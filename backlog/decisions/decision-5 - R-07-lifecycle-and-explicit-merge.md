---
id: decision-5
title: R-07-lifecycle-and-explicit-merge
date: '2026-09-29 14:45'
status: accepted
---

# R-07-lifecycle-and-explicit-merge

이관일: 2026-09-29 KST; native 생성 날짜는 원래 결정일/구현일을 대신하지 않는다. 상태: `accepted`. 등록은 실행 승인이 아니다.

## 선택·대안·이유·제약

soft archive·비식별화·PK/이력 보존·owner의 명시적 병합과 최소 audit을 유지한다. 자동 병합과 hard delete는 채택하지 않는다.

원문 결정·비교·제약: [docs/roadmap/R-07-customer-edit-delete-dedupe.md](../docs/features/doc-8%20-%20R-07-customer-edit-delete-dedupe.md)

<!-- migrated-decision:start -->
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
<!-- migrated-decision:end -->
