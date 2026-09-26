# rls_auto_enable 실행 권한 정리

## 준비 상태와 범위

2026-09-26 로컬 준비·격리 DB 검증 완료. **원격 미적용**이며 운영 적용 승인은 별도입니다. [점검 기록](../roadmap/security-audit-2026-09-26.md)의 Production에만 존재하는 플랫폼 event trigger가 대상입니다.

- migration: [20260926000000_rls_auto_enable_execute_hardening.sql](../../supabase/migrations/20260926000000_rls_auto_enable_execute_hardening.sql)
- `schema.sql` 마지막에 동일한 조건부 블록을 동기화했습니다. 새 DB에 플랫폼 함수를 만들어 넣지 않습니다.
- PUBLIC·anon·authenticated의 직접 EXECUTE만 회수합니다. 함수·owner·본문·search_path·이벤트 트리거와 service_role의 유효 권한을 보존합니다. 앱의 R-10 RPC 6개는 대상이 아닙니다.

| 접근 주체 | 적용 후 계약 |
| --- | --- |
| PUBLIC, anon, authenticated | EXECUTE 없음. 상속 권한이 남으면 예외로 블록 전체 취소 |
| service_role | 적용 직전 유효 EXECUTE 유지. PUBLIC 경유만으로 권한이 있던 경우에는 회수 후 달라지므로 중단 |
| postgres owner | 소유권과 암묵적 실행 권한 유지 |
| ensure_rls | 기존 활성 ddl_command_end event trigger와 함수 연결 유지 |

이 변경은 권한 최소화입니다. event_trigger 반환 함수는 일반 RPC처럼 실행할 수 없으므로, Advisor 경고가 실제 데이터 노출을 입증한 것으로 해석하지 않습니다. 사용자 데이터와 RLS policy는 수정하지 않습니다.

## 적용 전 읽기 전용 확인

승인된 환경에서 migration history와 아래 catalog를 다시 확인합니다. Production의 점검 기록과 다르면 이력만 보고 강행하지 않습니다.

```sql
select p.oid::regprocedure as signature, p.prorettype::regtype as returns,
       pg_get_userbyid(p.proowner) as owner, p.prosecdef, p.proconfig,
       coalesce(p.proacl, acldefault('f', p.proowner)) as effective_acl,
       pg_get_functiondef(p.oid) as definition
from pg_proc p where p.oid = to_regprocedure('public.rls_auto_enable()');
select evtname, evtevent, evtenabled, evtfoid::regprocedure, evttags
from pg_event_trigger where evtfoid = to_regprocedure('public.rls_auto_enable()');
```

기대: Production은 postgres 소유 SECURITY DEFINER event_trigger 함수, `search_path=pg_catalog`, 활성(`O`) `ensure_rls`/`ddl_command_end`. Preview는 함수가 없으면 건너뜁니다. 현재 함수 본문도 이전 점검과 대조합니다. migration은 본문 해시를 고정하지 않으므로 로컬 fixture 성공을 운영 함수 본문 검증으로 대체하지 않습니다.

변경 전 ACL·정의·트리거를 비밀/고객 데이터 없이 적용 기록에 보존합니다. 대상 연결과 migration history를 확인한 뒤 [migration·release 절차](./migration-release-workflow.md)에 따라 이 migration만 적용합니다. `db push --include-all`이나 다른 migration 재실행을 기본 경로로 사용하지 않습니다.

## 검증

로컬 테스트는 Production 덤프가 아닌 합성 event trigger fixture입니다. 로컬 PostgreSQL 17.10(Homebrew)의 실제 DDL 이벤트와 권한 동작을 검증합니다. 점검된 Production은 17.6이므로 동일 major의 로컬 검증이며 원격 동일 환경 검증은 아닙니다. 전체 Supabase migration 체인의 새 DB replay는 이번에 수행하지 않았습니다. 전용 임시 클러스터에 postgres superuser로 연결하고 실행합니다. 공유 DB에는 실행하지 않습니다.

```sh
psql -X -v ON_ERROR_STOP=1 -h "$task_pg_dir/socket" -p 55439 -U postgres -d postgres -f tests/sql/rls-auto-enable-hardening.sql
```

[테스트 SQL](../../tests/sql/rls-auto-enable-hardening.sql)은 transaction rollback으로 fixture를 되돌립니다. 로컬 클러스터는 `initdb -U postgres -A trust --no-locale`로 초기화하고 `pg_ctl`의 `-h ''`와 전용 socket 경로로 TCP 리스닝 없이 시작했습니다. trust는 이 격리 클러스터의 로컬 테스트 전용이며 운영 설정이 아닙니다.

통과 항목: 함수 부재 skip, 반복 적용, anon/authenticated/PUBLIC 회수와 service_role 보존, 함수 정의·owner·설정 보존, EXECUTE가 없는 일반 DDL 사용자에 의한 CREATE TABLE/CTAS/SELECT INTO/partitioned table/partition 5종 RLS 활성화. search_path 변경·트리거 비활성·상속 EXECUTE는 예상 오류로 중단합니다. 테스트 로그의 이 세 ERROR는 실패 경로 검증입니다.

운영 적용 후에는 위 catalog와 아래 권한 SELECT를 재조회합니다. Production에서 테스트 테이블 생성은 이번 준비 범위에 포함하지 않습니다. 실제 운영 함수에 대한 DDL 회귀와 Supabase Advisor 경고 해소는 아직 미검증입니다.

```sql
select has_function_privilege('anon', oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role', oid, 'EXECUTE') as service_execute
from pg_proc where oid = to_regprocedure('public.rls_auto_enable()');
```

## 중단과 복구

DO 블록 안의 계약·권한 검사가 실패하면 블록의 REVOKE도 함께 롤백됩니다. 함수가 없는 환경에서는 변경하지 않습니다. 실패 후 함수·트리거를 삭제하거나 RLS를 끄지 않습니다.

적용 성공 후 장애가 생기면 먼저 실제 원인과 적용 전후 ACL을 대조합니다. PUBLIC/anon/authenticated 실행 권한의 일괄 재부여는 보안 완화를 되돌리므로 자동 down migration을 제공하지 않습니다. 실제 필요한 최소 권한만 별도 승인된 forward-fix로 복구하고, 함수 본문·이벤트 트리거·고객 데이터는 보존합니다. 과거 ACL을 그대로 복원해야 한다면 재노출 영향을 설명하고 해당 복구를 승인받습니다.
