# 2026-09-26 R-01·R-10 보안 점검

## 범위와 근거

- 사용자가 계정 도구의 main 병합과 권장 순서 진행을 승인했습니다. [PR #42](https://github.com/dongseoklee1541/hairCRMvibes/pull/42)는 검토 head `82d01cd4e0cb3f03b7c3b2a3e30ac1cbb5bbfad9`에서 `main@a8ce41478891ce249b596fa1528aab5de1ec157d`로 병합됐습니다. PR CI·Vercel 및 [병합 후 CI](https://github.com/dongseoklee1541/hairCRMvibes/actions/runs/36170350860) success와 로컬 main 동기화를 확인했습니다.
- 보안 점검은 Auth 설정·Advisor UI와 DB catalog SELECT에 한정했습니다. 고객/예약/Auth 사용자 행, 비밀번호, 토큰, 이메일·전화번호는 조회하지 않았습니다. 설정 저장·DDL·DML·권한 변경·실제 초대는 수행하지 않았습니다.
- Supabase CLI 2.109.1은 인증됐지만 대상 프로젝트를 표시하지 않았습니다. 사용자가 로그인한 Supabase 관리 화면에서 Production `burtyhairCRM`과 Preview `burtyhairCRM-preview`를 확인했습니다. CLI 인증 만료로 분류하지 않았고 기존 CLI 계정을 변경하지 않았습니다.
- catalog는 `pg_proc`, `pg_namespace`, `pg_class`, `pg_policies`, `pg_event_trigger`, `pg_extension` 및 privilege 조회 함수만 사용했습니다. SQL 패널에 입력한 SELECT 원문을 실행 전에 대조했고, Save as snippet은 사용하지 않았습니다.

## 변경 전 점검 결과

| 항목 | Production | Preview | 판단 |
| --- | --- | --- | --- |
| Auth Site URL | `http://localhost:3000` | `http://localhost:3000` | Production의 운영 URL 정리 필요 |
| Auth Redirect URL | 0개 | 0개 | 의도한 초대 수락 URL을 환경별 exact allowlist로 정할 필요 |
| R-10 RPC 6개 | 아래 본문·ACL 계약 일치 | 같은 계약 일치 | authenticated 실행 경고를 이유로 일괄 권한 회수하지 않음 |
| private 초대 원장 | RLS=true, anon/authenticated schema USAGE·SELECT=false | 동일 | 현재 의도한 직접 접근 차단 확인 |
| 권한 감사 테이블 | RLS=true, owner 조건의 SELECT policy | 동일 | GraphQL 표시 경고를 무인증 데이터 노출로 단정하지 않음 |
| `rls_auto_enable()` | event_trigger, definer, `search_path=pg_catalog` | 없음 | Production의 불필요한 실행 권한 정리 후보 |
| `ensure_rls` 이벤트 트리거 | `ddl_command_end`, enabled=`O` | 없음 | 함수 삭제/비활성화 대신 기존 RLS 자동 적용 기능 보존 |
| `pg_graphql` | 1.5.11 설치 | 없음 | 환경 차이 확인. 앱 코드에서 명시적인 GraphQL 사용은 찾지 못했지만 외부 소비자까지 미사용으로 단정하지 않음 |
| 유출 비밀번호 보호 | Disabled | Advisor 경고 있음 | Production UI는 Pro 이상 조건 안내. 요금제·운영 정책 별도 결정 |

[Production Auth 설정](https://supabase.com/dashboard/project/skcujebqxjvmzmaiddvb/auth/url-configuration)과 [Preview Auth 설정](https://supabase.com/dashboard/project/ygczvpiowtexsqupkxth/auth/url-configuration)을 읽기 전용으로 확인했습니다. 위 값은 점검 시점 기록이며 변경 직전에 다시 확인합니다.

### R-10 본문·권한 대조

대상은 `list_staff_profiles`, `provision_invited_staff`, `change_staff_role`, `claim_staff_invitation`, `settle_staff_invitation`, `reconcile_staff_invitation`입니다.

- 양 환경 6/6의 공백 제거 본문 MD5가 저장소의 R-10 두 migration과 일치했습니다. 이는 동일 본문 대조이며 실제 owner/staff 로그인 smoke를 대체하지 않습니다.
- 모두 SECURITY DEFINER, 빈 search_path, anon EXECUTE=false, authenticated EXECUTE=true, service_role EXECUTE=false입니다.
- 일치한 로컬 본문에는 `auth.uid()`와 owner 재검사가 있습니다. 권한 변경·초대 원장의 동시성 보호 등 기존 검증 기록을 현재 구현과 연결할 수 있습니다.
- `profiles`는 본인 profile SELECT, `role_management_events`는 owner SELECT policy이며 private ledger에는 일반 API role의 직접 접근이 없습니다.
- authenticated는 owner와 staff JWT가 공유하는 DB role이므로 해당 EXECUTE를 일괄 회수하면 owner의 정상 RPC도 막힙니다. 별도의 설계 변경 없이 경고 수만 줄이는 수정을 하지 않습니다.

### RLS 자동 적용 함수

Production PostgreSQL은 17.6이며 함수 owner는 `postgres`입니다. 현재 ACL은 `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`입니다.

함수는 테이블 생성 DDL 이벤트에서 public 테이블에 RLS를 자동 활성화합니다. [PostgreSQL 17 구현](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/pl/plpgsql/src/pl_comp.c#L511)은 event_trigger 반환 함수를 일반 함수처럼 호출하는 것을 거부합니다. 따라서 Advisor의 익명 실행 경고만으로 실제 익명 RPC 악용이 가능하다고 확정하지 않습니다. 실서비스 공격 요청은 실행하지 않았습니다.

정리 후보는 이 함수의 PUBLIC·anon·authenticated EXECUTE만 회수하는 조건부 migration입니다. 함수 본문·owner·고정 search_path·이벤트 트리거·service_role 권한은 유지합니다. Preview에는 함수가 없어 해당 부분을 건너뛰어야 하며, 적용 전 객체 타입/ACL 확인과 disposable DB의 RLS 자동 적용 회귀가 필요합니다. 후속 사용자 승인으로 migration 작성·로컬 검증을 완료했습니다. 원격 적용은 미승인·미실행입니다.

## 검토한 변경안 — A안 적용 완료, B안 미실행

### A안: Auth URL부터 단계적으로 정리 (승인·적용 완료)

| 환경 | 제안 Site URL | 제안 Redirect URL |
| --- | --- | --- |
| Production | `https://hair-cr-mvibes.vercel.app` | `https://hair-cr-mvibes.vercel.app/invite/accept` |
| Preview | `http://localhost:3000` 유지 | `http://localhost:3000/invite/accept`, `http://127.0.0.1:3000/invite/accept` |

Preview는 localhost 앱 + Preview DB 검증 경로를 유지하는 안입니다. 현재 `resolveInviteRedirect`는 canonical Production과 http localhost/127.0.0.1만 허용하므로, Vercel Preview URL을 allowlist에 추가하는 것만으로 초대 기능이 동작하지 않습니다. wildcard는 추가하지 않습니다.

사용자 승인 후 기존 설정 재조회 → Preview 설정·재조회 → Production 설정·재조회 순서로 완료했습니다. 복구는 이번에 추가한 URL만 제거하고 이전 Site URL로 되돌리는 범위이며, 그 사이의 다른 변경은 덮어쓰지 않습니다. 초대 활성화·이메일 발송·계정/역할 변경은 포함하지 않습니다.

### B안: Vercel Preview에서도 초대 흐름 검증

정확한 Preview 도메인을 먼저 정하고 서버 origin 검사와 Supabase allowlist를 함께 확장해야 합니다. 배포된 Preview에서 검증할 수 있지만 Auth 경계 코드 변경과 origin/header 회귀 검증이 추가됩니다. 현재 승인된 read-only 점검에 포함하지 않았습니다.

Auth URL 정리 후 RLS 자동 적용 함수 ACL만 별도 migration-first 작업으로 좁혀 진행하는 것을 권합니다. GraphQL 비활성화·Pro 업그레이드·비밀번호 정책 변경은 사용 여부와 영향을 판단한 뒤 별도 결정합니다.

## 남은 경계

- Vercel의 현재 `R10_INVITATIONS_ENABLED` 값은 재조회하지 않았습니다. 과거 `false` 기록을 현재값으로 단정하거나 이번 점검만으로 활성화하지 않습니다.
- 실제 owner/staff 로그인·초대·역할 변경 smoke는 미실행입니다. R-10은 In Progress를 유지합니다.
- Preview Advisor의 Disk IO budget 경고도 관찰했습니다. 원인·지속 여부·요금제 변경 필요성은 아직 검증하지 않았습니다.
- R-14 대표 사용자 2명 관찰 결과는 여전히 필요합니다. 새로 수행한 것으로 기록하지 않습니다. 모바일 로그인·실기기 IME·설치형 PWA의 사용자 보류도 유지합니다.
- 최초 audit은 읽기 전용이었고 이후 승인된 Auth URL 설정만 변경했습니다. 앱 코드·DB는 변경하지 않았으며 앱 테스트·build를 반복하지 않았습니다. Auth 설정 검증은 각 환경 관리 화면의 저장 후 새로고침·재조회로 수행했습니다. PR #42의 검증과 보안 metadata 조회는 서로 다른 근거입니다.

## 2026-09-26 승인된 Auth URL 적용 결과

- Ego에서 변경 직전 양 환경 Site URL=`http://localhost:3000`, redirect 0개를 재확인했습니다.
- Preview: Site URL 유지, `http://localhost:3000/invite/accept`와 `http://127.0.0.1:3000/invite/accept`를 저장했습니다. 페이지 새로고침 후 Site URL과 두 redirect가 유지됨을 확인했습니다.
- Production: Site URL=`https://hair-cr-mvibes.vercel.app`, redirect=`https://hair-cr-mvibes.vercel.app/invite/accept`를 저장했습니다. 페이지 새로고침 후 두 값의 영속 반영을 확인했습니다.
- 위 A안의 설정 적용·재조회는 완료입니다. 실제 초대 링크 발급·이메일·계정·역할·DB 권한·Vercel flag는 변경하지 않았습니다. owner/staff end-to-end 검증은 여전히 미검증이며 R-10은 In Progress입니다.
- 복구가 필요하면 이 세션에서 추가한 redirect만 제거하고 Production Site URL을 이전 값으로 되돌립니다. 복구 직전 현재 값을 읽어 다른 세션의 변경을 보존합니다.

## 2026-09-26 ACL migration 준비

사용자가 1번 준비를 승인해 `20260926000000_rls_auto_enable_execute_hardening.sql`, schema.sql 동기화와 합성 SQL 회귀 검증을 준비했습니다. [적용·검증·복구 절차](../operations/rls-auto-enable-hardening.md)를 따릅니다. 별도 로컬 PostgreSQL 17 클러스터에서 함수 부재·재실행·역할 행렬·5종 DDL의 자동 RLS와 변경된 계약/상속 권한의 중단을 검증했습니다. 서버는 종료했고 임시 데이터 디렉터리는 보존했습니다. 원격 DB 적용과 실제 플랫폼 함수의 DDL 회귀·Advisor 해소는 미실행입니다.

검증 환경은 PostgreSQL 17.10(Homebrew), 운영 점검 버전은 17.6입니다. SQL 회귀는 `psql -X -h "$task_pg_dir/socket" -p 55439 -U postgres -d postgres -f tests/sql/rls-auto-enable-hardening.sql`로 통과했습니다. 전체 Supabase migration chain replay는 미실행입니다. 격리 소스 복사본 `/private/tmp/haircrm-acl-build-hdvog8k9`에서 합성 Supabase 환경값으로 `npm run build`를 통과했습니다. 최초 sandbox 실행의 Google Fonts DNS 실패 후 허용된 네트워크 실행에서 성공했으며 저장소의 PWA 생성물은 변경하지 않았습니다. `schema.sql`과 새 migration 블록 일치, 문서 링크·공백, `git diff --check`도 확인했습니다. 이 준비물은 로컬 검증 범위이며 원격 DB에 적용하지 않았습니다.
