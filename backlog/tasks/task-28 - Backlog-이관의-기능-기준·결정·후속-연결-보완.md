---
id: TASK-28
title: Backlog 이관의 기능 기준·결정·후속 연결 보완
status: Done
assignee: []
created_date: '2026-10-02 06:50'
updated_date: '2026-10-05 04:08'
labels:
  - migration
  - semantic-completeness
dependencies:
  - TASK-26
documentation:
  - backlog/docs/migration/doc-46 - backlog-migration-repair-20261002.md
type: docs
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-10-01 원문 대조 감사에서 확인한 네 가지 구조화 누락을 2026-10-02 사용자 승인으로 보완한다. TASK-1/9 기능 설명, TASK-9/10/12/13 기능 완료 기준, R-09 RPC 선택 및 최신 매출 계약 연결, R-08 대규모 동시 부하 후속 연결이 범위다. 기존 완료 구현·검증 대기·보류·Draft를 유지하고 원문 날짜·commit·증거를 보존한다. 이관 관리 보완의 완료 기준이며 해당 기능의 새 구현/운영 검증은 포함하지 않는다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 TASK-1/9의 기능 설명과 TASK-9/10/12/13의 기능별 완료 기준이 원문과 과거 검증 범위에 연결된다.
- [x] #2 R-09 RPC/view 선택 결정이 accepted 기록으로 생성되고 TASK-9에 최신 매출 결정·문서와 함께 연결된다.
- [x] #3 R-08 대규모 동시 부하 후속이 TASK-8과 TASK-24의 설명·의존관계·문서·미완료 기준으로 연결된다.
- [x] #4 원문40개·기존 상태/우선순위/선행관계·Draft/보류·증거 보존과 CLI/링크/공백 검증을 통과하고 운영 절차에 구조화 점검 기준을 남긴다.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. 현재 Git/작업 상태와 이관 원문·감사 결과를 대조한다.
2. 지원 CLI로 원문에 근거한 설명·기능 완료 기준·관계를 보완하고 R-09의 기존 확정 결정을 native decision으로 기록한다.
3. 원문/본문/코드·표·상태/보류를 보존한 채 구조화 누락이 해소됐는지 직접 대조한다.
4. 같은 검증 기준을 운영 절차와 감사 doc에 기록하고 승인된 이관 게시 흐름으로 전달한다.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-05 KST 재개·최종 검증: 설명2건·기능 기준25개·R-09 decision13/decision7/doc19 연결·R-08 확대 부하 후속과 TASK-24 dependency/unchecked 기준을 확인했다. 원문40개/445606바이트·코드24·표390, 기존27개 task 상태/priority/assignee/createdAt·기존관계, decision12개·Draft3개 및 비변경 tracked 파일을 보존했다. CLI/doctor/링크/공백 검증 성공. 최초 검사기의 고정 decision count12 한계는 추가 decision13 직접 검증으로 구분했다. 상세 doc-46 및 output/backlog-repair-20261005/verification.json. 완료 체크는 이관 보완 범위이며 원기능 검증은 과거 근거 재사용이다.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
감사에서 확인한 네 가지 구조화 누락을 보완했다. 빈 기능 설명2건·기능 완료 기준25개·R-09의 기존 RPC 결정/최신 매출 계약 연결·R-08 확대 부하 후속을 복원하고 원문/상태/보류·증거를 보존했다. 2026-10-05 문서·CLI·관계·보존 검증을 통과했고 구조화 점검 방법을 doc-41에 반영했다.
<!-- SECTION:FINAL_SUMMARY:END -->
