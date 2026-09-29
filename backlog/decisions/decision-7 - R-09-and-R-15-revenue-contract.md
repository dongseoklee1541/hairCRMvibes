---
id: decision-7
title: R-09-and-R-15-revenue-contract
date: '2026-09-29 14:45'
status: accepted
---

# R-09-and-R-15-revenue-contract

이관일: 2026-09-29 KST; native 생성 날짜는 원래 결정일/구현일을 대신하지 않는다. 상태: `accepted`. 등록은 실행 승인이 아니다.

## 선택·대안·이유·제약

R-09 초기 snapshot 지표는 당시 계약이며 실제 매출 의미는 후속 R-15 구현·release에서 확정됐다. 계획 단계의 권장안·gate와 최종 결과를 구분해 읽는다.

원문 결정·비교·제약: [docs/roadmap/R-15-customer-service-price.md](../docs/features/doc-19%20-%20R-15-customer-service-price.md)

<!-- migrated-decision:start -->
## 현재 계약과 남은 범위

- PR #34에서 실제 금액 컬럼·RPC·R-09 실제 매출 계약을 구현했고, PR #39에서 고객 상세 금액창의 연속 입력·포커스 유지·브라우저 증감 제거를 반영했습니다. 병합/CI/Production 근거는 [2026-09-22 점검](../docs/history/doc-28%20-%20documentation-audit-2026-09-22.md)에 있습니다.
- 실제 매출은 completed + non-null `actual_price_krw`만 집계하며 snapshot fallback과 기존 예약 추정 backfill은 없습니다. 빈값 `null`과 무료 `0`을 구분합니다. 아래 설계 대안·결정 게이트는 구현 전 기록이며 재승인할 미결정이 아닙니다.
- 2026-09-11 Preview owner 로그인과 390×844·360×800 입력·저장·재조회 검증은 완료 기록입니다. staff 별도 로그인/쓰기와 Production authenticated stats는 미검증입니다.
- 모바일 로그인 조사·실기기 키보드/IME·설치형 PWA 검증은 **사용자 보류**입니다. 이전 Preview 로그인 오류는 당시 관찰이며 현재 로그인 장애로 단정하거나 자동 재조사하지 않습니다. Preview owner 성공도 해당 모바일 새 자격 증명 문제의 해결 증거로 확대하지 않습니다.
- 이번 점검은 canonical alias·Production 인증 동작을 재검증하지 않았습니다. 아래 `구현·release 결과` 이후의 기록을 현재 완료 근거로 읽습니다.


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


## R-09 통계 결정 게이트
R-15 구현 전 R-09의 `매출`은 완료 예약의 `price_snapshot_krw` 합계였습니다. 당시 아래 대안을 검토해 A안을 승인·구현했습니다. 현재 계약은 상단과 구현·release 결과를 따릅니다.

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
<!-- migrated-decision:end -->
