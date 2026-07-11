-- R-07 disposable PostgreSQL/Supabase smoke test.
-- Run only against an isolated local database after all migrations.
-- Every fixture and mutation is rolled back.

begin;

insert into auth.users (id, created_at)
values
  ('70000000-0000-0000-0000-000000000001', now()),
  ('70000000-0000-0000-0000-000000000002', now());

insert into public.profiles (id, role)
values
  ('70000000-0000-0000-0000-000000000001', 'owner'),
  ('70000000-0000-0000-0000-000000000002', 'staff');

insert into public.customers (id, name, phone, memo)
values
  ('71000000-0000-0000-0000-000000000001', '테스트 고객 가', '010-1111-2222', '가상 메모'),
  ('71000000-0000-0000-0000-000000000002', '테스트 고객 나', '01011112222', '가상 메모'),
  ('71000000-0000-0000-0000-000000000003', '비식별 대상', '010-3333-4444', '삭제할 가상 메모'),
  ('71000000-0000-0000-0000-000000000004', '동명이인', '010-5555-6666', null),
  ('71000000-0000-0000-0000-000000000005', '  동명이인  ', '010-7777-8888', null),
  ('71000000-0000-0000-0000-000000000006', '취소 검증 원본', '010-9999-0000', null),
  ('71000000-0000-0000-0000-000000000007', '취소 검증 대표', '01099990000', null),
  ('71000000-0000-0000-0000-000000000008', '원자성 검증 원본', '010-9999-0002', null),
  ('71000000-0000-0000-0000-000000000009', '원자성 검증 대표', '01099990002', null);

insert into public.appointments (
  id,
  customer_id,
  date,
  time,
  service,
  duration_minutes,
  status
)
values
  (
    '72000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    '2026-07-13',
    '10:00',
    '가상 시술',
    60,
    'completed'
  ),
  (
    '72000000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000003',
    '2026-07-13',
    '11:00',
    '가상 시술',
    60,
    'completed'
  ),
  (
    '72000000-0000-0000-0000-000000000003',
    '71000000-0000-0000-0000-000000000006',
    '2026-07-13',
    '12:00',
    '가상 시술',
    60,
    'completed'
  ),
  (
    '72000000-0000-0000-0000-000000000004',
    '71000000-0000-0000-0000-000000000008',
    '2026-07-13',
    '13:00',
    '가상 시술',
    60,
    'completed'
  );

create function pg_temp.r07_force_merge_failure()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('r07.force_merge_failure', true) = 'on'
     and old.customer_id = '71000000-0000-0000-0000-000000000008'
     and new.customer_id = '71000000-0000-0000-0000-000000000009' then
    raise exception using
      errcode = 'R0701',
      message = 'R-07 smoke forced merge failure';
  end if;

  return new;
end;
$$;

create trigger r07_force_merge_failure
  before update of customer_id
  on public.appointments
  for each row execute function pg_temp.r07_force_merge_failure();

do $$
declare
  v_audit_table text;
  v_privilege text;
begin
  if not has_table_privilege('authenticated', 'public.customers', 'SELECT') then
    raise exception 'R-07 smoke: authenticated customers table 권한이 exact column allowlist와 다릅니다.';
  end if;

  foreach v_privilege in array array[
    'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
  ] loop
    if has_table_privilege('authenticated', 'public.customers', v_privilege) then
      raise exception 'R-07 smoke: authenticated customers table-level % 권한이 열려 있습니다.', v_privilege;
    end if;
  end loop;

  foreach v_privilege in array array[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
  ] loop
    if has_table_privilege('anon', 'public.customers', v_privilege) then
      raise exception 'R-07 smoke: anon customers % 권한이 열려 있습니다.', v_privilege;
    end if;
  end loop;

  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'customers'
      and has_column_privilege(
        'authenticated',
        'public.customers',
        c.column_name,
        'INSERT'
      ) is distinct from (c.column_name = any (array['name', 'phone', 'memo']))
  ) then
    raise exception 'R-07 smoke: authenticated customers INSERT 컬럼 allowlist가 정확하지 않습니다.';
  end if;

  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'customers'
      and has_column_privilege(
        'authenticated',
        'public.customers',
        c.column_name,
        'UPDATE'
      ) is distinct from (c.column_name = any (array['name', 'phone', 'memo', 'updated_at']))
  ) then
    raise exception 'R-07 smoke: authenticated customers UPDATE 컬럼 allowlist가 정확하지 않습니다.';
  end if;

  foreach v_audit_table in array array[
    'public.customer_merge_events',
    'public.customer_merge_appointment_moves'
  ] loop
    if not has_table_privilege('authenticated', v_audit_table, 'SELECT') then
      raise exception 'R-07 smoke: % audit table 권한이 exact allowlist와 다릅니다.', v_audit_table;
    end if;

    foreach v_privilege in array array[
      'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
    ] loop
      if has_table_privilege('authenticated', v_audit_table, v_privilege) then
        raise exception 'R-07 smoke: authenticated % audit table % 권한이 열려 있습니다.', v_audit_table, v_privilege;
      end if;
    end loop;

    foreach v_privilege in array array[
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
    ] loop
      if has_table_privilege('anon', v_audit_table, v_privilege) then
        raise exception 'R-07 smoke: anon % audit table % 권한이 열려 있습니다.', v_audit_table, v_privilege;
      end if;
    end loop;
  end loop;

  if exists (
    select 1
    from (
      values
        ('public.archive_customer(uuid,text)'::regprocedure),
        ('public.restore_customer(uuid)'::regprocedure),
        ('public.anonymize_customer(uuid)'::regprocedure),
        ('public.find_customer_duplicates(text,text,uuid)'::regprocedure),
        ('public.list_customer_duplicate_candidates()'::regprocedure),
        ('public.merge_customers(uuid,uuid)'::regprocedure),
        ('public.undo_customer_merge(uuid)'::regprocedure)
    ) as f(function_oid)
    where not has_function_privilege('authenticated', f.function_oid, 'EXECUTE')
       or has_function_privilege('anon', f.function_oid, 'EXECUTE')
  ) then
    raise exception 'R-07 smoke: lifecycle/dedupe RPC EXECUTE 권한이 authenticated/anon 계약과 다릅니다.';
  end if;
end;
$$;

set local role authenticated;
set local "request.jwt.claim.sub" = '70000000-0000-0000-0000-000000000002';

do $$
declare
  v_phone_candidates integer;
  v_name_pairs integer;
  v_staff_customer_id uuid;
  v_legacy_expected_memo constant text := '기존 앱 memo 저장 호환 검증';
  v_legacy_client_updated_at constant timestamptz := '2000-01-01T00:00:00Z'::timestamptz;
  v_legacy_effective_memo text;
  v_legacy_effective_updated_at timestamptz;
begin
  insert into public.customers (name, phone, memo)
  values ('staff 등록 검증', '010 2222 3333', 'staff 등록 가상 메모')
  returning id into v_staff_customer_id;

  if not exists (
    select 1
    from public.customers c
    where c.id = v_staff_customer_id
      and c.name = 'staff 등록 검증'
      and c.phone_normalized = '01022223333'
      and c.archived_at is null
      and c.anonymized_at is null
  ) then
    raise exception 'R-07 smoke: staff 허용 컬럼 insert 또는 전화번호 정규화가 실패했습니다.';
  end if;

  update public.customers
  set
    memo = v_legacy_expected_memo,
    updated_at = v_legacy_client_updated_at
  where id = v_staff_customer_id
  returning memo, updated_at
  into v_legacy_effective_memo, v_legacy_effective_updated_at;

  if v_legacy_effective_memo is distinct from v_legacy_expected_memo then
    raise exception 'R-07 smoke: 기존 앱 memo payload 저장이 실패했습니다.';
  end if;

  if v_legacy_effective_updated_at is null
     or v_legacy_effective_updated_at is not distinct from v_legacy_client_updated_at then
    raise exception 'R-07 smoke: updated_at 서버 시각 overwrite가 실패했습니다.';
  end if;

  begin
    insert into public.customers (name, archived_at)
    values ('lifecycle insert 차단 검증', now());
    raise exception 'R-07 smoke: staff lifecycle 컬럼 insert가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  select count(*)::integer
  into v_phone_candidates
  from public.find_customer_duplicates() d
  where d.phone_normalized = '01011112222'
    and d.match_reason = 'phone_exact';

  if v_phone_candidates <> 2 then
    raise exception 'R-07 smoke: exact normalized phone 후보가 2건이어야 합니다.';
  end if;

  select count(*)::integer
  into v_name_pairs
  from public.list_customer_duplicate_candidates() d
  where d.match_reason = 'name_exact_advisory'
    and d.source_customer_id in (
      '71000000-0000-0000-0000-000000000004',
      '71000000-0000-0000-0000-000000000005'
    )
    and d.target_customer_id in (
      '71000000-0000-0000-0000-000000000004',
      '71000000-0000-0000-0000-000000000005'
    );

  if v_name_pairs <> 1 then
    raise exception 'R-07 smoke: exact name 보조 후보가 1쌍이어야 합니다.';
  end if;

  update public.customers
  set
    name = '비식별 대상 수정',
    phone = '010 3333 4444',
    memo = 'staff 수정 가상 메모'
  where id = '71000000-0000-0000-0000-000000000003';

  if not exists (
    select 1
    from public.customers c
    where c.id = '71000000-0000-0000-0000-000000000003'
      and c.name = '비식별 대상 수정'
      and c.phone = '010 3333 4444'
      and c.phone_normalized = '01033334444'
      and c.memo = 'staff 수정 가상 메모'
  ) then
    raise exception 'R-07 smoke: staff 기본정보 수정 또는 전화번호 정규화가 실패했습니다.';
  end if;

  begin
    perform public.archive_customer(
      '71000000-0000-0000-0000-000000000001',
      'staff 권한 검증'
    );
    raise exception 'R-07 smoke: staff archive가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform public.merge_customers(
      '71000000-0000-0000-0000-000000000001',
      '71000000-0000-0000-0000-000000000002'
    );
    raise exception 'R-07 smoke: staff merge가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform public.restore_customer('71000000-0000-0000-0000-000000000001');
    raise exception 'R-07 smoke: staff restore가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform public.anonymize_customer('71000000-0000-0000-0000-000000000001');
    raise exception 'R-07 smoke: staff anonymize가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform 1
    from public.undo_customer_merge('73000000-0000-0000-0000-000000000001');
    raise exception 'R-07 smoke: staff undo가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    update public.customers
    set archived_at = now()
    where id = '71000000-0000-0000-0000-000000000001';
    raise exception 'R-07 smoke: lifecycle 컬럼 직접 수정이 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '70000000-0000-0000-0000-000000000001';

do $$
declare
  v_event_id uuid;
  v_moved integer;
  v_restored integer;
  v_stale_event_id uuid;
begin
  begin
    perform public.merge_customers(
      '71000000-0000-0000-0000-000000000001',
      '71000000-0000-0000-0000-000000000001'
    );
    raise exception 'R-07 smoke: self merge가 허용되었습니다.';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    perform public.merge_customers(
      '71000000-0000-0000-0000-000000000002',
      '71000000-0000-0000-0000-000000000006'
    );
    raise exception 'R-07 smoke: 후보 관계 없는 active 고객 병합이 허용되었습니다.';
  exception
    when sqlstate '22023' then null;
  end;

  if exists (
    select 1
    from public.customers c
    where c.id in (
      '71000000-0000-0000-0000-000000000002',
      '71000000-0000-0000-0000-000000000006'
    )
      and (
        c.archived_at is not null
        or c.merged_into_customer_id is not null
      )
  ) or exists (
    select 1
    from public.customer_merge_events e
    where e.source_customer_id = '71000000-0000-0000-0000-000000000002'
      and e.target_customer_id = '71000000-0000-0000-0000-000000000006'
  ) or not exists (
    select 1
    from public.appointments a
    where a.id = '72000000-0000-0000-0000-000000000003'
      and a.customer_id = '71000000-0000-0000-0000-000000000006'
  ) then
    raise exception 'R-07 smoke: 후보 관계 없는 병합 거부 후 상태가 변경되었습니다.';
  end if;

  perform public.archive_customer(
    '71000000-0000-0000-0000-000000000001',
    '일반 보관 smoke'
  );

  if not exists (
    select 1
    from public.customers c
    where c.id = '71000000-0000-0000-0000-000000000001'
      and c.archived_at is not null
      and c.archive_reason = '일반 보관 smoke'
  ) then
    raise exception 'R-07 smoke: archive 상태가 저장되지 않았습니다.';
  end if;

  begin
    perform public.merge_customers(
      '71000000-0000-0000-0000-000000000001',
      '71000000-0000-0000-0000-000000000002'
    );
    raise exception 'R-07 smoke: archived source merge가 허용되었습니다.';
  exception
    when sqlstate '55000' then null;
  end;

  begin
    perform public.merge_customers(
      '71000000-0000-0000-0000-000000000002',
      '71000000-0000-0000-0000-000000000001'
    );
    raise exception 'R-07 smoke: archived target merge가 허용되었습니다.';
  exception
    when sqlstate '55000' then null;
  end;

  begin
    insert into public.appointments (
      id,
      customer_id,
      date,
      time,
      service,
      duration_minutes,
      status
    ) values (
      '72000000-0000-0000-0000-000000000099',
      '71000000-0000-0000-0000-000000000001',
      '2026-07-14',
      '10:00',
      '차단 검증',
      60,
      'completed'
    );
    raise exception 'R-07 smoke: archived 고객에게 신규 예약이 허용되었습니다.';
  exception
    when sqlstate '55000' then null;
  end;

  begin
    update public.appointments
    set customer_id = '71000000-0000-0000-0000-000000000001'
    where id = '72000000-0000-0000-0000-000000000003';
    raise exception 'R-07 smoke: 기존 예약을 archived 고객에게 이동할 수 있었습니다.';
  exception
    when sqlstate '55000' then null;
  end;

  if not exists (
    select 1
    from public.appointments a
    where a.id = '72000000-0000-0000-0000-000000000003'
      and a.customer_id = '71000000-0000-0000-0000-000000000006'
  ) then
    raise exception 'R-07 smoke: archived 고객 예약 이동 거부 후 원래 고객이 보존되지 않았습니다.';
  end if;

  perform public.restore_customer('71000000-0000-0000-0000-000000000001');

  if exists (
    select 1
    from public.customers c
    where c.id = '71000000-0000-0000-0000-000000000001'
      and c.archived_at is not null
  ) then
    raise exception 'R-07 smoke: restore가 archive 상태를 제거하지 못했습니다.';
  end if;

  perform public.anonymize_customer('71000000-0000-0000-0000-000000000003');

  if not exists (
    select 1
    from public.customers c
    where c.id = '71000000-0000-0000-0000-000000000003'
      and c.name = '삭제된 고객'
      and c.phone is null
      and c.phone_normalized is null
      and c.memo is null
      and c.archived_at is not null
      and c.anonymized_at is not null
  ) then
    raise exception 'R-07 smoke: 비식별화 결과가 정책과 다릅니다.';
  end if;

  if not exists (
    select 1
    from public.appointments a
    where a.id = '72000000-0000-0000-0000-000000000002'
      and a.customer_id = '71000000-0000-0000-0000-000000000003'
  ) then
    raise exception 'R-07 smoke: 비식별화 중 예약 이력이 손실되었습니다.';
  end if;

  begin
    perform public.merge_customers(
      '71000000-0000-0000-0000-000000000003',
      '71000000-0000-0000-0000-000000000004'
    );
    raise exception 'R-07 smoke: anonymized source merge가 허용되었습니다.';
  exception
    when sqlstate '55000' then null;
  end;

  begin
    perform public.merge_customers(
      '71000000-0000-0000-0000-000000000004',
      '71000000-0000-0000-0000-000000000003'
    );
    raise exception 'R-07 smoke: anonymized target merge가 허용되었습니다.';
  exception
    when sqlstate '55000' then null;
  end;

  select m.event_id, m.moved_appointment_count
  into v_event_id, v_moved
  from public.merge_customers(
    '71000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000002'
  ) m;

  if v_moved <> 1 then
    raise exception 'R-07 smoke: 병합 예약 이동 수가 1이 아닙니다.';
  end if;

  if not exists (
    select 1
    from public.appointments a
    where a.id = '72000000-0000-0000-0000-000000000001'
      and a.customer_id = '71000000-0000-0000-0000-000000000002'
  ) or not exists (
    select 1
    from public.customer_merge_events e
    join public.customer_merge_appointment_moves move on move.event_id = e.id
    where e.id = v_event_id
      and move.appointment_id = '72000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'R-07 smoke: 병합 이동 또는 감사 mapping이 누락되었습니다.';
  end if;

  select u.restored_appointment_count
  into v_restored
  from public.undo_customer_merge(v_event_id) u;

  if v_restored <> 1 or not exists (
    select 1
    from public.appointments a
    where a.id = '72000000-0000-0000-0000-000000000001'
      and a.customer_id = '71000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'R-07 smoke: 병합 취소가 예약을 원본 고객에게 복원하지 못했습니다.';
  end if;

  select m.event_id
  into v_stale_event_id
  from public.merge_customers(
    '71000000-0000-0000-0000-000000000006',
    '71000000-0000-0000-0000-000000000007'
  ) m;

  update public.customers
  set name = '취소 검증 대표 수정'
  where id = '71000000-0000-0000-0000-000000000007';

  begin
    perform public.undo_customer_merge(v_stale_event_id);
    raise exception 'R-07 smoke: stale 대표 고객의 병합 취소가 허용되었습니다.';
  exception
    when sqlstate '55000' then null;
  end;

  perform set_config('r07.force_merge_failure', 'on', true);

  begin
    perform public.merge_customers(
      '71000000-0000-0000-0000-000000000008',
      '71000000-0000-0000-0000-000000000009'
    );
    raise exception 'R-07 smoke: 강제 오류가 병합을 중단하지 못했습니다.';
  exception
    when sqlstate 'R0701' then null;
  end;

  perform set_config('r07.force_merge_failure', 'off', true);

  if exists (
    select 1
    from public.customers c
    where c.id = '71000000-0000-0000-0000-000000000008'
      and (
        c.archived_at is not null
        or c.merged_into_customer_id is not null
      )
  ) or not exists (
    select 1
    from public.appointments a
    where a.id = '72000000-0000-0000-0000-000000000004'
      and a.customer_id = '71000000-0000-0000-0000-000000000008'
  ) or exists (
    select 1
    from public.customer_merge_events e
    where e.source_customer_id = '71000000-0000-0000-0000-000000000008'
      and e.target_customer_id = '71000000-0000-0000-0000-000000000009'
  ) or exists (
    select 1
    from public.customer_merge_appointment_moves move
    where move.appointment_id = '72000000-0000-0000-0000-000000000004'
  ) then
    raise exception 'R-07 smoke: 강제 오류 뒤 병합 일부 상태가 남았습니다.';
  end if;

  begin
    delete from public.customers
    where id = '71000000-0000-0000-0000-000000000001';
    raise exception 'R-07 smoke: authenticated hard delete가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    delete from public.appointments
    where id = '72000000-0000-0000-0000-000000000001';
    raise exception 'R-07 smoke: authenticated 예약 hard delete가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '70000000-0000-0000-0000-000000000002';

do $$
begin
  if exists (select 1 from public.customer_merge_events) then
    raise exception 'R-07 smoke: staff가 merge audit event를 조회할 수 있습니다.';
  end if;

  if exists (select 1 from public.customer_merge_appointment_moves) then
    raise exception 'R-07 smoke: staff가 merge appointment mapping을 조회할 수 있습니다.';
  end if;
end;
$$;

reset role;
set local role anon;
set local "request.jwt.claim.sub" = '';

do $$
begin
  begin
    perform 1 from public.customers limit 1;
    raise exception 'R-07 smoke: anon 고객 조회가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform public.archive_customer(
      '71000000-0000-0000-0000-000000000001',
      'anon 권한 검증'
    );
    raise exception 'R-07 smoke: anon archive RPC가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform 1 from public.customer_merge_events limit 1;
    raise exception 'R-07 smoke: anon merge audit 조회가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform 1 from public.customer_merge_appointment_moves limit 1;
    raise exception 'R-07 smoke: anon merge appointment mapping 조회가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform public.restore_customer('71000000-0000-0000-0000-000000000001');
    raise exception 'R-07 smoke: anon restore RPC가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform public.anonymize_customer('71000000-0000-0000-0000-000000000001');
    raise exception 'R-07 smoke: anon anonymize RPC가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform 1 from public.find_customer_duplicates();
    raise exception 'R-07 smoke: anon duplicate lookup RPC가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform 1 from public.list_customer_duplicate_candidates();
    raise exception 'R-07 smoke: anon duplicate list RPC가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform 1
    from public.merge_customers(
      '71000000-0000-0000-0000-000000000001',
      '71000000-0000-0000-0000-000000000002'
    );
    raise exception 'R-07 smoke: anon merge RPC가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    perform 1
    from public.undo_customer_merge('73000000-0000-0000-0000-000000000001');
    raise exception 'R-07 smoke: anon undo RPC가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;
end;
$$;

reset role;

drop trigger r07_force_merge_failure on public.appointments;
drop function pg_temp.r07_force_merge_failure();

do $$
begin
  begin
    delete from public.customers
    where id = '71000000-0000-0000-0000-000000000001';
    raise exception 'R-07 smoke: 예약 보유 고객의 FK RESTRICT가 작동하지 않았습니다.';
  exception
    when foreign_key_violation then null;
  end;
end;
$$;

rollback;
