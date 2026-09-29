---
id: TASK-26
title: 작업·설계·검증·운영 문서를 Backlog.md로 전면 전환
status: Done
assignee: []
created_date: '2026-09-29 14:45'
updated_date: '2026-09-29 15:21'
labels:
  - migration
  - approved-local-only
dependencies: []
references:
  - backlog/tasks/task-27 - Backlog-전면-전환-저장소-반영·main-병합.md
documentation:
  - backlog/docs/operations/doc-41 - backlog-workflow.md
  - backlog/docs/doc-42 - backlog-catalog.md
  - backlog/docs/migration/doc-43 - backlog-migration-20260929.md
  - backlog/docs/migration/doc-44 - backlog-migration-validation-20260929.md
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-09-29 사용자가 승인한 관리 체계 전환. 기존 40개 대상 문서와 R-01~R-16·미승인 후보 3개를 손실 없이 이관하고 현재 상태의 원본을 task로 일원화한다. 전역 설정·증거·복구·앱 소스·Pencil·SQL을 보존하며 로컬 diff만 남긴다. 커밋/push/PR/배포/운영 변경 승인 없음.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 전체 대상 40개 문서의 본문·코드·표·날짜·증거가 이관표와 손실 검증으로 연결된다.
- [x] #2 정식 16개·Draft 3개와 상태·P0/P1/P2·선행관계·완료/보류/미검증 경계가 CLI로 보존된다.
- [x] #3 기존 경로는 이동 안내만 남고 AGENTS·README·운영 절차 및 내부 링크·앵커가 새 체계와 일치한다.
- [x] #4 로컬 CLI 조회·문서·검색·보드 및 git diff --check·npm run build가 통과하고 기존 사용자 산출물이 보존된다.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 현재 지침·Git·문서·lockfile과 공식 1.53.0 CLI를 확인하고 복구 원본·보호 hash를 보존한다.
2. 로컬 devDependency 정확히 고정하고 자동 commit/remote/callback을 끈다.
3. 원문 40개 native doc, 기능 task, 독립 후속, 미승인 Draft, 확정/제안 decision을 생성하고 관계를 연결한다.
4. 오래된 경로는 안내로 바꾸고 AGENTS·README·운영 절차를 일원화한다.
5. 원문 비교·링크/앵커·CLI·보드·필수 build·diff·보존 hash를 검증하고 검토 가능한 로컬 diff를 남긴다.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
최종 관리 체계 검증: 2026-09-30 00:04:24 KST.

원문 40개/445606바이트, 코드 블록24·표행390 보존; R-01~R-16과 native ID, Draft3, priorities P0/P1/P2·원래 dependency·보류/미검증·완료 scope 확인. task/doc/draft/decision 조회·검색·보드·doctor 및 모든 로컬 Markdown 링크/앵커·metadata reference 통과. git diff --check와 신규 backlog whitespace 검사 통과. 격리 worktree의 합성 env npm run build exit0, build 입력116개 차이0·새 관련 경고 없음. 기존 보호 파일3334개와 미추적 증거 모두 보존; main/HEAD 불변.

원문의 과거 literal 경로8개/기존 glob1개는 현재 checkout 미확인, R11 제안 경로4개는 미생성. 역사적 정보로 보존했고 새 링크 오류·이관 본문 손실·필수 전환 검증 차단은 없다. 실제 owner/staff·대표 사용자·실기기/운영 후속을 재실행하지 않았다. 다음 행동: 사용자가 루트 main의 로컬 diff와 연결 이관표/검증 기록을 검토한다. 게시/commit/운영 변경 승인 없음. 상세 기록 backlog/docs/migration/doc-44 - backlog-migration-validation-20260929.md; 검증 worktree는 build snapshot만 보존한다.

2026-09-30 사용자 후속 승인으로 게시·CI 확인·main 병합과 연동 자동 배포 목표를 TASK-27로 분리했다. 기존 로컬 완료 범위와 이관 검증 날짜는 유지한다. 게시 근거 backlog/docs/releases/doc-45 - backlog-publication-20260930.md
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
기존 관리 체계를 Backlog.md 1.53.0으로 전면 전환했다. 26 tasks·44 docs·12 decisions·3 Draft로 분리하고 원문40개·역사적 증거/보류·R ID를 보존했다. old paths는 이동 안내만 남고 AGENTS/README/운영 규칙을 단일 current-task 체계로 바꿨다. 실제 CLI/본문·링크/관계/diff/보존 및 격리 build가 통과했다. 기존 기능의 미검증/보류는 독립 후속으로 유지하며 commit/push/PR/배포를 실행하지 않았다. 검증 기록 backlog/docs/migration/doc-44 - backlog-migration-validation-20260929.md
<!-- SECTION:FINAL_SUMMARY:END -->
