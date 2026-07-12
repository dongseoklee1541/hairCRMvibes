# R-01 RLS Policy

## 상태
- Done (live + fresh replay verified)
- 브랜치: `feature/r02-appointment-edit-status` (Phase 1 통합 브랜치)
- 최종 업데이트: 2026-07-12

## 완료 기준
- `customers`, `appointments`의 `Allow all` 정책 제거
- `auth.role()` 기반 정책 제거
- `profiles.role`의 `owner`/`staff`를 기준으로 고객/예약 운영 데이터 접근 허용
- `profiles` 자체 role escalation 방지
- `salon_closed_dates`는 owner/staff 읽기, owner 변경으로 제한
- DB 변경은 migration과 `schema.sql`에 동기화

## 권한 매트릭스 (R-07 반영 후 현재 live)
| 리소스 | Owner | Staff | Anon |
| --- | --- | --- | --- |
| `customers` | select, 기본정보 column insert/update, lifecycle·merge RPC; hard delete deny | select, 기본정보 column insert/update, 중복 후보 조회; lifecycle·merge·hard delete deny | deny |
| `appointments` | select/insert/update; hard delete deny | select/insert/update; hard delete deny | deny |
| `profiles` | own profile select | own profile select | deny |
| `salon_closed_dates` | select/insert/update/delete | select | deny |
| 휴무일 RPC | execute 후 함수 내부 owner 검증 | execute 가능하지만 함수 내부에서 deny | deny |

## 구현 근거
- `supabase/migrations/20260219000000_phase1_genesis_baseline.sql`
- `supabase/migrations/20260707155922_r01_rls_policy.sql`
- `supabase/rollbacks/20260707155922_r01_rls_policy.down.sql`
- `supabase/migrations/20260707161054_phase1_function_privilege_hardening.sql`
- `schema.sql`

## 검증
- `PATH="/Users/idongseog/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" npm run build` 통과
- Supabase MCP 프로젝트 조회: `burtyhairCRM` 프로젝트가 `ACTIVE_HEALTHY` 상태임을 확인
- live migration 적용 확인:
  - `20260707155922` / `r01_rls_policy_20260706010000`
  - `20260707155948` / `r02_appointment_status_20260706011000`
  - `20260707160023` / `r05_settings_business_hours_20260706012000`
  - `20260707160103` / `r03_booking_conflict_hours_20260706013000`
  - `20260707161054` / `phase1_function_privilege_hardening_20260706014000`
- live RLS smoke:
  - anon `customers` select 차단
  - owner/staff `customers` CRUD 허용
  - owner/staff `appointments` CRUD 허용
  - owner `salon_operation_settings` write 허용
  - staff `salon_operation_settings` write 차단(`0 rows affected`, 값 변경 없음)
  - anon `set_appointment_status` 실행 차단
- hardening 확인:
  - Phase 1 함수의 mutable `search_path` advisor 해소
  - Phase 1 RPC/helper 함수의 anon execute 권한 차단 확인
- 2026-07-11 live read-only 재확인:
  - 핵심 7개 테이블 RLS 활성화 및 `customers`/`appointments` realtime 등록
  - Auth 사용자 수와 profile 수가 각각 2이며 누락 profile 0건
  - `ensure_user_profile_role()` 및 `create_profile_for_new_user` trigger가 live에 없음
  - 점검 대상 Phase 1 함수 10개의 `search_path=public` 확인
- 2026-07-12 live read-only 감사:
  - migration history 9개와 local forward migration 9개의 version 일치 확인. 4~8번 live history name에는 repair 전 timestamp suffix가 남아 있음
  - `customers`는 authenticated table-level DELETE를 차단하고 `name`, `phone`, `memo` insert/update와 `updated_at` update만 column grant로 허용함을 확인
  - `appointments`는 authenticated select/insert/update만 허용하고 DELETE를 차단함을 확인
- PostgreSQL 17 disposable fresh replay:
  - forward migration 8개를 timestamp 순서대로 적용
  - 핵심 테이블 7개, RLS 7개, realtime 2개 및 owner/staff/anon 경계 확인
  - 새 Auth 사용자는 profile이 자동 생성되지 않는 승인된 운영 제약 확인
  - 별도 DB에 `schema.sql`을 적용한 뒤 table/column/constraint/index/policy/function/trigger/ACL/realtime 구성을 정규화 비교해 semantic diff 없음 확인
- 정적 검색:
  - active Phase 1 migration과 `schema.sql`에서 owner/staff 정책, `to authenticated`, explicit anon revoke, `set search_path = public` 확인
  - `Allow all access`와 `auth.role()`은 R-01 이전 legacy forward/rollback SQL과 문서의 이력 설명에만 남아 있음

## 남은 리스크
- Supabase advisor가 signed-in GraphQL table exposure를 보고합니다. anon 공개는 아니지만 GraphQL 사용 여부에 따라 비활성화 또는 노출 정책을 별도 결정해야 합니다.
- 기존 `public.rls_auto_enable()`은 anon/authenticated가 실행 가능한 `SECURITY DEFINER` 함수로 advisor 경고가 남습니다. Phase 1 신규 함수는 아니지만 별도 보안 hardening 우선순위로 다뤄야 합니다.
- Auth leaked-password protection이 비활성화되어 있다는 advisor 경고가 남습니다. 애플리케이션 migration이 아니라 Supabase Auth 운영 설정에서 결정해야 합니다.
- `apply_closed_day_with_cancellations`, `apply_closed_days_batch_with_cancellations`, `remove_closed_day_range`는 `security definer`를 유지합니다. 내부 owner 검증은 있으나 advisor 경고가 남으므로 후속 보안 리뷰 대상입니다.
- `appointments.customer_id`, `appointments.cancelled_by`, `salon_closed_dates.created_by/updated_by` FK index와 일부 settings/closed_dates select 정책 중복은 성능/정책 정리 backlog로 남깁니다.
- 신규 Auth 사용자 profile 자동 생성은 별도 보안/운영 작업으로 분리했습니다. 초대/운영 절차가 profile row를 만들기 전에는 해당 사용자가 RLS 보호 데이터에 접근할 수 없습니다. 첫 사용자를 자동 owner로 승격하는 trigger는 live, migration, `schema.sql` 어디에도 두지 않습니다.
- `phase1_function_privilege_hardening`은 의도적인 forward-only migration입니다. mutable `search_path` 또는 anon execute를 자동 복원하는 down SQL은 만들지 않으며, 장애 시 영향 함수만 검토 후 additive forward-fix로 교정합니다.
- genesis와 기존 R-03 두 migration(`20260219000000`, `20260220000000`, `20260221000000`)의 history repair는 2026-07-12 별도 승인 아래 완료됐습니다. SQL을 재실행하지 않았으며 향후에는 version 일치와 live history name suffix 차이를 함께 확인해야 합니다.
