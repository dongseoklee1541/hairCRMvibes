---
id: TASK-27
title: Backlog 전면 전환 저장소 반영·main 병합
status: In Progress
assignee: []
created_date: '2026-09-29 15:21'
updated_date: '2026-09-29 15:21'
labels:
  - publication
  - approved-git-and-auto-deploy
dependencies:
  - TASK-26
documentation:
  - backlog/docs/releases/doc-45 - backlog-publication-20260930.md
type: chore
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog 전면 이관은 TASK-26의 로컬 완료 범위다. 2026-09-30 사용자가 별도 브랜치→커밋→push→PR→CI 확인→main 병합과 연동 자동 배포 영향까지 포함한 제안을 선택해 진행을 명시적으로 승인했다. 이번 작업은 이미 검증된 전환 diff를 저장소에 반영하고 merge/CI/deployment 근거를 남긴다.

기존 사용자 미추적/ignored 증거·복구·서버·검증 worktree는 보존한다. 앱 기능·Pencil·SQL·운영 DB·계정/권한·R-10 flag·기존 보류·전역 설정/MCP/hook 변경은 포함하지 않는다. 담당은 미지정이다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 전환 파일만 별도 branch에 commit/push하고 main을 base로 PR을 생성한다.
- [ ] #2 실제 PR head의 필수 CI·mergeability를 확인한 뒤 main에 병합한다.
- [ ] #3 병합 commit의 main CI 및 연동 Production 자동 배포 상태를 각각 확인한다.
- [ ] #4 게시·배포 근거와 남은 한계는 Backlog task/doc에 남기고 기존 사용자 산출물을 보존한다.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Git/원문 보존 검사 및 저장소 전용 gh 인증·permissions.push·origin/main을 확인한다.
2. codex/backlog-md-migration에 이관/관리/검증 파일만 stage·commit·push하고 PR을 만든다.
3. 검토 head의 기존 CI와 mergeability를 확인해 main에 merge하고 main CI/자동 Production deployment를 확인한다.
4. 실제 결과를 이 task/doc에 기록한다. 필요하면 결과 문서만 후속 PR로 반영해 merge 완료와 기록 완료를 구분한다.
5. 기존 사용자 파일과 worktree/branch를 자동 정리하지 않고 완료 결과를 보고한다.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
사전 확인: 저장소 전용 계정 dongseoklee1541 auth 및 permissions.push=true. origin/main은 b095a7546a16169b6706ab8b520b1e38c7776f14, 작업 branch codex/backlog-md-migration. Git helper/프로필/전역 설정은 바꾸지 않았다. 로컬 이관 감사 40개 원문·CLI·관계/링크·보존 및 격리 build 통과를 재사용한다.
<!-- SECTION:NOTES:END -->
