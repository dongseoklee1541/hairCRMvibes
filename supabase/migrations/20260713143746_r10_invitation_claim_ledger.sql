-- ==========================================
-- R-10 hardening: invitation claim ledger
--
-- Security contract
-- - The ledger stores only a keyed email fingerprint, never the email itself.
-- - A shared R-10 advisory lock serializes claim/settle/reconcile with role writes.
-- - Only an authenticated owner may call the SECURITY DEFINER RPCs.
-- - The private table and schema remain inaccessible to Data API roles,
--   including service_role; RPCs expose no claim token on replay or settlement.
-- ==========================================

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
revoke all on schema private from service_role;

create table if not exists private.staff_invitation_requests (
  request_id uuid primary key,
  actor_id uuid not null,
  email_fingerprint text not null,
  claim_token uuid not null default pg_catalog.gen_random_uuid(),
  state text not null default 'claimed',
  auth_user_id uuid,
  failure_code text,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  claimed_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  settled_at timestamptz,
  constraint staff_invitation_requests_email_fingerprint_check check (
    email_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  constraint staff_invitation_requests_claim_token_key unique (claim_token),
  constraint staff_invitation_requests_state_check check (
    state in (
      'claimed',
      'auth_succeeded',
      'provisioned',
      'failed_definitive',
      'unknown'
    )
  ),
  constraint staff_invitation_requests_failure_code_check check (
    failure_code is null
    or failure_code in (
      'auth_not_configured',
      'auth_result_unknown',
      'profile_provision_failed',
      'claim_stale'
    )
  ),
  constraint staff_invitation_requests_state_shape_check check (
    (
      state = 'claimed'
      and auth_user_id is null
      and failure_code is null
      and settled_at is null
    )
    or (
      state = 'auth_succeeded'
      and auth_user_id is not null
      and (failure_code is null or failure_code = 'profile_provision_failed')
      and settled_at is null
    )
    or (
      state = 'provisioned'
      and auth_user_id is not null
      and failure_code is null
      and settled_at is not null
    )
    or (
      state = 'failed_definitive'
      and auth_user_id is null
      and failure_code = 'auth_not_configured'
      and settled_at is not null
    )
    or (
      state = 'unknown'
      and auth_user_id is null
      and failure_code in ('auth_result_unknown', 'claim_stale')
      and settled_at is not null
    )
  )
);

comment on table private.staff_invitation_requests is
  'Private R-10 at-most-once Auth-attempt ledger. Email is represented only by a server-keyed HMAC-SHA-256 fingerprint; UUID identities intentionally have no Auth/profile foreign keys so idempotency evidence survives account deletion.';

comment on column private.staff_invitation_requests.claim_token is
  'Claim-scoped server capability returned only when a claim is first acquired or explicitly re-acquired after a definitive pre-call failure. Stored raw inside the no-grant private schema and never returned on replay, settle, or reconcile.';

comment on column private.staff_invitation_requests.email_fingerprint is
  'Server-keyed HMAC-SHA-256 digest of the normalized email. Resolve active rows before rotating the HMAC key because a new key changes the deduplication identity.';

create unique index if not exists staff_invitation_requests_active_fingerprint_key
  on private.staff_invitation_requests (email_fingerprint)
  where state in ('claimed', 'auth_succeeded', 'unknown');

alter table private.staff_invitation_requests enable row level security;

revoke all on table private.staff_invitation_requests from public;
revoke all on table private.staff_invitation_requests from anon;
revoke all on table private.staff_invitation_requests from authenticated;
revoke all on table private.staff_invitation_requests from service_role;

create or replace function public.claim_staff_invitation(
  p_request_id uuid,
  p_email_fingerprint text
)
returns table (
  request_id uuid,
  state text,
  claim_token uuid,
  auth_user_id uuid,
  failure_code text,
  acquired boolean,
  replayed boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_request private.staff_invitation_requests%rowtype;
  v_active_request private.staff_invitation_requests%rowtype;
  v_now timestamptz;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  if p_request_id is null
     or p_email_fingerprint is null
     or p_email_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception '요청 ID와 유효한 이메일 fingerprint가 필요합니다.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(20260713, 10);

  select p.role
  into v_actor_role
  from public.profiles p
  where p.id = v_actor;

  if v_actor_role is distinct from 'owner' then
    raise exception '직원을 초대할 권한이 없습니다.' using errcode = '42501';
  end if;

  v_now := pg_catalog.clock_timestamp();

  select r.*
  into v_request
  from private.staff_invitation_requests r
  where r.request_id = p_request_id
  for update;

  if found then
    if v_request.actor_id is distinct from v_actor
       or v_request.email_fingerprint is distinct from p_email_fingerprint then
      raise exception '요청 ID가 다른 초대 작업에 사용되었습니다.' using errcode = '22023';
    end if;

    if v_request.state = 'failed_definitive' then
      if exists (
        select 1
        from public.role_management_events e
        where e.request_id = p_request_id
      ) then
        raise exception '요청 ID가 기존 역할 관리 작업에 사용되었습니다.' using errcode = '22023';
      end if;

      select active_request.*
      into v_active_request
      from private.staff_invitation_requests active_request
      where active_request.email_fingerprint = p_email_fingerprint
        and active_request.request_id <> p_request_id
        and active_request.state in ('claimed', 'auth_succeeded', 'unknown')
      for update;

      if found then
        if v_active_request.state = 'claimed'
           and v_active_request.claimed_at <= v_now - interval '10 minutes' then
          update private.staff_invitation_requests active_request
          set
            state = 'unknown',
            failure_code = 'claim_stale',
            updated_at = v_now,
            settled_at = v_now
          where active_request.request_id = v_active_request.request_id
          returning active_request.* into v_active_request;
        end if;

        return query
        select
          v_active_request.request_id,
          v_active_request.state,
          null::uuid,
          v_active_request.auth_user_id,
          v_active_request.failure_code,
          false,
          true,
          v_active_request.updated_at;
        return;
      end if;

      update private.staff_invitation_requests r
      set
        claim_token = pg_catalog.gen_random_uuid(),
        state = 'claimed',
        auth_user_id = null,
        failure_code = null,
        claimed_at = v_now,
        updated_at = v_now,
        settled_at = null
      where r.request_id = p_request_id
      returning r.* into v_request;

      return query
      select
        v_request.request_id,
        v_request.state,
        v_request.claim_token,
        v_request.auth_user_id,
        v_request.failure_code,
        true,
        true,
        v_request.updated_at;
      return;
    end if;

    if v_request.state = 'claimed'
       and v_request.claimed_at <= v_now - interval '10 minutes' then
      update private.staff_invitation_requests r
      set
        state = 'unknown',
        failure_code = 'claim_stale',
        updated_at = v_now,
        settled_at = v_now
      where r.request_id = p_request_id
      returning r.* into v_request;
    end if;

    return query
    select
      v_request.request_id,
      v_request.state,
      null::uuid,
      v_request.auth_user_id,
      v_request.failure_code,
      false,
      true,
      v_request.updated_at;
    return;
  end if;

  if exists (
    select 1
    from public.role_management_events e
    where e.request_id = p_request_id
  ) then
    raise exception '요청 ID가 기존 역할 관리 작업에 사용되었습니다.' using errcode = '22023';
  end if;

  select active_request.*
  into v_active_request
  from private.staff_invitation_requests active_request
  where active_request.email_fingerprint = p_email_fingerprint
    and active_request.state in ('claimed', 'auth_succeeded', 'unknown')
  for update;

  if found then
    if v_active_request.state = 'claimed'
       and v_active_request.claimed_at <= v_now - interval '10 minutes' then
      update private.staff_invitation_requests active_request
      set
        state = 'unknown',
        failure_code = 'claim_stale',
        updated_at = v_now,
        settled_at = v_now
      where active_request.request_id = v_active_request.request_id
      returning active_request.* into v_active_request;
    end if;

    return query
    select
      v_active_request.request_id,
      v_active_request.state,
      null::uuid,
      v_active_request.auth_user_id,
      v_active_request.failure_code,
      false,
      true,
      v_active_request.updated_at;
    return;
  end if;

  begin
    insert into private.staff_invitation_requests as r (
      request_id,
      actor_id,
      email_fingerprint,
      created_at,
      claimed_at,
      updated_at
    ) values (
      p_request_id,
      v_actor,
      p_email_fingerprint,
      v_now,
      v_now,
      v_now
    )
    returning r.* into v_request;
  exception
    when unique_violation then
      raise exception '이 이메일의 초대 처리가 이미 진행 중입니다.' using errcode = '55000';
  end;

  return query
  select
    v_request.request_id,
    v_request.state,
    v_request.claim_token,
    v_request.auth_user_id,
    v_request.failure_code,
    true,
    false,
    v_request.updated_at;
end;
$$;

comment on function public.claim_staff_invitation(uuid, text) is
  'Owner-only invitation claim. The shared R-10 lock binds request ID, actor, and keyed email fingerprint; only a newly acquired claim reveals its claim-scoped token.';

create or replace function public.settle_staff_invitation(
  p_request_id uuid,
  p_claim_token uuid,
  p_next_state text,
  p_auth_user_id uuid,
  p_failure_code text
)
returns table (
  request_id uuid,
  state text,
  auth_user_id uuid,
  failure_code text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_request private.staff_invitation_requests%rowtype;
  v_now timestamptz;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  if p_request_id is null or p_claim_token is null or p_next_state is null then
    raise exception '요청 ID, claim token, 다음 상태는 필수입니다.' using errcode = '22023';
  end if;

  if p_next_state not in (
    'auth_succeeded',
    'provisioned',
    'failed_definitive',
    'unknown'
  ) then
    raise exception '허용되지 않은 초대 상태입니다.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(20260713, 10);

  select p.role
  into v_actor_role
  from public.profiles p
  where p.id = v_actor;

  if v_actor_role is distinct from 'owner' then
    raise exception '초대 상태를 변경할 권한이 없습니다.' using errcode = '42501';
  end if;

  select r.*
  into v_request
  from private.staff_invitation_requests r
  where r.request_id = p_request_id
  for update;

  if not found then
    raise exception '초대 요청을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_request.actor_id is distinct from v_actor
     or v_request.claim_token is distinct from p_claim_token then
    raise exception '초대 claim을 확인할 수 없습니다.' using errcode = '42501';
  end if;

  if not (
    (v_request.state = 'claimed' and p_next_state in (
      'auth_succeeded', 'provisioned', 'failed_definitive', 'unknown'
    ))
    or (v_request.state = 'auth_succeeded' and p_next_state in (
      'auth_succeeded', 'provisioned'
    ))
    or (v_request.state = 'unknown' and p_next_state in (
      'auth_succeeded', 'provisioned', 'unknown'
    ))
    or (v_request.state = 'provisioned' and p_next_state = 'provisioned')
    or (v_request.state = 'failed_definitive' and p_next_state = 'failed_definitive')
  ) then
    raise exception '현재 상태에서 요청한 초대 상태로 전이할 수 없습니다.' using errcode = '55000';
  end if;

  if p_next_state = 'auth_succeeded' then
    if p_auth_user_id is null
       or p_failure_code is not null
          and p_failure_code <> 'profile_provision_failed' then
      raise exception 'Auth 성공 상태의 payload가 올바르지 않습니다.' using errcode = '22023';
    end if;
  elsif p_next_state = 'provisioned' then
    if p_auth_user_id is null or p_failure_code is not null then
      raise exception 'provisioned 상태의 payload가 올바르지 않습니다.' using errcode = '22023';
    end if;
  elsif p_next_state = 'failed_definitive' then
    if p_auth_user_id is not null or p_failure_code is distinct from 'auth_not_configured' then
      raise exception 'definitive 실패 상태의 payload가 올바르지 않습니다.' using errcode = '22023';
    end if;
  elsif p_next_state = 'unknown' then
    if p_auth_user_id is not null or p_failure_code is distinct from 'auth_result_unknown' then
      raise exception 'unknown 상태의 payload가 올바르지 않습니다.' using errcode = '22023';
    end if;
  end if;

  if p_auth_user_id is not null and not exists (
    select 1
    from auth.users u
    where u.id = p_auth_user_id
  ) then
    raise exception '초대된 Auth 사용자를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if p_next_state = 'provisioned' and not exists (
    select 1
    from public.profiles p
    where p.id = p_auth_user_id
  ) then
    raise exception '초대된 직원 프로필을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if p_next_state = 'provisioned' and not exists (
    select 1
    from public.role_management_events e
    where e.request_id = p_request_id
      and e.target_user_id = p_auth_user_id
      and e.event_type in ('staff_provisioned', 'staff_provision_noop')
  ) then
    raise exception '직원 provisioning 감사 증거를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_request.state in ('auth_succeeded', 'provisioned')
     and v_request.auth_user_id is distinct from p_auth_user_id then
    raise exception '요청 ID가 다른 Auth 사용자에 사용되었습니다.' using errcode = '22023';
  end if;

  v_now := pg_catalog.clock_timestamp();

  update private.staff_invitation_requests r
  set
    state = p_next_state,
    auth_user_id = p_auth_user_id,
    failure_code = p_failure_code,
    updated_at = v_now,
    settled_at = case
      when p_next_state in ('provisioned', 'failed_definitive', 'unknown') then v_now
      else null
    end
  where r.request_id = p_request_id
    and r.actor_id = v_actor
    and r.claim_token = p_claim_token
    and r.state = v_request.state
  returning r.* into v_request;

  if not found then
    raise exception '초대 상태가 동시에 변경되었습니다.' using errcode = '40001';
  end if;

  return query
  select
    v_request.request_id,
    v_request.state,
    v_request.auth_user_id,
    v_request.failure_code,
    v_request.updated_at;
end;
$$;

comment on function public.settle_staff_invitation(uuid, uuid, text, uuid, text) is
  'Owner-only claim settlement. Requires the original actor and claim-scoped token, validates Auth/profile/provisioning evidence, and never returns the token.';

create or replace function public.reconcile_staff_invitation(
  p_email_fingerprint text,
  p_auth_user_id uuid
)
returns table (
  request_id uuid,
  state text,
  auth_user_id uuid,
  failure_code text,
  reconciled boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_request private.staff_invitation_requests%rowtype;
  v_now timestamptz;
begin
  if v_actor is null then
    raise exception '인증이 필요합니다.' using errcode = '42501';
  end if;

  if p_email_fingerprint is null
     or p_email_fingerprint !~ '^[0-9a-f]{64}$'
     or p_auth_user_id is null then
    raise exception '유효한 이메일 fingerprint와 Auth 사용자 ID가 필요합니다.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(20260713, 10);

  select p.role
  into v_actor_role
  from public.profiles p
  where p.id = v_actor;

  if v_actor_role is distinct from 'owner' then
    raise exception '초대 상태를 복구할 권한이 없습니다.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from auth.users u
    where u.id = p_auth_user_id
  ) or not exists (
    select 1
    from public.profiles p
    where p.id = p_auth_user_id
  ) then
    raise exception 'Auth 사용자와 직원 프로필이 모두 필요합니다.' using errcode = 'P0002';
  end if;

  select r.*
  into v_request
  from private.staff_invitation_requests r
  where r.email_fingerprint = p_email_fingerprint
    and r.state in ('claimed', 'auth_succeeded', 'unknown')
  for update;

  if not found then
    select r.*
    into v_request
    from private.staff_invitation_requests r
    where r.email_fingerprint = p_email_fingerprint
      and r.state = 'provisioned'
      and r.auth_user_id = p_auth_user_id
    order by r.updated_at desc, r.request_id
    limit 1;

    if not found then
      raise exception '복구할 초대 요청을 찾을 수 없습니다.' using errcode = 'P0002';
    end if;

    return query
    select
      v_request.request_id,
      v_request.state,
      v_request.auth_user_id,
      v_request.failure_code,
      false,
      v_request.updated_at;
    return;
  end if;

  if v_request.auth_user_id is not null
     and v_request.auth_user_id is distinct from p_auth_user_id then
    raise exception '이메일 fingerprint가 다른 Auth 사용자에 연결되었습니다.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.role_management_events e
    where e.request_id = v_request.request_id
      and e.target_user_id = p_auth_user_id
      and e.event_type in ('staff_provisioned', 'staff_provision_noop')
  ) then
    raise exception '직원 provisioning 감사 증거를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  v_now := pg_catalog.clock_timestamp();

  update private.staff_invitation_requests r
  set
    state = 'provisioned',
    auth_user_id = p_auth_user_id,
    failure_code = null,
    updated_at = v_now,
    settled_at = v_now
  where r.request_id = v_request.request_id
    and r.state = v_request.state
  returning r.* into v_request;

  if not found then
    raise exception '초대 상태가 동시에 변경되었습니다.' using errcode = '40001';
  end if;

  return query
  select
    v_request.request_id,
    v_request.state,
    v_request.auth_user_id,
    v_request.failure_code,
    true,
    v_request.updated_at;
end;
$$;

comment on function public.reconcile_staff_invitation(text, uuid) is
  'Owner-only recovery for an active keyed email fingerprint after Auth/profile state is independently confirmed. No claim token is accepted or returned.';

revoke all on function public.claim_staff_invitation(uuid, text) from public;
revoke all on function public.claim_staff_invitation(uuid, text) from anon;
revoke all on function public.claim_staff_invitation(uuid, text) from authenticated;
revoke all on function public.claim_staff_invitation(uuid, text) from service_role;
grant execute on function public.claim_staff_invitation(uuid, text) to authenticated;

revoke all on function public.settle_staff_invitation(uuid, uuid, text, uuid, text) from public;
revoke all on function public.settle_staff_invitation(uuid, uuid, text, uuid, text) from anon;
revoke all on function public.settle_staff_invitation(uuid, uuid, text, uuid, text) from authenticated;
revoke all on function public.settle_staff_invitation(uuid, uuid, text, uuid, text) from service_role;
grant execute on function public.settle_staff_invitation(uuid, uuid, text, uuid, text) to authenticated;

revoke all on function public.reconcile_staff_invitation(text, uuid) from public;
revoke all on function public.reconcile_staff_invitation(text, uuid) from anon;
revoke all on function public.reconcile_staff_invitation(text, uuid) from authenticated;
revoke all on function public.reconcile_staff_invitation(text, uuid) from service_role;
grant execute on function public.reconcile_staff_invitation(text, uuid) to authenticated;
