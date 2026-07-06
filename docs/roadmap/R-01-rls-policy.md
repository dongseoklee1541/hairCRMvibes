# R-01 RLS Policy

## 상태
- Done (local)
- 브랜치: `feature/r01-rls-policy`
- 최종 업데이트: 2026-07-06

## 완료 기준
- `customers`, `appointments`의 `Allow all` 정책 제거
- `auth.role()` 기반 정책 제거
- `profiles.role`의 `owner`/`staff`를 기준으로 고객/예약 운영 데이터 접근 허용
- `profiles` 자체 role escalation 방지
- `salon_closed_dates`는 owner/staff 읽기, owner 변경으로 제한
- DB 변경은 migration과 `schema.sql`에 동기화

## 권한 매트릭스
| 리소스 | Owner | Staff | Anon |
| --- | --- | --- | --- |
| `customers` | select/insert/update/delete | select/insert/update/delete | deny |
| `appointments` | select/insert/update/delete | select/insert/update/delete | deny |
| `profiles` | own profile select | own profile select | deny |
| `salon_closed_dates` | select/insert/update/delete | select | deny |
| 휴무일 RPC | execute 후 함수 내부 owner 검증 | execute 가능하지만 함수 내부에서 deny | deny |

## 구현 근거
- `supabase/migrations/20260706_r01_rls_policy.sql`
- `supabase/migrations/20260706_r01_rls_policy.down.sql`
- `schema.sql`

## 검증
- `PATH="/Users/idongseog/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" npm run build` 통과
- SQL 정적 검토: `schema.sql`에서 legacy policy 이름과 `auth.role()` 제거 확인
- Supabase MCP 프로젝트 조회: `burtyhairCRM` 프로젝트가 `INACTIVE`라 live Owner/Staff 계정 smoke는 미실행

## 남은 리스크
- 로컬 Supabase CLI가 없어 migration 생성/적용 검증은 파일 기반으로만 수행했습니다.
- 실제 프로젝트에 기존 Auth 사용자 중 `profiles`가 없는 계정이 있으면 migration의 backfill 결과를 확인해야 합니다.
- 실제 Supabase 프로젝트 활성화 후 anon 차단, owner/staff 고객/예약 CRUD, staff 휴무일 변경 차단을 확인해야 합니다.
