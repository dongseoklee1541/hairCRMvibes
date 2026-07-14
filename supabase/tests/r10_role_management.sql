-- R-10 disposable PostgreSQL/Supabase smoke test.
-- Run only against an isolated database after all forward migrations.
-- Every fixture and mutation is rolled back.

begin;

do $$
declare
  v_privilege text;
begin
  if not exists (
    select 1
    from pg_class c
    where c.oid = 'public.role_management_events'::regclass
      and c.relrowsecurity
  ) then
    raise exception 'R-10 smoke: role audit table RLS가 활성화되지 않았습니다.';
  end if;

  if not has_table_privilege(
    'authenticated',
    'public.role_management_events',
    'SELECT'
  ) then
    raise exception 'R-10 smoke: authenticated audit SELECT 권한이 없습니다.';
  end if;

  foreach v_privilege in array array[
    'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
  ] loop
    if has_table_privilege(
      'authenticated',
      'public.role_management_events',
      v_privilege
    ) then
      raise exception 'R-10 smoke: authenticated audit % 권한이 열려 있습니다.', v_privilege;
    end if;
  end loop;

  foreach v_privilege in array array[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
  ] loop
    if has_table_privilege('anon', 'public.role_management_events', v_privilege) then
      raise exception 'R-10 smoke: anon audit % 권한이 열려 있습니다.', v_privilege;
    end if;

    if has_table_privilege('service_role', 'public.role_management_events', v_privilege) then
      raise exception 'R-10 smoke: service_role audit % 권한이 열려 있습니다.', v_privilege;
    end if;
  end loop;

  if not has_table_privilege('authenticated', 'public.profiles', 'SELECT') then
    raise exception 'R-10 smoke: authenticated profile SELECT 권한이 없습니다.';
  end if;

  foreach v_privilege in array array[
    'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
  ] loop
    if has_table_privilege('authenticated', 'public.profiles', v_privilege) then
      raise exception 'R-10 smoke: authenticated profile % 권한이 열려 있습니다.', v_privilege;
    end if;
  end loop;

  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'role_management_events'
      and c.column_name ilike '%email%'
  ) then
    raise exception 'R-10 smoke: role audit에 email 컬럼이 포함되었습니다.';
  end if;

  if not exists (
    select 1
    from pg_policy p
    where p.polrelid = 'public.role_management_events'::regclass
      and p.polname = 'Owners can read role management events'
      and p.polcmd = 'r'
  ) or (
    select count(*)
    from pg_policy p
    where p.polrelid = 'public.role_management_events'::regclass
  ) <> 1 then
    raise exception 'R-10 smoke: role audit owner-only SELECT 정책이 정확하지 않습니다.';
  end if;

  if exists (
    select 1
    from (
      values
        ('public.list_staff_profiles()'::regprocedure, 's'::text),
        ('public.provision_invited_staff(uuid,uuid)'::regprocedure, 'v'::text),
        ('public.change_staff_role(uuid,text,uuid)'::regprocedure, 'v'::text)
    ) as expected(function_oid, volatility)
    join pg_proc p on p.oid = expected.function_oid
    where not p.prosecdef
       or p.provolatile::text is distinct from expected.volatility
       or p.proconfig is distinct from array['search_path=""']
  ) then
    raise exception 'R-10 smoke: RPC security definer/volatility/empty search_path 계약이 다릅니다.';
  end if;

  if exists (
    select 1
    from (
      values
        ('public.list_staff_profiles()'::regprocedure),
        ('public.provision_invited_staff(uuid,uuid)'::regprocedure),
        ('public.change_staff_role(uuid,text,uuid)'::regprocedure)
    ) as f(function_oid)
    where not has_function_privilege('authenticated', f.function_oid, 'EXECUTE')
       or has_function_privilege('anon', f.function_oid, 'EXECUTE')
       or has_function_privilege('service_role', f.function_oid, 'EXECUTE')
  ) then
    raise exception 'R-10 smoke: authenticated/anon/service_role RPC EXECUTE 계약이 다릅니다.';
  end if;

  if exists (
    select 1
    from (
      values
        ('public.list_staff_profiles()'::regprocedure),
        ('public.provision_invited_staff(uuid,uuid)'::regprocedure),
        ('public.change_staff_role(uuid,text,uuid)'::regprocedure)
    ) as f(function_oid)
    join pg_proc p on p.oid = f.function_oid
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'R-10 smoke: PUBLIC RPC EXECUTE 권한이 열려 있습니다.';
  end if;

  if position(
    'pg_catalog.pg_advisory_xact_lock(20260713, 10)'
    in pg_get_functiondef('public.provision_invited_staff(uuid,uuid)'::regprocedure)
  ) = 0 or position(
    'pg_catalog.pg_advisory_xact_lock(20260713, 10)'
    in pg_get_functiondef('public.change_staff_role(uuid,text,uuid)'::regprocedure)
  ) = 0 then
    raise exception 'R-10 smoke: mutation RPC 공통 advisory transaction lock이 없습니다.';
  end if;

  if position(
    'FOR UPDATE'
    in upper(pg_get_functiondef('public.change_staff_role(uuid,text,uuid)'::regprocedure))
  ) = 0 then
    raise exception 'R-10 smoke: role change target row lock이 없습니다.';
  end if;

  if to_regclass('private.staff_invitation_requests') is null then
    raise exception 'R-10 smoke: private invitation claim ledger가 없습니다.';
  end if;

  if not exists (
    select 1
    from pg_class c
    where c.oid = 'private.staff_invitation_requests'::regclass
      and c.relrowsecurity
  ) then
    raise exception 'R-10 smoke: private invitation ledger RLS가 활성화되지 않았습니다.';
  end if;

  if exists (
    select 1
    from pg_policy p
    where p.polrelid = 'private.staff_invitation_requests'::regclass
  ) then
    raise exception 'R-10 smoke: no-grant private ledger에 RLS policy가 열려 있습니다.';
  end if;

  if exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'private.staff_invitation_requests'::regclass
      and c.contype = 'f'
  ) then
    raise exception 'R-10 smoke: invitation ledger UUID에 삭제 가능한 foreign key가 있습니다.';
  end if;

  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'private'
      and c.table_name = 'staff_invitation_requests'
      and c.column_name in ('email', 'raw_email', 'normalized_email')
  ) then
    raise exception 'R-10 smoke: invitation ledger에 raw email 컬럼이 포함되었습니다.';
  end if;

  if not exists (
    select 1
    from pg_indexes i
    where i.schemaname = 'private'
      and i.tablename = 'staff_invitation_requests'
      and i.indexname = 'staff_invitation_requests_active_fingerprint_key'
      and i.indexdef ilike '%unique%email_fingerprint%'
      and i.indexdef ilike '%claimed%auth_succeeded%unknown%'
  ) then
    raise exception 'R-10 smoke: active email fingerprint partial unique index가 없습니다.';
  end if;

  if has_schema_privilege('anon', 'private', 'USAGE')
     or has_schema_privilege('authenticated', 'private', 'USAGE')
     or has_schema_privilege('service_role', 'private', 'USAGE')
     or has_schema_privilege('anon', 'private', 'CREATE')
     or has_schema_privilege('authenticated', 'private', 'CREATE')
     or has_schema_privilege('service_role', 'private', 'CREATE') then
    raise exception 'R-10 smoke: private schema 권한이 Data API role에 열려 있습니다.';
  end if;

  if exists (
    select 1
    from pg_namespace n
    cross join lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) acl
    where n.nspname = 'private'
      and acl.grantee = 0
      and acl.privilege_type in ('USAGE', 'CREATE')
  ) then
    raise exception 'R-10 smoke: private schema 권한이 PUBLIC에 열려 있습니다.';
  end if;

  foreach v_privilege in array array[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
  ] loop
    if has_table_privilege(
      'anon',
      'private.staff_invitation_requests'::regclass,
      v_privilege
    ) or has_table_privilege(
      'authenticated',
      'private.staff_invitation_requests'::regclass,
      v_privilege
    ) or has_table_privilege(
      'service_role',
      'private.staff_invitation_requests'::regclass,
      v_privilege
    ) then
      raise exception 'R-10 smoke: private ledger % 권한이 Data API role에 열려 있습니다.', v_privilege;
    end if;
  end loop;

  if exists (
    select 1
    from (
      values
        ('public.claim_staff_invitation(uuid,text)'::regprocedure),
        ('public.settle_staff_invitation(uuid,uuid,text,uuid,text)'::regprocedure),
        ('public.reconcile_staff_invitation(text,uuid)'::regprocedure)
    ) as f(function_oid)
    join pg_proc p on p.oid = f.function_oid
    where not p.prosecdef
       or p.provolatile <> 'v'
       or p.proconfig is distinct from array['search_path=""']
  ) then
    raise exception 'R-10 smoke: invitation RPC security definer/volatility/empty search_path 계약이 다릅니다.';
  end if;

  if exists (
    select 1
    from (
      values
        ('public.claim_staff_invitation(uuid,text)'::regprocedure),
        ('public.settle_staff_invitation(uuid,uuid,text,uuid,text)'::regprocedure),
        ('public.reconcile_staff_invitation(text,uuid)'::regprocedure)
    ) as f(function_oid)
    where not has_function_privilege('authenticated', f.function_oid, 'EXECUTE')
       or has_function_privilege('anon', f.function_oid, 'EXECUTE')
       or has_function_privilege('service_role', f.function_oid, 'EXECUTE')
  ) then
    raise exception 'R-10 smoke: invitation RPC authenticated/anon/service_role EXECUTE 계약이 다릅니다.';
  end if;

  if exists (
    select 1
    from (
      values
        ('public.claim_staff_invitation(uuid,text)'::regprocedure),
        ('public.settle_staff_invitation(uuid,uuid,text,uuid,text)'::regprocedure),
        ('public.reconcile_staff_invitation(text,uuid)'::regprocedure)
    ) as f(function_oid)
    join pg_proc p on p.oid = f.function_oid
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'R-10 smoke: invitation RPC EXECUTE가 PUBLIC에 열려 있습니다.';
  end if;

  if exists (
    select 1
    from (
      values
        ('public.claim_staff_invitation(uuid,text)'::regprocedure),
        ('public.settle_staff_invitation(uuid,uuid,text,uuid,text)'::regprocedure),
        ('public.reconcile_staff_invitation(text,uuid)'::regprocedure)
    ) as f(function_oid)
    where position(
      'pg_catalog.pg_advisory_xact_lock(20260713, 10)'
      in pg_get_functiondef(f.function_oid)
    ) = 0
  ) then
    raise exception 'R-10 smoke: invitation RPC에 공통 R-10 advisory lock이 없습니다.';
  end if;

  if pg_get_function_result(
    'public.settle_staff_invitation(uuid,uuid,text,uuid,text)'::regprocedure
  ) ilike '%claim_token%'
     or pg_get_function_result(
       'public.reconcile_staff_invitation(text,uuid)'::regprocedure
     ) ilike '%claim_token%' then
    raise exception 'R-10 smoke: settle/reconcile 응답에 claim token이 노출됩니다.';
  end if;
end;
$$;

insert into auth.users (id, created_at)
values
  ('a0000000-0000-0000-0000-000000000001', now()),
  ('a0000000-0000-0000-0000-000000000002', now()),
  ('a0000000-0000-0000-0000-000000000003', now()),
  ('a0000000-0000-0000-0000-000000000004', now()),
  ('a0000000-0000-0000-0000-000000000005', now());

insert into public.profiles (id, role)
values
  ('a0000000-0000-0000-0000-000000000001', 'owner'),
  ('a0000000-0000-0000-0000-000000000002', 'owner'),
  ('a0000000-0000-0000-0000-000000000003', 'staff');

set local role authenticated;
set local "request.jwt.claim.sub" = 'a0000000-0000-0000-0000-000000000001';

do $$
declare
  v_roles text[];
begin
  select array_agg(s.role order by s.role, s.user_id)
  into v_roles
  from public.list_staff_profiles() s;

  if v_roles is distinct from array['owner', 'owner', 'staff']::text[] then
    raise exception 'R-10 smoke: owner 직원 목록이 profiles 계약과 다릅니다. roles=%', v_roles;
  end if;

  if exists (
    select 1
    from public.list_staff_profiles() s
    where s.user_id in (
      'a0000000-0000-0000-0000-000000000004'::uuid,
      'a0000000-0000-0000-0000-000000000005'::uuid
    )
  ) then
    raise exception 'R-10 smoke: profileless Auth 사용자가 직원 목록에 포함되었습니다.';
  end if;
end;
$$;

do $$
declare
  v_first record;
  v_retry record;
  v_owner_noop record;
  v_event_count integer;
begin
  select * into strict v_first
  from public.provision_invited_staff(
    'a0000000-0000-0000-0000-000000000005',
    'a1000000-0000-0000-0000-000000000001'
  );

  if v_first.previous_role is not null
     or v_first.next_role <> 'staff'
     or v_first.event_type <> 'staff_provisioned'
     or v_first.applied is not true
     or v_first.replayed is not false then
    raise exception 'R-10 smoke: 신규 초대 profile provisioning 결과가 다릅니다. result=%', to_jsonb(v_first);
  end if;

  if not exists (
    select 1
    from public.list_staff_profiles() p
    where p.user_id = 'a0000000-0000-0000-0000-000000000005'
      and p.role = 'staff'
  ) then
    raise exception 'R-10 smoke: 신규 초대 profile이 staff로 생성되지 않았습니다.';
  end if;

  select count(*)::integer into v_event_count
  from public.role_management_events;

  select * into strict v_retry
  from public.provision_invited_staff(
    'a0000000-0000-0000-0000-000000000005',
    'a1000000-0000-0000-0000-000000000001'
  );

  if v_retry.event_id is distinct from v_first.event_id
     or v_retry.event_type <> 'staff_provisioned'
     or v_retry.applied is not false
     or v_retry.replayed is not true
     or (select count(*) from public.role_management_events) <> v_event_count then
    raise exception 'R-10 smoke: provision 동일 request 재시도가 멱등하지 않습니다.';
  end if;

  select * into strict v_owner_noop
  from public.provision_invited_staff(
    'a0000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000002'
  );

  if v_owner_noop.previous_role <> 'owner'
     or v_owner_noop.next_role <> 'owner'
     or v_owner_noop.event_type <> 'staff_provision_noop'
     or v_owner_noop.applied is not false
     or v_owner_noop.replayed is not false
     or not exists (
       select 1
       from public.list_staff_profiles() p
       where p.user_id = 'a0000000-0000-0000-0000-000000000002'
         and p.role = 'owner'
     ) then
    raise exception 'R-10 smoke: 기존 owner가 provision에서 보존되지 않았습니다.';
  end if;

  begin
    perform 1
    from public.provision_invited_staff(
      'a0000000-0000-0000-0000-000000000003',
      'a1000000-0000-0000-0000-000000000002'
    );
    raise exception 'R-10 smoke: provision request_id의 다른 target 재사용이 허용되었습니다.';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    perform 1
    from public.provision_invited_staff(
      'af000000-0000-0000-0000-000000000001',
      'a1000000-0000-0000-0000-000000000003'
    );
    raise exception 'R-10 smoke: 존재하지 않는 Auth 사용자 provisioning이 허용되었습니다.';
  exception
    when sqlstate 'P0002' then null;
  end;

  begin
    perform 1
    from public.provision_invited_staff(
      'a0000000-0000-0000-0000-000000000005',
      null
    );
    raise exception 'R-10 smoke: null provision request_id가 허용되었습니다.';
  exception
    when sqlstate '22023' then null;
  end;
end;
$$;

do $$
declare
  v_first record;
  v_replay record;
  v_canonical record;
  v_settled record;
  v_reconciled record;
  v_failed record;
  v_reclaimed record;
  v_stale_claim record;
  v_first_token uuid;
  v_failed_token uuid;
begin
  select * into strict v_first
  from public.claim_staff_invitation(
    'c1000000-0000-0000-0000-000000000001',
    repeat('1', 64)
  );

  v_first_token := v_first.claim_token;

  if v_first.request_id <> 'c1000000-0000-0000-0000-000000000001'
     or v_first.state <> 'claimed'
     or v_first.claim_token is null
     or v_first.acquired is not true
     or v_first.replayed is not false then
    raise exception 'R-10 smoke: 최초 invitation claim 결과가 다릅니다. result=%', to_jsonb(v_first);
  end if;

  select * into strict v_replay
  from public.claim_staff_invitation(
    'c1000000-0000-0000-0000-000000000001',
    repeat('1', 64)
  );

  if v_replay.request_id is distinct from v_first.request_id
     or v_replay.state <> 'claimed'
     or v_replay.claim_token is not null
     or v_replay.acquired is not false
     or v_replay.replayed is not true then
    raise exception 'R-10 smoke: 동일 request replay가 claim token을 숨기지 못했습니다.';
  end if;

  select * into strict v_canonical
  from public.claim_staff_invitation(
    'c1000000-0000-0000-0000-000000000002',
    repeat('1', 64)
  );

  if v_canonical.request_id is distinct from v_first.request_id
     or v_canonical.state <> 'claimed'
     or v_canonical.claim_token is not null
     or v_canonical.acquired is not false
     or v_canonical.replayed is not true then
    raise exception 'R-10 smoke: 같은 active fingerprint가 canonical claim으로 수렴하지 않았습니다.';
  end if;

  begin
    perform 1
    from public.claim_staff_invitation(
      'c1000000-0000-0000-0000-000000000001',
      repeat('2', 64)
    );
    raise exception 'R-10 smoke: 같은 request ID의 다른 fingerprint가 허용되었습니다.';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    perform 1
    from public.claim_staff_invitation(
      'c1000000-0000-0000-0000-000000000099',
      'not-a-fingerprint'
    );
    raise exception 'R-10 smoke: 잘못된 email fingerprint가 허용되었습니다.';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    perform 1
    from public.claim_staff_invitation(
      'a1000000-0000-0000-0000-000000000001',
      repeat('6', 64)
    );
    raise exception 'R-10 smoke: 기존 역할 관리 event request ID로 신규 claim token이 발급되었습니다.';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    perform 1
    from public.settle_staff_invitation(
      v_first.request_id,
      'cf000000-0000-0000-0000-000000000001',
      'auth_succeeded',
      'a0000000-0000-0000-0000-000000000005',
      null
    );
    raise exception 'R-10 smoke: 잘못된 claim token으로 상태가 변경되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  select * into strict v_settled
  from public.settle_staff_invitation(
    v_first.request_id,
    v_first_token,
    'auth_succeeded',
    'a0000000-0000-0000-0000-000000000005',
    null
  );

  if v_settled.state <> 'auth_succeeded'
     or v_settled.auth_user_id <> 'a0000000-0000-0000-0000-000000000005'
     or v_settled.failure_code is not null then
    raise exception 'R-10 smoke: auth_succeeded settlement 결과가 다릅니다.';
  end if;

  begin
    perform 1
    from public.settle_staff_invitation(
      v_first.request_id,
      v_first_token,
      'provisioned',
      'a0000000-0000-0000-0000-000000000005',
      null
    );
    raise exception 'R-10 smoke: provisioning audit 없는 provisioned 전이가 허용되었습니다.';
  exception
    when sqlstate 'P0002' then null;
  end;

  perform 1
  from public.provision_invited_staff(
    'a0000000-0000-0000-0000-000000000005',
    v_first.request_id
  );

  select * into strict v_settled
  from public.settle_staff_invitation(
    v_first.request_id,
    v_first_token,
    'provisioned',
    'a0000000-0000-0000-0000-000000000005',
    null
  );

  if v_settled.state <> 'provisioned'
     or v_settled.failure_code is not null then
    raise exception 'R-10 smoke: audited provisioned settlement 결과가 다릅니다.';
  end if;

  select * into strict v_replay
  from public.claim_staff_invitation(
    v_first.request_id,
    repeat('1', 64)
  );

  if v_replay.state <> 'provisioned'
     or v_replay.claim_token is not null
     or v_replay.acquired is not false
     or v_replay.replayed is not true then
    raise exception 'R-10 smoke: provisioned replay가 token 없이 수렴하지 않았습니다.';
  end if;

  select * into strict v_first
  from public.claim_staff_invitation(
    'c1000000-0000-0000-0000-000000000003',
    repeat('3', 64)
  );

  select * into strict v_settled
  from public.settle_staff_invitation(
    v_first.request_id,
    v_first.claim_token,
    'unknown',
    null,
    'auth_result_unknown'
  );

  if v_settled.state <> 'unknown'
     or v_settled.failure_code <> 'auth_result_unknown' then
    raise exception 'R-10 smoke: Auth 결과 불명 상태가 보존되지 않았습니다.';
  end if;

  begin
    perform 1
    from public.reconcile_staff_invitation(
      repeat('3', 64),
      'a0000000-0000-0000-0000-000000000005'
    );
    raise exception 'R-10 smoke: provisioning audit 없는 reconcile이 허용되었습니다.';
  exception
    when sqlstate 'P0002' then null;
  end;

  perform 1
  from public.provision_invited_staff(
    'a0000000-0000-0000-0000-000000000005',
    'c1000000-0000-0000-0000-000000000003'
  );

  select * into strict v_reconciled
  from public.reconcile_staff_invitation(
    repeat('3', 64),
    'a0000000-0000-0000-0000-000000000005'
  );

  if v_reconciled.request_id <> 'c1000000-0000-0000-0000-000000000003'
     or v_reconciled.state <> 'provisioned'
     or v_reconciled.auth_user_id <> 'a0000000-0000-0000-0000-000000000005'
     or v_reconciled.reconciled is not true then
    raise exception 'R-10 smoke: audited reconcile 결과가 다릅니다.';
  end if;

  select * into strict v_failed
  from public.claim_staff_invitation(
    'c1000000-0000-0000-0000-000000000004',
    repeat('4', 64)
  );
  v_failed_token := v_failed.claim_token;

  perform 1
  from public.settle_staff_invitation(
    v_failed.request_id,
    v_failed_token,
    'failed_definitive',
    null,
    'auth_not_configured'
  );

  select * into strict v_reclaimed
  from public.claim_staff_invitation(
    v_failed.request_id,
    repeat('4', 64)
  );

  if v_reclaimed.state <> 'claimed'
     or v_reclaimed.claim_token is null
     or v_reclaimed.claim_token = v_failed_token
     or v_reclaimed.acquired is not true
     or v_reclaimed.replayed is not true then
    raise exception 'R-10 smoke: definitive pre-call failure가 새 token으로 재claim되지 않았습니다.';
  end if;

  perform 1
  from public.settle_staff_invitation(
    v_reclaimed.request_id,
    v_reclaimed.claim_token,
    'unknown',
    null,
    'auth_result_unknown'
  );

  select * into strict v_failed
  from public.claim_staff_invitation(
    'c1000000-0000-0000-0000-000000000007',
    repeat('7', 64)
  );
  v_failed_token := v_failed.claim_token;

  perform 1
  from public.settle_staff_invitation(
    v_failed.request_id,
    v_failed_token,
    'failed_definitive',
    null,
    'auth_not_configured'
  );

  perform 1
  from public.provision_invited_staff(
    'a0000000-0000-0000-0000-000000000005',
    v_failed.request_id
  );

  begin
    perform 1
    from public.claim_staff_invitation(
      v_failed.request_id,
      repeat('7', 64)
    );
    raise exception 'R-10 smoke: 역할 관리 event가 생긴 definitive failure에 재claim token이 발급되었습니다.';
  exception
    when sqlstate '22023' then null;
  end;

  select * into strict v_first
  from public.claim_staff_invitation(
    'c1000000-0000-0000-0000-000000000008',
    repeat('8', 64)
  );

  perform 1
  from public.settle_staff_invitation(
    v_first.request_id,
    v_first.claim_token,
    'auth_succeeded',
    'a0000000-0000-0000-0000-000000000005',
    null
  );

  begin
    perform 1
    from public.settle_staff_invitation(
      v_first.request_id,
      v_first.claim_token,
      'unknown',
      null,
      'auth_result_unknown'
    );
    raise exception 'R-10 smoke: auth_succeeded target binding이 unknown 전이로 지워졌습니다.';
  exception
    when sqlstate '55000' then null;
  end;

  begin
    perform 1
    from public.settle_staff_invitation(
      v_first.request_id,
      v_first.claim_token,
      'auth_succeeded',
      'a0000000-0000-0000-0000-000000000003',
      null
    );
    raise exception 'R-10 smoke: auth_succeeded request가 다른 Auth 사용자로 재결합되었습니다.';
  exception
    when sqlstate '22023' then null;
  end;

  perform 1
  from public.provision_invited_staff(
    'a0000000-0000-0000-0000-000000000005',
    v_first.request_id
  );

  perform 1
  from public.settle_staff_invitation(
    v_first.request_id,
    v_first.claim_token,
    'provisioned',
    'a0000000-0000-0000-0000-000000000005',
    null
  );

  select * into strict v_stale_claim
  from public.claim_staff_invitation(
    'c1000000-0000-0000-0000-000000000005',
    repeat('5', 64)
  );

  if v_stale_claim.claim_token is null then
    raise exception 'R-10 smoke: stale 전환 fixture claim이 생성되지 않았습니다.';
  end if;

  begin
    perform count(*) from private.staff_invitation_requests;
    raise exception 'R-10 smoke: authenticated 사용자가 private ledger를 직접 조회했습니다.';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

do $$
begin
  if exists (
    select 1
    from private.staff_invitation_requests r
    where r.request_id = 'a1000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'R-10 smoke: 기존 role event request ID에 ledger row가 생성되었습니다.';
  end if;

  if (
    select r.state
    from private.staff_invitation_requests r
    where r.request_id = 'c1000000-0000-0000-0000-000000000007'
  ) is distinct from 'failed_definitive' then
    raise exception 'R-10 smoke: event 충돌 definitive row가 재claim으로 변경되었습니다.';
  end if;
end;
$$;

update private.staff_invitation_requests r
set claimed_at = pg_catalog.clock_timestamp() - interval '11 minutes'
where r.request_id = 'c1000000-0000-0000-0000-000000000005';

set local role authenticated;
set local "request.jwt.claim.sub" = 'a0000000-0000-0000-0000-000000000001';

do $$
declare
  v_stale record;
  v_canonical record;
begin
  select * into strict v_stale
  from public.claim_staff_invitation(
    'c1000000-0000-0000-0000-000000000005',
    repeat('5', 64)
  );

  if v_stale.state <> 'unknown'
     or v_stale.failure_code <> 'claim_stale'
     or v_stale.claim_token is not null
     or v_stale.acquired is not false
     or v_stale.replayed is not true then
    raise exception 'R-10 smoke: 10분 초과 claimed request가 unknown으로 격리되지 않았습니다.';
  end if;

  select * into strict v_canonical
  from public.claim_staff_invitation(
    'c1000000-0000-0000-0000-000000000006',
    repeat('5', 64)
  );

  if v_canonical.request_id <> 'c1000000-0000-0000-0000-000000000005'
     or v_canonical.state <> 'unknown'
     or v_canonical.failure_code <> 'claim_stale'
     or v_canonical.claim_token is not null then
    raise exception 'R-10 smoke: 다른 request ID가 stale canonical row로 수렴하지 않았습니다.';
  end if;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'a0000000-0000-0000-0000-000000000002';

do $$
begin
  begin
    perform 1
    from public.claim_staff_invitation(
      'c1000000-0000-0000-0000-000000000001',
      repeat('1', 64)
    );
    raise exception 'R-10 smoke: 다른 actor가 같은 request ID를 재사용했습니다.';
  exception
    when sqlstate '22023' then null;
  end;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'a0000000-0000-0000-0000-000000000001';

do $$
declare
  v_promote record;
  v_retry record;
  v_noop record;
  v_message text;
  v_event_count integer;
begin
  select * into strict v_promote
  from public.change_staff_role(
    'a0000000-0000-0000-0000-000000000003',
    'owner',
    'a1000000-0000-0000-0000-000000000010'
  );

  if v_promote.previous_role <> 'staff'
     or v_promote.next_role <> 'owner'
     or v_promote.event_type <> 'role_changed'
     or v_promote.applied is not true then
    raise exception 'R-10 smoke: staff owner 승격 결과가 다릅니다. result=%', to_jsonb(v_promote);
  end if;

  select count(*)::integer into v_event_count
  from public.role_management_events;

  select * into strict v_retry
  from public.change_staff_role(
    'a0000000-0000-0000-0000-000000000003',
    'owner',
    'a1000000-0000-0000-0000-000000000010'
  );

  if v_retry.event_id is distinct from v_promote.event_id
     or v_retry.applied is not false
     or (select count(*) from public.role_management_events) <> v_event_count then
    raise exception 'R-10 smoke: role change 동일 request 재시도가 멱등하지 않습니다.';
  end if;

  begin
    perform 1
    from public.change_staff_role(
      'a0000000-0000-0000-0000-000000000005',
      'owner',
      'a1000000-0000-0000-0000-000000000010'
    );
    raise exception 'R-10 smoke: role change request_id의 다른 target 재사용이 허용되었습니다.';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    perform 1
    from public.change_staff_role(
      'a0000000-0000-0000-0000-000000000005',
      'admin',
      'a1000000-0000-0000-0000-000000000011'
    );
    raise exception 'R-10 smoke: 허용되지 않은 role 값이 저장되었습니다.';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    perform 1
    from public.change_staff_role(
      'a0000000-0000-0000-0000-000000000004',
      'staff',
      'a1000000-0000-0000-0000-000000000012'
    );
    raise exception 'R-10 smoke: profileless target role 변경이 허용되었습니다.';
  exception
    when sqlstate 'P0002' then null;
  end;

  begin
    perform 1
    from public.change_staff_role(
      'a0000000-0000-0000-0000-000000000001',
      'staff',
      'a1000000-0000-0000-0000-000000000013'
    );
    raise exception 'R-10 smoke: 다중 owner 상태의 자기 강등이 허용되었습니다.';
  exception
    when sqlstate '55000' then
      get stacked diagnostics v_message = message_text;
      if v_message <> '자기 자신의 owner 권한은 변경할 수 없습니다.' then
        raise exception 'R-10 smoke: 자기 강등 차단 오류가 다릅니다. message=%', v_message;
      end if;
  end;

  select * into strict v_noop
  from public.change_staff_role(
    'a0000000-0000-0000-0000-000000000001',
    'owner',
    'a1000000-0000-0000-0000-000000000014'
  );

  if v_noop.previous_role <> 'owner'
     or v_noop.next_role <> 'owner'
     or v_noop.event_type <> 'role_change_noop'
     or v_noop.applied is not false then
    raise exception 'R-10 smoke: 동일 role no-op 계약이 다릅니다.';
  end if;

  perform 1
  from public.change_staff_role(
    'a0000000-0000-0000-0000-000000000002',
    'staff',
    'a1000000-0000-0000-0000-000000000015'
  );

  perform 1
  from public.change_staff_role(
    'a0000000-0000-0000-0000-000000000003',
    'staff',
    'a1000000-0000-0000-0000-000000000016'
  );

  if (select count(*) from public.list_staff_profiles() p where p.role = 'owner') <> 1 then
    raise exception 'R-10 smoke: owner 축소 fixture가 마지막 owner 상태를 만들지 못했습니다.';
  end if;

  begin
    perform 1
    from public.change_staff_role(
      'a0000000-0000-0000-0000-000000000001',
      'staff',
      'a1000000-0000-0000-0000-000000000017'
    );
    raise exception 'R-10 smoke: 마지막 owner 강등이 허용되었습니다.';
  exception
    when sqlstate '55000' then
      get stacked diagnostics v_message = message_text;
      if v_message <> '마지막 owner는 staff로 변경할 수 없습니다.' then
        raise exception 'R-10 smoke: 마지막 owner 차단 오류가 다릅니다. message=%', v_message;
      end if;
  end;

  if not exists (
    select 1
    from public.list_staff_profiles() p
    where p.user_id = 'a0000000-0000-0000-0000-000000000001'
      and p.role = 'owner'
  ) then
    raise exception 'R-10 smoke: 마지막 owner가 보존되지 않았습니다.';
  end if;
end;
$$;

do $$
begin
  begin
    update public.profiles
    set role = 'staff'
    where id = 'a0000000-0000-0000-0000-000000000001';
    raise exception 'R-10 smoke: authenticated direct profile UPDATE가 허용되었습니다.';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.role_management_events (
      actor_id,
      target_user_id,
      previous_role,
      next_role,
      event_type,
      request_id
    ) values (
      'a0000000-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000005',
      'staff',
      'staff',
      'role_change_noop',
      'a1000000-0000-0000-0000-000000000030'
    );
    raise exception 'R-10 smoke: authenticated direct audit INSERT가 허용되었습니다.';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.role_management_events
    set next_role = next_role;
    raise exception 'R-10 smoke: authenticated direct audit UPDATE가 허용되었습니다.';
  exception
    when insufficient_privilege then null;
  end;

  begin
    delete from public.role_management_events;
    raise exception 'R-10 smoke: authenticated direct audit DELETE가 허용되었습니다.';
  exception
    when insufficient_privilege then null;
  end;

  if (select count(*) from public.role_management_events) <> 10 then
    raise exception 'R-10 smoke: 성공/no-op audit 건수가 예상과 다릅니다.';
  end if;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'a0000000-0000-0000-0000-000000000002';

do $$
begin
  begin
    perform 1 from public.list_staff_profiles();
    raise exception 'R-10 smoke: staff 직원 목록 조회가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform 1
    from public.claim_staff_invitation(
      'c2000000-0000-0000-0000-000000000001',
      repeat('a', 64)
    );
    raise exception 'R-10 smoke: staff invitation claim이 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform 1
    from public.settle_staff_invitation(
      'c1000000-0000-0000-0000-000000000001',
      'cf000000-0000-0000-0000-000000000002',
      'unknown',
      null,
      'auth_result_unknown'
    );
    raise exception 'R-10 smoke: staff invitation settle이 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform 1
    from public.reconcile_staff_invitation(
      repeat('1', 64),
      'a0000000-0000-0000-0000-000000000005'
    );
    raise exception 'R-10 smoke: staff invitation reconcile이 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform 1
    from public.provision_invited_staff(
      'a0000000-0000-0000-0000-000000000005',
      'a1000000-0000-0000-0000-000000000020'
    );
    raise exception 'R-10 smoke: staff provisioning이 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform 1
    from public.change_staff_role(
      'a0000000-0000-0000-0000-000000000005',
      'owner',
      'a1000000-0000-0000-0000-000000000021'
    );
    raise exception 'R-10 smoke: staff role 변경이 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  if exists (select 1 from public.role_management_events) then
    raise exception 'R-10 smoke: staff가 role audit을 조회할 수 있습니다.';
  end if;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'a0000000-0000-0000-0000-000000000004';

do $$
begin
  begin
    perform 1 from public.list_staff_profiles();
    raise exception 'R-10 smoke: profileless 사용자의 직원 목록 조회가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform 1
    from public.change_staff_role(
      'a0000000-0000-0000-0000-000000000005',
      'owner',
      'a1000000-0000-0000-0000-000000000022'
    );
    raise exception 'R-10 smoke: profileless 사용자의 role 변경이 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;
end;
$$;

reset role;
set local role anon;
set local "request.jwt.claim.sub" = '';

do $$
begin
  begin
    perform 1 from public.list_staff_profiles();
    raise exception 'R-10 smoke: anon list RPC 실행이 허용되었습니다.';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform 1
    from public.provision_invited_staff(
      'a0000000-0000-0000-0000-000000000005',
      'a1000000-0000-0000-0000-000000000023'
    );
    raise exception 'R-10 smoke: anon provision RPC 실행이 허용되었습니다.';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform 1
    from public.change_staff_role(
      'a0000000-0000-0000-0000-000000000005',
      'owner',
      'a1000000-0000-0000-0000-000000000024'
    );
    raise exception 'R-10 smoke: anon role change RPC 실행이 허용되었습니다.';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform 1
    from public.claim_staff_invitation(
      'c3000000-0000-0000-0000-000000000001',
      repeat('b', 64)
    );
    raise exception 'R-10 smoke: anon invitation claim RPC 실행이 허용되었습니다.';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform 1
    from public.settle_staff_invitation(
      'c1000000-0000-0000-0000-000000000001',
      'cf000000-0000-0000-0000-000000000003',
      'unknown',
      null,
      'auth_result_unknown'
    );
    raise exception 'R-10 smoke: anon invitation settle RPC 실행이 허용되었습니다.';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform 1
    from public.reconcile_staff_invitation(
      repeat('1', 64),
      'a0000000-0000-0000-0000-000000000005'
    );
    raise exception 'R-10 smoke: anon invitation reconcile RPC 실행이 허용되었습니다.';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

set local role service_role;
set local "request.jwt.claim.sub" = '';

do $$
begin
  begin
    perform 1
    from public.claim_staff_invitation(
      'c4000000-0000-0000-0000-000000000001',
      repeat('c', 64)
    );
    raise exception 'R-10 smoke: service_role invitation claim RPC 실행이 허용되었습니다.';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform 1
    from public.settle_staff_invitation(
      'c1000000-0000-0000-0000-000000000001',
      'cf000000-0000-0000-0000-000000000004',
      'unknown',
      null,
      'auth_result_unknown'
    );
    raise exception 'R-10 smoke: service_role invitation settle RPC 실행이 허용되었습니다.';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform 1
    from public.reconcile_staff_invitation(
      repeat('1', 64),
      'a0000000-0000-0000-0000-000000000005'
    );
    raise exception 'R-10 smoke: service_role invitation reconcile RPC 실행이 허용되었습니다.';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

rollback;
