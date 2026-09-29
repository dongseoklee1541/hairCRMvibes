---
id: decision-3
title: R-05-normalized-settings
date: '2026-09-29 14:45'
status: accepted
---

# R-05-normalized-settings

이관일: 2026-09-29 KST; native 생성 날짜는 원래 결정일/구현일을 대신하지 않는다. 상태: `accepted`. 등록은 실행 승인이 아니다.

## 선택·대안·이유·제약

정규화 테이블과 단일 JSON row 대안 비교·채택 이유를 원문대로 보존한다.

원문 결정·비교·제약: [docs/roadmap/R-05-settings-page.md](../docs/features/doc-6%20-%20R-05-settings-page.md)

<!-- migrated-decision:start -->
## 데이터 모델 결정
- 선택한 방식: 정규화 테이블
- 대안 A: `salon_business_hours`, `salon_operation_settings`, `salon_service_defaults`로 분리
- 대안 B: 단일 JSON 설정 row
- 결정 사유: R-03에서 요일별 영업시간을 SQL 제약/트리거/RPC가 직접 조회해야 하므로 정규화 테이블이 안전합니다.
<!-- migrated-decision:end -->
