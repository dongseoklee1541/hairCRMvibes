---
id: TASK-17
title: R-10 실제 owner/staff 검증과 초대 활성화 gate
status: Waiting Validation
assignee: []
created_date: '2026-09-29 14:45'
labels:
  - follow-up
  - not-authorized
  - unverified
dependencies:
  - TASK-10
documentation:
  - backlog/docs/features/doc-12 - R-10-role-management.md
  - backlog/docs/history/doc-23 - astra-feedback-release-2026-09-28.md
priority: p2
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
R-10 구현·배포·Auth URL·ACL 적용은 완료 기록이다. 실제 owner/staff 로그인·초대·역할 변경·메일·배포 flag snapshot 및 잔여 운영 정책은 미검증이다. 초대 활성화 gate는 닫힌 채 유지한다. 대상 환경·합성 데이터·계정/권한/메일 side effect 범위를 결정하고 현재 요청의 승인을 확인한 뒤에만 실행한다.

다음 행동: 대상·재개 조건과 현재 승인 범위를 확인한다. 등록·담당·우선순위·의존관계는 실행 승인이 아니다. 담당 미지정. 이관일 2026-09-29 KST; 이관 기능의 구현·운영 검증·보류 작업은 이번 목표에 포함되지 않는다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 실제 owner/staff 검증의 대상·환경·합성 데이터와 허용 side effect가 특정된다.
- [ ] #2 승인된 역할별 시나리오를 실행·재조회하고 flag·Auth URL·Advisor·배포 snapshot을 각각 구분해 기록한다.
<!-- AC:END -->
