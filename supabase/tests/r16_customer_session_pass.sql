-- R-16 disposable PostgreSQL/Supabase contract smoke.
-- Run only after every forward migration in an isolated database.

begin;

do $$
declare
  v_proc regprocedure;
  v_row pg_proc%rowtype;
begin
  if to_regclass('public.customer_session_passes') is null
     or to_regclass('public.appointment_session_pass_usages') is null
     or to_regclass('private.appointment_mutation_requests') is null then
    raise exception 'R-16 smoke: required tables are missing.';
  end if;

  if not exists (
    select 1 from pg_class c
    where c.oid in (
      'public.customer_session_passes'::regclass,
      'public.appointment_session_pass_usages'::regclass,
      'private.appointment_mutation_requests'::regclass
    )
      and c.relrowsecurity
    having count(*) = 3
  ) then
    raise exception 'R-16 smoke: RLS is not enabled on every new table.';
  end if;

  if not has_table_privilege('authenticated', 'public.customer_session_passes', 'SELECT')
     or not has_table_privilege('authenticated', 'public.appointment_session_pass_usages', 'SELECT')
     or has_table_privilege('authenticated', 'public.customer_session_passes', 'INSERT')
     or has_table_privilege('authenticated', 'public.customer_session_passes', 'UPDATE')
     or has_table_privilege('authenticated', 'public.customer_session_passes', 'DELETE')
     or has_table_privilege('authenticated', 'public.appointment_session_pass_usages', 'INSERT')
     or has_table_privilege('authenticated', 'public.appointment_session_pass_usages', 'UPDATE')
     or has_table_privilege('authenticated', 'public.appointment_session_pass_usages', 'DELETE')
     or has_table_privilege('authenticated', 'public.appointments', 'INSERT')
     or has_table_privilege('authenticated', 'public.appointments', 'UPDATE') then
    raise exception 'R-16 smoke: Data API table grants differ from select/RPC-only contract.';
  end if;

  if has_table_privilege('anon', 'public.customer_session_passes', 'SELECT')
     or has_table_privilege('anon', 'public.appointment_session_pass_usages', 'SELECT')
     or has_schema_privilege('authenticated', 'private', 'USAGE')
     or has_table_privilege('authenticated', 'private.appointment_mutation_requests', 'SELECT') then
    raise exception 'R-16 smoke: anon/private boundary is open.';
  end if;

  foreach v_proc in array array[
    'public.create_customer_session_pass(uuid,text,uuid,integer,date,date,text)'::regprocedure,
    'public.update_customer_session_pass(uuid,text,uuid,integer,date,date,text,text,timestamp with time zone)'::regprocedure,
    'public.list_customer_session_passes(uuid)'::regprocedure,
    'public.list_appointment_session_pass_options(uuid,uuid)'::regprocedure,
    'public.create_appointment_with_session_pass(uuid,uuid,date,time without time zone,uuid,text,text,integer,text,text,uuid,integer,text)'::regprocedure,
    'public.update_appointment_with_session_pass(uuid,uuid,date,time without time zone,uuid,text,text,integer,text,uuid)'::regprocedure,
    'public.set_appointment_status(uuid,uuid,text,text,uuid)'::regprocedure,
    'public.apply_closed_day_with_cancellations(date,uuid[],text)'::regprocedure,
    'public.apply_closed_days_batch_with_cancellations(text,date,date,integer,text)'::regprocedure
  ] loop
    select p.* into v_row from pg_proc p where p.oid = v_proc;
    if not v_row.prosecdef
       or v_row.proconfig <> array['search_path=""']
       or not has_function_privilege('authenticated', v_proc, 'EXECUTE')
       or has_function_privilege('anon', v_proc, 'EXECUTE')
       or exists (
         select 1
         from aclexplode(coalesce(v_row.proacl, acldefault('f', v_row.proowner))) acl
         where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
       ) then
      raise exception 'R-16 smoke: write RPC security/ACL contract failed for %.', v_proc;
    end if;
  end loop;

  if to_regprocedure('public.set_appointment_status(uuid,text,text)') is not null then
    raise exception 'R-16 smoke: legacy status RPC bypass still exists.';
  end if;

  if not exists (
    select 1
    from pg_indexes i
    where i.schemaname = 'public'
      and i.indexname = 'appointment_session_pass_usages_active_appointment_idx'
      and i.indexdef ilike '%where (state = any%reserved%consumed%'
  ) then
    raise exception 'R-16 smoke: active appointment usage unique index is missing.';
  end if;
end;
$$;

insert into auth.users (id, created_at) values
  ('16000000-0000-0000-0000-000000000001', now()),
  ('16000000-0000-0000-0000-000000000002', now()),
  ('16000000-0000-0000-0000-000000000003', now());

insert into public.profiles (id, role) values
  ('16000000-0000-0000-0000-000000000001', 'owner'),
  ('16000000-0000-0000-0000-000000000002', 'staff');

insert into public.customers (id, name, phone, memo) values
  ('16100000-0000-0000-0000-000000000001', 'R16 활성 고객', null, 'fixture'),
  ('16100000-0000-0000-0000-000000000002', 'R16 병합 후보', null, 'fixture'),
  ('16100000-0000-0000-0000-000000000003', 'R16 병합 후보', null, 'fixture'),
  ('16100000-0000-0000-0000-000000000004', 'R16 익명 후보', null, 'fixture');

insert into public.salon_service_defaults (
  id, name, default_duration_minutes, price_krw, is_active, sort_order
) values
  ('16200000-0000-0000-0000-000000000001', 'R16 두피 관리', 60, 30000, true, 1601),
  ('16200000-0000-0000-0000-000000000002', 'R16 클리닉', 60, 40000, true, 1602);

set local role authenticated;
set local "request.jwt.claim.sub" = '16000000-0000-0000-0000-000000000002';

do $$
begin
  begin
    perform public.create_customer_session_pass(
      '16100000-0000-0000-0000-000000000001',
      'staff forbidden',
      null,
      1,
      current_date,
      null,
      null
    );
    raise exception 'R-16 smoke: staff pass management was allowed.';
  exception when sqlstate '42501' then null;
  end;

  begin
    insert into public.appointments (
      customer_id, date, time, service, service_id, status
    ) values (
      '16100000-0000-0000-0000-000000000001',
      current_date + 10,
      '10:00',
      'direct',
      '16200000-0000-0000-0000-000000000001',
      'confirmed'
    );
    raise exception 'R-16 smoke: direct appointment INSERT was allowed.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local "request.jwt.claim.sub" = '16000000-0000-0000-0000-000000000001';

do $$
declare
  v_today date := (pg_catalog.timezone('Asia/Seoul', pg_catalog.clock_timestamp()))::date;
  v_pass public.customer_session_passes%rowtype;
  v_merge_pass public.customer_session_passes%rowtype;
begin
  select * into strict v_pass
  from public.create_customer_session_pass(
    '16100000-0000-0000-0000-000000000001',
    '두피관리 1회권',
    '16200000-0000-0000-0000-000000000001',
    1,
    v_today - 30,
    v_today,
    '내부 메모'
  );

  if v_pass.total_sessions <> 1 or v_pass.status <> 'active' then
    raise exception 'R-16 smoke: owner pass creation returned wrong row.';
  end if;
  if (select count(*) from public.list_customer_session_passes('16100000-0000-0000-0000-000000000001')) <> 1 then
    raise exception 'R-16 smoke: owner pass read RPC failed.';
  end if;

  select * into strict v_merge_pass
  from public.create_customer_session_pass(
    '16100000-0000-0000-0000-000000000002',
    '병합 차단권',
    null,
    2,
    v_today,
    null,
    null
  );

  begin
    perform public.merge_customers(
      '16100000-0000-0000-0000-000000000002',
      '16100000-0000-0000-0000-000000000003'
    );
    raise exception 'R-16 smoke: active pass customer merge was allowed.';
  exception when sqlstate '55000' then null;
  end;
end;
$$;

set local "request.jwt.claim.sub" = '16000000-0000-0000-0000-000000000002';

do $$
declare
  v_pass_id uuid;
  v_create jsonb;
  v_retry jsonb;
  v_appointment_id uuid;
begin
  select id into strict v_pass_id
  from public.customer_session_passes
  where customer_id = '16100000-0000-0000-0000-000000000001';

  if not exists (
    select 1
    from public.list_appointment_session_pass_options(
      '16100000-0000-0000-0000-000000000001',
      '16200000-0000-0000-0000-000000000001'
    ) o
    where o.id = v_pass_id and o.is_available
  ) then
    raise exception 'R-16 smoke: staff appointment pass option RPC failed.';
  end if;

  v_create := public.create_appointment_with_session_pass(
    '16300000-0000-0000-0000-000000000001',
    '16100000-0000-0000-0000-000000000001',
    (pg_catalog.timezone('Asia/Seoul', pg_catalog.clock_timestamp()))::date + 10,
    '10:00',
    '16200000-0000-0000-0000-000000000001',
    'client name ignored',
    '60분',
    60,
    'synthetic',
    'confirmed',
    v_pass_id,
    null,
    null
  );

  v_retry := public.create_appointment_with_session_pass(
    '16300000-0000-0000-0000-000000000001',
    '16100000-0000-0000-0000-000000000001',
    (pg_catalog.timezone('Asia/Seoul', pg_catalog.clock_timestamp()))::date + 10,
    '10:00',
    '16200000-0000-0000-0000-000000000001',
    'client name ignored',
    '60분',
    60,
    'synthetic',
    'confirmed',
    v_pass_id,
    null,
    null
  );

  v_appointment_id := (v_create->>'appointment_id')::uuid;
  if v_appointment_id is null
     or v_retry->>'appointment_id' is distinct from v_create->>'appointment_id'
     or (v_create->>'usage_state') <> 'reserved'
     or (v_create->>'remaining_sessions')::integer <> 0
     or (select count(*) from public.appointments where id = v_appointment_id) <> 1
     or (select count(*) from public.appointment_session_pass_usages where appointment_id = v_appointment_id) <> 1 then
    raise exception 'R-16 smoke: create/idempotency/reserve contract failed. create=% retry=%', v_create, v_retry;
  end if;

  if exists (
    select 1 from public.appointments a
    where a.id = v_appointment_id and a.actual_price_krw is not null
  ) then
    raise exception 'R-16 smoke: pass use auto-filled actual_price_krw.';
  end if;

  begin
    perform public.create_appointment_with_session_pass(
      '16300000-0000-0000-0000-000000000002',
      '16100000-0000-0000-0000-000000000001',
      (pg_catalog.timezone('Asia/Seoul', pg_catalog.clock_timestamp()))::date + 11,
      '11:00',
      '16200000-0000-0000-0000-000000000001',
      'conflict pass capacity',
      '60분',
      60,
      null,
      'confirmed',
      v_pass_id,
      null,
      null
    );
    raise exception 'R-16 smoke: exhausted pass was reused.';
  exception when sqlstate '55000' then null;
  end;

  begin
    insert into public.appointment_session_pass_usages (
      session_pass_id, appointment_id, state, reserved_by
    ) values (v_pass_id, v_appointment_id, 'reserved', auth.uid());
    raise exception 'R-16 smoke: direct usage INSERT was allowed.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;

do $$
begin
  if exists (
    select 1
    from private.appointment_mutation_requests r
    where r.request_id = '16300000-0000-0000-0000-000000000002'
  ) then
    raise exception 'R-16 smoke: failed create left idempotency residue.';
  end if;
end;
$$;

set local role authenticated;
set local "request.jwt.claim.sub" = '16000000-0000-0000-0000-000000000001';

do $$
declare
  v_today date := (pg_catalog.timezone('Asia/Seoul', pg_catalog.clock_timestamp()))::date;
begin
  perform public.create_customer_session_pass(
    '16100000-0000-0000-0000-000000000004', '전이권 A', null, 2, v_today - 2, null, '전이 fixture A'
  );
  perform public.create_customer_session_pass(
    '16100000-0000-0000-0000-000000000004', '전이권 B', null, 2, v_today - 2, null, '전이 fixture B'
  );
end;
$$;

set local "request.jwt.claim.sub" = '16000000-0000-0000-0000-000000000002';

do $$
declare
  v_today date := (pg_catalog.timezone('Asia/Seoul', pg_catalog.clock_timestamp()))::date;
  v_pass_a uuid;
  v_pass_b uuid;
  v_appointment_id uuid;
  v_result jsonb;
begin
  select id into strict v_pass_a from public.customer_session_passes where name = '전이권 A';
  select id into strict v_pass_b from public.customer_session_passes where name = '전이권 B';

  v_result := public.create_appointment_with_session_pass(
    '16300000-0000-0000-0000-000000000200',
    '16100000-0000-0000-0000-000000000004',
    v_today + 23, '10:00', '16200000-0000-0000-0000-000000000001',
    '전이 A', '60분', 60, null, 'confirmed', v_pass_a, null, null
  );
  v_appointment_id := (v_result->>'appointment_id')::uuid;

  v_result := public.update_appointment_with_session_pass(
    '16300000-0000-0000-0000-000000000201', v_appointment_id,
    v_today + 23, '10:00', '16200000-0000-0000-0000-000000000002',
    '전이 B', '60분', 60, null, v_pass_b
  );
  if v_result->>'session_pass_id' is distinct from v_pass_b::text
     or not exists (
       select 1 from public.appointment_session_pass_usages
       where appointment_id = v_appointment_id
         and session_pass_id = v_pass_a
         and state = 'released'
         and release_reason = 'service_changed'
     ) then
    raise exception 'R-16 smoke: service/pass change transition failed. %', v_result;
  end if;

  v_result := public.update_appointment_with_session_pass(
    '16300000-0000-0000-0000-000000000202', v_appointment_id,
    v_today + 23, '10:00', '16200000-0000-0000-0000-000000000002',
    '전이 B', '60분', 60, null, null
  );
  if v_result->>'session_pass_id' is not null
     or not exists (
       select 1 from public.appointment_session_pass_usages
       where appointment_id = v_appointment_id
         and session_pass_id = v_pass_b
         and state = 'released'
         and release_reason = 'pass_removed'
     ) then
    raise exception 'R-16 smoke: pass removal transition failed. %', v_result;
  end if;

  perform public.create_appointment_with_session_pass(
    '16300000-0000-0000-0000-000000000203',
    '16100000-0000-0000-0000-000000000004',
    v_today + 21, '10:00', '16200000-0000-0000-0000-000000000001',
    '단일 휴무', '60분', 60, null, 'confirmed', v_pass_b, null, null
  );
  perform public.create_appointment_with_session_pass(
    '16300000-0000-0000-0000-000000000204',
    '16100000-0000-0000-0000-000000000004',
    v_today + 22, '10:00', '16200000-0000-0000-0000-000000000001',
    '일괄 휴무', '60분', 60, null, 'confirmed', v_pass_a, null, null
  );
end;
$$;

set local "request.jwt.claim.sub" = '16000000-0000-0000-0000-000000000001';

do $$
declare
  v_today date := (pg_catalog.timezone('Asia/Seoul', pg_catalog.clock_timestamp()))::date;
  v_single_id uuid;
  v_result jsonb;
begin
  select id into strict v_single_id
  from public.appointments
  where customer_id = '16100000-0000-0000-0000-000000000004'
    and memo is null
    and date = v_today + 21;

  v_result := public.apply_closed_day_with_cancellations(
    v_today + 21, array[v_single_id], 'R16 single fixture'
  );
  if (v_result->>'cancelled_count')::integer <> 1
     or (v_result->>'released_session_count')::integer <> 1 then
    raise exception 'R-16 smoke: single closed-day release failed. %', v_result;
  end if;

  v_result := public.apply_closed_days_batch_with_cancellations(
    'range', v_today + 22, v_today + 22, null, 'R16 batch fixture'
  );
  if (v_result->>'cancelled_count')::integer <> 1
     or (v_result->>'released_session_count')::integer <> 1 then
    raise exception 'R-16 smoke: batch closed-day release failed. %', v_result;
  end if;
end;
$$;

do $$
declare
  v_today date := (pg_catalog.timezone('Asia/Seoul', pg_catalog.clock_timestamp()))::date;
  v_pass public.customer_session_passes%rowtype;
begin
  select * into strict v_pass from public.customer_session_passes where name = '전이권 A';
  perform public.update_customer_session_pass(
    v_pass.id, v_pass.name, v_pass.eligible_service_id, v_pass.total_sessions,
    v_pass.purchased_on, v_pass.expires_on, v_pass.memo, 'cancelled', v_pass.updated_at
  );

  select * into strict v_pass from public.customer_session_passes where name = '전이권 B';
  perform public.update_customer_session_pass(
    v_pass.id, v_pass.name, v_pass.eligible_service_id, v_pass.total_sessions,
    v_pass.purchased_on, v_today - 1, v_pass.memo, 'active', v_pass.updated_at
  );
end;
$$;

set local "request.jwt.claim.sub" = '16000000-0000-0000-0000-000000000002';

do $$
declare
  v_today date := (pg_catalog.timezone('Asia/Seoul', pg_catalog.clock_timestamp()))::date;
  v_pass_id uuid;
begin
  select id into strict v_pass_id from public.customer_session_passes where name = '전이권 A';
  begin
    perform public.create_appointment_with_session_pass(
      '16300000-0000-0000-0000-000000000205',
      '16100000-0000-0000-0000-000000000004',
      v_today + 24, '10:00', '16200000-0000-0000-0000-000000000001',
      'cancelled 차단', '60분', 60, null, 'confirmed', v_pass_id, null, null
    );
    raise exception 'R-16 smoke: cancelled pass was newly reserved.';
  exception when sqlstate '55000' then null;
  end;

  select id into strict v_pass_id from public.customer_session_passes where name = '전이권 B';
  begin
    perform public.create_appointment_with_session_pass(
      '16300000-0000-0000-0000-000000000206',
      '16100000-0000-0000-0000-000000000004',
      v_today + 25, '10:00', '16200000-0000-0000-0000-000000000001',
      'expired 차단', '60분', 60, null, 'confirmed', v_pass_id, null, null
    );
    raise exception 'R-16 smoke: expired pass was newly reserved.';
  exception when sqlstate '55000' then null;
  end;
end;
$$;

set local "request.jwt.claim.sub" = '16000000-0000-0000-0000-000000000001';

do $$
declare
  v_pass public.customer_session_passes%rowtype;
  v_today date := (pg_catalog.timezone('Asia/Seoul', pg_catalog.clock_timestamp()))::date;
begin
  select * into strict v_pass
  from public.customer_session_passes
  where customer_id = '16100000-0000-0000-0000-000000000001';

  select * into strict v_pass
  from public.update_customer_session_pass(
    v_pass.id,
    v_pass.name,
    v_pass.eligible_service_id,
    v_pass.total_sessions,
    v_pass.purchased_on,
    v_today - 1,
    v_pass.memo,
    'paused',
    v_pass.updated_at
  );

  if v_pass.status <> 'paused' or v_pass.expires_on <> v_today - 1 then
    raise exception 'R-16 smoke: owner pause/expiry update failed.';
  end if;
end;
$$;

set local "request.jwt.claim.sub" = '16000000-0000-0000-0000-000000000002';

do $$
declare
  v_pass_id uuid;
  v_appointment_id uuid;
  v_result jsonb;
begin
  select id into strict v_pass_id
  from public.customer_session_passes
  where customer_id = '16100000-0000-0000-0000-000000000001';

  select appointment_id into strict v_appointment_id
  from public.appointment_session_pass_usages
  where session_pass_id = v_pass_id and state = 'reserved';

  v_result := public.set_appointment_status(
    '16300000-0000-0000-0000-000000000003',
    v_appointment_id,
    'completed',
    null,
    v_pass_id
  );
  if v_result->>'usage_state' <> 'consumed' then
    raise exception 'R-16 smoke: reserved -> consumed failed. %', v_result;
  end if;

  v_result := public.set_appointment_status(
    '16300000-0000-0000-0000-000000000004',
    v_appointment_id,
    'confirmed',
    null,
    v_pass_id
  );
  if v_result->>'usage_state' <> 'reserved' then
    raise exception 'R-16 smoke: paused/expired existing consumed -> reserved failed. %', v_result;
  end if;

  v_result := public.set_appointment_status(
    '16300000-0000-0000-0000-000000000005',
    v_appointment_id,
    'cancelled',
    'test cancellation',
    null
  );
  if v_result->>'usage_state' is not null
     or (
       select sp.total_sessions - count(*) filter (where u.state in ('reserved', 'consumed'))
       from public.customer_session_passes sp
       left join public.appointment_session_pass_usages u on u.session_pass_id = sp.id
       where sp.id = v_pass_id
       group by sp.total_sessions
     ) <> 1
     or not exists (
       select 1 from public.appointment_session_pass_usages u
       where u.appointment_id = v_appointment_id
         and u.state = 'released'
         and u.release_reason = 'appointment_cancelled'
     ) then
    raise exception 'R-16 smoke: cancellation release/remaining failed. %', v_result;
  end if;

  begin
    perform public.set_appointment_status(
      '16300000-0000-0000-0000-000000000006',
      v_appointment_id,
      'confirmed',
      null,
      v_pass_id
    );
    raise exception 'R-16 smoke: paused/expired released pass was re-reserved.';
  exception when sqlstate '55000' then null;
  end;
end;
$$;

set local "request.jwt.claim.sub" = '16000000-0000-0000-0000-000000000001';

do $$
declare
  v_pass public.customer_session_passes%rowtype;
begin
  select * into strict v_pass
  from public.customer_session_passes
  where customer_id = '16100000-0000-0000-0000-000000000004'
  limit 1;
exception when no_data_found then
  select * into strict v_pass
  from public.create_customer_session_pass(
    '16100000-0000-0000-0000-000000000004',
    '익명 처리권',
    null,
    3,
    current_date,
    null,
    '개인정보 금지 메모 fixture'
  );
end;
$$;

select public.anonymize_customer('16100000-0000-0000-0000-000000000004');

do $$
begin
  if exists (
    select 1 from public.customer_session_passes sp
    where sp.customer_id = '16100000-0000-0000-0000-000000000004'
      and sp.memo is not null
  ) then
    raise exception 'R-16 smoke: anonymize did not clear pass memo.';
  end if;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '16000000-0000-0000-0000-000000000003';

do $$
begin
  begin
    perform public.list_customer_session_passes('16100000-0000-0000-0000-000000000001');
    raise exception 'R-16 smoke: profileless authenticated read was allowed.';
  exception when sqlstate '42501' then null;
  end;
end;
$$;

reset role;
set local role anon;

do $$
begin
  begin
    perform public.list_customer_session_passes('16100000-0000-0000-0000-000000000001');
    raise exception 'R-16 smoke: anon RPC execute was allowed.';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
