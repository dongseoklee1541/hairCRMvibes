-- ==========================================
-- R-10: owner-only staff role management
--
-- Security contract
-- - profiles remains read-only to Data API users; all role writes use RPCs.
-- - mutation RPCs serialize on one transaction advisory lock before rechecking
--   the actor's owner role, so concurrent cross-demotions cannot remove every owner.
-- - role_management_events is append-only for Data API roles and stores no email.
-- ==========================================

create table public.role_management_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  target_user_id uuid not null,
  previous_role text,
  next_role text not null,
  event_type text not null,
  request_id uuid not null,
  changed_at timestamptz not null default clock_timestamp(),
  constraint role_management_events_previous_role_check check (
    previous_role is null or previous_role in ('owner', 'staff')
  ),
  constraint role_management_events_next_role_check check (
    next_role in ('owner', 'staff')
  ),
  constraint role_management_events_event_type_check check (
    event_type in (
      'staff_provisioned',
      'staff_provision_noop',
      'role_changed',
      'role_change_noop'
    )
  ),
  constraint role_management_events_shape_check check (
    (
      event_type = 'staff_provisioned'
      and previous_role is null
      and next_role = 'staff'
    )
    or (
      event_type = 'staff_provision_noop'
      and previous_role is not null
      and previous_role = next_role
    )
    or (
      event_type = 'role_changed'
      and previous_role is not null
      and previous_role <> next_role
    )
    or (
      event_type = 'role_change_noop'
      and previous_role is not null
      and previous_role = next_role
    )
  ),
  constraint role_management_events_request_id_key unique (request_id)
);

comment on table public.role_management_events is
  'Append-only R-10 role audit. Actor and target UUIDs are retained without email or Auth foreign keys so account deletion cannot erase the audit identity.';

alter table public.role_management_events enable row level security;

revoke all on table public.role_management_events from public;
revoke all on table public.role_management_events from anon;
revoke all on table public.role_management_events from authenticated;
revoke all on table public.role_management_events from service_role;
grant select on table public.role_management_events to authenticated;

drop policy if exists "Owners can read role management events"
  on public.role_management_events;
create policy "Owners can read role management events"
  on public.role_management_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'owner'
    )
  );

-- Preserve the R-01 escalation boundary explicitly. The RPC owner executes
-- profile writes; authenticated and anon users never receive direct write grants.
revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;

create or replace function public.list_staff_profiles()
returns table (
  user_id uuid,
  role text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role
  into v_actor_role
  from public.profiles p
  where p.id = v_actor;

  if v_actor_role is distinct from 'owner' then
    raise exception '직원 권한을 조회할 권한이 없습니다.' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.role,
    p.created_at,
    p.updated_at
  from public.profiles p
  order by
    case when p.role = 'owner' then 0 else 1 end,
    p.created_at,
    p.id;
end;
$$;

comment on function public.list_staff_profiles() is
  'Owner-only profile list. Returns IDs, roles, and timestamps without email or other Auth PII.';

create or replace function public.provision_invited_staff(
  p_user_id uuid,
  p_request_id uuid
)
returns table (
  target_user_id uuid,
  previous_role text,
  next_role text,
  event_type text,
  event_id uuid,
  request_id uuid,
  changed_at timestamptz,
  applied boolean,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_profile public.profiles%rowtype;
  v_event public.role_management_events%rowtype;
  v_previous_role text;
  v_next_role text;
  v_event_type text;
  v_applied boolean;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  if p_user_id is null or p_request_id is null then
    raise exception '사용자 ID와 요청 ID는 필수입니다.' using errcode = '22023';
  end if;

  -- Every supported profile mutation shares this transaction-scoped lock.
  perform pg_catalog.pg_advisory_xact_lock(20260713, 10);

  -- Recheck after waiting for the lock. The caller may have been demoted while
  -- another transaction held it.
  select p.role
  into v_actor_role
  from public.profiles p
  where p.id = v_actor;

  if v_actor_role is distinct from 'owner' then
    raise exception '직원 권한을 생성할 권한이 없습니다.' using errcode = '42501';
  end if;

  select e.*
  into v_event
  from public.role_management_events e
  where e.request_id = p_request_id;

  if found then
    if v_event.actor_id is distinct from v_actor
       or v_event.target_user_id is distinct from p_user_id
       or v_event.event_type not in ('staff_provisioned', 'staff_provision_noop') then
      raise exception '요청 ID가 다른 권한 작업에 사용되었습니다.' using errcode = '22023';
    end if;

    return query
    select
      v_event.target_user_id,
      v_event.previous_role,
      v_event.next_role,
      v_event.event_type,
      v_event.id,
      v_event.request_id,
      v_event.changed_at,
      false,
      true;
    return;
  end if;

  if not exists (
    select 1
    from auth.users u
    where u.id = p_user_id
  ) then
    raise exception '초대된 Auth 사용자를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  select p.*
  into v_profile
  from public.profiles p
  where p.id = p_user_id
  for update;

  if found then
    -- Existing staff remains staff, and an existing owner is never downgraded.
    v_previous_role := v_profile.role;
    v_next_role := v_profile.role;
    v_event_type := 'staff_provision_noop';
    v_applied := false;
  else
    insert into public.profiles (id, role)
    values (p_user_id, 'staff')
    returning * into v_profile;

    v_previous_role := null;
    v_next_role := 'staff';
    v_event_type := 'staff_provisioned';
    v_applied := true;
  end if;

  insert into public.role_management_events as e (
    actor_id,
    target_user_id,
    previous_role,
    next_role,
    event_type,
    request_id
  ) values (
    v_actor,
    p_user_id,
    v_previous_role,
    v_next_role,
    v_event_type,
    p_request_id
  )
  returning e.* into v_event;

  return query
  select
    v_event.target_user_id,
    v_event.previous_role,
    v_event.next_role,
    v_event.event_type,
    v_event.id,
    v_event.request_id,
    v_event.changed_at,
    v_applied,
    false;
end;
$$;

comment on function public.provision_invited_staff(uuid, uuid) is
  'Owner-only, idempotent profile provisioning for an Auth user already invited by the server. New profiles are always staff; existing roles are preserved.';

create or replace function public.change_staff_role(
  p_target_user_id uuid,
  p_next_role text,
  p_request_id uuid
)
returns table (
  target_user_id uuid,
  previous_role text,
  next_role text,
  event_type text,
  event_id uuid,
  request_id uuid,
  changed_at timestamptz,
  applied boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target public.profiles%rowtype;
  v_event public.role_management_events%rowtype;
  v_owner_count integer;
  v_event_type text;
  v_applied boolean;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  if p_target_user_id is null or p_next_role is null or p_request_id is null then
    raise exception '대상 사용자 ID, 역할, 요청 ID는 필수입니다.' using errcode = '22023';
  end if;

  if p_next_role not in ('owner', 'staff') then
    raise exception '역할은 owner 또는 staff만 허용됩니다.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(20260713, 10);

  -- This check intentionally occurs after lock acquisition.
  select p.role
  into v_actor_role
  from public.profiles p
  where p.id = v_actor;

  if v_actor_role is distinct from 'owner' then
    raise exception '직원 권한을 변경할 권한이 없습니다.' using errcode = '42501';
  end if;

  select e.*
  into v_event
  from public.role_management_events e
  where e.request_id = p_request_id;

  if found then
    if v_event.actor_id is distinct from v_actor
       or v_event.target_user_id is distinct from p_target_user_id
       or v_event.next_role is distinct from p_next_role
       or v_event.event_type not in ('role_changed', 'role_change_noop') then
      raise exception '요청 ID가 다른 권한 작업에 사용되었습니다.' using errcode = '22023';
    end if;

    return query
    select
      v_event.target_user_id,
      v_event.previous_role,
      v_event.next_role,
      v_event.event_type,
      v_event.id,
      v_event.request_id,
      v_event.changed_at,
      false;
    return;
  end if;

  select p.*
  into v_target
  from public.profiles p
  where p.id = p_target_user_id
  for update;

  if not found then
    raise exception '대상 직원 프로필을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_target.role = 'owner' and p_next_role = 'staff' then
    select count(*)::integer
    into v_owner_count
    from public.profiles p
    where p.role = 'owner';

    if v_owner_count <= 1 then
      raise exception '마지막 owner는 staff로 변경할 수 없습니다.' using errcode = '55000';
    end if;

    if p_target_user_id = v_actor then
      raise exception '자기 자신의 owner 권한은 변경할 수 없습니다.' using errcode = '55000';
    end if;
  end if;

  if v_target.role = p_next_role then
    v_event_type := 'role_change_noop';
    v_applied := false;
  else
    update public.profiles p
    set
      role = p_next_role,
      updated_at = pg_catalog.clock_timestamp()
    where p.id = p_target_user_id;

    v_event_type := 'role_changed';
    v_applied := true;
  end if;

  insert into public.role_management_events as e (
    actor_id,
    target_user_id,
    previous_role,
    next_role,
    event_type,
    request_id
  ) values (
    v_actor,
    p_target_user_id,
    v_target.role,
    p_next_role,
    v_event_type,
    p_request_id
  )
  returning e.* into v_event;

  return query
  select
    v_event.target_user_id,
    v_event.previous_role,
    v_event.next_role,
    v_event.event_type,
    v_event.id,
    v_event.request_id,
    v_event.changed_at,
    v_applied;
end;
$$;

comment on function public.change_staff_role(uuid, text, uuid) is
  'Owner-only, idempotent role mutation with actor recheck, target row lock, self-demotion prevention, and last-owner serialization.';

-- Functions in public receive PUBLIC EXECUTE by default on existing projects.
-- Close every implicit path, then reopen only the authenticated RPC contract.
revoke all on function public.list_staff_profiles() from public;
revoke all on function public.list_staff_profiles() from anon;
revoke all on function public.list_staff_profiles() from authenticated;
revoke all on function public.list_staff_profiles() from service_role;
grant execute on function public.list_staff_profiles() to authenticated;

revoke all on function public.provision_invited_staff(uuid, uuid) from public;
revoke all on function public.provision_invited_staff(uuid, uuid) from anon;
revoke all on function public.provision_invited_staff(uuid, uuid) from authenticated;
revoke all on function public.provision_invited_staff(uuid, uuid) from service_role;
grant execute on function public.provision_invited_staff(uuid, uuid) to authenticated;

revoke all on function public.change_staff_role(uuid, text, uuid) from public;
revoke all on function public.change_staff_role(uuid, text, uuid) from anon;
revoke all on function public.change_staff_role(uuid, text, uuid) from authenticated;
revoke all on function public.change_staff_role(uuid, text, uuid) from service_role;
grant execute on function public.change_staff_role(uuid, text, uuid) to authenticated;
