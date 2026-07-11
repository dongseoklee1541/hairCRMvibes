# R-07 Customer Edit Delete Dedupe

## 상태
- Done (local verified; production migration/live smoke pending)
- 브랜치: `feature/r07-customer-edit-delete-dedupe`
- 기준 HEAD: `1ca4494` (`feat(pwa): complete R-06 offline experience`)
- 최종 업데이트: 2026-07-11

## 목표
- 고객 이름·전화번호·메모를 편집하고 명시적인 loading/error/empty/success 상태를 제공합니다.
- hard delete 없이 고객 키와 예약 이력을 보존하면서 일반 보관과 개인정보 비식별화를 분리합니다.
- 중복 후보를 자동 병합하지 않고 비교·대표 고객 선택·transaction 병합·감사·제한된 undo로 정리합니다.

## 확정 정책

### 고객 lifecycle
- 일반 삭제는 owner 전용 `archive_customer` soft archive로 처리하고 owner가 `restore_customer`로 복원할 수 있습니다.
- 개인정보 삭제 요청은 owner 전용 `anonymize_customer`로 처리합니다. 이름은 `삭제된 고객`, 전화번호·정규화 번호·고객 메모는 `NULL`이 되며 복구할 수 없습니다.
- 고객 PK와 기존 예약은 유지합니다. 신규 예약은 active 고객만 허용합니다.
- authenticated 사용자의 고객/예약 hard delete 권한을 제거하고 예약 FK를 `ON DELETE RESTRICT`로 바꿨습니다.

### 중복 판정·병합
- 숫자만 남긴 `phone_normalized` exact match를 주 후보로 사용합니다.
- `lower(btrim(name))` exact match는 동명이인 가능성이 있는 보조 후보로만 표시합니다.
- 자동 병합은 금지합니다. owner가 두 고객을 비교하고 대표 고객을 명시적으로 선택해야 합니다.
- 서버 RPC도 두 고객이 exact phone 또는 exact name 후보인지 다시 검사하므로 UI를 우회한 임의 병합은 거부됩니다.
- `merge_customers`는 대표 고객 기본정보를 유지하고 원본 고객 예약을 이동한 뒤 원본을 archive합니다. 모든 변경은 한 transaction에서 실행됩니다.
- `customer_merge_events`와 `customer_merge_appointment_moves`에는 고객/예약 ID 관계와 actor/time만 저장하며 이름·전화번호·메모 snapshot은 남기지 않습니다.
- `undo_customer_merge`는 원본/대표 고객과 이동 예약이 병합 이후 충돌 없이 유지된 경우에만 실행됩니다. owner는 새로고침 후에도 미취소 감사 이벤트를 다시 열어 undo할 수 있습니다.
- staff는 active 고객 기본정보 편집과 중복 후보 조회·비교까지만 가능하고 archive/anonymize/merge/undo는 DB와 UI 모두 차단합니다.

## Pencil SSOT
- 원본: `pencil-hairshopcrm.pen`
- R-06 기준 hash `b1c8ec48946627bcc2fe747d107c78d36601e03d` → R-07 hash `101a1f5b8da25511a7052589bc8e6034054cbe1f`
- top-level node 14→39, reusable component 2→14를 Save → 다른 파일 전환 → 원본 재열기로 확인했습니다.
- Design System top-level: `Foundations`, `Components`, `Patterns`
- 신규 reusable 12개: Primary/Secondary/Danger Button, 44px IconButton, Text Input, Textarea, Select, Customer Row/Card, Status Badge, Inline Alert, Empty/Loading/Error State Panel, Confirm Bottom Sheet
- 기존 Owner/Staff TabBar는 새로 만들지 않고 재사용했습니다.
- 신규 화면 9개: 고객 리스트, 고객 상세, 고객 편집, 고객 보관 확인, 예약 이력 고객 개인정보 처리, 중복 고객 후보, 중복 고객 비교, 병합 미리보기, 병합 결과
- 모든 R-07 핵심 node가 재열기 후 존재하고 reusable marker 12개를 확인했습니다.
- 전체 `snapshot_layout(problemsOnly)`에서 R-07 node 문제는 0건입니다. 기존 `QmN8k/u2fJd` partial clipping 1건은 R-07 이전 상태 그대로입니다.
- Pencil MCP image export는 server/file mismatch가 반복됐지만 Pencil GUI `Export Selection`과 MCP screenshot은 성공했습니다.
- 검증 export: `output/playwright/r07-customer-edit-delete-dedupe/pencil-verified/20260711_r07_merge_result_pencil.png`

## 구현 결과

### DB/RLS/RPC
- migration: `supabase/migrations/20260711110928_r07_customer_lifecycle_dedupe.sql`
- snapshot: `schema.sql`
- smoke: `supabase/tests/r07_customer_lifecycle.sql`
- lifecycle column, phone normalization trigger/index, audit/mapping table, active-customer appointment guard를 추가했습니다.
- 고객 direct write는 `insert(name, phone, memo)`와 `update(name, phone, memo)` column grant로 제한했습니다.
- 신규 audit table은 RLS를 활성화하고 owner select만 허용합니다.
- privileged RPC는 `SECURITY DEFINER`, `search_path=''`, 내부 `auth.uid()`/owner 검증, PUBLIC·anon execute 회수를 적용했습니다.

### UI/UX
- 고객 목록에서 active/archive 상태, 검색, owner archive 목록, 중복 관리 진입을 제공합니다.
- 고객 등록·편집은 한국 전화번호 형식, 중복 번호 확인, 명시적 확인 checkbox, dirty navigation guard를 제공합니다. 브라우저 Back/Forward·내부 뒤로가기·중복 비교 진입에서 확인을 거치며, 취소하면 입력값과 focus를 유지하고 승인하면 history sentinel 없이 한 번만 이동합니다.
- 고객 상세에서 편집, 보관/복원, 영구 비식별화 확인, 기존 예약 이력 보존 상태를 제공합니다.
- 중복 화면은 후보→비교→대표 고객 선택→preview→confirm→result→guarded undo 순서로 동작합니다.
- owner는 미취소 merge event를 최신순 20건 단위로 계속 조회해 오래된 기록도 새 세션에서 undo를 검토할 수 있습니다.
- 44×44px 이상 hit area, safe-area, fixed CTA, focus trap, Escape close, body scroll lock을 반영했습니다.
- Tailwind CSS 4/PostCSS를 추가하고 기존 CSS Modules와 함께 touch/focus/disabled/loading utility를 점진 적용했습니다.
- 홈 정적 진입과 TabBar, 중복 비교 진입은 저가치 자동 route prefetch를 끄고 지속 대기 중 사용되지 않은 CSS prefetch 경고를 제거했습니다.
- 신규 예약 고객 selector와 활성 고객 통계는 `archived_at is null`만 사용하며 과거 예약 join은 유지합니다.

## 로컬 검증
- bundled Node `npm ls --depth=0`: Tailwind/PostCSS 포함 dependency tree 확인
- `npm audit`: 0 vulnerabilities
- bundled Node `npm run build`: 통과
- PostgreSQL 17 전체 forward migration 9개 fresh replay + R-07 smoke: 통과
- 별도 PostgreSQL 17 `schema.sql` from-scratch + 동일 smoke: 통과
- owner/staff/anon, authenticated column/table privilege(`MAINTAIN` 포함), anon RPC/mapping 접근 차단, phone sync, archive/restore/anonymize, hard delete 차단, archived 예약 차단: 통과
- exact phone/name 후보, unrelated/self/archived merge 거부, 원자적 merge·audit·undo, stale undo 거부: 통과
- 강제 appointment trigger 오류 후 customer/event/mapping/appointment 전체 rollback: 통과
- `appointments_customer_id_fkey=RESTRICT`, authenticated 고객/예약 DELETE=false, audit RLS=true: 확인
- 한국 전화번호 helper 5개 case: 통과
- 등록·편집 dirty 상태에서 브라우저 Back/Forward 취소·승인, 내부 뒤로가기, 중복 비교 진입: 390×844/360×800 통과. 취소 시 입력값·focus·guard phase 유지, 승인 시 단일 이동, history ghost 0건
- 제출 중에도 dirty 보호가 유지되고, 합성 저장 응답을 지연한 상태에서 이동한 뒤 완료된 비동기 callback이 현재 route를 덮지 않음. 합성 Supabase 요청 16건 전부 intercept, escaped 요청 0건
- 등록·편집 저장→상세 feedback 흐름: 통과, 성공 이동 시 confirm/`beforeunload` dialog 0건, Back/Forward에서 stale form 재노출 0건
- 미취소 merge event 21건 fixture에서 두 번째 페이지의 21번째 event 접근: 통과
- 390×844 중복 후보·비교·미리보기·durable undo와 360×800 confirm·result: 가로 overflow 0, CTA 52px, console error/warning 0건
- 홈 고객 목록 390×844와 empty state 360×800에서 각각 6.5초 지속 대기: console error/warning 0건, page error 0건, 가로 overflow 0
- 새 브라우저 컨텍스트의 production service worker active/scope `/`, Cache Storage 1개/46 entries, CRM·Supabase·API 민감 URL 0건, offline/manifest/favicon/icon required missing 0건. 390×844/360×800 offline 화면과 CTA 52px도 통과
- `git diff --check`: 통과
- 모바일 owner mock smoke와 production PWA cache 검증은 아래 증거 경로로 보존합니다.

## Screenshot 증거
- Before: `output/playwright/r07-customer-edit-delete-dedupe/20260711_r07_customer_detail_before_390x844.png`
- After 상세: `output/playwright/r07-customer-edit-delete-dedupe/20260711_r07_customer_detail_after_390x844.png`
- After 편집: `output/playwright/r07-customer-edit-delete-dedupe/20260711_r07_customer_edit_after_360x800.png`
- 후보/비교: `output/playwright/r07-customer-edit-delete-dedupe/20260711_dedupe_agent_compare_full_390x844.png`
- durable undo: `output/playwright/r07-customer-edit-delete-dedupe/20260711_dedupe_agent_durable_undo_390x844.png`
- confirm: `output/playwright/r07-customer-edit-delete-dedupe/20260711_dedupe_agent_confirm_360x800.png`
- result: `output/playwright/r07-customer-edit-delete-dedupe/20260711_dedupe_agent_merge_result_360x800.png`
- PWA cache: `output/playwright/r07-customer-edit-delete-dedupe/20260711_r07_pwa_cache_audit_390x844.png`
- Pencil: `output/playwright/r07-customer-edit-delete-dedupe/pencil-verified/20260711_r07_merge_result_pencil.png`

## 남은 리스크 / 배포 게이트
- R-07 migration은 production Supabase에 적용하지 않았습니다. migration 적용 전 R-07 UI를 배포하면 새 column/RPC 조회가 실패합니다.
- live history에는 genesis/기존 R-03 세 timestamp가 없으므로 향후 `db push` 전 별도 승인 아래 Phase 1 migration history repair가 먼저 필요합니다.
- 현재 production Advisor는 R-07 미적용 기준 security 13건/performance 8건을 보고합니다. GraphQL schema 노출 경고, 기존 `rls_auto_enable` execute 경고, leaked-password protection, FK index/다중 permissive policy는 R-07과 분리해 운영 hardening backlog로 처리합니다.
- audit event는 개인정보 snapshot을 남기지 않으므로 비식별화 이후 당시 이름/전화번호를 복구하는 용도로 사용할 수 없습니다. 이는 의도된 privacy 경계입니다.
- production에서는 owner/staff 실제 세션, migration 적용 순서, browser install/standalone, service worker update를 다시 검증해야 합니다.
- `prefetch={false}`를 적용한 정적 진입은 첫 이동이 소폭 느려질 수 있으므로 production 실기기에서 체감 속도를 다시 확인합니다.
- R-07은 아직 stage/commit/push/PR/deploy하지 않았습니다.
