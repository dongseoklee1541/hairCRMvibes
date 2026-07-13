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

  if (select count(*) from public.role_management_events) <> 6 then
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
end;
$$;

reset role;

rollback;
