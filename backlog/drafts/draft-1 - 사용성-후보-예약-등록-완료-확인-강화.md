---
id: DRAFT-1
title: '사용성 후보: 예약 등록 완료 확인 강화'
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
  - backlog/docs/candidates/doc-25 - candidate-appointment-save-confirmation.md
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 가설
예약 저장 직후 큰 완료 표시와 핵심 예약 요약, 다음 행동을 보여주면 저장 여부에 대한 불안과 중복 등록을 줄일 수 있습니다.

## 현재 근거
- `app/appointments/new/page.js`는 insert 성공 직후 `/appointments`로 이동하고 새 예약 화면 안에서는 성공 요약을 보여주지 않습니다.
- 이동한 예약 목록에서 등록한 날짜가 현재 선택 날짜와 다르면 사용자가 방금 저장한 예약을 즉시 찾지 못할 수 있습니다.
- 실제 사용자가 현재 이동을 성공으로 이해하는지, 저장 버튼을 다시 누르거나 뒤로 돌아가는지는 아직 관찰하지 않았습니다.

승인 없음. 정식 R ID 미배정. R-14 대표 사용자 관찰 결과를 근거로 필요한 항목만 별도 승인 후 승격하며 다음 사용 가능 R 번호는 그때 부여한다. 이관일 2026-09-29 KST. 후보 원문과 비교 대안·채택 기준·위험은 연결 문서에 전체 보존한다.

다음 행동: R-14 관찰 결과를 기다린다. 담당 미지정; Draft 등록은 구현·검증 승인이 아니다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 R-14 관찰에서 해당 불편과 개선 효과를 입증할 근거가 있다.
- [ ] #2 정식 작업 승격·범위·R ID 부여가 별도로 승인된다.
<!-- AC:END -->
