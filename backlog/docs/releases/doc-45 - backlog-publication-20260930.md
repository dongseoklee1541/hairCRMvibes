---
id: doc-45
title: backlog-publication-20260930
type: other
created_date: '2026-09-29 15:21'
updated_date: '2026-09-29 15:23'
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

실제 commit·PR·head/merge·CI·deployment·확인 시각은 실행 후 이 문서와 task에 추가한다. PR 병합/배포 기록과 현재 task 상태를 수동 상태표로 병행 관리하지 않는다.

## 게시 전 로그 형식 교정

공백 검사의 terminal carriage return/끝 공백 지적만 교정했다. [읽기용 build.log](../../../output/backlog-migration-20260929/build.log)는 결과·명령·본문을 유지해 정규화했고 [원시 로그 gzip](../../../output/backlog-migration-20260929/build.raw.log.gz)은 원래 바이트를 그대로 보존한다. 원시 SHA-256: `f10448c346af030c01e3868bffa2e488e8bd2eaebd6275c7a912989e88395dee`. 기존 사용자 증거/복구 파일은 변경하지 않았다.
