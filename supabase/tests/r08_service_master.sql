-- R-08 disposable PostgreSQL/Supabase smoke test.
-- Run only against an isolated local database after all migrations.
-- Every fixture and mutation is rolled back.

begin;

do $$
declare
  v_privilege text;
  v_guard_definition text;
  v_snapshot_definition text;
begin
  if exists (
    select 1
    from public.salon_service_defaults s
    where s.price_krw is not null
  ) then
    raise exception 'R-08 smoke: 기존 서비스 가격이 추정 backfill되었습니다.';
  end if;

  if exists (
    select 1
    from public.salon_operation_settings s
    where s.default_service_id is not null
  ) then
    raise exception 'R-08 smoke: 기본 서비스 ID가 이름으로 추정 backfill되었습니다.';
  end if;

  foreach v_privilege in array array['SELECT', 'INSERT', 'UPDATE'] loop
    if not has_table_privilege(
      'authenticated',
      'public.salon_service_defaults',
      v_privilege
    ) then
      raise exception 'R-08 smoke: authenticated service defaults % 권한이 없습니다.', v_privilege;
    end if;
  end loop;

  foreach v_privilege in array array[
    'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
  ] loop
    if has_table_privilege(
      'authenticated',
      'public.salon_service_defaults',
      v_privilege
    ) then
      raise exception 'R-08 smoke: authenticated service defaults % 권한이 열려 있습니다.', v_privilege;
    end if;
  end loop;

  foreach v_privilege in array array[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
  ] loop
    if has_table_privilege('anon', 'public.salon_service_defaults', v_privilege) then
      raise exception 'R-08 smoke: anon service defaults % 권한이 열려 있습니다.', v_privilege;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_policy p
    where p.polrelid = 'public.salon_service_defaults'::regclass
      and p.polname = 'Owner and staff can read service defaults'
      and p.polcmd = 'r'
  ) or not exists (
    select 1
    from pg_policy p
    where p.polrelid = 'public.salon_service_defaults'::regclass
      and p.polname = 'Owners can create service defaults'
      and p.polcmd = 'a'
  ) or not exists (
    select 1
    from pg_policy p
    where p.polrelid = 'public.salon_service_defaults'::regclass
      and p.polname = 'Owners can update service defaults'
      and p.polcmd = 'w'
  ) or exists (
    select 1
    from pg_policy p
    where p.polrelid = 'public.salon_service_defaults'::regclass
      and p.polcmd = 'd'
  ) then
    raise exception 'R-08 smoke: 서비스 RLS 정책이 read/create/update/no-delete 계약과 다릅니다.';
  end if;

  if exists (
    select 1
    from (
      values
        ('public.apply_appointment_service_snapshot()'::regprocedure),
        ('public.guard_active_default_service()'::regprocedure),
        ('public.guard_default_service_deactivation()'::regprocedure)
    ) as f(function_oid)
    join pg_proc p on p.oid = f.function_oid
    where (
        p.prosecdef
        or not ('search_path=public' = any (coalesce(p.proconfig, array[]::text[])))
      )
  ) then
    raise exception 'R-08 smoke: trigger 함수가 security invoker/search_path 계약과 다릅니다.';
  end if;

  if exists (
    select 1
    from (
      values
        ('public.guard_active_default_service()'::regprocedure),
        ('public.guard_default_service_deactivation()'::regprocedure)
    ) as f(function_oid)
    join pg_proc p on p.oid = f.function_oid
    where position(
      'pg_catalog.pg_advisory_xact_lock(20260712, 8)'
      in pg_get_functiondef(p.oid)
    ) = 0
  ) then
    raise exception 'R-08 smoke: 기본 서비스 invariant 함수의 공통 advisory lock이 없습니다.';
  end if;

  if exists (
    select 1
    from (
      values
        ('public.apply_appointment_service_snapshot()'::regprocedure),
        ('public.guard_active_default_service()'::regprocedure),
        ('public.guard_default_service_deactivation()'::regprocedure)
    ) as f(function_oid)
    cross join (values ('authenticated'), ('anon')) as r(role_name)
    where has_function_privilege(r.role_name, f.function_oid, 'EXECUTE')
  ) then
    raise exception 'R-08 smoke: trigger 함수가 Data API 역할에 직접 노출되었습니다.';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.salon_operation_settings'::regclass
      and t.tgname = 'guard_active_default_service'
      and not t.tgisinternal
  ) or not exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.salon_service_defaults'::regclass
      and t.tgname = 'guard_default_service_deactivation'
      and not t.tgisinternal
  ) then
    raise exception 'R-08 smoke: 기본 서비스 양방향 invariant trigger가 없습니다.';
  end if;

  select pg_get_triggerdef(t.oid)
  into v_snapshot_definition
  from pg_trigger t
  where t.tgrelid = 'public.appointments'::regclass
    and t.tgname = 'apply_appointment_service_snapshot'
    and not t.tgisinternal;

  select pg_get_triggerdef(t.oid)
  into v_guard_definition
  from pg_trigger t
  where t.tgrelid = 'public.appointments'::regclass
    and t.tgname = 'guard_appointment_conflict_and_business_hours'
    and not t.tgisinternal;

  if v_snapshot_definition is null
     or v_guard_definition is null
     or position('service_id' in lower(v_guard_definition)) = 0
     or 'apply_appointment_service_snapshot' >= 'guard_appointment_conflict_and_business_hours' then
    raise exception 'R-08 smoke: snapshot/R-03 trigger 존재·service_id 감시·실행 순서가 다릅니다.';
  end if;

  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.appointments'::regclass
      and c.conname = 'appointments_service_id_fkey'
      and c.confdeltype = 'r'
  ) or not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.salon_operation_settings'::regclass
      and c.conname = 'salon_operation_settings_default_service_id_fkey'
      and c.confdeltype = 'n'
  ) then
    raise exception 'R-08 smoke: appointment RESTRICT/default SET NULL FK 계약이 다릅니다.';
  end if;
end;
$$;

insert into auth.users (id, created_at)
values
  ('80000000-0000-0000-0000-000000000001', now()),
  ('80000000-0000-0000-0000-000000000002', now());

insert into public.profiles (id, role)
values
  ('80000000-0000-0000-0000-000000000001', 'owner'),
  ('80000000-0000-0000-0000-000000000002', 'staff');

insert into public.customers (id, name, phone, memo)
values (
  '81000000-0000-0000-0000-000000000001',
  'R-08 가상 고객',
  '010-0000-0000',
  'disposable fixture'
);

insert into public.salon_service_defaults (
  id,
  name,
  default_duration_minutes,
  price_krw,
  is_active,
  sort_order
)
values
  (
    '82000000-0000-0000-0000-000000000001',
    'R-08 커트',
    60,
    25000,
    true,
    100
  ),
  (
    '82000000-0000-0000-0000-000000000002',
    'R-08 펌',
    120,
    80000,
    true,
    110
  ),
  (
    '82000000-0000-0000-0000-000000000003',
    'R-08 가격 미설정',
    30,
    null,
    true,
    120
  ),
  (
    '82000000-0000-0000-0000-000000000004',
    'R-08 비활성',
    60,
    40000,
    false,
    130
  ),
  (
    '82000000-0000-0000-0000-000000000006',
    'R-08 무료 서비스',
    45,
    0,
    true,
    135
  );

-- 실제 migration 이전부터 존재할 수 있는 confirmed + NULL service_id 행을 재현한다.
-- R-08은 이 행을 backfill하거나 무관한 수정에서 차단하지 않는다.
alter table public.appointments
  disable trigger apply_appointment_service_snapshot;

insert into public.appointments (
  id,
  customer_id,
  date,
  time,
  service,
  service_id,
  duration_minutes,
  status
)
values (
  '83000000-0000-0000-0000-000000000099',
  '81000000-0000-0000-0000-000000000001',
  '2099-01-11',
  '10:00',
  '기존 confirmed 자유입력',
  null,
  60,
  'confirmed'
);

alter table public.appointments
  enable trigger apply_appointment_service_snapshot;

set local role anon;

do $$
begin
  begin
    perform 1 from public.salon_service_defaults limit 1;
    raise exception 'R-08 smoke: anon 서비스 조회가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '80000000-0000-0000-0000-000000000002';

do $$
declare
  v_visible integer;
  v_rows integer;
begin
  select count(*)::integer
  into v_visible
  from public.salon_service_defaults s
  where s.id in (
    '82000000-0000-0000-0000-000000000001',
    '82000000-0000-0000-0000-000000000002',
    '82000000-0000-0000-0000-000000000003',
    '82000000-0000-0000-0000-000000000004',
    '82000000-0000-0000-0000-000000000006'
  );

  if v_visible <> 5 then
    raise exception 'R-08 smoke: staff가 active/inactive 서비스 전체를 읽지 못합니다.';
  end if;

  update public.appointments
  set memo = '기존 confirmed 무관한 수정'
  where id = '83000000-0000-0000-0000-000000000099';
  get diagnostics v_rows = row_count;

  if v_rows <> 1 or not exists (
    select 1
    from public.appointments a
    where a.id = '83000000-0000-0000-0000-000000000099'
      and a.service_id is null
      and a.price_snapshot_krw is null
      and a.service = '기존 confirmed 자유입력'
      and a.memo = '기존 confirmed 무관한 수정'
  ) then
    raise exception 'R-08 smoke: 기존 confirmed NULL service_id 행의 호환 수정이 실패했습니다.';
  end if;

  begin
    insert into public.salon_service_defaults (name, default_duration_minutes, price_krw)
    values ('staff 생성 차단', 60, 10000);
    raise exception 'R-08 smoke: staff 서비스 생성이 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  update public.salon_service_defaults
  set price_krw = 1
  where id = '82000000-0000-0000-0000-000000000001';
  get diagnostics v_rows = row_count;

  if v_rows <> 0 then
    raise exception 'R-08 smoke: staff 서비스 수정이 허용되었습니다.';
  end if;

  begin
    delete from public.salon_service_defaults
    where id = '82000000-0000-0000-0000-000000000004';
    raise exception 'R-08 smoke: staff 서비스 hard delete가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;
end;
$$;

insert into public.appointments (
  id,
  customer_id,
  date,
  time,
  service,
  service_id,
  duration_minutes,
  price_snapshot_krw,
  status
)
values (
  '83000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000001',
  '2099-01-05',
  '10:00',
  'client 변조 시술명',
  '82000000-0000-0000-0000-000000000001',
  45,
  1,
  'confirmed'
);

insert into public.appointments (
  id,
  customer_id,
  date,
  time,
  service,
  service_id,
  duration_minutes,
  price_snapshot_krw,
  status
)
values (
  '83000000-0000-0000-0000-000000000008',
  '81000000-0000-0000-0000-000000000001',
  '2099-01-12',
  '10:00',
  'client 변조 무료 서비스',
  '82000000-0000-0000-0000-000000000006',
  null,
  999,
  'confirmed'
);

insert into public.appointments (
  id,
  customer_id,
  date,
  time,
  service,
  service_id,
  duration_minutes,
  price_snapshot_krw,
  status
)
values (
  '83000000-0000-0000-0000-000000000002',
  '81000000-0000-0000-0000-000000000001',
  '2099-01-05',
  '11:00',
  'client 변조 가격 미설정',
  '82000000-0000-0000-0000-000000000003',
  null,
  999,
  'confirmed'
);

insert into public.appointments (
  id,
  customer_id,
  date,
  time,
  service,
  service_id,
  duration_minutes,
  price_snapshot_krw,
  status
)
values (
  '83000000-0000-0000-0000-000000000003',
  '81000000-0000-0000-0000-000000000001',
  '2020-01-01',
  '10:00',
  '과거 자유입력 이력',
  null,
  50,
  999,
  'completed'
);

insert into public.appointments (
  id,
  customer_id,
  date,
  time,
  service,
  service_id,
  duration_minutes,
  status
)
values
  (
    '83000000-0000-0000-0000-000000000004',
    '81000000-0000-0000-0000-000000000001',
    '2099-01-06',
    '18:00',
    'client 시술명',
    '82000000-0000-0000-0000-000000000001',
    null,
    'confirmed'
  ),
  (
    '83000000-0000-0000-0000-000000000005',
    '81000000-0000-0000-0000-000000000001',
    '2099-01-07',
    '10:00',
    'client 시술명',
    '82000000-0000-0000-0000-000000000001',
    null,
    'confirmed'
  ),
  (
    '83000000-0000-0000-0000-000000000006',
    '81000000-0000-0000-0000-000000000001',
    '2099-01-08',
    '10:00',
    'client 시술명',
    '82000000-0000-0000-0000-000000000002',
    null,
    'completed'
  ),
  (
    '83000000-0000-0000-0000-000000000007',
    '81000000-0000-0000-0000-000000000001',
    '2099-01-10',
    '10:00',
    'client 시술명',
    '82000000-0000-0000-0000-000000000001',
    null,
    'confirmed'
  );

do $$
declare
  v_guard_blocked boolean := false;
begin
  if not exists (
    select 1
    from public.appointments a
    where a.id = '83000000-0000-0000-0000-000000000001'
      and a.service = 'R-08 커트'
      and a.price_snapshot_krw = 25000
      and a.duration_minutes = 45
  ) then
    raise exception 'R-08 smoke: 신규 예약 이름/가격 강제 또는 duration override가 실패했습니다.';
  end if;

  if not exists (
    select 1
    from public.appointments a
    where a.id = '83000000-0000-0000-0000-000000000002'
      and a.service = 'R-08 가격 미설정'
      and a.price_snapshot_krw is null
      and a.duration_minutes = 30
  ) then
    raise exception 'R-08 smoke: NULL 가격/default duration snapshot이 실패했습니다.';
  end if;

  if not exists (
    select 1
    from public.appointments a
    where a.id = '83000000-0000-0000-0000-000000000008'
      and a.service = 'R-08 무료 서비스'
      and a.price_snapshot_krw = 0
      and a.duration_minutes = 45
  ) then
    raise exception 'R-08 smoke: 0원 서비스가 NULL이 아닌 0으로 snapshot되지 않았습니다.';
  end if;

  if not exists (
    select 1
    from public.appointments a
    where a.id = '83000000-0000-0000-0000-000000000003'
      and a.service_id is null
      and a.service = '과거 자유입력 이력'
      and a.price_snapshot_krw is null
      and a.duration_minutes = 50
  ) then
    raise exception 'R-08 smoke: completed 자유입력/가격 미설정 이력 보존이 실패했습니다.';
  end if;

  begin
    update public.appointments
    set
      service_id = null,
      service = '연결 해제 시도',
      price_snapshot_krw = null
    where id = '83000000-0000-0000-0000-000000000006';
    raise exception 'R-08 smoke: 연결된 completed 예약의 service_id 해제가 허용되었습니다.';
  exception
    when sqlstate '22023' then null;
  end;

  if not exists (
    select 1
    from public.appointments a
    where a.id = '83000000-0000-0000-0000-000000000006'
      and a.service_id = '82000000-0000-0000-0000-000000000002'
      and a.service = 'R-08 펌'
      and a.price_snapshot_krw = 80000
  ) then
    raise exception 'R-08 smoke: 연결 해제 거부 후 기존 snapshot이 보존되지 않았습니다.';
  end if;

  begin
    insert into public.appointments (
      customer_id, date, time, service, service_id, duration_minutes, status
    ) values (
      '81000000-0000-0000-0000-000000000001',
      '2099-01-05',
      '14:00',
      '비활성 차단',
      '82000000-0000-0000-0000-000000000004',
      60,
      'confirmed'
    );
    raise exception 'R-08 smoke: 비활성 서비스 신규 선택이 허용되었습니다.';
  exception
    when sqlstate '55000' then null;
  end;

  begin
    insert into public.appointments (
      customer_id, date, time, service, service_id, duration_minutes, status
    ) values (
      '81000000-0000-0000-0000-000000000001',
      '2099-01-05',
      '15:00',
      '서비스 없는 확정 예약',
      null,
      60,
      'confirmed'
    );
    raise exception 'R-08 smoke: 신규 confirmed 예약에 NULL service_id가 허용되었습니다.';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    insert into public.appointments (
      customer_id, date, time, service, service_id, duration_minutes, status
    ) values (
      '81000000-0000-0000-0000-000000000001',
      '2099-01-05',
      '16:00',
      '서비스 없는 신규 취소 예약',
      null,
      60,
      'cancelled'
    );
    raise exception 'R-08 smoke: 신규 cancelled 예약에 NULL service_id가 허용되었습니다.';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    update public.appointments
    set
      service_id = '82000000-0000-0000-0000-000000000002',
      duration_minutes = null
    where id = '83000000-0000-0000-0000-000000000004';
  exception
    when sqlstate 'P0001' then
      v_guard_blocked := true;
  end;

  if not v_guard_blocked then
    raise exception 'R-08 smoke: service_id 변경 후 R-03 영업시간 guard가 실행되지 않았습니다.';
  end if;

  if not exists (
    select 1
    from public.appointments a
    where a.id = '83000000-0000-0000-0000-000000000004'
      and a.service_id = '82000000-0000-0000-0000-000000000001'
      and a.service = 'R-08 커트'
      and a.duration_minutes = 60
      and a.price_snapshot_krw = 25000
  ) then
    raise exception 'R-08 smoke: guard 실패 후 기존 snapshot이 원자적으로 보존되지 않았습니다.';
  end if;

  update public.appointments
  set service_id = '82000000-0000-0000-0000-000000000002'
  where id = '83000000-0000-0000-0000-000000000005';

  if not exists (
    select 1
    from public.appointments a
    where a.id = '83000000-0000-0000-0000-000000000005'
      and a.service = 'R-08 펌'
      and a.duration_minutes = 60
      and a.price_snapshot_krw = 80000
  ) then
    raise exception 'R-08 smoke: service_id만 변경할 때 기존 non-NULL duration snapshot이 보존되지 않았습니다.';
  end if;

  update public.appointments
  set
    service = 'same-id client 변조',
    price_snapshot_krw = 1,
    duration_minutes = 75
  where id = '83000000-0000-0000-0000-000000000005';

  if not exists (
    select 1
    from public.appointments a
    where a.id = '83000000-0000-0000-0000-000000000005'
      and a.service = 'R-08 펌'
      and a.duration_minutes = 75
      and a.price_snapshot_krw = 80000
  ) then
    raise exception 'R-08 smoke: same service snapshot 보존/duration override가 실패했습니다.';
  end if;

  update public.appointments
  set
    service_id = '82000000-0000-0000-0000-000000000002',
    duration_minutes = 60
  where id = '83000000-0000-0000-0000-000000000007';

  if not exists (
    select 1
    from public.appointments a
    where a.id = '83000000-0000-0000-0000-000000000007'
      and a.service = 'R-08 펌'
      and a.duration_minutes = 60
      and a.price_snapshot_krw = 80000
  ) then
    raise exception 'R-08 smoke: 서비스 변경의 same-as-old duration override가 유지되지 않았습니다.';
  end if;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '80000000-0000-0000-0000-000000000001';

do $$
begin
  insert into public.salon_service_defaults (
    id, name, default_duration_minutes, price_krw, sort_order
  ) values (
    '82000000-0000-0000-0000-000000000005',
    'R-08 owner 생성',
    90,
    60000,
    140
  );

  update public.salon_service_defaults
  set price_krw = 30000
  where id = '82000000-0000-0000-0000-000000000001';

  begin
    update public.salon_operation_settings
    set default_service_id = '82000000-0000-0000-0000-000000000004'
    where id = true;
    raise exception 'R-08 smoke: 비활성 서비스를 기본 서비스로 지정할 수 있었습니다.';
  exception
    when sqlstate '55000' then null;
  end;

  update public.salon_operation_settings
  set default_service_id = null
  where id = true;

  update public.salon_operation_settings
  set default_service_id = '82000000-0000-0000-0000-000000000001'
  where id = true;

  begin
    update public.salon_service_defaults
    set is_active = false
    where id = '82000000-0000-0000-0000-000000000001';
    raise exception 'R-08 smoke: 현재 기본 서비스를 비활성화할 수 있었습니다.';
  exception
    when sqlstate '55000' then null;
  end;

  if not exists (
    select 1
    from public.salon_service_defaults s
    where s.id = '82000000-0000-0000-0000-000000000001'
      and s.is_active
  ) then
    raise exception 'R-08 smoke: 기본 서비스 비활성화 거부 후 active 상태가 보존되지 않았습니다.';
  end if;

  update public.salon_operation_settings
  set default_service_id = '82000000-0000-0000-0000-000000000006'
  where id = true;

  update public.salon_service_defaults
  set is_active = false
  where id = '82000000-0000-0000-0000-000000000001';

  update public.salon_service_defaults
  set is_active = false
  where id = '82000000-0000-0000-0000-000000000002';

  begin
    insert into public.salon_service_defaults (name, default_duration_minutes, price_krw)
    values ('R-08 음수 가격', 60, -1);
    raise exception 'R-08 smoke: 음수 서비스 가격이 허용되었습니다.';
  exception
    when sqlstate '23514' then null;
  end;

  begin
    delete from public.salon_service_defaults
    where id = '82000000-0000-0000-0000-000000000005';
    raise exception 'R-08 smoke: owner hard delete가 허용되었습니다.';
  exception
    when sqlstate '42501' then null;
  end;

  if not exists (
    select 1
    from public.salon_service_defaults s
    where s.id = '82000000-0000-0000-0000-000000000005'
      and s.price_krw = 60000
      and s.is_active
  ) then
    raise exception 'R-08 smoke: owner 서비스 생성/수정 경계가 실패했습니다.';
  end if;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '80000000-0000-0000-0000-000000000002';

do $$
begin
  if not exists (
    select 1
    from public.appointments a
    where a.id = '83000000-0000-0000-0000-000000000001'
      and a.price_snapshot_krw = 25000
  ) then
    raise exception 'R-08 smoke: 마스터 가격 변경이 과거 snapshot을 변경했습니다.';
  end if;

  update public.appointments
  set
    memo = '비활성 참조 예약의 무관한 수정',
    service = '비활성 same-id 변조',
    price_snapshot_krw = 1
  where id = '83000000-0000-0000-0000-000000000005';

  if not exists (
    select 1
    from public.appointments a
    where a.id = '83000000-0000-0000-0000-000000000005'
      and a.memo = '비활성 참조 예약의 무관한 수정'
      and a.service = 'R-08 펌'
      and a.price_snapshot_krw = 80000
  ) then
    raise exception 'R-08 smoke: 비활성 참조 예약의 snapshot 보존이 실패했습니다.';
  end if;

  begin
    update public.appointments
    set status = 'confirmed'
    where id = '83000000-0000-0000-0000-000000000006';
    raise exception 'R-08 smoke: 비활성 서비스로 completed -> confirmed 전환이 허용되었습니다.';
  exception
    when sqlstate '55000' then null;
  end;

  begin
    insert into public.appointments (
      customer_id, date, time, service, service_id, status
    ) values (
      '81000000-0000-0000-0000-000000000001',
      '2099-01-09',
      '10:00',
      '비활성 신규 선택',
      '82000000-0000-0000-0000-000000000002',
      'completed'
    );
    raise exception 'R-08 smoke: completed 이력에 비활성 서비스를 새로 연결했습니다.';
  exception
    when sqlstate '55000' then null;
  end;
end;
$$;

reset role;

do $$
begin
  begin
    delete from public.salon_service_defaults
    where id = '82000000-0000-0000-0000-000000000001';
    raise exception 'R-08 smoke: 참조 서비스 hard delete가 FK에서 허용되었습니다.';
  exception
    when sqlstate '23503' then null;
  end;

  if not exists (
    select 1
    from public.salon_operation_settings s
    where s.id = true
      and s.default_service_id = '82000000-0000-0000-0000-000000000006'
  ) then
    raise exception 'R-08 smoke: FK RESTRICT 실패 후 기본 서비스 참조가 변형되었습니다.';
  end if;
end;
$$;

rollback;
