-- R-15 disposable PostgreSQL/Supabase contract smoke.
-- Run after every forward migration against an isolated database only.

begin;

do $$
declare
  v_price_fn regprocedure := 'public.set_appointment_actual_price(uuid,integer,timestamp with time zone,text)'::regprocedure;
  v_stats_fn regprocedure := 'public.get_stats_summary(date,date)'::regprocedure;
  v_proc pg_proc%rowtype;
  v_price_proc pg_proc%rowtype;
begin
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.appointments'::regclass
      and c.conname = 'appointments_actual_price_krw_check'
  ) then
    raise exception 'R-15 smoke: actual_price_krw non-negative constraint가 없습니다.';
  end if;
  select p.* into v_price_proc from pg_proc p where p.oid = v_price_fn;
  if not has_function_privilege('authenticated', v_price_fn, 'EXECUTE')
     or has_function_privilege('anon', v_price_fn, 'EXECUTE')
     or exists (
       select 1 from aclexplode(coalesce(v_price_proc.proacl, acldefault('f', v_price_proc.proowner))) acl
       where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
     ) then
    raise exception 'R-15 smoke: 실제 금액 RPC ACL이 authenticated-only 계약과 다릅니다.';
  end if;
  if has_column_privilege('authenticated', 'public.appointments', 'actual_price_krw', 'UPDATE')
     or has_column_privilege('authenticated', 'public.appointments', 'actual_price_updated_at', 'UPDATE')
     or has_column_privilege('authenticated', 'public.appointments', 'actual_price_updated_by', 'UPDATE')
     or has_column_privilege('authenticated', 'public.appointments', 'actual_price_update_reason', 'UPDATE') then
    raise exception 'R-15 smoke: 실제 금액/감사 필드 direct UPDATE 권한이 열려 있습니다.';
  end if;
  select p.* into v_proc from pg_proc p where p.oid = v_stats_fn;
  if v_proc.prosecdef or v_proc.provolatile <> 's'
     or v_proc.proconfig <> array['search_path=""'] then
    raise exception 'R-15 smoke: 통계 RPC security invoker/stable/search_path 계약이 다릅니다.';
  end if;
end;
$$;

insert into auth.users (id, created_at) values
  ('f1500000-0000-0000-0000-000000000001', now()),
  ('f1500000-0000-0000-0000-000000000002', now()),
  ('f1500000-0000-0000-0000-000000000003', now());
insert into public.profiles (id, role) values
  ('f1500000-0000-0000-0000-000000000001', 'owner'),
  ('f1500000-0000-0000-0000-000000000002', 'staff');
insert into public.customers (id, name, phone, memo) values
  ('f1510000-0000-0000-0000-000000000001', 'R15 활성', null, 'fixture'),
  ('f1510000-0000-0000-0000-000000000002', 'R15 보관', null, 'fixture'),
  ('f1510000-0000-0000-0000-000000000003', 'R15 병합', null, 'fixture'),
  ('f1510000-0000-0000-0000-000000000004', 'R15 익명', null, 'fixture');
insert into public.salon_service_defaults (id, name, default_duration_minutes, price_krw, is_active, sort_order) values
  ('f1520000-0000-0000-0000-000000000001', 'R15 기준 3만', 60, 30000, true, 901),
  ('f1520000-0000-0000-0000-000000000002', 'R15 무료', 60, 0, true, 902);

set local role authenticated;
set local "request.jwt.claim.sub" = 'f1500000-0000-0000-0000-000000000001';

insert into public.appointments (id, customer_id, date, time, service, service_id, duration_minutes, status, actual_price_krw) values
  ('f1530000-0000-0000-0000-000000000001', 'f1510000-0000-0000-0000-000000000001', '2026-07-01', '10:00', 'client value ignored', 'f1520000-0000-0000-0000-000000000001', 60, 'confirmed', 25000),
  ('f1530000-0000-0000-0000-000000000002', 'f1510000-0000-0000-0000-000000000001', '2026-07-02', '10:00', 'client value ignored', 'f1520000-0000-0000-0000-000000000001', 60, 'completed', null),
  ('f1530000-0000-0000-0000-000000000003', 'f1510000-0000-0000-0000-000000000001', '2026-07-03', '10:00', 'client value ignored', 'f1520000-0000-0000-0000-000000000002', 60, 'completed', null),
  ('f1530000-0000-0000-0000-000000000004', 'f1510000-0000-0000-0000-000000000001', '2026-07-04', '10:00', 'client value ignored', 'f1520000-0000-0000-0000-000000000001', 60, 'completed', null),
  ('f1530000-0000-0000-0000-000000000005', 'f1510000-0000-0000-0000-000000000001', '2026-07-05', '10:00', 'client value ignored', 'f1520000-0000-0000-0000-000000000001', 60, 'cancelled', null),
  ('f1530000-0000-0000-0000-000000000006', 'f1510000-0000-0000-0000-000000000002', '2026-07-06', '10:00', 'client value ignored', 'f1520000-0000-0000-0000-000000000001', 60, 'confirmed', null),
  ('f1530000-0000-0000-0000-000000000007', 'f1510000-0000-0000-0000-000000000003', '2026-07-07', '10:00', 'client value ignored', 'f1520000-0000-0000-0000-000000000001', 60, 'confirmed', null),
  ('f1530000-0000-0000-0000-000000000008', 'f1510000-0000-0000-0000-000000000004', '2026-07-08', '10:00', 'client value ignored', 'f1520000-0000-0000-0000-000000000001', 60, 'confirmed', null);

reset role;
update public.customers set archived_at = now() where id = 'f1510000-0000-0000-0000-000000000002';
update public.customers set archived_at = now(), merged_into_customer_id = 'f1510000-0000-0000-0000-000000000001' where id = 'f1510000-0000-0000-0000-000000000003';
update public.customers set archived_at = now(), anonymized_at = now(), name = '삭제된 고객', phone = null, memo = null where id = 'f1510000-0000-0000-0000-000000000004';
set local role authenticated;
set local "request.jwt.claim.sub" = 'f1500000-0000-0000-0000-000000000001';

do $$
declare v_before timestamptz; v_after timestamptz; v_result record; v_stats record;
begin
  select actual_price_updated_at into v_before from public.appointments where id = 'f1530000-0000-0000-0000-000000000001';
  if v_before is null or not exists (
    select 1 from public.appointments a where a.id = 'f1530000-0000-0000-0000-000000000001'
      and a.actual_price_krw = 25000 and a.actual_price_updated_by = auth.uid() and a.actual_price_update_reason is null
  ) then raise exception 'R-15 smoke: 신규 confirmed INSERT 실제 금액/감사가 실패했습니다.'; end if;

  select * into strict v_result from public.set_appointment_actual_price('f1530000-0000-0000-0000-000000000001', 25000, v_before, null);
  if v_result.actual_price_updated_at is distinct from v_before then raise exception 'R-15 smoke: same-value no-op가 감사 시각을 바꿨습니다.'; end if;

  begin
    update public.appointments set actual_price_krw = 1 where id = 'f1530000-0000-0000-0000-000000000001';
    raise exception 'R-15 smoke: direct actual price UPDATE가 허용됐습니다.';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.set_appointment_actual_price('f1530000-0000-0000-0000-000000000002', 10000, null, null);
    raise exception 'R-15 smoke: completed 실제 금액 사유 누락이 허용됐습니다.';
  exception when sqlstate '22023' then null;
  end;
  select * into strict v_result from public.set_appointment_actual_price('f1530000-0000-0000-0000-000000000002', 10000, null, '현장 할인 적용');
  v_after := v_result.actual_price_updated_at;
  if v_result.actual_price_krw <> 10000 or v_result.actual_price_updated_by <> auth.uid() or v_result.actual_price_update_reason <> '현장 할인 적용' then
    raise exception 'R-15 smoke: completed 실제 금액/감사 값이 다릅니다.';
  end if;
  begin
    perform public.set_appointment_actual_price('f1530000-0000-0000-0000-000000000002', 12000, null, 'stale');
    raise exception 'R-15 smoke: stale optimistic lock이 허용됐습니다.';
  exception when sqlstate '40001' then null;
  end;
  select * into strict v_result from public.set_appointment_actual_price('f1530000-0000-0000-0000-000000000003', 0, null, '무료 시술');
  if v_result.actual_price_krw <> 0 then raise exception 'R-15 smoke: 0원 실제 금액이 NULL과 혼동됐습니다.'; end if;
  begin
    perform public.set_appointment_actual_price('f1530000-0000-0000-0000-000000000004', -1, null, 'invalid');
    raise exception 'R-15 smoke: 음수 실제 금액이 허용됐습니다.';
  exception when sqlstate '22023' then null;
  end;
  select * into strict v_stats from public.get_stats_summary('2026-07-01', '2026-07-31');
  if v_stats.completed_count <> 3 or v_stats.actual_revenue_krw <> 10000
     or v_stats.paid_actual_completed_count <> 1 or v_stats.actual_average_ticket_krw <> 10000
     or v_stats.zero_actual_price_completed_count <> 1 or v_stats.missing_actual_price_completed_count <> 1
     or v_stats.booking_snapshot_revenue_krw <> 60000 then
    raise exception 'R-15 smoke: actual-only stats/snapshot auxiliary contract가 다릅니다. payload=%', to_jsonb(v_stats);
  end if;
end;
$$;

do $$
begin
  begin perform public.set_appointment_actual_price('f1530000-0000-0000-0000-000000000006', 1, null, null); raise exception 'R-15 smoke: archived 고객 수정이 허용됐습니다.'; exception when sqlstate '42501' then null; end;
  begin perform public.set_appointment_actual_price('f1530000-0000-0000-0000-000000000007', 1, null, null); raise exception 'R-15 smoke: merged 고객 수정이 허용됐습니다.'; exception when sqlstate '42501' then null; end;
  begin perform public.set_appointment_actual_price('f1530000-0000-0000-0000-000000000008', 1, null, null); raise exception 'R-15 smoke: anonymized 고객 수정이 허용됐습니다.'; exception when sqlstate '42501' then null; end;
end;
$$;

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'f1500000-0000-0000-0000-000000000003';
do $$ begin
  begin perform public.set_appointment_actual_price('f1530000-0000-0000-0000-000000000001', 1, (select actual_price_updated_at from public.appointments where id = 'f1530000-0000-0000-0000-000000000001'), null); raise exception 'R-15 smoke: profileless authenticated 호출이 허용됐습니다.'; exception when sqlstate '42501' then null; end;
end $$;

reset role;
set local role anon;
do $$ begin
  begin perform public.set_appointment_actual_price('f1530000-0000-0000-0000-000000000001', 1, null, null); raise exception 'R-15 smoke: anon RPC 호출이 허용됐습니다.'; exception when insufficient_privilege then null; end;
end $$;

reset role;
rollback;
