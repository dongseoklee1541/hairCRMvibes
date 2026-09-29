---
id: doc-45
title: backlog-publication-20260930
type: other
created_date: '2026-09-29 15:21'
updated_date: '2026-09-29 15:41'
tags:
  - publication
  - release
  - evidence
---
# Backlog 전환 저장소 반영 — 2026-09-30

게시 작업: [TASK-27](../../tasks/task-27%20-%20Backlog-%EC%A0%84%EB%A9%B4-%EC%A0%84%ED%99%98-%EC%A0%80%EC%9E%A5%EC%86%8C-%EB%B0%98%EC%98%81%C2%B7main-%EB%B3%91%ED%95%A9.md). 이전 로컬 이관은 [TASK-26](../../tasks/task-26%20-%20%EC%9E%91%EC%97%85%C2%B7%EC%84%A4%EA%B3%84%C2%B7%EA%B2%80%EC%A6%9D%C2%B7%EC%9A%B4%EC%98%81-%EB%AC%B8%EC%84%9C%EB%A5%BC-Backlog.md%EB%A1%9C-%EC%A0%84%EB%A9%B4-%EC%A0%84%ED%99%98.md)와 [이관 검증](../migration/doc-44%20-%20backlog-migration-validation-20260929.md)을 따른다.

## 승인과 준비 — 2026-09-30 00:21:15 KST

사용자가 별도 branch·commit·push·PR·CI 확인·main 병합과 연동 자동 배포 영향까지 진행을 승인했다. 09-29/09-30 초기 이관 기록의 로컬-only·게시 미승인은 그 당시 경계이며 이 승인으로 게시 목표만 확대됐다. 기능/운영 DB·계정/권한·초대 flag·보류 작업·전역 설정·MCP/hook은 그대로 보존한다. 기록 생성/담당/우선순위는 다른 기능 실행 승인이 아니다.

- repo: dongseoklee1541/hairCRMvibes; default/base main
- fetched base: b095a7546a16169b6706ab8b520b1e38c7776f14
- branch: codex/backlog-md-migration
- git/PR: git 및 저장소 전용 git gh-account
- 실제 인증 계정·permissions.push 확인; 전역 프로필·credential helper 변경 없음
- stage 범위: 이전 이관의 변경 문서40개·AGENTS/README/package/lock + backlog/ + 이 작업의 이관/게시 감사 output. 기존 다른 사용자 untracked·ignored·output/recovery 등은 제외하고 보존

## 검증 기준

원문40개와 R ID/native ID·완료/후속/보류/Draft/제안·링크·CLI·설정을 유지한다. `python3 output/backlog-migration-20260929/verify.py --publication`은 이관 manifest의 원문/기존 task/doc 보존을 확인하면서 이후 게시 task/doc와 branch/HEAD 변경을 허용한다. 원래 mode의 26 tasks/44 docs/main@b095 조건은 당시 로컬 전환 감사이며 그 기록을 현재 재실행 결과로 덮어쓰지 않는다.

기존 합성 env build는 앱/package/lock/Next/PWA 입력이 같아 재사용한다. PR/main에서는 기존 .github/workflows/test-build.yml의 npm ci·npm test·격리 PostgreSQL 계약/동시성·npm run build를 현재 head별로 확인한다. Preview·main CI·Production deployment·canonical alias·실제 로그인/역할·실기기는 서로 대체하지 않는다. 이번 목표에서 새로운 운영 UI/DB smoke·메일·실기기 검증은 수행하지 않는다.

## 게시 결과

실제 commit·PR·head/merge·CI·deployment·확인 시각은 아래 실행 기록을 따른다. 현재 작업 상태의 원본은 연결 task이며 이 문서는 날짜별 게시·검증 근거다.

## 게시 전 로그 형식 교정

공백 검사의 terminal carriage return/끝 공백 지적만 교정했다. [읽기용 build.log](../../../output/backlog-migration-20260929/build.log)는 결과·명령·본문을 유지해 정규화했고 [원시 로그 gzip](../../../output/backlog-migration-20260929/build.raw.log.gz)은 원래 바이트를 그대로 보존한다. 원시 SHA-256: `f10448c346af030c01e3868bffa2e488e8bd2eaebd6275c7a912989e88395dee`. 기존 사용자 증거/복구 파일은 변경하지 않았다.

## PR #46 저장소 반영·Production 배포 결과

- 전환 commit: `bd156804841f1e45e76dd503a6fbfd763d8e62de`. stage manifest와 commit 파일 144개가 정확히 일치. 앱/Pencil/SQL/기존 사용자 증거는 commit에 포함하지 않음.
- [PR #46](https://github.com/dongseoklee1541/hairCRMvibes/pull/46): base main, head codex/backlog-md-migration, 검토 head `bd15680`. PR test-build·Vercel Preview·Preview Comments success. [PR CI](https://github.com/dongseoklee1541/hairCRMvibes/actions/runs/36590109342).
- 모든 검사가 통과한 뒤 Draft→ready 및 CLEAN/MERGEABLE, 같은 head SHA를 확인하고 `git gh-account pr merge 46 --merge --match-head-commit bd156804841f1e45e76dd503a6fbfd763d8e62de`로 병합. --admin/--delete-branch를 사용하지 않음. 기존 delete_branch_on_merge=false도 변경하지 않음.
- merge: `a678dfbc037cd1c4ddde18f2e6cc1e16d4495e6d`, 2026-09-30 00:29:06 KST (GitHub UTC 2026-09-29T15:29:06Z).
- 해당 merge의 [main CI](https://github.com/dongseoklee1541/hairCRMvibes/actions/runs/36590544813) success. 기존 npm ci/test·격리 PostgreSQL R-10 SQL/동시성·npm build 검사 포함. PR head 검사와 merge 검사를 구분.
- [Vercel main 배포](https://vercel.com/dongseoklee1541s-projects/hair-cr-mvibes/DW3t1uFajCSnBSZkSW6VqpZeSWAS) success. GitHub deployment `6738697657`, sha/ref=`a678dfb...`, environment=Production, statuses state=success. 배포 기록 시각 2026-09-30 00:29:56 KST.
- 로컬 main을 origin/main에 fast-forward로 동기화했다. 추가 로컬 merge commit/reset/stash/사용자 파일 정리를 수행하지 않음.
- 기존 보호 파일3,334개 SHA-256 동일·기존 미추적 사용자 파일 전부 보존. worktree/branch를 자동 제거하거나 archive하지 않음.

이 결과를 task/doc에 저장하는 후속 PR은 게시 문서·감사 JSON·검증 산출물만 반영한다. 감사 스크립트의 변경 경로 읽기는 `git diff --name-only -z`로 교정해 한글 파일명을 정확히 처리하며 전역 Git 설정은 바꾸지 않는다. 최초 이관의 native 생성일·원문40개의 기준 commit/hash·기존 로컬 검증 날짜를 바꾸지 않는다. 추가 앱/DB/환경/Pencil 변경·운영/실기기 검증 없이 해당 후속 head의 기존 CI·자동 배포 상태만 확인한다.

## 실제 원격 근거 파일

- [PR/head/merge 원격 조회](../../../output/backlog-publication-20260930/pr46-merged.json)
- [merge SHA의 main CI·Vercel·Production 목록](../../../output/backlog-publication-20260930/pr46-main-checks.json)
- [Production deployment 상태 직접 조회](../../../output/backlog-publication-20260930/pr46-production.json)
- [병합 후 기존 사용자/증거 보존 확인](../../../output/backlog-publication-20260930/postmerge-preservation.json)
- [게시 전 이관 감사](../../../output/backlog-publication-20260930/preflight-verification.json)

## 남은 검증 경계

이것은 GitHub/CI/deployment metadata의 실제 확인이다. canonical alias를 별도로 변경·재조회하거나 운영 UI/auth/owner/staff·메일·실제 고객/예약·R-10 flag·DB·실기기 IME/설치형 PWA를 smoke하지 않았다. 기능의 미검증·보류는 해당 task에 그대로 유지한다. 과거 증거 경로8개/기존 glob1개는 여전히 역사적 미확인이며 새로 만들거나 삭제하지 않았다. 전역 gh/모델/설정·MCP·hook·계정/권한을 바꾸지 않았다.
