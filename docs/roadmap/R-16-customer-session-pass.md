# R-16 고객별 횟수권

## 상태
- In Progress (Preview 취소 검증 완료 · 재확정 보완 로컬 검증 완료)
- 기준: `main@b87eb6873f3ab873b5d7cc8c6e9db641bd1c6e4d`
- Git 전달 worktree: `/Users/idongseog/workspace/hairCRMvibes-r16-delivery-20260907`, `codex/r16-delivery-20260907`
- 보존된 복구 사본: `/Users/idongseog/workspace/hairCRMvibes/output/recovery/r16-20260906/app` (Git worktree가 아닌 별도 파일 사본)
- 과거 작업: `/private/tmp/hairCRMvibes-r16-customer-session-pass`, `codex/r16-customer-session-pass` — 구현 파일 및 `.git` 연결 파일 유실 확인
- 우선순위: P1
- 선행조건: R-02 예약 상태 전이, R-07 고객 lifecycle/병합, R-08 서비스 마스터, R-15 실제 시술금액 의미 확정
- 최종 업데이트: 2026-09-07
- delivery 경계: stage/commit/push·Draft PR은 승인된 검토 범위. 병합, 수동 배포, remote DB migration은 별도 승인 대상

## 사용자 요구
- 고객이 10회권 같은 횟수형 상품을 미리 등록해 둘 수 있어야 합니다.
- 예약할 때 횟수권을 선택하면 1회가 차감되어야 합니다.
- 예약 후 남은 횟수를 즉시 알 수 있어야 합니다.
- 고객 상세에서 보유 횟수권, 남은 횟수와 사용 이력을 확인할 수 있어야 합니다.

## 현재 코드 근거
- `customer_session_passes`가 총 횟수·상태·KST 등록/만료일을 관리하고 `appointment_session_pass_usages`가 예약별 `reserved`/`consumed`/`released` 원장을 보존합니다.
- mutable `remaining_sessions` 컬럼은 없으며 RPC 조회 시 `total_sessions - reserved/consumed`로 잔여를 계산합니다.
- `/appointments/new`, `/appointments`, 고객 상세 완료 이력, 단일·일괄 휴무 취소는 예약과 usage를 같은 transaction에서 처리하는 RPC를 사용합니다. 앱의 `appointments` 및 usage 직접 DML은 없습니다.
- `/customers/[id]`는 owner 등록·총 횟수·만료·pause/cancel 관리와 staff read-only 경계를 제공하며 예약/시술 이력에 usage 상태를 표시합니다.
- active/paused 횟수권 또는 usage history가 있는 고객 merge를 차단하고, 익명 처리 시 횟수권 memo를 비웁니다.
- R-03 충돌, R-07 lifecycle, R-08 snapshot, R-15 actual price 의미를 유지하며 기존 예약·고객에는 pass를 추정 연결하거나 backfill하지 않습니다.

## 핵심 원칙
- `남은 횟수`를 사용자가 직접 수정하는 단일 숫자로 저장하지 않습니다.
- 총 횟수와 예약별 사용 원장을 분리하고 `총 횟수 - 예약/사용 중인 횟수`로 잔여를 계산합니다.
- 예약 확정 시점에 1회를 먼저 확보해 같은 횟수권이 동시에 초과 예약되지 않게 합니다.
- 예약 완료는 확보한 1회를 사용 확정하고, 예약 취소는 확보한 1회를 반환합니다.
- 차감·복구·예약 상태 변경은 한 DB transaction에서 처리합니다.
- 횟수권 사용은 결제나 매출 인식을 뜻하지 않습니다.

## 구현 사용자 흐름

```text
횟수권 등록
  -> 고객·대상 시술·총 횟수·유효기간 확인
  -> 예약에서 횟수권 선택
  -> 예약 확정과 동시에 1회 reserved
  -> 시술 완료 시 consumed
  -> 예약 취소 시 released, 잔여 1회 복구
```

고객이 횟수권을 사용하지 않는 예약은 기존 흐름을 유지합니다.

## 구현 데이터 모델

### `customer_session_passes`

| 컬럼 | 의미 |
| --- | --- |
| `id` | 횟수권 ID |
| `customer_id` | 소유 고객 |
| `name` | 운영상 표시명, 예: `두피관리 10회권` |
| `eligible_service_id` | 특정 서비스 전용이면 FK, 전체 시술형이면 NULL |
| `total_sessions` | 최초·조정 후 총 횟수, 1 이상 |
| `status` | `active`, `paused`, `cancelled` |
| `purchased_on` | KST 구매/등록 date key |
| `expires_on` | nullable KST 만료 date key |
| `memo` | nullable 내부 메모, 개인정보 입력 금지 안내 필요 |
| `created_by`, `updated_by` | DB에서 기록하는 작업자 |
| `created_at`, `updated_at` | 감사 시각 |

- `exhausted`와 `expired`는 잔여·날짜에서 파생되는 표시 상태로 보고 저장 상태와 중복시키지 않는 안을 권장합니다.
- `total_sessions`는 이미 `reserved` 또는 `consumed`인 합계보다 작게 낮출 수 없습니다.
- 서비스가 비활성화되어도 기존 사용 원장은 유지하지만 새 예약에는 사용할 수 없습니다.

### `appointment_session_pass_usages`

| 컬럼 | 의미 |
| --- | --- |
| `id` | 사용 원장 ID |
| `session_pass_id` | 사용한 횟수권 |
| `appointment_id` | 연결 예약 |
| `state` | `reserved`, `consumed`, `released` |
| `units` | MVP에서는 항상 1 |
| `reserved_at`, `reserved_by` | 예약 차감 시각·작업자 |
| `consumed_at`, `consumed_by` | 시술 완료 시각·작업자 |
| `released_at`, `released_by` | 취소·변경으로 복구한 시각·작업자 |
| `release_reason` | `appointment_cancelled`, `pass_changed`, `service_changed` 등 제한된 값 |

- 같은 예약에는 `reserved` 또는 `consumed` 상태의 사용 원장이 최대 1개만 존재하도록 partial unique index를 둡니다.
- `released` 원장은 삭제하지 않아 취소·횟수권 변경 흔적을 남깁니다.
- 잔여 횟수는 `total_sessions - sum(units where state in ('reserved','consumed'))`로 계산합니다.
- 잔여를 별도 mutable 컬럼으로 캐시한다면 원장과 불일치를 자동 탐지·복구하는 검증이 필요하므로 MVP에서는 파생값을 권장합니다.

## 서비스 범위 대안

### A안 - 전체 시술형 또는 단일 서비스형 (MVP 채택)
- `eligible_service_id=NULL`이면 모든 활성 서비스, non-NULL이면 해당 서비스에만 사용할 수 있습니다.
- 10회권 요구를 충족하면서 검증과 UI가 단순합니다.

### B안 - 여러 서비스 묶음형
- 패키지 항목 테이블에서 서비스별 사용 가능 횟수를 관리합니다.
- 커트 5회 + 염색 3회 같은 상품을 지원하지만 잔여 표시·서비스 변경·환불 규칙이 크게 복잡해집니다.
- 실제 운영 사례가 확인될 때 후속 확장합니다.

### C안 - 금액 잔액형
- 횟수가 아니라 선불 금액을 차감합니다.
- 이번 요구와 다른 결제·선불금 회계 기능이므로 범위 밖입니다.

## 상태 전이

| 이벤트 | 사용 원장 변화 | 잔여 변화 |
| --- | --- | --- |
| confirmed 예약 생성 + 횟수권 선택 | `reserved` 생성 | -1 |
| confirmed 예약 날짜·시간만 수정 | 변화 없음 | 변화 없음 |
| confirmed 예약 서비스 변경 | 자격 재검증, 부적합하면 저장 차단 또는 명시적 pass 변경 | 조건부 |
| confirmed 예약 횟수권 변경 | 기존 `released` 후 새 `reserved` | 원자적으로 복구 후 차감 |
| confirmed -> completed | `reserved -> consumed` | 변화 없음 |
| confirmed -> cancelled | `reserved -> released` | +1 |
| completed -> confirmed | `consumed -> reserved` | 변화 없음 |
| cancelled -> confirmed | 기존 pass가 유효하고 잔여가 있으면 새 `reserved` | -1, 실패 가능 |

- 예약 재확정 시 횟수권이 만료·중지·소진됐으면 상태 변경을 거부하고 다른 횟수권 또는 미사용 예약을 명시적으로 선택하게 합니다.
- `paused`·만료 상태는 신규 예약 차감을 막지만 이미 확보된 confirmed 예약을 자동 취소하거나 반환하지 않습니다.
- `cancelled` 횟수권은 active usage가 남아 있으면 바로 취소할 수 없고 기존 예약을 먼저 해제하도록 합니다.
- 예약 고객을 다른 고객으로 변경하는 기능이 도입되면 기존 사용을 반환하고 새 고객 소유 횟수권만 선택하도록 강제합니다.

## 원자성과 동시성

### 채택안 - 예약 mutation RPC로 통합
- 새 예약 저장, 예약 편집, 상태 변경이 횟수권 사용 원장까지 한 transaction에서 처리됩니다.
- 횟수권 row를 `SELECT ... FOR UPDATE`로 잠근 뒤 잔여를 재계산합니다.
- 서로 다른 횟수권을 동시에 잠글 때는 UUID 정렬 순서로 잠가 deadlock을 줄입니다.
- 기존 R-03/R-08 trigger는 RPC 내부 appointment insert/update에서도 그대로 실행됩니다.
- `set_appointment_status`는 횟수권 상태 전이까지 포함하도록 새 version 또는 호환 확장합니다.
- 클라이언트가 예약만 저장하고 횟수권 차감에 실패하는 부분 성공 상태를 만들지 않습니다.

### B안 - appointment trigger에서 자동 원장 처리
- 기존 direct insert/update 경로를 적게 바꿀 수 있습니다.
- trigger 이름 순서, service snapshot, 충돌 guard, 상태 RPC와의 상호작용이 복잡하고 오류 메시지 계약이 불명확해질 수 있습니다.
- 채택하려면 모든 write 경로와 trigger ordering을 SQL test로 고정해야 합니다.

### DB 불변조건
- active/만료 전/서비스 적합/소유 고객 일치가 아니면 `reserved`를 만들 수 없습니다.
- `reserved + consumed <= total_sessions`를 row lock 아래에서 검증합니다.
- active usage를 직접 DELETE하지 않고 `released`로 전환합니다.
- usage 테이블의 authenticated direct INSERT/UPDATE/DELETE는 회수하고 승인된 RPC만 EXECUTE하도록 하는 안을 권장합니다.

## 화면별 UX

### `/customers/[id]`
- 시술 이력 위에 `횟수권` 섹션을 둡니다.
- 카드에 이름, 대상 시술, `10회 중 7회 남음`, 예약 확보 수, 사용 완료 수, 만료일과 상태를 표시합니다.
- 소진·만료·중지된 횟수권은 접힌 과거 영역에서 조회할 수 있습니다.
- owner에게 최소 44×44px `횟수권 등록/관리` 행동을 제공하고 staff는 조회만 하도록 하는 안을 권장합니다.
- 각 시술 이력에는 `횟수권 1회 사용`, `예약 차감`, `취소로 복구` 상태를 표시합니다.

### `/appointments/new`
- 고객과 서비스를 선택한 뒤 사용 가능한 횟수권만 표시합니다.
- 기본 선택은 `횟수권 사용 안 함`으로 두고 자동 차감하지 않습니다.
- 선택 시 `현재 7회 -> 예약 후 6회`를 저장 전에 보여줍니다.
- 잔여 0, 만료, paused, 서비스 불일치 상태는 선택할 수 없게 하고 이유를 표시합니다.
- 저장 완료 메시지에 예약 요약과 차감 후 잔여를 포함합니다.

### `/appointments`
- 예약 카드와 편집 패널에서 연결 횟수권과 `reserved/consumed`를 표시합니다.
- 취소 확인에는 `횟수권 1회가 복구됩니다`를 포함하고 성공 후 새 잔여를 알립니다.
- 횟수권 변경은 기존 반환과 새 차감을 한 번의 저장으로 처리합니다.
- 저장 오류·stale response가 이전 날짜의 잔여를 덮어쓰지 않도록 기존 예약 request guard를 유지합니다.

### 모바일·접근성
- 주요 행동은 최소 44×44px이며 fixed CTA는 safe-area를 반영합니다.
- 390×844와 360×800에서 횟수권 카드, select/listbox, 숫자 입력, 키보드, bottom sheet 내부 scroll을 검증합니다.
- 잔여 변경은 색상만으로 표현하지 않고 숫자·문구와 `aria-live` 상태로 알립니다.

## 구현 권한 정책

| 작업 | owner | staff | anon/profileless |
| --- | --- | --- | --- |
| 횟수권 조회 | 허용 | 허용 | 차단 |
| 신규 등록·총 횟수·만료일 변경 | 허용 | 차단 | 차단 |
| pause/cancel | 허용 | 차단 | 차단 |
| 예약에서 1회 사용·취소 복구 | 허용 | 허용 | 차단 |
| usage 직접 수정·삭제 | 차단, RPC만 사용 | 차단, RPC만 사용 | 차단 |

- 실제 운영에서 staff가 횟수권 판매·수정을 담당한다면 역할 확대를 별도 승인하고 감사 필드를 유지합니다.
- service-role secret을 브라우저에 노출하지 않습니다.

## R-07 고객 lifecycle 연동
- 보관·병합·익명 처리 고객에게 신규 횟수권 등록과 신규 사용을 차단합니다.
- 보관 시 횟수권과 사용 원장은 삭제하지 않고 조회 전용으로 보존합니다.
- 익명 처리 시 자유입력 memo에 개인정보가 남지 않도록 memo를 비우거나 비식별화하는 정책을 migration/RPC에 포함합니다.
- 고객 병합은 활성 횟수권을 조용히 합치지 않습니다.
- MVP 구현은 active/paused 횟수권 또는 usage history가 있는 고객의 병합을 차단하고 이유를 안내합니다.
- 고객 간 횟수권 자동 이전과 `transfer_session_pass` 흐름은 제공하지 않습니다.
- 기존 R-07 merge/undo RPC와 audit test를 반드시 회귀 검증합니다.

## R-15 가격과의 경계
- 횟수권 사용을 `actual_price_krw=0`으로 자동 기록하지 않습니다. 선불 구매 시점과 시술 사용 시점의 매출 의미가 다르기 때문입니다.
- 서비스의 `price_snapshot_krw`는 시술 기준가격으로 계속 보존합니다.
- 횟수권 사용 당일 추가로 받은 금액이 있다면 R-15의 `actual_price_krw`에 실제 추가 금액을 기록할 수 있습니다.
- 횟수권 판매금액, 선수금, 사용 시 매출 인식은 별도 회계 범위이며 R-16 MVP에 포함하지 않습니다.

## 구현 범위
- `pencil-hairshopcrm.pen`
- `app/appointments/new/page.js`, `app/appointments/new/page.module.css`
- `app/appointments/page.js`, `app/appointments/page.module.css`
- `app/customers/[id]/page.js`, `app/customers/[id]/page.module.css`
- `components/sessionPass/SessionPassPicker.js`, `components/sessionPass/SessionPassPicker.module.css`, `lib/sessionPass.js`
- `supabase/migrations/20260719150346_r16_customer_session_pass.sql`
- `supabase/rollbacks/20260719150346_r16_customer_session_pass.down.sql`
- R-16 fresh/upgrade/rollback/semantic/concurrency SQL·shell tests와 R-07/R-08/R-15 회귀 fixture
- `set_appointment_status` 및 예약 create/edit mutation 경로
- R-07 고객 lifecycle/merge 관련 RPC·test
- `schema.sql`
- `future-todo.md`, `docs/roadmap/README.md`, 본 문서

## 완료 기준
- Pencil에서 고객 상세 정상·없음·소진·만료·오류, 새 예약 선택·잔여 부족, 예약 취소 복구 상태를 코드보다 먼저 설계합니다.
- owner는 고객에게 전체 시술형 또는 단일 서비스형 횟수권을 등록·관리할 수 있습니다.
- owner/staff는 예약에서 사용 가능한 횟수권을 선택하고 차감 후 잔여를 즉시 확인할 수 있습니다.
- confirmed 예약은 1회를 reserved하고 completed는 consumed, cancelled는 released로 원자 전이합니다.
- 동일 마지막 1회를 두 동시 예약이 사용할 수 없습니다.
- 날짜·시간 변경은 중복 차감하지 않고 서비스·횟수권 변경은 원자적으로 반환·재차감합니다.
- 고객 상세에서 보유 상태와 예약별 사용·복구 이력을 확인할 수 있습니다.
- 보관·병합·익명 처리 고객의 횟수권 lifecycle 경계를 검증합니다.
- owner/staff/profileless/anon RLS·RPC·grant 경계를 통과합니다.
- 기존 고객·예약을 추정해 횟수권에 연결하지 않습니다.
- 390×844·360×800과 production-mode PWA에서 loading/error/empty/offline/recovery와 cache 0건을 검증합니다.

## 로컬 검증 결과 (2026-07-20)

아래는 과거 작업 기록입니다. 당시 임시 worktree와 PNG 원본은 유실됐으며, 이 절의 node ID·hash·스크린샷 경로·console 결과를 현재 증거로 사용하지 않습니다. 최신 결과는 다음 복구 감사 절을 기준으로 합니다.

- Pencil Desktop에서 R-16 node `VlzqR`, `fQBsS`, `inFJ9`, `HPb4U`, `ghTjF`, `mFV7a`의 `snapshot_layout problems=0`을 확인하고 저장했습니다. `.pen` SHA-256은 `97c791bd8d6dd9300e141be2fc109f289a932210ec9a3ba6c91669e42183f581`로 바뀌어 디스크 persistence도 확인했습니다.
- 전체 forward migration fresh replay, R-15→R-16 upgrade 무 backfill, rollback→legacy RPC 복원→reapply, `schema.sql` fresh replay를 통과했습니다. migration DB와 schema DB의 semantic digest는 모두 `5b0d35f1d46a5446aba3070c48aef079`입니다.
- 두 PostgreSQL session의 마지막 1회 경쟁은 정확히 1건만 성공했고, 동일 request UUID 동시 요청은 appointment·usage·private request ledger가 각각 1건만 남았습니다. 실패 원자성, 상태 전이, 서비스·pass 변경, KST 만료, 잔여 0, paused/cancelled를 통과했습니다.
- owner/staff/profileless/anon/PUBLIC, RLS, Data API grant, SECURITY DEFINER `search_path=''`·명시적 authenticated EXECUTE 경계와 R-03/R-07/R-08/R-15 회귀를 통과했습니다.
- `npm test`는 Node 35/35와 appointment race 9/9, 합성 env Production `npm run build`는 Next.js/PWA build와 `/offline.html` fallback 생성을 포함해 성공했습니다.
- 합성 데이터만 사용해 390×844·360×800에서 owner 등록/관리, staff read-only, 새 예약 사용 가능·소진 disabled, 예약 reserved 표시, 편집 picker 배치, completed/cancelled/re-confirm, loading/error/empty/recovery, 44×44px, 가로 overflow 0, bottom sheet 키보드 축소·safe-area를 검증했습니다. 정상 화면 console error/warning은 0건입니다.
- `/manifest.json`, `/icons/icon-192.png`, `/icons/icon-512.png`는 200, `/sw.js`는 scope `/`에서 activated/controller 상태였습니다. offline fallback을 두 viewport에서 확인하고 재연결 refresh 후 변경된 최신 합성 데이터를 다시 받았습니다.
- Cache Storage는 `workbox-precache-v2-http://127.0.0.1:3101/` 1개, 정적 URL 54개였습니다. `/rest/v1`, `/auth/v1`, 고객/예약 route 문서, session-pass 표식, 외부 API URL은 각각 0건입니다.
- 스크린샷은 `output/playwright/r16-customer-session-pass/before/`를 보존하고 `after/20260720_r16_*_final_*.png`에 최종 화면을 추가했습니다. 전화·고객·예약 내용은 비식별 합성 값만 사용했습니다.

## 복구 및 재검증 결과 (2026-09-06)

- base `b87eb687` 위에 두 세션의 성공한 패치 이벤트 67건을 정확한 문맥·줄 수 검증 후 적용했습니다. 소스·문서·SQL·테스트 25개와 합성 서버 1개가 복구됐습니다. Git commit으로 존재하지 않던 변경이며, main과 기존 worktree metadata는 수정하지 않았습니다.
- Pen Desktop (`dev.pencil.desktop`)에서 과거 디자인 작업을 재구성했습니다. 원본 `.pen` 바이트 복구가 아니며 새 ID를 사용합니다. 현재 node는 `IeRVR`, `t5UzpA`, `OrA43`, `I0fst`, `yT3MH`, `iD397`이고 여섯 frame의 layout problem은 0건입니다. 현재 앱에서 확인한 실제 좌표에 맞춰 겹침을 교정했고 File > Save 후 디스크 SHA-256 `be5eeef5f310597b76c3368dde02084a7bec3bf833449c11bcdebd7ec3884856`을 확인했습니다.
- 복구 후 실제 브라우저에서 횟수권 조회 실패 중 저장 버튼이 활성화되는 결함을 발견했습니다. 새 예약·예약 편집·완료 이력의 로딩/오류 저장 차단과 submit handler guard를 보완했습니다. 편집 중 완료/재확정도 차단하며 취소 및 서비스 연결 없는 legacy 이력은 기존 계약을 유지합니다. 이는 기존 오류 시 저장 금지 디자인을 구현하는 수정입니다.
- PostgreSQL 17 별도 로컬 cluster에서 전체 15개 forward migration fresh replay, R-15→R-16 upgrade, rollback/reapply, `schema.sql` replay 및 R-07/R-08/R-09/R-10/R-15/R-16 SQL 검증이 통과했습니다. 세 DB digest는 모두 `e4c9ae453013f837e2fe2f36f02e8798`입니다. 기존 digest SQL에는 role OID가 포함되므로 과거 다른 cluster의 hash와 동일성을 완료 기준으로 사용하지 않았습니다.
- 마지막 1회 경쟁과 동일 request UUID 동시 요청이 통과했습니다. 최종 catalog에서 대상 함수 15개는 모두 빈 search_path·PUBLIC/anon EXECUTE 차단, private helper는 authenticated EXECUTE도 차단됐습니다. 두 공개 원장은 RLS·authenticated SELECT-only입니다. fresh DB의 고객·예약·횟수권·usage fixture 잔여는 각각 0건입니다.
- 최종 `npm test`: Node 35/35 + race 9/9. 합성 env `npm run build`: 성공. 새 예약·편집·이력의 강제 submit에서도 mutation 요청은 0건이며 재조회 성공 후 저장이 복구됩니다.
- 390×844·360×800에서 before 6장 및 after를 새로 캡처했습니다. owner/staff, picker·잔여·소진 disabled, 상태 전이, loading/error/empty/retry, 가로 overflow 0, 44px 조작 영역, sheet·키보드 높이 축소를 확인했습니다. 취소 사유는 합성 입력을 사용했고 실기기 키보드는 검증하지 않았습니다.
- PWA 자산 5개 HTTP 200, SW activated/controller 및 update 확인, 두 viewport offline fallback, 재연결 후 최신 합성 revision 복구를 통과했습니다. precache 1개·정적 URL 54개·고객/예약/Auth/API 민감 cache 0건입니다. 정상/PWA 복구 console 오류는 0건이며 CSS preload 경고 5건은 baseline에서도 재현되는 후속 사항입니다. 의도적으로 주입한 503 오류 시나리오는 별도 로그입니다.
- 현재 증거: 복구 루트의 `evidence/restore-manifest.json`, `db-results.json`, `audit.log`, `npm-test-final.log`, `build-final.log`, `ui-guards.log`, `ui-status-final.log`, `pwa.log`, `pencil-final/`, `mobile/`. 상세 인계와 파일 hash는 복구 루트 `README.md`, `source-manifest.json`을 사용합니다.

## Git 전달 및 검증 경계 (2026-09-07)

- 사용자 승인 범위는 새 worktree 생성, 검증한 26개 파일 반영, 인계 문서 갱신, stage/commit/push, Draft PR 생성 및 CI·자동 Preview 상태 확인입니다. 병합·Production 배포·remote migration·기존 worktree/branch 삭제는 포함하지 않습니다.
- 생성 직전 원격 `main`은 복구 기준 `b87eb6873f3ab873b5d7cc8c6e9db641bd1c6e4d`와 일치했고 기존 열린 PR은 없었습니다. 새 worktree에 26개 파일을 복사한 뒤 모든 SHA-256 일치를 확인했습니다. 이후 이 절과 두 roadmap 상태 문서만 전달 단계에 맞춰 갱신합니다.
- 애플리케이션·DB·테스트·디자인 바이트는 2026-09-06 검증본을 그대로 사용합니다. 새 worktree에서 `npm test`, 합성 env `npm run build`, `git diff --check`를 다시 실행하고 PR의 현재 head에 대한 CI 결과를 확인합니다. 실행 결과와 PR 주소는 작업 인계 보고서 및 PR 메타데이터를 기준으로 합니다.
- 기존 `main`과 다른 worktree의 사용자 파일·복구 증거는 보존합니다. 원래 유실된 worktree metadata는 별도 정리 대상입니다.

- 로컬 코드·DB·합성 Production 브라우저/PWA 검증은 완료했습니다.
- 실제 Production Auth/DB/고객·예약 데이터, Preview/Production 배포, remote migration은 조회하거나 변경하지 않았습니다.
- R-16은 `Done`이 아닙니다. Git 검토 이후 실제 Supabase 연동 검증과 migration·release는 별도 Implementation Plan과 승인이 필요합니다.

## Preview 검증 및 재확정 보완 (2026-09-10)

### 전달된 버전과 실제 Preview 검증

- Draft PR [#37](https://github.com/dongseoklee1541/hairCRMvibes/pull/37), head `aaa168a56bbafc136abf339acd757352b8e912ba`. 해당 head의 CI 및 Vercel 검사는 통과했습니다. PR은 Draft이며 병합하지 않았습니다.
- `burtyhairCRM-preview`에 R-16 migration을 적용하고 owner/staff/profileless/anon SQL 계약 검사를 통과했습니다. 검사는 rollback으로 정리했으며 이후 합성 고객 1명·횟수권 2개·예약 3건으로 owner UI 흐름을 검증했습니다.
- 실제 Preview 버튼에서 예약 C 취소 → released, 고객 상세와 DB 원장의 2회권 잔여 1회·예약 중 0회·사용 완료 1회, 1회권 잔여 1회를 확인했습니다. 재조회 후에도 유지됐습니다. 기존 취소 prompt는 인라인 사유/확정 폼으로 바뀌었습니다.
- 근거는 main checkout의 `output/recovery/r16-20260906/preview-20260910/cancel-ui-fix-report.md`와 `cancel-preview-reverification.json`입니다. Production DB·배포는 변경하지 않았습니다.

### 재확정 보완: 이번 로컬 변경

- 기존 UI는 active usage만 찾아 취소된 예약의 확정·완료 RPC에 횟수권 ID 대신 null을 보냈습니다. 두 회귀 테스트와 기존 빌드의 모바일 화면에서 confirmed/released 상태를 재현했습니다.
- `getAppointmentStatusPassUsage`는 active usage를 우선하며, cancelled 예약의 마지막 released 원장 중 `appointment_cancelled`인 원장을 재사용 후보로 고릅니다. 현재 취소 시각보다 오래된 복구는 제외해 미사용 재확정 후 재취소 시 과거 권을 되살리지 않습니다.
- 편집 화면은 같은 후보를 초기 선택하되 released를 현재 reserved로 표시하지 않습니다. 사용자가 선택한 미사용/다른 횟수권을 우선합니다. 기존에 제거·교체·고객 처리로 복구한 원장은 자동 선택하지 않습니다.
- 만료·중지·소진·시술 자격·잔여 및 동시성 검증은 기존 transaction RPC가 수행합니다. 실패하면 상태를 유지하고 원래 요청 UUID로 재시도하며 미사용으로 자동 전환하지 않습니다. DB migration/RPC/RLS 및 가격·캐시 계약 변경은 없습니다.
- 기존 버튼과 picker의 잘못된 초기값/전달값만 바로잡는 micro bug fix이므로 `.pen` 변경 예외를 적용했습니다. 새 화면·레이아웃·의존성은 없습니다.
- `npm test`: Node 35/35 + race 24/24, 총 59개 통과. 재확정/바로 완료, 복구 사유/시각, 만료·소진·중지 실패/재시도, 명시적 미사용/다른 권 선택을 포함합니다.
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329 NEXT_PUBLIC_SUPABASE_ANON_KEY=r16-synthetic-test-key npm run build`: 성공. `git diff --check`: 통과.
- 합성 API를 연결한 local production build의 390×844·360×800에서 before confirmed/released → after confirmed/reserved를 동일 fixture로 비교했습니다. 390×844에서 만료 오류와 취소 상태 유지도 확인했습니다. 실제 Preview에서 이번 재확정 변경을 실행한 결과와는 구분합니다.
- 근거: main checkout의 `output/recovery/r16-20260906/reconfirm-20260910/README.md`, `tests.log`, `build.log`, 수정 전후 JPEG 4장과 오류 JPEG 1장. 실제 비밀번호·토큰·고객 정보는 저장하지 않았습니다.

### 현재 남은 단계

- 2026-09-10 추가 승인으로 이번 재확정 코드·테스트·문서의 커밋·푸시와 새 Preview 재검증을 진행합니다. 결과는 PR #37의 최신 head 및 로컬 검증 보고서의 전달 결과를 기준으로 확인하며, 이전 `aaa168a`의 CI/Preview 결과를 새 변경의 원격 검증으로 사용하지 않습니다.
- commit/push 후 새 Preview에서 재확정·완료·미사용/다른 권 선택을 재검증하고 PR 최종 검토를 진행합니다. 병합·Production migration·배포는 별도 계획과 승인 대상입니다.
- 기존 합성 예약 B의 완료/released 이력은 자동 보정하지 않았습니다. 재확정 보완은 과거 데이터 일괄 수정을 포함하지 않습니다.
- 실제 모바일 IME/키보드 및 staff 브라우저 로그인을 검증하지 않았습니다. PWA/cache 로직은 변경하지 않아 이번 보완에서 전체 PWA 검사를 반복하지 않았습니다.

## Non-Goals
- 선불금·결제·환불·매출 인식·영수증
- 금액 잔액형 상품
- 여러 서비스별 서로 다른 횟수를 담는 복합 패키지
- 한 예약에서 2회 이상 차감, 부분 차감, 소수 단위
- 가족·지인 공유, 고객 간 양도 자동화
- 반복 예약 자동 생성
- Production 기존 데이터 backfill

## 위험과 완화
- 클라이언트에서 잔여를 읽고 차감하면 동시 예약으로 음수가 될 수 있습니다. DB row lock과 단일 transaction에서 재검증합니다.
- 예약만 저장되고 차감이 실패하면 상태가 어긋납니다. appointment와 usage를 같은 RPC transaction으로 처리합니다.
- 취소·재확정·서비스 변경에서 중복 차감될 수 있습니다. 상태 전이 표와 partial unique index, idempotency test를 고정합니다.
- 남은 횟수 컬럼과 원장이 달라질 수 있습니다. MVP는 원장에서 파생하고 mutable 잔여 컬럼을 두지 않습니다.
- 횟수권을 무료 시술 금액으로 처리하면 매출이 왜곡됩니다. R-15 실제 금액과 횟수권 사용을 분리합니다.
- 고객 병합이 다른 고객의 잔여를 조용히 합칠 수 있습니다. active pass 병합 차단 또는 명시적 owner 이전을 사용합니다.

## 확정된 구현 결정
1. 횟수권 등록·총 횟수·만료·pause/cancel은 owner 전용이고 staff는 조회와 예약 사용·복구만 허용합니다.
2. 만료 전에 reserved된 예약은 만료 후에도 유지합니다.
3. active/paused 횟수권 또는 usage history가 있는 고객 merge를 차단하며 자동 이전하지 않습니다.
4. 예약 create/edit/status와 휴무 취소를 transaction RPC로 통합합니다.
5. 구매금액·선불금·환불·매출 인식은 R-16 MVP에서 분리하고 횟수권 사용을 `actual_price_krw=0`으로 자동 기록하지 않습니다.

## Rollback
- 먼저 UI에서 신규 횟수권 선택·등록을 비활성화합니다.
- active confirmed 예약과 `reserved` usage가 0인지 확인하고, 남아 있으면 자동 삭제하지 않고 명시적으로 해제·보존 결정을 받습니다.
- 애플리케이션을 R-16 이전 버전으로 배포한 뒤 RPC execute 권한을 회수합니다.
- 원장 데이터 보존 여부를 확인한 후 trigger/function/index/table을 역순으로 제거하는 검토된 rollback SQL을 사용합니다.
- 현재 복구 사본은 main에 적용하지 않았으므로 사용을 중단해 원래 작업 상태를 유지할 수 있습니다. 2026-09-06 disposable DB 3개와 data directory는 보존하고 서버만 정상 종료합니다. DB·worktree·branch 삭제는 별도 승인 작업입니다.
