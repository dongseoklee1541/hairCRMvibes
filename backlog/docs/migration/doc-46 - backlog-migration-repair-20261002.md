---
id: doc-46
title: backlog-migration-repair-20261002
type: other
created_date: '2026-10-02 06:50'
updated_date: '2026-10-05 04:10'
---
# Backlog 구조화 이관 보완 — 2026-10-02 KST

대상: [TASK-28](../../tasks/task-28%20-%20Backlog-%EC%9D%B4%EA%B4%80%EC%9D%98-%EA%B8%B0%EB%8A%A5-%EA%B8%B0%EC%A4%80%C2%B7%EA%B2%B0%EC%A0%95%C2%B7%ED%9B%84%EC%86%8D-%EC%97%B0%EA%B2%B0-%EB%B3%B4%EC%99%84.md). 2026-10-01 감사의 네 가지 보완을 사용자 승인으로 실행했다. 기준 main@8b6ee2e322b9f123a7560a7449353123bb448a90, 원문 보존 기준 b095a7546a16169b6706ab8b520b1e38c7776f14. 본문의 보완일과 원래 구현·검증일을 구분한다.

## 보완 내용

| 대상 | 보완 | 근거/경계 |
| --- | --- | --- |
| TASK-1/9 | 빈 기능 설명을 RLS·통계의 기능 목적과 범위로 복원 | doc-2/10, 최신 가격 계약 doc-19 |
| TASK-9/10/12/13 | 기능·권한·오류/개인정보·입력 보존 등의 native 완료 기준 복원 | 과거 검증 기록 재사용, 실제 역할/대표 사용자/실기기 미검증 유지 |
| TASK-9 | RPC/view 선택 decision과 최신 매출 decision-7·doc-19 연결 | 원문의 기존 확정 선택을 기록; 새 설계 승격 없음 |
| TASK-8/24 | 큰 동시 부하의 후속 설명·의존관계·문서·unchecked 기준 연결 | doc-9의 순차/2-session 완료와 확대 부하 대기를 구분 |

## 기능 완료 기준의 증거

- [TASK-9](../../tasks/task-9%20-%20R-09-%ED%86%B5%EA%B3%84-%EA%B3%A0%EB%8F%84%ED%99%94.md): doc-10 구현 결과·확정 지표 계약·DB/권한·로컬 검증(2026-07-12 PR #20); doc-19 현재 계약·구현/release 결과와 decision-7의 R-15 실제 매출 A안(PR #34). Production authenticated stats는 TASK-23 검증 대기다.
- [TASK-10](../../tasks/task-10%20-%20R-10-%EC%A7%81%EC%9B%90-%EC%B4%88%EB%8C%80%C2%B7%EC%97%AD%ED%95%A0-%EA%B4%80%EB%A6%AC-%EA%B5%AC%ED%98%84%EA%B3%BC-%EB%B0%B0%ED%8F%AC.md): doc-12 선택 방식·권한 경계·검증 결과(2026-07-14 PR #26); doc-24 F1/F2 합성 회귀(2026-09-27); doc-23 PR #44 배포/공개 접근 경계(2026-09-28). 실제 owner/staff·초대/역할 변경·메일 및 flag 배포 snapshot은 TASK-17 대기다. native Done은 구현·배포 기록 범위다.
- [TASK-12](../../tasks/task-12%20-%20R-12-CSV-%EB%82%B4%EB%B3%B4%EB%82%B4%EA%B8%B0%C2%B7%EB%B0%B1%EC%97%85.md): doc-14 목표·권한/보관·CSV 계약과 전용 Preview 통합 근거(2026-07-13 PR #22); doc-33 CSV 취급 절차. 실제 Production CSV 생성은 TASK-23, 대량/Blob 부하는 TASK-24 대기다.
- [TASK-13](../../tasks/task-13%20-%20R-13-%EC%98%88%EC%95%BD-%EA%B3%A0%EA%B0%9D-%EA%B2%80%EC%83%89%C2%B7%EB%B9%A0%EB%A5%B8-%EB%93%B1%EB%A1%9D.md): doc-15 목표·개인정보/DB·구현 구조·합성 모바일 검증(2026-07-12 PR #18). 실제 owner/staff는 TASK-23 대기, 실기기 IME/설치형 PWA는 TASK-20/21 사용자 보류다.

## 기존 결정과 후속 연결

- [decision-13 — R-09 집계 RPC 선택](../../decisions/decision-13%20-%20R-09-stats-aggregate-rpc.md)
- [decision-7 — 실제 매출 계약](../../decisions/decision-7%20-%20R-09-and-R-15-revenue-contract.md)
- [TASK-24 — 확대 부하 검증 대기](../../tasks/task-24%20-%20%EC%98%88%EC%95%BD%C2%B7%EC%8B%9C%EA%B0%84%EB%8C%80%C2%B7CSV-%EB%B6%80%ED%95%98%EC%99%80-%ED%99%98%EA%B2%BD-%EA%B2%80%EC%A6%9D-%EA%B3%B5%EB%B0%B1.md)

## 검증

2026-10-02 보완 시작 후 2026-10-05 KST 재개·최종 검증을 수행했다. 40개 원문445,606바이트, 코드 블록24개·표 행390개와 기존27개 task의 상태·우선순위·담당·생성일·기존 관계를 대조해 보존을 확인했다. TASK-24의 TASK-8 선행관계만 승인 범위에서 추가했다. 25개 기능 기준이 원문 근거와 연결되며 새 앱/운영 검증으로 소급하지 않는다. 기존12개 decision과 Draft3개를 그대로 보존하고 기존 RPC 결정을 decision-13으로 추가했다.

- 로컬 검증: python3 /private/tmp/haircrm-backlog-repair-20261002/verify-repair.py — 성공. 원문·메타데이터·기능 기준·결정/후속 연결·CLI 검색/문서/보드·기존 파일 보존을 대조했다.
- git diff --check 및 보완 Markdown의 git diff --no-index --check — 성공.
- 로컬 링크/앵커1,404개 정상, backlog doctor의 중복 ID·자기참조·순환 없음.
- 기존 일회성 verify.py --publication은 당시 decision 개수12를 고정한 조건만 불일치했다. 이 조건을 숨기거나 원본 검증기를 바꾸지 않았으며, 승인된 추가 decision-13과 기존12개 보존을 독립 검증했다. 그 밖의 기존 이관 검사는 통과했다.
- 앱·설정·의존성·Pencil·SQL 변경이 없는 문서 보완이므로 로컬 npm build/test·브라우저·운영 smoke를 새로 실행하지 않았다. 게시에는 기존 PR/main CI와 연동 자동 배포 검사 결과를 사용한다.

[검증 결과 JSON](../../../output/backlog-repair-20261005/verification.json)을 보존했다. 이 기록은 이관 메타데이터 검증이며 기존 기능/실기기·역할 검증을 재실행한 결과가 아니다.

## 복구·게시 범위

앱·Pencil·SQL·package/lock·운영 설정 변경 없이 Backlog 문서/메타데이터만 보완한다. 기존 출처 본문과 최초 이관표는 날짜가 있는 원문/당시 기록으로 보존한다. 되돌릴 때는 이 보완의 task/doc/decision diff만 검토해 역패치하고 기존 증거·사용자 미추적 파일·worktree를 정리하지 않는다. 기존 승인된 이관 게시 범위에서 commit/PR/main 반영과 연동 CI/배포 확인을 이어간다.
