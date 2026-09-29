---
id: TASK-24
title: 예약·시간대·CSV 부하와 환경 검증 공백
status: Waiting Validation
assignee: []
created_date: '2026-09-29 14:45'
labels:
  - follow-up
  - not-authorized
  - unverified
dependencies:
  - TASK-2
  - TASK-3
  - TASK-4
  - TASK-12
documentation:
  - backlog/docs/features/doc-3 - R-02-appointment-edit-cancel-status.md
  - backlog/docs/features/doc-4 - R-03-booking-conflict-business-hours.md
  - backlog/docs/features/doc-5 - R-04-kst-date-time-consistency.md
  - backlog/docs/features/doc-14 - R-12-csv-export-backup.md
priority: p1
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
R-02 다양한 duration/service 조합, R-03 full Supabase reset·장시간/대량 lock 부하와 resource dimension 미지원, R-04 timezone/time-travel·실기기 장시간, R-12 대량 export·모바일 Blob 메모리/시점 일관성은 후속이다. 새 요구 없이 이미 통과한 전체 검사를 반복하지 않는다.

다음 행동: 대상·재개 조건과 현재 승인 범위를 확인한다. 등록·담당·우선순위·의존관계는 실행 승인이 아니다. 담당 미지정. 이관일 2026-09-29 KST; 이관 기능의 구현·운영 검증·보류 작업은 이번 목표에 포함되지 않는다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 필요성이 확인된 위험에 대해 환경·부하·경계 시나리오를 정한다.
- [ ] #2 기존 PostgreSQL replay/단위 테스트와 새 검증의 범위·한계를 구분한다.
<!-- AC:END -->
