---
id: DRAFT-3
title: '사용성 후보: 오늘 예약 중심 홈'
status: Draft
assignee: []
created_date: '2026-09-29 14:45'
labels:
  - candidate
  - unapproved
  - no-r-id
dependencies:
  - TASK-18
documentation:
  - backlog/docs/candidates/doc-27 - candidate-today-centered-home.md
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 가설
살롱 업무를 시작할 때 가장 먼저 확인하는 정보가 고객 목록보다 오늘 예약이라면, 홈 상단에 오늘 일정을 배치했을 때 탐색 시간과 스크롤이 줄어듭니다.

## 현재 근거
- 현재 `app/page.js`는 `내 고객`을 화면 제목으로 사용하고 고객 검색·고객 목록 다음에 오늘 예약을 표시합니다.
- 오늘 예약 데이터는 이미 KST 오늘 날짜 기준으로 조회되므로, 후보 검토에 필요한 기본 데이터는 존재합니다.
- 다만 실제 사용자가 앱을 열 때 고객 검색과 일정 확인 중 무엇을 더 자주 하는지는 아직 관찰하지 않았습니다.

승인 없음. 정식 R ID 미배정. R-14 대표 사용자 관찰 결과를 근거로 필요한 항목만 별도 승인 후 승격하며 다음 사용 가능 R 번호는 그때 부여한다. 이관일 2026-09-29 KST. 후보 원문과 비교 대안·채택 기준·위험은 연결 문서에 전체 보존한다.

다음 행동: R-14 관찰 결과를 기다린다. 담당 미지정; Draft 등록은 구현·검증 승인이 아니다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 R-14 관찰에서 해당 불편과 개선 효과를 입증할 근거가 있다.
- [ ] #2 정식 작업 승격·범위·R ID 부여가 별도로 승인된다.
<!-- AC:END -->
