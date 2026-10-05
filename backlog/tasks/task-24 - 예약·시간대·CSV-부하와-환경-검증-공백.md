---
id: TASK-24
title: 예약·시간대·CSV 부하와 환경 검증 공백
status: Waiting Validation
assignee: []
created_date: '2026-09-29 14:45'
updated_date: '2026-10-02 06:50'
labels:
  - follow-up
  - not-authorized
  - unverified
dependencies:
  - TASK-2
  - TASK-3
  - TASK-4
  - TASK-12
  - TASK-8
documentation:
  - backlog/docs/features/doc-3 - R-02-appointment-edit-cancel-status.md
  - backlog/docs/features/doc-4 - R-03-booking-conflict-business-hours.md
  - backlog/docs/features/doc-5 - R-04-kst-date-time-consistency.md
  - backlog/docs/features/doc-14 - R-12-csv-export-backup.md
  - backlog/docs/features/doc-9 - R-08-service-master.md
priority: p1
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
R-02 다양한 duration/service 조합, R-03 full Supabase reset·장시간/대량 lock 부하와 resource dimension 미지원, R-04 timezone/time-travel·실기기 장시간, R-08 기본 서비스 지정·활성/비활성화 불변식의 확대 동시 부하, R-12 대량 export·모바일 Blob 메모리/시점 일관성은 후속이다. 새 요구 없이 이미 통과한 전체 검사를 반복하지 않는다.

다음 행동: 대상·재개 조건과 현재 승인 범위를 확인한다. 등록·담당·우선순위·의존관계는 실행 승인이 아니다. 담당 미지정. 이관일 2026-09-29 KST; 이관 기능의 구현·운영 검증·보류 작업은 이번 목표에 포함되지 않는다.

R-08의 순차 회귀·2-session 경쟁은 2026-07-12 완료 기록이다. 그보다 큰 동시 부하는 기존 구현 완료의 필수조건과 분리된 후속 성능 검증이며, 이번 이관 보완은 시험 실행이나 운영 데이터 변경을 승인하지 않는다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 필요성이 확인된 위험에 대해 환경·부하·경계 시나리오를 정한다.
- [ ] #2 기존 PostgreSQL replay/단위 테스트와 새 검증의 범위·한계를 구분한다.
- [ ] #3 필요성이 확인된 R-08 확대 동시 부하의 대상·환경·규모를 정하고, 수행 시 기본 서비스 불변식/직렬화 결과와 순차·2-session 기존 검증의 범위 차이를 기록한다.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-02 이관 보완: doc-9 완료 경계와 다음 단계의 대규모 동시 부하 후속을 이 task에 연결했다. 기존 Waiting Validation·미승인 실행 경계를 유지한다.
<!-- SECTION:NOTES:END -->
