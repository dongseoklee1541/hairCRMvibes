# R-10 직원 초대 claim ledger 운영 runbook

## 범위와 안전 원칙

이 문서는 `/api/staff/invitations`와 `private.staff_invitation_requests`를 운영·중지·복구할 때 사용합니다. 초대 route는 `R10_INVITATIONS_ENABLED`가 문자열 `true`일 때만 동작하며, 그 외 값은 fail-closed로 `503`, `invitation_maintenance`, `Cache-Control: private, no-store`를 반환합니다. 인증 헤더가 없는 요청은 flag와 무관하게 `401`, `Cache-Control: no-store, max-age=0`입니다.

- 실제 초대 메일, 테스트 계정 생성, 실제 역할 변경은 이 runbook의 dry-run에서 수행하지 않습니다.
- raw email, claim token, service-role/secret key, fingerprint 값은 로그·터미널·스크린샷·보고서에 출력하지 않습니다.
- `private.staff_invitation_requests`와 `public.role_management_events`는 감사 증거입니다. ledger 직접 `UPDATE`/`DELETE`와 감사 행 삭제를 금지합니다.
- DB rollback이 필요해도 route disable을 먼저 수행하고, ledger·RLS·감사 증거를 보존합니다.

## 활성화·비활성화 순서

### 비활성화 또는 장애 대응

1. 모든 Vercel server scope에서 `R10_INVITATIONS_ENABLED=false`를 설정하고 Production을 재배포합니다. 누락·대소문자 변형·숫자 값도 비활성으로 취급합니다.
2. canonical `/api/staff/invitations`에 인증된 synthetic 요청을 보내 `503`/`invitation_maintenance`/`private, no-store`를 확인합니다. 실제 이메일과 실제 owner token은 사용하지 않습니다.
3. 인증 헤더 없는 요청이 계속 `401`/`no-store`인지 확인합니다.
4. Vercel Runtime Logs 또는 동등한 request telemetry에서 `/api/staff/invitations`의 진행 중·최근 요청을 확인하고, 플랫폼의 최대 request timeout 이상 기다린 뒤 active request가 0건임을 기록합니다. 로그 필터에는 route와 status만 사용하고 query/body/header 값은 수집하지 않습니다.
5. 장애 원인, migration/ACL/Auth 설정 호환성, active ledger aggregate를 확인하기 전에는 flag를 다시 켜지 않습니다.

### 활성화

1. Preview와 Production의 migration history가 아래 순서와 일치하고 catalog/ACL/RLS/advisor 결과에 새 차단 경고가 없는지 확인합니다.
2. Auth user, profile, 동일 request의 provisioning audit evidence를 비식별 방식으로 확인합니다. `unknown`이 남아 있으면 활성화하지 않습니다.
3. Auth URL과 Vercel Production env scope를 확인합니다. canonical redirect는 exact allowlist만 사용합니다.
4. flag를 먼저 `false`인 상태로 새 deployment에 반영하고, unauthenticated 401과 authenticated maintenance 503 경계를 확인합니다.
5. in-flight 0건을 확인한 뒤 Production의 `R10_INVITATIONS_ENABLED=true`를 설정하고 재배포합니다.
6. 실제 초대 없이 공개 route, protected route의 무인증 경계, UI maintenance 문구, cache header만 검증합니다. owner 인증 smoke와 실제 메일 발송은 별도 승인 없이는 수행하지 않습니다.

## 비식별 상태 집계와 unknown 조사

아래 SQL은 raw email이나 fingerprint를 반환하지 않고 상태·시간·비식별 개수만 반환합니다. 운영 DB에서 `private` schema 접근 권한이 있는 관리 경로로만 실행합니다.

```sql
select
  state,
  count(*)::bigint as request_count,
  min(created_at) as oldest_created_at,
  max(updated_at) as newest_updated_at
from private.staff_invitation_requests
group by state
order by state;

select
  count(*) filter (where state = 'claimed')::bigint as claimed_count,
  count(*) filter (where state = 'auth_succeeded')::bigint as auth_succeeded_count,
  count(*) filter (where state = 'provisioned')::bigint as provisioned_count,
  count(*) filter (where state = 'failed_definitive')::bigint as failed_definitive_count,
  count(*) filter (where state = 'unknown')::bigint as unknown_count
from private.staff_invitation_requests;
```

`unknown`은 Admin API timeout·모호한 결과·stale claim을 의미할 수 있으며 자동 만료·자동 재전송 대상이 아닙니다. 조사자는 raw email 대신 내부 request UUID와 비식별 시간/상태만 사용해 다음 세 증거를 대조합니다.

1. 해당 request의 `auth_user_id`가 실제 `auth.users.id`와 일치합니다.
2. 같은 Auth user에 `public.profiles` 행이 존재하고 역할이 의도한 `staff`인지 확인합니다.
3. 동일 request의 `public.role_management_events`에 `staff_provisioned` 또는 `staff_provision_noop` 감사 증거가 존재하고 actor/target/request 관계가 일치합니다.

세 증거가 모두 일치할 때만 owner-only `reconcile_staff_invitation` RPC로 `provisioned` 종결을 수행합니다. 하나라도 없거나 상충하면 route를 `false`로 중지하고 incident로 유지합니다. ledger 직접 UPDATE/DELETE, fingerprint 해제, claim token 재사용, 같은 email 재초대는 하지 않습니다.

## HMAC key rotation

`SUPABASE_SECRET_KEY`는 Admin API 자격증명인 동시에 ledger fingerprint HMAC key입니다. key를 바꾸면 같은 email이 다른 fingerprint가 되어 at-most-once 장벽을 우회할 수 있으므로 다음 순서를 지킵니다.

1. route를 `false`로 중지하고 Production을 재배포합니다.
2. in-flight 0건을 확인합니다.
3. 기존 key로 생성된 active `claimed`, `auth_succeeded`, `unknown` aggregate가 0인지 확인합니다. `provisioned`/`failed_definitive` 감사 행은 삭제하지 않습니다.
4. 모든 server instance의 secret을 교체하고 재배포합니다. 이전 key는 server runtime과 로그에서 제거하되, 최소 30일 또는 초대 만료·reconciliation window 중 더 긴 기간 동안 접근 통제된 secret escrow에 보존합니다. 기존 fingerprint를 재계산하거나 삭제하지 않습니다.
5. 새 key 환경에서 실제 메일 없는 synthetic route/header/bundle 검증과 old-active 0 aggregate를 다시 확인합니다.
6. 모든 검증이 끝난 뒤에만 flag를 `true`로 변경하고 재배포합니다.

## Migration·catalog·ACL 확인

적용 순서는 반드시 `20260712153420_r10_role_management.sql` → `20260713143746_r10_invitation_claim_ledger.sql`입니다. `--include-all`로 backdated migration을 재실행하지 않습니다.

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;

select n.nspname as schema_name, c.relname as object_name, c.relkind,
       c.relrowsecurity as rls_enabled
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where (n.nspname, c.relname) in (
  ('public', 'role_management_events'),
  ('private', 'staff_invitation_requests')
)
order by n.nspname, c.relname;

select routine_schema, routine_name, routine_type
from information_schema.routines
where (routine_schema = 'public' and routine_name in (
  'list_staff_profiles', 'provision_invited_staff', 'change_staff_role',
  'claim_staff_invitation', 'settle_staff_invitation', 'reconcile_staff_invitation'
))
order by routine_name;

select routine_schema, routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'list_staff_profiles', 'provision_invited_staff', 'change_staff_role',
    'claim_staff_invitation', 'settle_staff_invitation', 'reconcile_staff_invitation'
  )
order by routine_name, grantee, privilege_type;

select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'private'
  and table_name = 'staff_invitation_requests'
order by grantee, privilege_type;
```

기대 계약은 private ledger에 `PUBLIC`, `anon`, `authenticated`, `service_role` 직접 table/schema grant가 없고, public RPC는 의도된 `authenticated` EXECUTE만 가지며 `PUBLIC`/`anon` EXECUTE가 차단되는 것입니다. `role_management_events`는 RLS와 owner-only read 정책을 유지해야 합니다. migration 직후 Supabase security/performance advisor를 실행하고 새 관련 경고를 기록합니다.

## Rollback과 dry-run

rollback은 `R10_INVITATIONS_ENABLED=false` → Production 재배포 → in-flight 0 → 앱/DB 호환성 검토 순서입니다. 필요한 경우에만 승인된 down migration을 사용하며, claim/settle/reconcile 함수와 ledger를 기계적으로 제거하지 않습니다. 제거가 승인되어도 private table, RLS, no-grant, 상태 행, `role_management_events` 감사 증거는 보존하는 호환 rollback을 선택합니다.

dry-run은 synthetic env·mock handler·비밀이 아닌 UUID/email fixture만 사용합니다. 실제 Supabase Auth invite, 실제 이메일 전달, 실제 owner/staff 역할 변경, 테스트 사용자 생성, 고객·예약 데이터 접근은 하지 않습니다.
