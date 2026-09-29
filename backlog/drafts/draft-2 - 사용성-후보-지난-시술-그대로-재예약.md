---
id: DRAFT-2
title: '사용성 후보: 지난 시술 그대로 재예약'
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
  - backlog/docs/candidates/doc-26 - candidate-repeat-last-service.md
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 가설
단골 고객은 같은 시술을 반복하는 경우가 많으므로 고객 이력에서 `같은 시술로 예약`을 시작하면 고객·시술·소요시간 재입력과 선택 실수가 줄어듭니다.

## 현재 근거
- `app/customers/[id]/page.js`는 고객의 예약·시술 이력을 이미 표시합니다.
- `app/appointments/new/page.js`는 고객, 날짜, 시간, 활성 서비스, 소요시간을 새로 선택합니다.
- R-08은 예약 당시 서비스명·가격·소요시간 snapshot과 현재 활성 서비스 마스터를 구분합니다.
- 실제로 같은 시술을 반복하는 비율과 재입력 불편은 아직 측정하지 않았습니다.

승인 없음. 정식 R ID 미배정. R-14 대표 사용자 관찰 결과를 근거로 필요한 항목만 별도 승인 후 승격하며 다음 사용 가능 R 번호는 그때 부여한다. 이관일 2026-09-29 KST. 후보 원문과 비교 대안·채택 기준·위험은 연결 문서에 전체 보존한다.

다음 행동: R-14 관찰 결과를 기다린다. 담당 미지정; Draft 등록은 구현·검증 승인이 아니다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 R-14 관찰에서 해당 불편과 개선 효과를 입증할 근거가 있다.
- [ ] #2 정식 작업 승격·범위·R ID 부여가 별도로 승인된다.
<!-- AC:END -->
