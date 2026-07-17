# R-15 고객별 실제 시술금액 입력·수정

## 상태
- Done (production deployed; live migration applied; authenticated UI smoke pending)
- 기준: `origin/main@52fa394d783cb418883d413ef4796be32f8afcde`
- 우선순위: P1
- 선행조건: R-08 서비스 마스터, R-09 통계 계약 재결정
- 최종 업데이트: 2026-07-17

## 사용자 요구
- 고객에게 실제로 적용한 시술 금액을 기록할 수 있어야 합니다.
- 새 예약에서 금액을 입력할 수 있으면 좋지만 필수는 아닙니다.
- 예약 후 또는 시술 완료 후에도 금액을 별도로 입력·수정할 수 있어야 합니다.
- 고객 상세의 시술 이력에서 당시 금액을 확인하고 수정할 수 있어야 합니다.

## 현재 코드 근거
- `salon_service_defaults.price_krw`는 현재 서비스 마스터의 기본가격입니다.
- `appointments.price_snapshot_krw`는 R-08 trigger가 서비스 선택 시 복사하는 예약 당시 기본가격 snapshot입니다.
- `/appointments/new`는 서비스와 기본가격을 보여주지만 가격을 직접 입력하지 않고 DB trigger가 snapshot을 채웁니다.
- `/appointments`의 예약 수정은 날짜·시간·서비스·소요시간·메모를 수정하지만 같은 서비스의 가격 snapshot은 변경하지 않습니다.
- `/customers/[id]`는 `price_snapshot_krw`를 시술 이력에 표시하지만 기존 이력의 가격 수정 행동은 없습니다.
- R-09 매출·객단가는 완료 예약의 `price_snapshot_krw`를 사용하므로 실제 고객별 금액을 추가하면 지표 계약도 함께 재결정해야 합니다.

## 용어와 가격 의미

| 값 | 의미 | 변경 규칙 |
| --- | --- | --- |
| `salon_service_defaults.price_krw` | 현재 서비스 마스터의 기본가격 | owner가 설정에서 변경 |
| `appointments.price_snapshot_krw` | 예약에서 서비스를 선택한 시점의 기본가격 | 서비스 변경 때만 새 snapshot 생성, 이후 현재가와 독립 |
| 권장 신규 `appointments.actual_price_krw` | 해당 고객·해당 시술에 실제 적용한 금액 | 예약 생성 또는 이후 이력 수정에서 명시적으로 입력 |

- `NULL`은 실제 금액 미입력, `0`은 무료 시술로 구분합니다.
- 모든 금액은 정수 KRW이며 non-NULL 값은 `0 이상`이어야 합니다.
- `actual_price_krw`는 결제 완료나 현금 수납 증빙을 뜻하지 않습니다. 이 기능은 결제 시스템이 아니라 운영자가 기록한 실제 적용 금액입니다.
- 서비스 변경이나 현재 서비스 가격 변경이 이미 입력된 실제 금액을 자동으로 덮어쓰지 않습니다.

## 대안 비교

### A안 - 실제 금액 컬럼 분리 (권장)
- `price_snapshot_krw`를 R-08의 예약 당시 기준가격으로 보존하고 `actual_price_krw`를 추가합니다.
- 기본가격과 할인·현장 변경이 반영된 실제 금액을 함께 설명할 수 있습니다.
- 기존 R-08 trigger와 과거 snapshot 의미를 깨지 않습니다.
- R-09 통계가 어떤 가격을 사용할지 별도 결정이 필요합니다.

### B안 - `price_snapshot_krw`를 직접 수정
- 스키마 변경은 작지만 snapshot이 더 이상 예약 당시 기본가격을 뜻하지 않게 됩니다.
- 서비스 변경, 과거 가격, 통계 결과의 근거를 구분하기 어렵습니다.
- R-08 완료 계약과 충돌하므로 채택하지 않습니다.

### C안 - 가격 변경 원장 테이블
- 모든 변경 전후 값과 사유를 남길 수 있어 감사에는 가장 강합니다.
- 현재 요구보다 구현·조회·복구 복잡도가 큽니다.
- 정산·결제 기능이 도입될 때 후속 승격을 검토합니다.

## 권장 데이터 모델
- `appointments.actual_price_krw integer null`
- `appointments.actual_price_updated_at timestamptz null`
- `appointments.actual_price_updated_by uuid null references auth.users(id)`
- `actual_price_krw is null or actual_price_krw >= 0` check constraint
- 가격이 실제로 변경된 경우에만 DB trigger가 수정 시각과 `auth.uid()`를 기록합니다.
- 기존 예약은 추정 backfill하지 않고 모두 `actual_price_krw=NULL`로 둡니다.
- `apply_appointment_service_snapshot()`은 기존 `price_snapshot_krw` 계약만 유지하고 실제 금액을 읽거나 덮어쓰지 않습니다.

최종 구현 전에는 전체 변경 이력 원장이 필요한지 다시 확인합니다. MVP에서는 마지막 수정자·수정시각을 남기고, 이전 값 전체 보존은 Non-Goal로 둡니다.

## 상태별 규칙

| 예약 상태 | 실제 금액 입력·수정 | 표시·통계 원칙 |
| --- | --- | --- |
| `confirmed` | 선택 입력 허용 | 예정 예약임을 함께 표시하고 실제 매출에 포함하지 않음 |
| `completed` | 입력·수정 허용 | 실제 금액이 없으면 `금액 미입력`으로 명시 |
| `cancelled` | 기존 값 보존, 수정은 허용 | 취소 상태를 함께 표시하고 매출에서 제외 |

- 취소 전 입력한 금액을 취소 시 자동 삭제하지 않습니다. 자동 삭제는 사용자 입력을 조용히 잃게 만들 수 있습니다.
- 완료 예약에도 금액 입력을 강제하지 않습니다. 기존 이력과 현장 입력 누락을 허용하되 데이터 품질 경고로 추적합니다.
- 서비스가 바뀌어도 입력된 실제 금액은 자동 변경하지 않고, UI에서 새 기준가격과 실제 금액 차이를 확인하게 합니다.

## 화면별 UX

### `/appointments/new`
- 서비스 선택 아래에 `실제 시술금액 (선택)` 숫자 입력을 둡니다.
- 기본값은 비워두고 현재 서비스 기본가격을 보조문구로 보여줍니다.
- `기본가격 사용` 행동으로 snapshot 값을 명시적으로 복사할 수 있게 하는 방안을 우선 검토합니다.
- 예약 생성 화면의 필수 입력 수를 늘리지 않으며 금액 미입력으로도 저장할 수 있습니다.

### `/appointments`
- 기존 예약 수정 패널에 실제 금액을 추가합니다.
- 현재 예약 기준가격과 실제 금액을 나란히 보여줍니다.
- 서비스 변경 뒤 기존 실제 금액이 남아 있으면 `새 시술의 기본가격과 다를 수 있습니다` 안내를 표시합니다.

### `/customers/[id]`
- 각 시술 이력에 다음 중 하나를 표시합니다.
  - 실제 금액 입력됨: `실제 35,000원`
  - 실제 금액 없음·snapshot 있음: `실제 금액 미입력 · 예약 기준 30,000원`
  - 두 값 모두 없음: `금액 미입력`
- 각 이력에 최소 44×44px `금액 수정` 행동을 제공합니다.
- 수정은 bottom sheet 또는 기존 이력 편집 sheet로 제공하고 저장 중·성공·오류·오프라인 상태를 분리합니다.
- 보관·병합·익명 처리된 read-only 고객은 조회만 허용하고 가격 수정은 차단합니다.

## 권한과 개인정보 경계
- owner/staff는 기존 예약 관리 권한 범위에서 실제 금액을 조회·입력·수정할 수 있도록 하는 안을 권장합니다.
- anon과 profile이 없는 authenticated 사용자는 읽기·쓰기를 모두 차단합니다.
- `actual_price_updated_by`는 앱 입력이 아니라 DB에서 `auth.uid()`로 기록합니다.
- 고객 이름·전화번호·메모와 가격을 로그, screenshot, fixture에 함께 노출하지 않습니다.
- 고객·예약·가격 응답은 기존 PWA `NetworkOnly` 경계를 유지하며 Cache Storage에 저장하지 않습니다.

## R-09 통계 결정 게이트
현재 R-09의 `매출`은 완료 예약의 `price_snapshot_krw` 합계입니다. R-15 구현 전에 다음 중 하나를 명시적으로 승인해야 합니다.

### A안 - 실제 금액만 매출로 집계 (정확성 우선 권장)
- 완료 + `actual_price_krw is not null`만 실제 매출과 실제 객단가에 포함합니다.
- snapshot만 있는 행은 `실제 금액 미입력` 데이터 품질로 분리합니다.
- 도입 직후 과거 매출이 비어 보일 수 있지만 추정값과 실제값을 섞지 않습니다.

### B안 - 실제 금액 우선, snapshot fallback
- `coalesce(actual_price_krw, price_snapshot_krw)`로 기존 통계 연속성을 유지합니다.
- 실제값과 추정값이 한 숫자에 섞여 매출 정확도를 오해할 수 있습니다.

### C안 - 실제 매출과 예약 기준금액을 별도 지표로 병렬 표시
- 의미는 가장 명확하지만 R-09 RPC·UI 범위가 커집니다.
- 장기 권장안이며 R-15 MVP 범위와 일정에 따라 선택합니다.

## 구현 예상 범위
- `pencil-hairshopcrm.pen`
- `app/appointments/new/page.js`, `app/appointments/new/page.module.css`
- `app/appointments/page.js`, `app/appointments/page.module.css`
- `app/customers/[id]/page.js`, `app/customers/[id]/page.module.css`
- R-15 forward migration·rollback·SQL test
- `schema.sql`
- R-09 migration/RPC/UI/test 파일(선택한 통계 계약에 따라 필수)
- `future-todo.md`, `docs/roadmap/README.md`, 본 문서

## 완료 기준
- Pencil에서 새 예약, 예약 수정, 고객 이력 정상·미입력·무료·오류 상태를 코드보다 먼저 설계하고 `.pen` persistence를 확인합니다.
- 예약 생성 시 실제 금액을 선택적으로 입력할 수 있고 미입력 저장도 가능합니다.
- 예약과 고객 상세 양쪽에서 실제 금액을 입력·수정할 수 있습니다.
- 기본가격, 예약 당시 snapshot, 실제 금액을 혼동하지 않게 표시합니다.
- 서비스 변경과 취소가 실제 금액을 조용히 삭제하거나 현재가로 덮어쓰지 않습니다.
- owner/staff/profileless/anon 권한과 수정자 감사 필드를 SQL·Data API로 검증합니다.
- 기존 예약에 실제 금액을 추정 backfill하지 않습니다.
- 390×844와 360×800에서 숫자 키보드, 저장 CTA, 오류·성공·뒤로 가기와 focus 복귀를 검증합니다.
- R-09 통계 계약을 승인한 방식으로 갱신하고 snapshot/실제값 혼합 여부를 UI에 명확히 표시합니다.
- Production 데이터 변경 없이 synthetic Preview에서 migration·RLS·UI·PWA cache를 검증합니다.

## 테스트 요구사항
- 전체 forward migration fresh replay와 `schema.sql` 경로 semantic parity
- 기존 R-08 snapshot 회귀: 서비스 생성·변경·비활성화와 snapshot 불변
- NULL/0/양수/음수, 같은 값 재저장, 동시 수정, 수정자·시각 trigger
- confirmed/completed/cancelled × 가격 상태 조합
- R-09 기간 경계, 실제 금액 누락률, 0원, 취소 제외, 선택한 fallback 계약
- `npm test`, `npm run build`
- 390×844·360×800 mobile browser와 production-mode PWA/offline/recovery
- Supabase/API/customer/appointment 문서의 Cache Storage 0건

## Non-Goals
- 결제 승인, 현금영수증, 카드·현금 구분, 미수금, 환불
- 할인 사유·쿠폰·부가세·원가·직원 인센티브
- 가격 변경 전체 이력 원장
- 기존 예약 실제 금액 추정 backfill
- 횟수권 구매금액 또는 매출 인식(R-16 별도)

## 위험과 완화
- snapshot을 실제 금액처럼 수정하면 과거 가격 근거가 사라집니다. 별도 컬럼으로 의미를 분리합니다.
- 가격 수정이 R-09 매출과 어긋날 수 있습니다. 구현 전 통계 계약을 승인하고 같은 작업에서 RPC/UI/test를 갱신합니다.
- 서비스 변경 시 이전 실제 금액이 잘못 남을 수 있습니다. 자동 덮어쓰기 대신 차이 경고와 명시적 확인을 사용합니다.
- staff의 임의 수정 책임이 불명확할 수 있습니다. 최소한 마지막 수정자·수정시각을 DB에서 기록하고 필요 시 owner-only 또는 전체 원장으로 확장합니다.
- 모바일 숫자 입력이 저장 CTA를 가릴 수 있습니다. safe-area·keyboard 축소 viewport를 검증합니다.

## 구현 전 결정사항
1. R-09를 실제 금액만 집계할지, snapshot fallback 또는 병렬 지표로 제공할지
2. owner/staff 모두 수정할지, staff 수정에 별도 제한이나 사유 입력을 둘지
3. MVP에 마지막 수정자만 남길지, 가격 변경 전체 원장을 포함할지
4. 새 예약에서 실제 금액을 빈 값으로 시작할지, 기본가격을 자동 입력할지

## Rollback
- 애플리케이션은 R-15 구현 commit을 revert합니다.
- DB rollback은 R-09가 신규 컬럼을 참조하지 않는 버전을 먼저 배포한 뒤 grant·trigger·constraint·신규 컬럼 순으로 제거합니다.
- 신규 컬럼에 실제 운영값이 생긴 뒤에는 즉시 drop하지 않고 CSV 또는 승인된 안전한 방식으로 보존 여부를 확인합니다.
- 구현 전 문서 단계에서는 코드·DB rollback이 없습니다.

## 구현·release 결과
- 구현 commit: `a0f324f743809baad8a0be91550c6dc6daf075ae`
- ignore commit: `96bd4b76fafcae6694e270f39d71e840f947cb82`
- PR: #34 merge commit `52fa394d783cb418883d413ef4796be32f8afcde`
- 통계 계약: A안 채택. 실제 매출 = completed + `actual_price_krw is not null`, snapshot fallback 없음, 0원은 포함·유료 객단가 제외
- 로컬 검증: disposable PostgreSQL fresh/upgrade/schema replay, R-15 rollback/reapply, R-08/R-09/R-15 SQL 계약·ACL·2-session optimistic lock, `npm test` Node 33 + race 9, `npm run build`, `git diff --check`, PWA offline/online 및 민감 Cache Storage 0건
- Preview live migration: `20260717140419_r15_customer_service_price`
- Production live migration: `20260717140540_r15_customer_service_price`
- Production stats signature fix: `r15_customer_service_price_stats_signature_fix` (`repeat_rate` 누락 교정)
- live catalog 검증: actual_price 4컬럼, check/trigger/RPC, authenticated EXECUTE 허용·anon 차단
- 기존 예약 actual_price backfill 0건, 실제 고객·예약 데이터 변경 없음

## 남은 리스크
- 인증 후 owner/staff live UI 재렌더와 Production authenticated stats 조회 smoke는 미완전
- Production connector history version은 local filename `20260716151141`과 다른 apply-time version을 사용
- Production 첫 apply에서 stats returns table에 `repeat_rate` 누락이 있었고 즉시 follow-up migration으로 교정함
