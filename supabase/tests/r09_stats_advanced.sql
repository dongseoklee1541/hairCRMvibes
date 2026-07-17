-- R-09 disposable PostgreSQL/Supabase smoke test.
-- Run only against an isolated database after all forward migrations.
-- Every fixture is rolled back.

begin;

do $$
declare
  v_function regprocedure := 'public.get_stats_summary(date,date)'::regprocedure;
  v_proc pg_proc%rowtype;
begin
  select p.* into v_proc
  from pg_proc p
  where p.oid = v_function;

  if v_proc.prosecdef
     or v_proc.provolatile <> 's'
     or v_proc.proconfig <> array['search_path=""'] then
    raise exception 'R-09 smoke: RPC가 security invoker/stable/empty search_path 계약과 다릅니다.';
  end if;

  if not has_function_privilege('authenticated', v_function, 'EXECUTE') then
    raise exception 'R-09 smoke: authenticated RPC EXECUTE 권한이 없습니다.';
  end if;

  if has_function_privilege('anon', v_function, 'EXECUTE') then
    raise exception 'R-09 smoke: anon RPC EXECUTE 권한이 열려 있습니다.';
  end if;

  if exists (
    select 1
    from aclexplode(coalesce(v_proc.proacl, acldefault('f', v_proc.proowner))) acl
    where acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'R-09 smoke: PUBLIC RPC EXECUTE 권한이 열려 있습니다.';
  end if;
end;
$$;

insert into auth.users (id, created_at)
values
  ('90000000-0000-0000-0000-000000000001', now()),
  ('90000000-0000-0000-0000-000000000002', now()),
  ('90000000-0000-0000-0000-000000000003', now());

insert into public.profiles (id, role)
values
  ('90000000-0000-0000-0000-000000000001', 'owner'),
  ('90000000-0000-0000-0000-000000000002', 'staff');

insert into public.customers (id, name, phone, memo)
values
  ('91000000-0000-0000-0000-000000000001', 'R-09 가상 고객 1', null, 'disposable fixture'),
  ('91000000-0000-0000-0000-000000000002', 'R-09 가상 고객 2', null, 'disposable fixture'),
  ('91000000-0000-0000-0000-000000000003', 'R-09 가상 고객 3', null, 'disposable fixture'),
  ('91000000-0000-0000-0000-000000000004', 'R-09 가상 고객 4', null, 'disposable fixture'),
  ('91000000-0000-0000-0000-000000000005', 'R-09 가상 고객 5', null, 'disposable fixture');

insert into public.salon_service_defaults (
  id,
  name,
  default_duration_minutes,
  price_krw,
  is_active,
  sort_order
)
values
  ('92000000-0000-0000-0000-000000000001', 'R-09 커트', 60, 30000, true, 200),
  ('92000000-0000-0000-0000-000000000002', 'R-09 무료', 60, 0, true, 210),
  ('92000000-0000-0000-0000-000000000003', 'R-09 상담', 60, null, true, 220),
  ('92000000-0000-0000-0000-000000000004', 'R-09 염색', 90, 70000, true, 230);

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
    '93000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000005',
    '2026-06-30', '09:00', 'ignored',
    '92000000-0000-0000-0000-000000000001', 60, 'completed'
  ),
  (
    '93000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000001',
    '2026-07-01', '09:00', 'ignored',
    '92000000-0000-0000-0000-000000000001', 60, 'completed'
  ),
  (
    '93000000-0000-0000-0000-000000000003',
    '91000000-0000-0000-0000-000000000001',
    '2026-07-15', '09:00', 'ignored',
    '92000000-0000-0000-0000-000000000001', 60, 'completed'
  ),
  (
    '93000000-0000-0000-0000-000000000004',
    '91000000-0000-0000-0000-000000000002',
    '2026-07-16', '09:00', 'ignored',
    '92000000-0000-0000-0000-000000000002', 60, 'completed'
  ),
  (
    '93000000-0000-0000-0000-000000000005',
    '91000000-0000-0000-0000-000000000003',
    '2026-07-17', '09:00', 'ignored',
    '92000000-0000-0000-0000-000000000003', 60, 'completed'
  ),
  (
    '93000000-0000-0000-0000-000000000007',
    '91000000-0000-0000-0000-000000000005',
    '2026-07-31', '09:00', 'ignored',
    '92000000-0000-0000-0000-000000000004', 90, 'completed'
  ),
  (
    '93000000-0000-0000-0000-000000000008',
    '91000000-0000-0000-0000-000000000005',
    '2026-08-01', '09:00', 'ignored',
    '92000000-0000-0000-0000-000000000001', 60, 'completed'
  ),
  (
    '93000000-0000-0000-0000-000000000009',
    '91000000-0000-0000-0000-000000000001',
    '2026-07-10', '10:00', 'ignored',
    '92000000-0000-0000-0000-000000000001', 60, 'confirmed'
  ),
  (
    '93000000-0000-0000-0000-000000000010',
    '91000000-0000-0000-0000-000000000001',
    '2026-07-10', '11:00', 'ignored',
    '92000000-0000-0000-0000-000000000002', 60, 'confirmed'
  ),
  (
    '93000000-0000-0000-0000-000000000011',
    '91000000-0000-0000-0000-000000000001',
    '2026-07-10', '12:00', 'ignored',
    '92000000-0000-0000-0000-000000000003', 60, 'confirmed'
  ),
  (
    '93000000-0000-0000-0000-000000000012',
    '91000000-0000-0000-0000-000000000001',
    '2026-07-10', '13:00', 'ignored',
    '92000000-0000-0000-0000-000000000001', 60, 'cancelled'
  ),
  (
    '93000000-0000-0000-0000-000000000013',
    '91000000-0000-0000-0000-000000000001',
    '2026-07-10', '14:00', 'ignored',
    '92000000-0000-0000-0000-000000000002', 60, 'cancelled'
  ),
  (
    '93000000-0000-0000-0000-000000000014',
    '91000000-0000-0000-0000-000000000001',
    '2026-07-10', '15:00', 'ignored',
    '92000000-0000-0000-0000-000000000003', 60, 'cancelled'
  );

-- A completed free-text history is the allowed service_id NULL case.
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
  '93000000-0000-0000-0000-000000000006',
  '91000000-0000-0000-0000-000000000004',
  '2026-07-18',
  '09:00',
  'R-09 자유입력',
  null,
  60,
  'completed'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '90000000-0000-0000-0000-000000000001';

do $$
declare
  v_result record;
  v_first_service jsonb;
  v_payload jsonb;
  v_expected_result_keys text[] := array[
    'actual_average_ticket_krw',
    'actual_revenue_krw',
    'booking_snapshot_missing_completed_count',
    'booking_snapshot_priced_completed_count',
    'booking_snapshot_revenue_krw',
    'completed_count',
    'completed_customer_count',
    'missing_actual_price_completed_count',
    'missing_actual_price_rate',
    'missing_actual_price_with_service_count',
    'missing_actual_price_without_service_count',
    'paid_actual_completed_count',
    'period_end',
    'period_start',
    'repeat_customer_count',
    'repeat_rate',
    'service_breakdown',
    'zero_actual_price_completed_count'
  ];
  v_expected_service_keys text[] := array[
    'actual_average_ticket_krw',
    'actual_revenue_krw',
    'booking_snapshot_revenue_krw',
    'completed_count',
    'missing_actual_price_count',
    'paid_actual_completed_count',
    'service_name'
  ];
begin
  select * into strict v_result
  from public.get_stats_summary('2026-07-01', '2026-07-31');

  if v_result.period_start <> '2026-07-01'::date
     or v_result.period_end <> '2026-07-31'::date
     or v_result.completed_count <> 6
     or v_result.actual_revenue_krw <> 0
     or v_result.paid_actual_completed_count <> 0
     or v_result.actual_average_ticket_krw is not null
     or v_result.zero_actual_price_completed_count <> 0
     or v_result.missing_actual_price_completed_count <> 6
     or v_result.missing_actual_price_rate <> 100.0
     or v_result.missing_actual_price_without_service_count <> 1
     or v_result.missing_actual_price_with_service_count <> 5
     or v_result.booking_snapshot_revenue_krw <> 130000
     or v_result.booking_snapshot_priced_completed_count <> 4
     or v_result.booking_snapshot_missing_completed_count <> 2
     or v_result.completed_customer_count <> 5
     or v_result.repeat_customer_count <> 1
     or v_result.repeat_rate <> 20.0 then
    raise exception 'R-09 smoke: owner KPI 또는 inclusive KST date 경계가 계약과 다릅니다. payload=%', to_jsonb(v_result);
  end if;

  if jsonb_array_length(v_result.service_breakdown) <> 5 then
    raise exception 'R-09 smoke: service ranking이 5행으로 제한되지 않았습니다.';
  end if;

  v_first_service := v_result.service_breakdown -> 0;
  if v_first_service ->> 'service_name' <> 'R-09 커트'
     or (v_first_service ->> 'completed_count')::bigint <> 2
     or (v_first_service ->> 'actual_revenue_krw')::bigint <> 0
     or (v_first_service ->> 'booking_snapshot_revenue_krw')::bigint <> 60000
     or (v_first_service ->> 'actual_average_ticket_krw') is not null then
    raise exception 'R-09 smoke: service actual/snapshot 분리 ranking이 계약과 다릅니다. first=%', v_first_service;
  end if;

  v_payload := to_jsonb(v_result);

  if array(
    select k
    from jsonb_object_keys(v_payload) as keys(k)
    order by k
  ) is distinct from v_expected_result_keys then
    raise exception 'R-09 smoke: RPC 반환 column allowlist가 다릅니다. keys=%', array(
      select k from jsonb_object_keys(v_payload) as keys(k) order by k
    );
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_result.service_breakdown) item
    where array(
      select k
      from jsonb_object_keys(item) as keys(k)
      order by k
    ) is distinct from v_expected_service_keys
  ) then
    raise exception 'R-09 smoke: service breakdown column allowlist가 다릅니다.';
  end if;

  if v_payload::text ~* '(customer_id|customer_name|phone|memo|appointment_id|R-09 가상 고객)' then
    raise exception 'R-09 smoke: 집계 응답에 고객 개인정보 또는 원본 예약 식별자가 포함됐습니다.';
  end if;

  select * into strict v_result
  from public.get_stats_summary('2026-09-01', '2026-09-30');

  if v_result.completed_count <> 0
     or v_result.actual_revenue_krw <> 0
     or v_result.actual_average_ticket_krw is not null
     or v_result.missing_actual_price_rate is not null
     or v_result.repeat_rate is not null
     or v_result.service_breakdown <> '[]'::jsonb then
    raise exception 'R-09 smoke: empty denominator가 데이터 없음(NULL) 계약과 다릅니다. payload=%', to_jsonb(v_result);
  end if;

  begin
    perform public.get_stats_summary('2026-07-31', '2026-07-01');
    raise exception 'R-09 smoke: 역순 기간이 허용됐습니다.';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    perform public.get_stats_summary('2026-01-01', '2027-01-02');
    raise exception 'R-09 smoke: 366일 초과 기간이 허용됐습니다.';
  exception
    when sqlstate '22023' then null;
  end;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '90000000-0000-0000-0000-000000000002';

do $$
declare
  v_staff record;
begin
  select * into strict v_staff
  from public.get_stats_summary('2026-07-01', '2026-07-31');

  if v_staff.completed_count <> 6
     or v_staff.actual_revenue_krw <> 0
     or v_staff.repeat_rate <> 20.0 then
    raise exception 'R-09 smoke: staff 집계가 승인된 owner 공통 계약과 다릅니다.';
  end if;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = '90000000-0000-0000-0000-000000000003';

do $$
begin
  begin
    perform public.get_stats_summary('2026-07-01', '2026-07-31');
    raise exception 'R-09 smoke: profile 없는 authenticated 사용자가 RPC를 호출했습니다.';
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
    perform public.get_stats_summary('2026-07-01', '2026-07-31');
    raise exception 'R-09 smoke: anon 사용자가 RPC를 호출했습니다.';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
