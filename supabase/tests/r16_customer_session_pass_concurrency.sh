#!/usr/bin/env bash
set -euo pipefail

: "${R16_DISPOSABLE_DATABASE_URL:?Set R16_DISPOSABLE_DATABASE_URL to an isolated local PostgreSQL database.}"

if [[ "${R16_CONFIRM_DISPOSABLE:-}" != "YES" ]]; then
  echo "Refusing to run without R16_CONFIRM_DISPOSABLE=YES." >&2
  exit 2
fi

database_name="$(psql "$R16_DISPOSABLE_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c 'select current_database();')"
case "$database_name" in
  *test*|*tmp*|*r16*|*disposable*) ;;
  *)
    echo "Refusing database '$database_name'; its name does not look disposable." >&2
    exit 2
    ;;
esac

if [[ "$(psql "$R16_DISPOSABLE_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 \
  -c "select to_regprocedure('public.create_appointment_with_session_pass(uuid,uuid,date,time without time zone,uuid,text,text,integer,text,text,uuid,integer,text)') is not null;")" != "t" ]]; then
  echo "R-16 migration is not applied to the disposable database." >&2
  exit 2
fi

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/haircrm-r16-concurrency.XXXXXX")"
capacity_a="$temp_dir/capacity-a.log"
capacity_b="$temp_dir/capacity-b.log"
retry_a="$temp_dir/retry-a.log"
retry_b="$temp_dir/retry-b.log"

cleanup() {
  set +e
  psql "$R16_DISPOSABLE_DATABASE_URL" -X -q -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
delete from public.appointment_session_pass_usages
where appointment_id in (
  select a.id
  from public.appointments a
  where a.customer_id = 'c1600000-0000-0000-0000-000000000002'
);
delete from private.appointment_mutation_requests
where request_id in (
  'c1630000-0000-0000-0000-000000000001',
  'c1630000-0000-0000-0000-000000000002',
  'c1630000-0000-0000-0000-000000000003'
);
delete from public.appointments
where customer_id = 'c1600000-0000-0000-0000-000000000002';
delete from public.customer_session_passes where id = 'c1620000-0000-0000-0000-000000000001';
delete from public.salon_service_defaults where id = 'c1610000-0000-0000-0000-000000000001';
delete from public.customers where id = 'c1600000-0000-0000-0000-000000000002';
delete from public.profiles where id = 'c1600000-0000-0000-0000-000000000001';
delete from auth.users where id = 'c1600000-0000-0000-0000-000000000001';
SQL
  rm -f "$capacity_a" "$capacity_b" "$retry_a" "$retry_b"
  rmdir "$temp_dir" 2>/dev/null || true
}
trap cleanup EXIT

cleanup
mkdir -p "$temp_dir"
trap cleanup EXIT

psql "$R16_DISPOSABLE_DATABASE_URL" -X -q -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users (id, created_at)
values ('c1600000-0000-0000-0000-000000000001', now());
insert into public.profiles (id, role)
values ('c1600000-0000-0000-0000-000000000001', 'staff');
insert into public.customers (id, name, memo)
values ('c1600000-0000-0000-0000-000000000002', 'R16 concurrency fixture', 'synthetic');
insert into public.salon_service_defaults (
  id, name, default_duration_minutes, price_krw, is_active, sort_order
) values (
  'c1610000-0000-0000-0000-000000000001', 'R16 concurrency service', 60, 10000, true, 1699
);
insert into public.customer_session_passes (
  id, customer_id, name, eligible_service_id, total_sessions, purchased_on, status,
  created_by, updated_by
) values (
  'c1620000-0000-0000-0000-000000000001',
  'c1600000-0000-0000-0000-000000000002',
  'R16 last one fixture',
  'c1610000-0000-0000-0000-000000000001',
  1,
  current_date,
  'active',
  'c1600000-0000-0000-0000-000000000001',
  'c1600000-0000-0000-0000-000000000001'
);
SQL

psql "$R16_DISPOSABLE_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 >"$capacity_a" 2>&1 <<'SQL' &
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = 'c1600000-0000-0000-0000-000000000001';
select public.create_appointment_with_session_pass(
  'c1630000-0000-0000-0000-000000000001',
  'c1600000-0000-0000-0000-000000000002',
  '2099-01-05', '10:00',
  'c1610000-0000-0000-0000-000000000001',
  'synthetic', null, 60, null, 'confirmed',
  'c1620000-0000-0000-0000-000000000001', null, null
)->>'appointment_id';
select pg_sleep(1);
commit;
SQL
capacity_a_pid=$!

sleep 0.2

psql "$R16_DISPOSABLE_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 >"$capacity_b" 2>&1 <<'SQL' &
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = 'c1600000-0000-0000-0000-000000000001';
select public.create_appointment_with_session_pass(
  'c1630000-0000-0000-0000-000000000002',
  'c1600000-0000-0000-0000-000000000002',
  '2099-01-05', '12:00',
  'c1610000-0000-0000-0000-000000000001',
  'synthetic', null, 60, null, 'confirmed',
  'c1620000-0000-0000-0000-000000000001', null, null
)->>'appointment_id';
commit;
SQL
capacity_b_pid=$!

set +e
wait "$capacity_a_pid"; capacity_a_status=$?
wait "$capacity_b_pid"; capacity_b_status=$?
set -e

if [[ "$capacity_a_status" -eq "$capacity_b_status" ]]; then
  echo "Expected exactly one last-session reservation to succeed; statuses=$capacity_a_status/$capacity_b_status." >&2
  cat "$capacity_a" "$capacity_b" >&2
  exit 1
fi

read -r appointment_count usage_count request_count <<<"$(
  psql "$R16_DISPOSABLE_DATABASE_URL" -X -qAt -F ' ' -v ON_ERROR_STOP=1 -c "
    select
      count(distinct a.id),
      count(distinct u.id) filter (where u.state = 'reserved'),
      count(distinct r.request_id)
    from private.appointment_mutation_requests r
    left join public.appointments a on a.id = r.appointment_id
    left join public.appointment_session_pass_usages u on u.appointment_id = a.id
    where r.request_id in (
      'c1630000-0000-0000-0000-000000000001',
      'c1630000-0000-0000-0000-000000000002'
    );"
)"

if [[ "$appointment_count" != "1" || "$usage_count" != "1" || "$request_count" != "1" ]]; then
  echo "Last-session race left unexpected rows: appointments=$appointment_count usages=$usage_count requests=$request_count." >&2
  exit 1
fi

psql "$R16_DISPOSABLE_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 >"$retry_a" 2>&1 <<'SQL' &
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = 'c1600000-0000-0000-0000-000000000001';
select public.create_appointment_with_session_pass(
  'c1630000-0000-0000-0000-000000000003',
  'c1600000-0000-0000-0000-000000000002',
  '2099-01-06', '10:00',
  'c1610000-0000-0000-0000-000000000001',
  'synthetic retry', null, 60, null, 'confirmed', null, null, null
)->>'appointment_id';
select pg_sleep(1);
commit;
SQL
retry_a_pid=$!

sleep 0.2

psql "$R16_DISPOSABLE_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 >"$retry_b" 2>&1 <<'SQL' &
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = 'c1600000-0000-0000-0000-000000000001';
select public.create_appointment_with_session_pass(
  'c1630000-0000-0000-0000-000000000003',
  'c1600000-0000-0000-0000-000000000002',
  '2099-01-06', '10:00',
  'c1610000-0000-0000-0000-000000000001',
  'synthetic retry', null, 60, null, 'confirmed', null, null, null
)->>'appointment_id';
commit;
SQL
retry_b_pid=$!

wait "$retry_a_pid"
wait "$retry_b_pid"

retry_a_id="$(head -n 1 "$retry_a")"
retry_b_id="$(head -n 1 "$retry_b")"
if [[ -z "$retry_a_id" || "$retry_a_id" != "$retry_b_id" ]]; then
  echo "Concurrent request UUID retries did not converge: '$retry_a_id' vs '$retry_b_id'." >&2
  exit 1
fi

if [[ "$(psql "$R16_DISPOSABLE_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c "
  select count(*)
  from public.appointments a
  join private.appointment_mutation_requests r on r.appointment_id = a.id
  where r.request_id = 'c1630000-0000-0000-0000-000000000003';")" != "1" ]]; then
  echo "Concurrent request UUID retry created more than one appointment." >&2
  exit 1
fi

echo "R-16 concurrency checks passed: last-session race and concurrent request UUID retry."
