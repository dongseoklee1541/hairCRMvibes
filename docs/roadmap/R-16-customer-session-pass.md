# R-16 고객별 횟수권

## 상태
- Proposed (설계 문서화 완료 · 구현 승인 없음)
- 기준: `origin/main@ed5b07bee005bd8d84d164a78c00e0adf38153ab`
- 우선순위: P1
- 선행조건: R-02 예약 상태 전이, R-07 고객 lifecycle/병합, R-08 서비스 마스터, R-15 실제 시술금액 의미 확정
- 최종 업데이트: 2026-07-16

## 사용자 요구
- 고객이 10회권 같은 횟수형 상품을 미리 등록해 둘 수 있어야 합니다.
- 예약할 때 횟수권을 선택하면 1회가 차감되어야 합니다.
- 예약 후 남은 횟수를 즉시 알 수 있어야 합니다.
- 고객 상세에서 보유 횟수권, 남은 횟수와 사용 이력을 확인할 수 있어야 합니다.

## 현재 코드 근거
- 고객·예약·서비스 마스터는 있지만 횟수권, 패키지, 사용 원장 테이블은 없습니다.
- `/appointments/new`는 고객·서비스·날짜·시간을 선택한 뒤 `appointments`에 직접 insert합니다.
- `/appointments`는 direct update와 `set_appointment_status` RPC를 함께 사용합니다.
- `/customers/[id]`는 예약 기반 시술 이력을 표시하고 완료 이력을 추가할 수 있습니다.
- R-03은 예약 충돌과 영업시간을 DB trigger로 보호하며, R-08은 서비스 snapshot을 DB trigger로 보존합니다.
- R-07 고객 병합·보관·익명 처리 흐름에 신규 고객 소유 데이터의 처리 규칙을 추가해야 합니다.

## 핵심 원칙
- `남은 횟수`를 사용자가 직접 수정하는 단일 숫자로 저장하지 않습니다.
- 총 횟수와 예약별 사용 원장을 분리하고 `총 횟수 - 예약/사용 중인 횟수`로 잔여를 계산합니다.
- 예약 확정 시점에 1회를 먼저 확보해 같은 횟수권이 동시에 초과 예약되지 않게 합니다.
- 예약 완료는 확보한 1회를 사용 확정하고, 예약 취소는 확보한 1회를 반환합니다.
- 차감·복구·예약 상태 변경은 한 DB transaction에서 처리합니다.
- 횟수권 사용은 결제나 매출 인식을 뜻하지 않습니다.

## 권장 사용자 흐름

```text
횟수권 등록
  -> 고객·대상 시술·총 횟수·유효기간 확인
  -> 예약에서 횟수권 선택
  -> 예약 확정과 동시에 1회 reserved
  -> 시술 완료 시 consumed
  -> 예약 취소 시 released, 잔여 1회 복구
```

고객이 횟수권을 사용하지 않는 예약은 기존 흐름을 유지합니다.

## 권장 데이터 모델

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

### A안 - 전체 시술형 또는 단일 서비스형 (MVP 권장)
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

### A안 - 예약 mutation RPC로 통합 (권장)
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

## 권한 정책 권장안

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
- MVP 권장안은 source 고객에 active/paused 횟수권이 있으면 병합을 차단하고, owner가 별도 `transfer_session_pass` 흐름에서 대상·잔여·사용 이력을 확인한 뒤 이전하도록 하는 것입니다.
- 횟수권 이전을 지원하지 않는 1차 구현이라면 active pass가 있는 고객 병합을 명시적으로 차단하고 이유를 안내합니다.
- 기존 R-07 merge/undo RPC와 audit test를 반드시 회귀 검증합니다.

## R-15 가격과의 경계
- 횟수권 사용을 `actual_price_krw=0`으로 자동 기록하지 않습니다. 선불 구매 시점과 시술 사용 시점의 매출 의미가 다르기 때문입니다.
- 서비스의 `price_snapshot_krw`는 시술 기준가격으로 계속 보존합니다.
- 횟수권 사용 당일 추가로 받은 금액이 있다면 R-15의 `actual_price_krw`에 실제 추가 금액을 기록할 수 있습니다.
- 횟수권 판매금액, 선수금, 사용 시 매출 인식은 별도 회계 범위이며 R-16 MVP에 포함하지 않습니다.

## 구현 예상 범위
- `pencil-hairshopcrm.pen`
- `app/appointments/new/page.js`, `app/appointments/new/page.module.css`
- `app/appointments/page.js`, `app/appointments/page.module.css`
- `app/customers/[id]/page.js`, `app/customers/[id]/page.module.css`
- R-16 forward migration·rollback·SQL concurrency test
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

## 테스트 요구사항
- 전체 forward migration fresh replay, rollback/reapply, `schema.sql` semantic parity
- 총 1회·10회, 잔여 0, 만료 당일/전/후 KST date, paused/cancelled
- 전체 시술형·단일 서비스형·비활성 서비스·서비스 변경
- confirmed/completed/cancelled/re-confirm 상태 전이와 중복 요청 idempotency
- 마지막 1회를 두 PostgreSQL session에서 동시에 예약하는 경쟁
- 예약 저장 실패 시 appointment/usage 모두 0건인 원자성
- owner/staff/profileless/anon/PUBLIC execute·table grant
- R-03 충돌·영업시간, R-08 snapshot, R-07 merge/undo 회귀
- `npm test`, `npm run build`
- 390×844·360×800 mobile browser, PWA offline/recovery, 민감 cache 0건

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

## 구현 전 결정사항
1. 횟수권 등록·수정을 owner 전용으로 할지 staff까지 허용할지
2. 유효기간이 지난 뒤 이미 reserved인 예약을 그대로 인정할지(권장) 또는 반환할지
3. active 횟수권 고객 병합을 차단할지, owner 확인형 이전을 1차 범위에 포함할지
4. 예약 mutation을 RPC로 통합할지, trigger 기반으로 기존 direct write를 유지할지
5. 횟수권 구매금액·추가금액 기록을 이번 범위와 분리할지

## Rollback
- 먼저 UI에서 신규 횟수권 선택·등록을 비활성화합니다.
- active confirmed 예약과 `reserved` usage가 0인지 확인하고, 남아 있으면 자동 삭제하지 않고 명시적으로 해제·보존 결정을 받습니다.
- 애플리케이션을 R-16 이전 버전으로 배포한 뒤 RPC execute 권한을 회수합니다.
- 원장 데이터 보존 여부를 확인한 후 trigger/function/index/table을 역순으로 제거하는 검토된 rollback SQL을 사용합니다.
- 구현 전 문서 단계에서는 코드·DB rollback이 없습니다.
