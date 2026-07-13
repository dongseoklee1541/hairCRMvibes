#!/usr/bin/env bash
set -euo pipefail

: "${R10_DISPOSABLE_DATABASE_URL:?Set R10_DISPOSABLE_DATABASE_URL to an isolated local PostgreSQL database.}"

if [[ "${R10_CONFIRM_DISPOSABLE:-}" != "YES" ]]; then
  echo "Refusing to run without R10_CONFIRM_DISPOSABLE=YES." >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required." >&2
  exit 2
fi

database_name="$({
  psql "$R10_DISPOSABLE_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 \
    -c 'select current_database();'
})"

case "$database_name" in
  *test*|*tmp*|*r10*|*disposable*) ;;
  *)
    echo "Refusing database '$database_name'; its name does not look disposable." >&2
    exit 2
    ;;
esac

if [[ "$(psql "$R10_DISPOSABLE_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 \
  -c "select to_regprocedure('public.change_staff_role(uuid,text,uuid)') is not null;")" != "t" ]]; then
  echo "R-10 migration is not applied to the disposable database." >&2
  exit 2
fi

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/haircrm-r10-concurrency.XXXXXX")"
session_a_output="$temp_dir/session-a.log"
session_b_output="$temp_dir/session-b.log"

cleanup() {
  set +e
  psql "$R10_DISPOSABLE_DATABASE_URL" -X -q -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
delete from public.role_management_events
where actor_id in (
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002'
)
or target_user_id in (
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002'
);

delete from public.profiles
where id in (
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002'
);

delete from auth.users
where id in (
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002'
);
SQL

  [[ -f "$session_a_output" ]] && rm "$session_a_output"
  [[ -f "$session_b_output" ]] && rm "$session_b_output"
  rmdir "$temp_dir" 2>/dev/null || true
}
trap cleanup EXIT

# The test is intentionally committed inside an explicitly disposable database
# so two independent sessions can observe the same fixtures. The EXIT trap
# removes every synthetic row even when one session fails as expected.
psql "$R10_DISPOSABLE_DATABASE_URL" -X -q -v ON_ERROR_STOP=1 <<'SQL'
delete from public.role_management_events
where actor_id in (
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002'
)
or target_user_id in (
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002'
);

delete from public.profiles
where id in (
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002'
);

delete from auth.users
where id in (
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002'
);

insert into auth.users (id, created_at)
values
  ('b0000000-0000-0000-0000-000000000001', now()),
  ('b0000000-0000-0000-0000-000000000002', now());

insert into public.profiles (id, role)
values
  ('b0000000-0000-0000-0000-000000000001', 'owner'),
  ('b0000000-0000-0000-0000-000000000002', 'owner');
SQL

psql "$R10_DISPOSABLE_DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$session_a_output" 2>&1 <<'SQL' &
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = 'b0000000-0000-0000-0000-000000000001';
select *
from public.change_staff_role(
  'b0000000-0000-0000-0000-000000000002',
  'staff',
  'b1000000-0000-0000-0000-000000000001'
);
select pg_sleep(1);
commit;
SQL
session_a_pid=$!

# Give session A time to enter change_staff_role and hold the transaction lock.
sleep 0.2

psql "$R10_DISPOSABLE_DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$session_b_output" 2>&1 <<'SQL' &
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = 'b0000000-0000-0000-0000-000000000002';
select *
from public.change_staff_role(
  'b0000000-0000-0000-0000-000000000001',
  'staff',
  'b1000000-0000-0000-0000-000000000002'
);
commit;
SQL
session_b_pid=$!

set +e
wait "$session_a_pid"
session_a_status=$?
wait "$session_b_pid"
session_b_status=$?
set -e

if [[ "$session_a_status" -eq 0 && "$session_b_status" -eq 0 ]]; then
  echo "Both cross-demotions succeeded; last-owner invariant failed." >&2
  exit 1
fi

if [[ "$session_a_status" -ne 0 && "$session_b_status" -ne 0 ]]; then
  echo "Both cross-demotions failed; concurrency contract was not exercised." >&2
  cat "$session_a_output" >&2
  cat "$session_b_output" >&2
  exit 1
fi

read -r owner_count event_count <<<"$(
  psql "$R10_DISPOSABLE_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 \
    -F ' ' -c "
      select
        count(*) filter (where p.role = 'owner'),
        (
          select count(*)
          from public.role_management_events e
          where e.request_id in (
            'b1000000-0000-0000-0000-000000000001',
            'b1000000-0000-0000-0000-000000000002'
          )
        )
      from public.profiles p
      where p.id in (
        'b0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000002'
      );
    "
)"

if [[ "$owner_count" != "1" || "$event_count" != "1" ]]; then
  echo "Expected one owner and one committed audit event; got owners=$owner_count events=$event_count." >&2
  exit 1
fi

echo "R-10 concurrency smoke passed: exactly one cross-demotion committed and one owner remains."
