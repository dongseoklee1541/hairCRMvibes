---
id: TASK-23
title: 완료 기능의 실제 역할별 UI·운영 쓰기 검증 공백
status: Waiting Validation
assignee: []
created_date: '2026-09-29 14:45'
labels:
  - follow-up
  - not-authorized
  - unverified
dependencies:
  - TASK-5
  - TASK-7
  - TASK-8
  - TASK-9
  - TASK-12
  - TASK-13
  - TASK-15
  - TASK-16
documentation:
  - backlog/docs/features/doc-6 - R-05-settings-page.md
  - backlog/docs/features/doc-8 - R-07-customer-edit-delete-dedupe.md
  - backlog/docs/features/doc-9 - R-08-service-master.md
  - backlog/docs/features/doc-10 - R-09-stats-advanced.md
  - backlog/docs/features/doc-14 - R-12-csv-export-backup.md
  - >-
    backlog/docs/features/doc-15 -
    R-13-appointment-customer-search-quick-create.md
  - backlog/docs/features/doc-19 - R-15-customer-service-price.md
  - backlog/docs/features/doc-20 - R-16-customer-session-pass.md
priority: p1
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
R-05 staff settings UI, R-07 post-deploy owner/staff와 체감 속도, R-08 역할 UI·초기 실제 가격, R-09/R-15 Production authenticated stats, R-13 owner/staff, R-16 Production 횟수권 쓰기·staff 별도 로그인, R-12 실제 Production CSV 생성은 각각 미검증/미실행이다. 과거 Preview 격리 충돌은 당시 기록이며 현재 환경은 대상별 확인 필요다. 운영 데이터·계정·역할 변경을 이번 이관에서 실행하지 않는다.

다음 행동: 대상·재개 조건과 현재 승인 범위를 확인한다. 등록·담당·우선순위·의존관계는 실행 승인이 아니다. 담당 미지정. 이관일 2026-09-29 KST; 이관 기능의 구현·운영 검증·보류 작업은 이번 목표에 포함되지 않는다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 대상 기능·환경·역할과 synthetic/비식별 검증·복구 범위를 특정한다.
- [ ] #2 실행한 기능별 결과와 실행하지 않은 항목을 구분하며 원래 구현 완료 상태를 되돌리지 않는다.
<!-- AC:END -->
