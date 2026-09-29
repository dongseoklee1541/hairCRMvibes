---
id: decision-12
title: R-16-pass-scope-and-atomic-ledger
date: '2026-09-29 14:45'
status: accepted
---

# R-16-pass-scope-and-atomic-ledger

이관일: 2026-09-29 KST; native 생성 날짜는 원래 결정일/구현일을 대신하지 않는다. 상태: `accepted`. 등록은 실행 승인이 아니다.

## 선택·대안·이유·제약

MVP 전체/단일 서비스형 A안을 선택하고 B 묶음형·C 금액 잔액형은 후속/범위 밖으로 유지한다. 원자 차감·복구, 역할·merge·만료·가격 경계를 그대로 보존한다.

원문 결정·비교·제약: [docs/roadmap/R-16-customer-session-pass.md](../docs/features/doc-20%20-%20R-16-customer-session-pass.md)

<!-- migrated-decision:start -->
## 핵심 원칙
- `남은 횟수`를 사용자가 직접 수정하는 단일 숫자로 저장하지 않습니다.
- 총 횟수와 예약별 사용 원장을 분리하고 `총 횟수 - 예약/사용 중인 횟수`로 잔여를 계산합니다.
- 예약 확정 시점에 1회를 먼저 확보해 같은 횟수권이 동시에 초과 예약되지 않게 합니다.
- 예약 완료는 확보한 1회를 사용 확정하고, 예약 취소는 확보한 1회를 반환합니다.
- 차감·복구·예약 상태 변경은 한 DB transaction에서 처리합니다.
- 횟수권 사용은 결제나 매출 인식을 뜻하지 않습니다.


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


## 확정된 구현 결정
1. 횟수권 등록·총 횟수·만료·pause/cancel은 owner 전용이고 staff는 조회와 예약 사용·복구만 허용합니다.
2. 만료 전에 reserved된 예약은 만료 후에도 유지합니다.
3. active/paused 횟수권 또는 usage history가 있는 고객 merge를 차단하며 자동 이전하지 않습니다.
4. 예약 create/edit/status와 휴무 취소를 transaction RPC로 통합합니다.
5. 구매금액·선불금·환불·매출 인식은 R-16 MVP에서 분리하고 횟수권 사용을 `actual_price_krw=0`으로 자동 기록하지 않습니다.
<!-- migrated-decision:end -->
