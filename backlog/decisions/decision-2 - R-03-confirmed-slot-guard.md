---
id: decision-2
title: R-03-confirmed-slot-guard
date: '2026-09-29 14:45'
status: accepted
---

# R-03-confirmed-slot-guard

이관일: 2026-09-29 KST; native 생성 날짜는 원래 결정일/구현일을 대신하지 않는다. 상태: `accepted`. 등록은 실행 승인이 아니다.

## 선택·대안·이유·제약

confirmed만 슬롯을 점유하고 서버 guard로 차단하는 확정 계약. 저장 허용/경고 대안은 채택하지 않았다. 새로운 resource dimension은 후속 결정이다.

원문 결정·비교·제약: [docs/roadmap/R-03-booking-conflict-business-hours.md](../docs/features/doc-4%20-%20R-03-booking-conflict-business-hours.md)

<!-- migrated-decision:start -->
## 정책 결정
- 중복/영업시간 검증 대상은 `confirmed` 예약으로 제한합니다.
- `completed` 이력 입력은 과거 시술 기록으로 간주해 차단하지 않습니다.
- `cancelled` 예약은 슬롯 점유에서 제외합니다.
- 같은 날짜 confirmed 예약 저장은 `pg_advisory_xact_lock`으로 직렬화해 동시 요청 TOCTOU 위험을 줄입니다.
<!-- migrated-decision:end -->
