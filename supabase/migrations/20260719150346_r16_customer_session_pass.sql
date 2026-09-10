-- R-16: customer session passes and per-appointment usage ledger.
-- Remaining sessions are derived from reserved/consumed ledger rows.

create schema if not exists private;

create table public.customer_session_passes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  name text not null,
  eligible_service_id uuid references public.salon_service_defaults(id) on delete restrict,
  total_sessions integer not null,
  status text not null default 'active',
  purchased_on date not null,
  expires_on date,
  memo text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_session_passes_name_check check (
    nullif(btrim(name), '') is not null and char_length(btrim(name)) <= 120
  ),
  constraint customer_session_passes_total_sessions_check check (total_sessions >= 1),
  constraint customer_session_passes_status_check check (
    status in ('active', 'paused', 'cancelled')
  ),
  constraint customer_session_passes_expiry_check check (
    expires_on is null or expires_on >= purchased_on
  ),
  constraint customer_session_passes_memo_check check (
    memo is null or char_length(memo) <= 1000
  )
);

create table public.appointment_session_pass_usages (
  id uuid primary key default gen_random_uuid(),
  session_pass_id uuid not null references public.customer_session_passes(id) on delete restrict,
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  state text not null,
  units smallint not null default 1,
  reserved_at timestamptz not null default now(),
  reserved_by uuid references auth.users(id) on delete set null,
  consumed_at timestamptz,
  consumed_by uuid references auth.users(id) on delete set null,
  released_at timestamptz,
  released_by uuid references auth.users(id) on delete set null,
  release_reason text,
  constraint appointment_session_pass_usages_state_check check (
    state in ('reserved', 'consumed', 'released')
  ),
  constraint appointment_session_pass_usages_units_check check (units = 1),
  constraint appointment_session_pass_usages_state_fields_check check (
    (
      state = 'reserved'
      and released_at is null
      and released_by is null
      and release_reason is null
    )
    or (
      state = 'consumed'
      and consumed_at is not null
      and released_at is null
      and released_by is null
      and release_reason is null
    )
    or (
      state = 'released'
      and released_at is not null
      and release_reason is not null
    )
  ),
  constraint appointment_session_pass_usages_release_reason_check check (
    release_reason is null
    or release_reason in (
      'appointment_cancelled',
      'pass_changed',
      'service_changed',
      'pass_removed'
    )
  )
);

create unique index appointment_session_pass_usages_active_appointment_idx
  on public.appointment_session_pass_usages(appointment_id)
  where state in ('reserved', 'consumed');

create index customer_session_passes_customer_idx
  on public.customer_session_passes(customer_id, status, created_at desc);

create index customer_session_passes_service_idx
  on public.customer_session_passes(eligible_service_id)
  where eligible_service_id is not null;

create index appointment_session_pass_usages_pass_state_idx
  on public.appointment_session_pass_usages(session_pass_id, state, reserved_at desc);

create index appointment_session_pass_usages_appointment_idx
  on public.appointment_session_pass_usages(appointment_id, reserved_at desc);

create table private.appointment_mutation_requests (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  operation text not null,
  appointment_id uuid references public.appointments(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint appointment_mutation_requests_operation_check check (
    operation in ('create', 'update', 'status')
  ),
  constraint appointment_mutation_requests_completion_check check (
    completed_at is null or appointment_id is not null
  )
);

alter table public.customer_session_passes enable row level security;
alter table public.appointment_session_pass_usages enable row level security;
alter table private.appointment_mutation_requests enable row level security;

revoke all on schema private from public, anon, authenticated;
revoke all on table private.appointment_mutation_requests from public, anon, authenticated;

revoke all on table public.customer_session_passes from anon, authenticated;
revoke all on table public.appointment_session_pass_usages from anon, authenticated;
grant usage on schema public to authenticated;
grant select on table public.customer_session_passes to authenticated;
grant select on table public.appointment_session_pass_usages to authenticated;

create policy "Owner and staff can read customer session passes"
  on public.customer_session_passes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'staff')
    )
  );

create policy "Owner and staff can read appointment session pass usages"
  on public.appointment_session_pass_usages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'staff')
    )
  );

create or replace function private.r16_require_actor(p_owner_only boolean default false)
returns table (actor_id uuid, actor_role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  select p.role
  into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role is null or v_role not in ('owner', 'staff') then
    raise exception '작업 권한이 없습니다.' using errcode = '42501';
  end if;

  if p_owner_only and v_role is distinct from 'owner' then
    raise exception '원장 계정에서만 횟수권을 관리할 수 있습니다.' using errcode = '42501';
  end if;

  return query select v_actor, v_role;
end;
$$;

create or replace function private.r16_remaining_sessions(p_session_pass_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    sp.total_sessions - coalesce(sum(u.units) filter (
      where u.state in ('reserved', 'consumed')
    ), 0)::integer,
    0
  )
  from public.customer_session_passes sp
  left join public.appointment_session_pass_usages u
    on u.session_pass_id = sp.id
  where sp.id = p_session_pass_id
  group by sp.total_sessions;
$$;

create or replace function private.r16_claim_appointment_request(
  p_request_id uuid,
  p_actor_id uuid,
  p_operation text,
  p_appointment_id uuid default null
)
returns table (is_new boolean, stored_appointment_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer := 0;
  v_existing private.appointment_mutation_requests%rowtype;
begin
  if p_request_id is null then
    raise exception '요청 ID는 필수입니다.' using errcode = '22023';
  end if;

  if p_operation not in ('create', 'update', 'status') then
    raise exception '지원하지 않는 예약 mutation입니다.' using errcode = '22023';
  end if;

  insert into private.appointment_mutation_requests (
    request_id,
    actor_id,
    operation,
    appointment_id
  ) values (
    p_request_id,
    p_actor_id,
    p_operation,
    p_appointment_id
  )
  on conflict (request_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    return query select true, p_appointment_id;
    return;
  end if;

  select r.*
  into v_existing
  from private.appointment_mutation_requests r
  where r.request_id = p_request_id
  for update;

  if v_existing.actor_id is distinct from p_actor_id
     or v_existing.operation is distinct from p_operation
     or (
       p_operation <> 'create'
       and v_existing.appointment_id is distinct from p_appointment_id
     ) then
    raise exception '같은 요청 ID를 다른 예약 작업에 재사용할 수 없습니다.'
      using errcode = '22023';
  end if;

  if v_existing.completed_at is null or v_existing.appointment_id is null then
    raise exception '이전 요청 결과가 완성되지 않았습니다. 새 요청 ID로 다시 시도하세요.'
      using errcode = '40001';
  end if;

  return query select false, v_existing.appointment_id;
end;
$$;

create or replace function private.r16_appointment_response(p_appointment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'appointment_id', a.id,
    'status', a.status,
    'session_pass_id', u.session_pass_id,
    'usage_state', u.state,
    'remaining_sessions', case
      when u.session_pass_id is null then null
      else private.r16_remaining_sessions(u.session_pass_id)
    end
  )
  from public.appointments a
  left join lateral (
    select au.session_pass_id, au.state
    from public.appointment_session_pass_usages au
    where au.appointment_id = a.id
      and au.state in ('reserved', 'consumed')
    order by au.reserved_at desc, au.id desc
    limit 1
  ) u on true
  where a.id = p_appointment_id;
$$;

revoke all on function private.r16_require_actor(boolean) from public, anon, authenticated;
revoke all on function private.r16_remaining_sessions(uuid) from public, anon, authenticated;
revoke all on function private.r16_claim_appointment_request(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function private.r16_appointment_response(uuid) from public, anon, authenticated;

create or replace function public.create_customer_session_pass(
  p_customer_id uuid,
  p_name text,
  p_eligible_service_id uuid,
  p_total_sessions integer,
  p_purchased_on date,
  p_expires_on date default null,
  p_memo text default null
)
returns public.customer_session_passes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_role text;
  v_customer public.customers%rowtype;
  v_pass public.customer_session_passes%rowtype;
  v_purchased_on date := coalesce(
    p_purchased_on,
    (pg_catalog.timezone('Asia/Seoul', pg_catalog.clock_timestamp()))::date
  );
begin
  select actor_id, actor_role into v_actor, v_role
  from private.r16_require_actor(true);

  if p_customer_id is null then
    raise exception '고객 ID는 필수입니다.' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception '횟수권 이름은 필수입니다.' using errcode = '22023';
  end if;
  if p_total_sessions is null or p_total_sessions < 1 then
    raise exception '총 횟수는 1회 이상이어야 합니다.' using errcode = '22023';
  end if;
  if p_expires_on is not null and p_expires_on < v_purchased_on then
    raise exception '만료일은 구매일보다 빠를 수 없습니다.' using errcode = '22023';
  end if;

  select c.*
  into v_customer
  from public.customers c
  where c.id = p_customer_id
  for update;

  if not found then
    raise exception '고객을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  if v_customer.archived_at is not null
     or v_customer.merged_into_customer_id is not null
     or v_customer.anonymized_at is not null then
    raise exception '활성 고객에게만 횟수권을 등록할 수 있습니다.' using errcode = '55000';
  end if;

  if p_eligible_service_id is not null
     and not exists (
       select 1
       from public.salon_service_defaults s
       where s.id = p_eligible_service_id
         and s.is_active is true
     ) then
    raise exception '사용 중인 시술만 횟수권 대상 시술로 선택할 수 있습니다.'
      using errcode = '55000';
  end if;

  insert into public.customer_session_passes (
    customer_id,
    name,
    eligible_service_id,
    total_sessions,
    status,
    purchased_on,
    expires_on,
    memo,
    created_by,
    updated_by
  ) values (
    p_customer_id,
    btrim(p_name),
    p_eligible_service_id,
    p_total_sessions,
    'active',
    v_purchased_on,
    p_expires_on,
    nullif(btrim(coalesce(p_memo, '')), ''),
    v_actor,
    v_actor
  )
  returning * into v_pass;

  return v_pass;
end;
$$;

create or replace function public.update_customer_session_pass(
  p_session_pass_id uuid,
  p_name text,
  p_eligible_service_id uuid,
  p_total_sessions integer,
  p_purchased_on date,
  p_expires_on date,
  p_memo text,
  p_status text,
  p_expected_updated_at timestamptz
)
returns public.customer_session_passes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_role text;
  v_customer_id uuid;
  v_pass public.customer_session_passes%rowtype;
  v_active_units integer := 0;
begin
  select actor_id, actor_role into v_actor, v_role
  from private.r16_require_actor(true);

  if p_session_pass_id is null then
    raise exception '횟수권 ID는 필수입니다.' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception '횟수권 이름은 필수입니다.' using errcode = '22023';
  end if;
  if p_total_sessions is null or p_total_sessions < 1 then
    raise exception '총 횟수는 1회 이상이어야 합니다.' using errcode = '22023';
  end if;
  if p_purchased_on is null then
    raise exception '구매일은 필수입니다.' using errcode = '22023';
  end if;
  if p_expires_on is not null and p_expires_on < p_purchased_on then
    raise exception '만료일은 구매일보다 빠를 수 없습니다.' using errcode = '22023';
  end if;
  if p_status not in ('active', 'paused', 'cancelled') then
    raise exception '지원하지 않는 횟수권 상태입니다.' using errcode = '22023';
  end if;

  select sp.customer_id
  into v_customer_id
  from public.customer_session_passes sp
  where sp.id = p_session_pass_id;

  if not found then
    raise exception '횟수권을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  perform 1
  from public.customers c
  where c.id = v_customer_id
  for update;

  select sp.*
  into v_pass
  from public.customer_session_passes sp
  where sp.id = p_session_pass_id
  for update;

  if v_pass.updated_at is distinct from p_expected_updated_at then
    raise exception '다른 사용자가 횟수권을 먼저 수정했습니다. 최신 값을 다시 불러오세요.'
      using errcode = '40001';
  end if;

  if v_pass.status = 'cancelled' and p_status <> 'cancelled' then
    raise exception '취소된 횟수권은 다시 활성화할 수 없습니다.' using errcode = '55000';
  end if;

  select coalesce(sum(u.units), 0)::integer
  into v_active_units
  from public.appointment_session_pass_usages u
  where u.session_pass_id = p_session_pass_id
    and u.state in ('reserved', 'consumed');

  if p_total_sessions < v_active_units then
    raise exception '총 횟수는 예약 확보와 사용 완료 합계보다 작게 줄일 수 없습니다.'
      using errcode = '22023';
  end if;

  if p_status = 'cancelled'
     and exists (
       select 1
       from public.appointment_session_pass_usages u
       where u.session_pass_id = p_session_pass_id
         and u.state = 'reserved'
     ) then
    raise exception '예약 확보 중인 횟수권은 예약을 먼저 해제해야 취소할 수 있습니다.'
      using errcode = '55000';
  end if;

  if p_eligible_service_id is distinct from v_pass.eligible_service_id
     and exists (
       select 1
       from public.appointment_session_pass_usages u
       where u.session_pass_id = p_session_pass_id
     ) then
    raise exception '사용 이력이 있는 횟수권의 대상 시술은 변경할 수 없습니다.'
      using errcode = '55000';
  end if;

  if p_eligible_service_id is not null
     and not exists (
       select 1
       from public.salon_service_defaults s
       where s.id = p_eligible_service_id
     ) then
    raise exception '대상 시술을 찾을 수 없습니다.' using errcode = '23503';
  end if;

  update public.customer_session_passes sp
  set
    name = btrim(p_name),
    eligible_service_id = p_eligible_service_id,
    total_sessions = p_total_sessions,
    purchased_on = p_purchased_on,
    expires_on = p_expires_on,
    memo = nullif(btrim(coalesce(p_memo, '')), ''),
    status = p_status,
    updated_by = v_actor,
    updated_at = pg_catalog.clock_timestamp()
  where sp.id = p_session_pass_id
  returning * into v_pass;

  return v_pass;
end;
$$;

create or replace function public.list_customer_session_passes(p_customer_id uuid)
returns table (
  id uuid,
  customer_id uuid,
  name text,
  eligible_service_id uuid,
  eligible_service_name text,
  eligible_service_active boolean,
  total_sessions integer,
  reserved_sessions integer,
  consumed_sessions integer,
  remaining_sessions integer,
  status text,
  display_status text,
  purchased_on date,
  expires_on date,
  memo text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_role text;
  v_today date := (pg_catalog.timezone('Asia/Seoul', pg_catalog.clock_timestamp()))::date;
begin
  select actor_id, actor_role into v_actor, v_role
  from private.r16_require_actor(false);

  return query
  select
    sp.id,
    sp.customer_id,
    sp.name,
    sp.eligible_service_id,
    s.name,
    s.is_active,
    sp.total_sessions,
    coalesce(sum(u.units) filter (where u.state = 'reserved'), 0)::integer,
    coalesce(sum(u.units) filter (where u.state = 'consumed'), 0)::integer,
    greatest(
      sp.total_sessions - coalesce(sum(u.units) filter (
        where u.state in ('reserved', 'consumed')
      ), 0)::integer,
      0
    ),
    sp.status,
    case
      when sp.status = 'cancelled' then 'cancelled'
      when sp.status = 'paused' then 'paused'
      when sp.expires_on is not null and sp.expires_on < v_today then 'expired'
      when sp.total_sessions - coalesce(sum(u.units) filter (
        where u.state in ('reserved', 'consumed')
      ), 0)::integer <= 0 then 'exhausted'
      else 'active'
    end,
    sp.purchased_on,
    sp.expires_on,
    sp.memo,
    sp.updated_at
  from public.customer_session_passes sp
  left join public.salon_service_defaults s on s.id = sp.eligible_service_id
  left join public.appointment_session_pass_usages u on u.session_pass_id = sp.id
  where sp.customer_id = p_customer_id
  group by sp.id, s.name, s.is_active
  order by
    case sp.status when 'active' then 0 when 'paused' then 1 else 2 end,
    sp.expires_on nulls last,
    sp.created_at desc;
end;
$$;

create or replace function public.list_appointment_session_pass_options(
  p_customer_id uuid,
  p_service_id uuid
)
returns table (
  id uuid,
  name text,
  total_sessions integer,
  remaining_sessions integer,
  status text,
  expires_on date,
  eligible_service_id uuid,
  is_available boolean,
  unavailable_reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_role text;
  v_today date := (pg_catalog.timezone('Asia/Seoul', pg_catalog.clock_timestamp()))::date;
begin
  select actor_id, actor_role into v_actor, v_role
  from private.r16_require_actor(false);

  return query
  with pass_counts as (
    select
      sp.*,
      greatest(
        sp.total_sessions - coalesce(sum(u.units) filter (
          where u.state in ('reserved', 'consumed')
        ), 0)::integer,
        0
      ) as remaining
    from public.customer_session_passes sp
    left join public.appointment_session_pass_usages u on u.session_pass_id = sp.id
    where sp.customer_id = p_customer_id
    group by sp.id
  )
  select
    pc.id,
    pc.name,
    pc.total_sessions,
    pc.remaining,
    pc.status,
    pc.expires_on,
    pc.eligible_service_id,
    (
      pc.status = 'active'
      and (pc.expires_on is null or pc.expires_on >= v_today)
      and pc.remaining > 0
      and p_service_id is not null
      and (pc.eligible_service_id is null or pc.eligible_service_id = p_service_id)
      and exists (
        select 1
        from public.customers c
        where c.id = pc.customer_id
          and c.archived_at is null
          and c.merged_into_customer_id is null
          and c.anonymized_at is null
      )
    ),
    case
      when pc.status = 'paused' then 'paused'
      when pc.status = 'cancelled' then 'cancelled'
      when pc.expires_on is not null and pc.expires_on < v_today then 'expired'
      when pc.remaining <= 0 then 'exhausted'
      when p_service_id is null then 'service_required'
      when pc.eligible_service_id is not null and pc.eligible_service_id <> p_service_id then 'service_mismatch'
      when exists (
        select 1
        from public.customers c
        where c.id = pc.customer_id
          and (
            c.archived_at is not null
            or c.merged_into_customer_id is not null
            or c.anonymized_at is not null
          )
      ) then 'customer_inactive'
      else null
    end
  from pass_counts pc
  order by
    case
      when pc.status = 'active'
        and (pc.expires_on is null or pc.expires_on >= v_today)
        and pc.remaining > 0
        and p_service_id is not null
        and (pc.eligible_service_id is null or pc.eligible_service_id = p_service_id)
      then 0 else 1
    end,
    pc.expires_on nulls last,
    pc.created_at desc;
end;
$$;

revoke all on function public.create_customer_session_pass(uuid, text, uuid, integer, date, date, text) from public, anon, authenticated;
grant execute on function public.create_customer_session_pass(uuid, text, uuid, integer, date, date, text) to authenticated;

revoke all on function public.update_customer_session_pass(uuid, text, uuid, integer, date, date, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.update_customer_session_pass(uuid, text, uuid, integer, date, date, text, text, timestamptz) to authenticated;

revoke all on function public.list_customer_session_passes(uuid) from public, anon, authenticated;
grant execute on function public.list_customer_session_passes(uuid) to authenticated;

revoke all on function public.list_appointment_session_pass_options(uuid, uuid) from public, anon, authenticated;
grant execute on function public.list_appointment_session_pass_options(uuid, uuid) to authenticated;

create or replace function private.r16_transition_appointment_usage(
  p_appointment_id uuid,
  p_customer_id uuid,
  p_service_id uuid,
  p_status text,
  p_session_pass_id uuid,
  p_actor_id uuid,
  p_release_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usage public.appointment_session_pass_usages%rowtype;
  v_pass public.customer_session_passes%rowtype;
  v_remaining integer;
  v_next_state text;
  v_today date := (pg_catalog.timezone('Asia/Seoul', pg_catalog.clock_timestamp()))::date;
begin
  select u.*
  into v_usage
  from public.appointment_session_pass_usages u
  where u.appointment_id = p_appointment_id
    and u.state in ('reserved', 'consumed')
  order by u.reserved_at desc, u.id desc
  limit 1
  for update;

  if p_status = 'cancelled' then
    if p_session_pass_id is not null then
      raise exception '취소 예약에는 횟수권을 선택할 수 없습니다.' using errcode = '22023';
    end if;

    if v_usage.id is not null then
      update public.appointment_session_pass_usages u
      set
        state = 'released',
        released_at = pg_catalog.clock_timestamp(),
        released_by = p_actor_id,
        release_reason = 'appointment_cancelled'
      where u.id = v_usage.id;
      return v_usage.id;
    end if;

    return null;
  end if;

  if p_status not in ('confirmed', 'completed') then
    raise exception '지원하지 않는 예약 상태입니다.' using errcode = '22023';
  end if;

  v_next_state := case when p_status = 'completed' then 'consumed' else 'reserved' end;

  if p_session_pass_id is null then
    if v_usage.id is not null then
      update public.appointment_session_pass_usages u
      set
        state = 'released',
        released_at = pg_catalog.clock_timestamp(),
        released_by = p_actor_id,
        release_reason = case
          when p_release_reason in ('service_changed', 'pass_removed') then p_release_reason
          else 'pass_removed'
        end
      where u.id = v_usage.id;
      return v_usage.id;
    end if;

    return null;
  end if;

  if p_service_id is null then
    raise exception '서비스가 연결된 예약에서만 횟수권을 사용할 수 있습니다.'
      using errcode = '22023';
  end if;

  select sp.*
  into v_pass
  from public.customer_session_passes sp
  where sp.id = p_session_pass_id;

  if not found then
    raise exception '횟수권을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_pass.customer_id is distinct from p_customer_id then
    raise exception '예약 고객이 소유한 횟수권만 사용할 수 있습니다.' using errcode = '42501';
  end if;

  if v_pass.eligible_service_id is not null
     and v_pass.eligible_service_id is distinct from p_service_id then
    raise exception '선택한 횟수권은 이 시술에 사용할 수 없습니다.' using errcode = '22023';
  end if;

  if v_usage.id is not null
     and v_usage.session_pass_id = p_session_pass_id then
    if v_pass.status = 'cancelled'
       and v_usage.state = 'consumed'
       and p_status = 'confirmed' then
      raise exception '취소된 횟수권으로 완료 예약을 다시 확정할 수 없습니다.'
        using errcode = '55000';
    end if;

    if v_next_state = 'reserved' then
      update public.appointment_session_pass_usages u
      set
        state = 'reserved',
        reserved_at = case
          when u.state = 'consumed' then pg_catalog.clock_timestamp()
          else u.reserved_at
        end,
        reserved_by = case
          when u.state = 'consumed' then p_actor_id
          else u.reserved_by
        end,
        released_at = null,
        released_by = null,
        release_reason = null
      where u.id = v_usage.id;
    else
      update public.appointment_session_pass_usages u
      set
        state = 'consumed',
        consumed_at = case
          when u.state = 'consumed' then u.consumed_at
          else pg_catalog.clock_timestamp()
        end,
        consumed_by = case
          when u.state = 'consumed' then u.consumed_by
          else p_actor_id
        end,
        released_at = null,
        released_by = null,
        release_reason = null
      where u.id = v_usage.id;
    end if;

    return v_usage.id;
  end if;

  if v_pass.status <> 'active' then
    raise exception '사용 중인 횟수권만 새 예약에 사용할 수 있습니다.' using errcode = '55000';
  end if;
  if v_pass.expires_on is not null and v_pass.expires_on < v_today then
    raise exception '만료된 횟수권은 새 예약에 사용할 수 없습니다.' using errcode = '55000';
  end if;
  if not exists (
    select 1
    from public.customers c
    where c.id = p_customer_id
      and c.archived_at is null
      and c.merged_into_customer_id is null
      and c.anonymized_at is null
  ) then
    raise exception '활성 고객의 예약에서만 횟수권을 사용할 수 있습니다.'
      using errcode = '55000';
  end if;

  if v_usage.id is not null then
    update public.appointment_session_pass_usages u
    set
      state = 'released',
      released_at = pg_catalog.clock_timestamp(),
      released_by = p_actor_id,
      release_reason = case
        when p_release_reason = 'service_changed' then 'service_changed'
        else 'pass_changed'
      end
    where u.id = v_usage.id;
  end if;

  v_remaining := private.r16_remaining_sessions(p_session_pass_id);
  if v_remaining is null or v_remaining < 1 then
    raise exception '횟수권의 남은 횟수가 없습니다.' using errcode = '55000';
  end if;

  insert into public.appointment_session_pass_usages (
    session_pass_id,
    appointment_id,
    state,
    units,
    reserved_at,
    reserved_by,
    consumed_at,
    consumed_by
  ) values (
    p_session_pass_id,
    p_appointment_id,
    v_next_state,
    1,
    pg_catalog.clock_timestamp(),
    p_actor_id,
    case when v_next_state = 'consumed' then pg_catalog.clock_timestamp() else null end,
    case when v_next_state = 'consumed' then p_actor_id else null end
  )
  returning id into v_usage.id;

  return v_usage.id;
end;
$$;

revoke all on function private.r16_transition_appointment_usage(uuid, uuid, uuid, text, uuid, uuid, text) from public, anon, authenticated;

create or replace function public.create_appointment_with_session_pass(
  p_request_id uuid,
  p_customer_id uuid,
  p_date date,
  p_time time,
  p_service_id uuid,
  p_service text,
  p_duration text,
  p_duration_minutes integer,
  p_memo text,
  p_status text default 'confirmed',
  p_session_pass_id uuid default null,
  p_actual_price_krw integer default null,
  p_actual_price_update_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_role text;
  v_claim record;
  v_customer public.customers%rowtype;
  v_appointment_id uuid;
begin
  select actor_id, actor_role into v_actor, v_role
  from private.r16_require_actor(false);

  if p_status not in ('confirmed', 'completed') then
    raise exception '신규 예약은 확정 또는 완료 상태만 허용됩니다.' using errcode = '22023';
  end if;
  if p_customer_id is null or p_date is null or p_time is null then
    raise exception '고객, 날짜, 시간은 필수입니다.' using errcode = '22023';
  end if;
  if p_service_id is null
     and (p_status <> 'completed' or nullif(btrim(coalesce(p_service, '')), '') is null) then
    raise exception '확정 예약에는 서비스가 필요하며 자유입력은 완료 이력만 허용됩니다.'
      using errcode = '22023';
  end if;
  if p_actual_price_krw is not null and p_actual_price_krw < 0 then
    raise exception '실제 금액은 0원 이상이어야 합니다.' using errcode = '22023';
  end if;
  if p_status = 'completed'
     and p_actual_price_krw is not null
     and nullif(btrim(coalesce(p_actual_price_update_reason, '')), '') is null then
    raise exception '완료 이력의 실제 금액 변경 사유가 필요합니다.' using errcode = '22023';
  end if;

  select * into v_claim
  from private.r16_claim_appointment_request(
    p_request_id,
    v_actor,
    'create',
    null
  );

  if v_claim.is_new is false then
    return private.r16_appointment_response(v_claim.stored_appointment_id);
  end if;

  select c.*
  into v_customer
  from public.customers c
  where c.id = p_customer_id
  for update;

  if not found then
    raise exception '고객을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  if v_customer.archived_at is not null
     or v_customer.merged_into_customer_id is not null
     or v_customer.anonymized_at is not null then
    raise exception '활성 고객에게만 예약을 등록할 수 있습니다.' using errcode = '55000';
  end if;

  if p_session_pass_id is not null then
    perform 1
    from public.customer_session_passes sp
    where sp.id = p_session_pass_id
    order by sp.id
    for update;

    if not found then
      raise exception '횟수권을 찾을 수 없습니다.' using errcode = 'P0002';
    end if;
  end if;

  insert into public.appointments (
    customer_id,
    date,
    time,
    service,
    service_id,
    duration,
    duration_minutes,
    memo,
    status,
    actual_price_krw,
    actual_price_update_reason
  ) values (
    p_customer_id,
    p_date,
    p_time,
    coalesce(nullif(btrim(coalesce(p_service, '')), ''), '시술'),
    p_service_id,
    p_duration,
    p_duration_minutes,
    nullif(btrim(coalesce(p_memo, '')), ''),
    p_status,
    p_actual_price_krw,
    nullif(btrim(coalesce(p_actual_price_update_reason, '')), '')
  )
  returning id into v_appointment_id;

  perform private.r16_transition_appointment_usage(
    v_appointment_id,
    p_customer_id,
    p_service_id,
    p_status,
    p_session_pass_id,
    v_actor,
    'pass_changed'
  );

  update private.appointment_mutation_requests r
  set
    appointment_id = v_appointment_id,
    completed_at = pg_catalog.clock_timestamp()
  where r.request_id = p_request_id;

  return private.r16_appointment_response(v_appointment_id);
end;
$$;

create or replace function public.update_appointment_with_session_pass(
  p_request_id uuid,
  p_appointment_id uuid,
  p_date date,
  p_time time,
  p_service_id uuid,
  p_service text,
  p_duration text,
  p_duration_minutes integer,
  p_memo text,
  p_session_pass_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_role text;
  v_claim record;
  v_locked_customer_id uuid;
  v_customer_id uuid;
  v_current_pass_id uuid;
  v_appointment public.appointments%rowtype;
  v_release_reason text;
begin
  select actor_id, actor_role into v_actor, v_role
  from private.r16_require_actor(false);

  if p_appointment_id is null then
    raise exception '예약 ID는 필수입니다.' using errcode = '22023';
  end if;
  if p_date is null or p_time is null then
    raise exception '날짜와 시간은 필수입니다.' using errcode = '22023';
  end if;

  select * into v_claim
  from private.r16_claim_appointment_request(
    p_request_id,
    v_actor,
    'update',
    p_appointment_id
  );

  if v_claim.is_new is false then
    return private.r16_appointment_response(v_claim.stored_appointment_id);
  end if;

  select a.customer_id
  into v_locked_customer_id
  from public.appointments a
  where a.id = p_appointment_id;

  if not found then
    raise exception '예약을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  perform 1
  from public.customers c
  where c.id = v_locked_customer_id
  for update;

  select a.customer_id
  into v_customer_id
  from public.appointments a
  where a.id = p_appointment_id;

  if not found then
    raise exception '예약을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  select u.session_pass_id
  into v_current_pass_id
  from public.appointment_session_pass_usages u
  where u.appointment_id = p_appointment_id
    and u.state in ('reserved', 'consumed')
  order by u.reserved_at desc, u.id desc
  limit 1;

  perform 1
  from public.customer_session_passes sp
  where sp.id = any(
    array_remove(array[v_current_pass_id, p_session_pass_id]::uuid[], null)
  )
  order by sp.id
  for update;

  select a.*
  into v_appointment
  from public.appointments a
  where a.id = p_appointment_id
  for update;

  if v_customer_id is distinct from v_locked_customer_id
     or v_appointment.customer_id is distinct from v_locked_customer_id then
    raise exception '예약 고객이 동시에 변경되었습니다. 최신 값을 다시 불러오세요.'
      using errcode = '40001';
  end if;
  if v_appointment.status = 'cancelled' and p_session_pass_id is not null then
    raise exception '취소 예약은 재확정할 때 횟수권을 선택해야 합니다.' using errcode = '22023';
  end if;

  v_release_reason := case
    when p_service_id is distinct from v_appointment.service_id then 'service_changed'
    when p_session_pass_id is null then 'pass_removed'
    else 'pass_changed'
  end;

  update public.appointments a
  set
    date = p_date,
    time = p_time,
    service_id = p_service_id,
    service = coalesce(nullif(btrim(coalesce(p_service, '')), ''), a.service),
    duration = p_duration,
    duration_minutes = p_duration_minutes,
    memo = nullif(btrim(coalesce(p_memo, '')), ''),
    updated_at = pg_catalog.clock_timestamp()
  where a.id = p_appointment_id;

  perform private.r16_transition_appointment_usage(
    p_appointment_id,
    v_appointment.customer_id,
    p_service_id,
    v_appointment.status,
    case when v_appointment.status = 'cancelled' then null else p_session_pass_id end,
    v_actor,
    v_release_reason
  );

  update private.appointment_mutation_requests r
  set completed_at = pg_catalog.clock_timestamp()
  where r.request_id = p_request_id;

  return private.r16_appointment_response(p_appointment_id);
end;
$$;

revoke all on function public.set_appointment_status(uuid, text, text) from public, anon, authenticated;
drop function public.set_appointment_status(uuid, text, text);

create function public.set_appointment_status(
  p_request_id uuid,
  p_appointment_id uuid,
  p_status text,
  p_cancel_reason text default null,
  p_session_pass_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_role text;
  v_claim record;
  v_locked_customer_id uuid;
  v_customer_id uuid;
  v_current_pass_id uuid;
  v_appointment public.appointments%rowtype;
begin
  select actor_id, actor_role into v_actor, v_role
  from private.r16_require_actor(false);

  if p_appointment_id is null then
    raise exception '예약 ID는 필수입니다.' using errcode = '22023';
  end if;
  if p_status not in ('confirmed', 'completed', 'cancelled') then
    raise exception '지원하지 않는 예약 상태입니다.' using errcode = '22023';
  end if;
  if p_status = 'cancelled' and p_session_pass_id is not null then
    raise exception '취소 상태에는 횟수권을 선택할 수 없습니다.' using errcode = '22023';
  end if;

  select * into v_claim
  from private.r16_claim_appointment_request(
    p_request_id,
    v_actor,
    'status',
    p_appointment_id
  );

  if v_claim.is_new is false then
    return private.r16_appointment_response(v_claim.stored_appointment_id);
  end if;

  select a.customer_id
  into v_locked_customer_id
  from public.appointments a
  where a.id = p_appointment_id;

  if not found then
    raise exception '예약을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  perform 1
  from public.customers c
  where c.id = v_locked_customer_id
  for update;

  select a.customer_id
  into v_customer_id
  from public.appointments a
  where a.id = p_appointment_id;

  if not found then
    raise exception '예약을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  select u.session_pass_id
  into v_current_pass_id
  from public.appointment_session_pass_usages u
  where u.appointment_id = p_appointment_id
    and u.state in ('reserved', 'consumed')
  order by u.reserved_at desc, u.id desc
  limit 1;

  perform 1
  from public.customer_session_passes sp
  where sp.id = any(
    array_remove(array[v_current_pass_id, p_session_pass_id]::uuid[], null)
  )
  order by sp.id
  for update;

  select a.*
  into v_appointment
  from public.appointments a
  where a.id = p_appointment_id
  for update;

  if v_customer_id is distinct from v_locked_customer_id
     or v_appointment.customer_id is distinct from v_locked_customer_id then
    raise exception '예약 고객이 동시에 변경되었습니다. 최신 값을 다시 불러오세요.'
      using errcode = '40001';
  end if;

  update public.appointments a
  set
    status = p_status,
    cancelled_reason = case
      when p_status = 'cancelled' then coalesce(nullif(btrim(p_cancel_reason), ''), 'manual')
      else null
    end,
    cancelled_by = case when p_status = 'cancelled' then v_actor else null end,
    cancelled_at = case
      when p_status = 'cancelled' then pg_catalog.clock_timestamp()
      else null
    end,
    updated_at = pg_catalog.clock_timestamp()
  where a.id = p_appointment_id;

  perform private.r16_transition_appointment_usage(
    p_appointment_id,
    v_appointment.customer_id,
    v_appointment.service_id,
    p_status,
    case when p_status = 'cancelled' then null else p_session_pass_id end,
    v_actor,
    case when p_status = 'cancelled' then 'appointment_cancelled' else 'pass_changed' end
  );

  update private.appointment_mutation_requests r
  set completed_at = pg_catalog.clock_timestamp()
  where r.request_id = p_request_id;

  return private.r16_appointment_response(p_appointment_id);
end;
$$;

revoke all on function public.create_appointment_with_session_pass(uuid, uuid, date, time, uuid, text, text, integer, text, text, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.create_appointment_with_session_pass(uuid, uuid, date, time, uuid, text, text, integer, text, text, uuid, integer, text) to authenticated;

revoke all on function public.update_appointment_with_session_pass(uuid, uuid, date, time, uuid, text, text, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.update_appointment_with_session_pass(uuid, uuid, date, time, uuid, text, text, integer, text, uuid) to authenticated;

revoke all on function public.set_appointment_status(uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.set_appointment_status(uuid, uuid, text, text, uuid) to authenticated;

revoke all on table public.appointments from anon, authenticated;
grant select on table public.appointments to authenticated;

create or replace function public.apply_closed_day_with_cancellations(
  p_closed_date date,
  p_cancel_ids uuid[] default '{}',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_role text;
  v_cancel_ids uuid[] := '{}'::uuid[];
  v_remaining integer := 0;
  v_applied integer := 0;
  v_released integer := 0;
begin
  select actor_id, actor_role into v_actor, v_role
  from private.r16_require_actor(true);

  if p_closed_date is null then
    raise exception '휴무일 날짜는 필수입니다.' using errcode = '22023';
  end if;

  select coalesce(array_agg(a.id order by a.id), '{}'::uuid[])
  into v_cancel_ids
  from public.appointments a
  where a.id = any(coalesce(p_cancel_ids, '{}'::uuid[]))
    and a.date = p_closed_date
    and a.status = 'confirmed';

  perform 1
  from public.customers c
  where c.id in (
    select distinct a.customer_id
    from public.appointments a
    where a.id = any(v_cancel_ids)
  )
  order by c.id
  for update;

  perform 1
  from public.customer_session_passes sp
  where sp.id in (
    select distinct u.session_pass_id
    from public.appointment_session_pass_usages u
    where u.appointment_id = any(v_cancel_ids)
      and u.state in ('reserved', 'consumed')
  )
  order by sp.id
  for update;

  perform 1
  from public.appointments a
  where a.id = any(v_cancel_ids)
  order by a.id
  for update;

  if coalesce(array_length(v_cancel_ids, 1), 0) > 0 then
    update public.appointments a
    set
      status = 'cancelled',
      cancelled_reason = 'closed_day',
      cancelled_by = v_actor,
      cancelled_at = pg_catalog.clock_timestamp(),
      updated_at = pg_catalog.clock_timestamp()
    where a.id = any(v_cancel_ids)
      and a.status = 'confirmed';

    get diagnostics v_applied = row_count;

    update public.appointment_session_pass_usages u
    set
      state = 'released',
      released_at = pg_catalog.clock_timestamp(),
      released_by = v_actor,
      release_reason = 'appointment_cancelled'
    where u.appointment_id = any(v_cancel_ids)
      and u.state in ('reserved', 'consumed');

    get diagnostics v_released = row_count;
  end if;

  select count(*)::integer
  into v_remaining
  from public.appointments a
  where a.date = p_closed_date
    and a.status = 'confirmed';

  if v_remaining > 0 then
    raise exception '해당 날짜에 confirmed 예약이 남아 있어 휴무일로 저장할 수 없습니다.'
      using errcode = 'P0001';
  end if;

  insert into public.salon_closed_dates (
    closed_date,
    note,
    created_by,
    updated_by
  ) values (
    p_closed_date,
    p_note,
    v_actor,
    v_actor
  )
  on conflict (closed_date) do update
  set
    note = excluded.note,
    updated_by = v_actor,
    updated_at = pg_catalog.clock_timestamp();

  return jsonb_build_object(
    'closed_date', p_closed_date,
    'cancelled_count', v_applied,
    'released_session_count', v_released,
    'remaining_confirmed', v_remaining
  );
end;
$$;

create or replace function public.apply_closed_days_batch_with_cancellations(
  p_mode text,
  p_start_date date,
  p_end_date date,
  p_weekday int default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_role text;
  v_span_days integer;
  v_target_dates date[] := '{}'::date[];
  v_target_count integer := 0;
  v_appointment_ids uuid[] := '{}'::uuid[];
  v_cancelled_count integer := 0;
  v_released_count integer := 0;
  v_remaining integer := 0;
begin
  select actor_id, actor_role into v_actor, v_role
  from private.r16_require_actor(true);

  if p_mode not in ('range', 'weekly') then
    raise exception 'p_mode는 range 또는 weekly 여야 합니다.' using errcode = '22023';
  end if;
  if p_start_date is null or p_end_date is null then
    raise exception '시작일과 종료일은 필수입니다.' using errcode = '22023';
  end if;
  if p_end_date < p_start_date then
    raise exception '종료일은 시작일보다 빠를 수 없습니다.' using errcode = '22023';
  end if;

  v_span_days := (p_end_date - p_start_date) + 1;
  if v_span_days > 366 then
    raise exception '휴무일 등록 범위는 최대 366일입니다.' using errcode = '22023';
  end if;
  if p_mode = 'weekly'
     and (p_weekday is null or p_weekday < 0 or p_weekday > 6) then
    raise exception '정기휴무 요일은 0(일)~6(토) 범위여야 합니다.' using errcode = '22023';
  end if;

  select
    coalesce(array_agg(d order by d), '{}'::date[]),
    count(*)::integer
  into v_target_dates, v_target_count
  from (
    select gs::date as d
    from pg_catalog.generate_series(p_start_date, p_end_date, interval '1 day') gs
    where p_mode = 'range'
      or extract(dow from gs)::integer = p_weekday
  ) target_days;

  if v_target_count = 0 then
    raise exception '선택한 조건에 적용할 휴무일이 없습니다.' using errcode = '22023';
  end if;

  select coalesce(array_agg(a.id order by a.id), '{}'::uuid[])
  into v_appointment_ids
  from public.appointments a
  where a.date = any(v_target_dates)
    and a.status = 'confirmed';

  perform 1
  from public.customers c
  where c.id in (
    select distinct a.customer_id
    from public.appointments a
    where a.id = any(v_appointment_ids)
  )
  order by c.id
  for update;

  perform 1
  from public.customer_session_passes sp
  where sp.id in (
    select distinct u.session_pass_id
    from public.appointment_session_pass_usages u
    where u.appointment_id = any(v_appointment_ids)
      and u.state in ('reserved', 'consumed')
  )
  order by sp.id
  for update;

  perform 1
  from public.appointments a
  where a.id = any(v_appointment_ids)
  order by a.id
  for update;

  update public.appointments a
  set
    status = 'cancelled',
    cancelled_reason = 'closed_day',
    cancelled_by = v_actor,
    cancelled_at = pg_catalog.clock_timestamp(),
    updated_at = pg_catalog.clock_timestamp()
  where a.id = any(v_appointment_ids)
    and a.status = 'confirmed';

  get diagnostics v_cancelled_count = row_count;

  update public.appointment_session_pass_usages u
  set
    state = 'released',
    released_at = pg_catalog.clock_timestamp(),
    released_by = v_actor,
    release_reason = 'appointment_cancelled'
  where u.appointment_id = any(v_appointment_ids)
    and u.state in ('reserved', 'consumed');

  get diagnostics v_released_count = row_count;

  select count(*)::integer
  into v_remaining
  from public.appointments a
  where a.date = any(v_target_dates)
    and a.status = 'confirmed';

  if v_remaining > 0 then
    raise exception '해당 기간에 confirmed 예약이 남아 있어 휴무일 저장을 완료할 수 없습니다.'
      using errcode = 'P0001';
  end if;

  insert into public.salon_closed_dates (
    closed_date,
    note,
    created_by,
    updated_by
  )
  select
    d,
    p_note,
    v_actor,
    v_actor
  from unnest(v_target_dates) as d
  on conflict (closed_date) do update
  set
    note = excluded.note,
    updated_by = v_actor,
    updated_at = pg_catalog.clock_timestamp();

  return jsonb_build_object(
    'mode', p_mode,
    'applied_days', v_target_count,
    'cancelled_count', v_cancelled_count,
    'released_session_count', v_released_count,
    'remaining_confirmed', v_remaining
  );
end;
$$;

revoke all on function public.apply_closed_day_with_cancellations(date, uuid[], text) from public, anon, authenticated;
grant execute on function public.apply_closed_day_with_cancellations(date, uuid[], text) to authenticated;

revoke all on function public.apply_closed_days_batch_with_cancellations(text, date, date, int, text) from public, anon, authenticated;
grant execute on function public.apply_closed_days_batch_with_cancellations(text, date, date, int, text) to authenticated;

create or replace function public.guard_r16_customer_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_ids uuid[];
  v_event_id uuid;
begin
  v_customer_ids := array_remove(
    array[old.id, old.merged_into_customer_id, new.merged_into_customer_id]::uuid[],
    null
  );

  perform 1
  from public.customer_session_passes sp
  where sp.customer_id = any(v_customer_ids)
  order by sp.id
  for update;

  if old.merged_into_customer_id is null
     and new.merged_into_customer_id is not null then
    if exists (
      select 1
      from public.customer_session_passes sp
      where sp.customer_id = any(v_customer_ids)
        and sp.status in ('active', 'paused')
    )
    or exists (
      select 1
      from public.appointment_session_pass_usages u
      join public.customer_session_passes sp on sp.id = u.session_pass_id
      where sp.customer_id = any(v_customer_ids)
    ) then
      raise exception '활성·중지 횟수권 또는 사용 이력이 있는 고객은 병합할 수 없습니다.'
        using errcode = '55000';
    end if;
  end if;

  if old.merged_into_customer_id is not null
     and new.merged_into_customer_id is null then
    select e.id
    into v_event_id
    from public.customer_merge_events e
    where e.source_customer_id = old.id
      and e.target_customer_id = old.merged_into_customer_id
      and e.undone_at is null
    order by e.merged_at desc
    limit 1;

    if v_event_id is not null
       and exists (
         select 1
         from public.customer_merge_appointment_moves m
         join public.appointment_session_pass_usages u
           on u.appointment_id = m.appointment_id
         where m.event_id = v_event_id
       ) then
      raise exception '병합 이후 횟수권 사용 이력이 생긴 예약이 있어 병합을 취소할 수 없습니다.'
        using errcode = '55000';
    end if;
  end if;

  if old.anonymized_at is null and new.anonymized_at is not null then
    update public.customer_session_passes sp
    set
      memo = null,
      updated_by = auth.uid(),
      updated_at = pg_catalog.clock_timestamp()
    where sp.customer_id = old.id
      and sp.memo is not null;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_r16_customer_lifecycle() from public, anon, authenticated;

drop trigger if exists guard_r16_customer_lifecycle on public.customers;
create trigger guard_r16_customer_lifecycle
  before update of archived_at, merged_into_customer_id, anonymized_at
  on public.customers
  for each row execute function public.guard_r16_customer_lifecycle();
