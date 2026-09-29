---
id: TASK-25
title: PWA 고정 URL precache·등록 차단 환경 후속
status: To Do
assignee: []
created_date: '2026-09-29 14:45'
labels:
  - follow-up
  - not-authorized
  - unverified
dependencies:
  - TASK-6
documentation:
  - backlog/docs/features/doc-7 - R-06-pwa-completion.md
  - backlog/docs/history/doc-23 - astra-feedback-release-2026-09-28.md
priority: p1
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
manifest/favicon/icon의 revision:null 갱신 정책, 로컬 production CSS preload baseline, SW 등록을 강제로 막았을 때 waiting 접근 오류는 별도 검토다. 기본 allow 조건 공개 검증 통과와 차단 환경을 구분한다. 사용자 보류의 설치형 PWA/실기기 검증을 자동 재개하지 않는다.

다음 행동: 대상·재개 조건과 현재 승인 범위를 확인한다. 등록·담당·우선순위·의존관계는 실행 승인이 아니다. 담당 미지정. 이관일 2026-09-29 KST; 이관 기능의 구현·운영 검증·보류 작업은 이번 목표에 포함되지 않는다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 최신 코드·환경에서 필요성이 확인된 cache revision/등록 차단 문제를 분류한다.
- [ ] #2 구현 변경이 필요하면 SSOT·PWA 회귀·복구 범위를 포함해 승인 범위를 확인한다.
<!-- AC:END -->
