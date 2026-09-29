---
id: TASK-4
title: R-04 KST 날짜·시간 정합성
status: Done
assignee: []
created_date: '2026-09-29 14:45'
updated_date: '2026-09-29 14:59'
labels:
  - R-04
  - formal-feature
  - historical-evidence
  - implementation-complete
dependencies: []
documentation:
  - backlog/docs/features/doc-5 - R-04-kst-date-time-consistency.md
priority: p0
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
원래 기능 ID: `R-04`. 이 native task는 기록된 구현·배포 완료 범위를 추적합니다.

이관일: 2026-09-29 KST. 구현·검증 날짜는 연결 문서의 원래 날짜를 따릅니다. 과거 검증을 이번 실행으로 표시하지 않습니다.

승인: 작업 등록·우선순위·의존관계·담당 지정은 실행 승인이 아닙니다. 이번 승인은 관리 체계 이관에 한정되며 이 기능을 구현하거나 운영 검증하지 않습니다. 담당은 미지정입니다.

기능 의도와 계약:

### 목표
- 브라우저 로컬 timezone이나 UTC 변환으로 인해 `YYYY-MM-DD` date key가 하루 밀리는 문제를 방지합니다.
- 오늘/이번 달/달력/상대 날짜/고객 이력 표시를 KST 기준으로 통일합니다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 앱/컴포넌트 화면에서 직접 `new Date()`로 date key를 만들지 않음
- [x] #2 월 범위 조회가 KST 기준 첫날/마지막날을 사용
- [x] #3 date-only 문자열을 브라우저 timezone에 의존하지 않고 표시
- [x] #4 `npm run build` 통과
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
과거 계획과 구현 순서는 연결한 원문 설계·release 문서에 보존한다. 이관 이후 신규 구현 계획은 승인된 재개 시 최신 코드·환경 조사 후 이 task 또는 독립 후속 task에 기록한다.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
이관일: 2026-09-29 KST; 검증 실행일과 구분.

2026-09-28 원문 상태 스냅샷: Done
완료·진행 근거: KST 공통 유틸·경계 단위 테스트·모바일 검증 기록
당시 다음 행동 / 남은 범위: 전체 timezone/time-travel·실기기 장시간 실행은 미검증

최신 직접 근거: 로컬 HEAD `b095a7546a16169b6706ab8b520b1e38c7776f14`; PR #44 merge `df950f6`가 이 HEAD의 조상임을 확인. PR #45는 2026-09-28 배포 증거를 문서화한 후속이다. 원격 서비스를 이번 이관에서 재조회하지 않았다.

원문에서 유지한 검증 공백·위험·재개 조건:
## 남은 리스크
- 날짜 유틸의 자정·월경계 단위 테스트는 자동화했습니다.
- 브라우저 timezone을 바꾸는 전체 화면 time-travel 검증과 실제 기기 장시간 실행 검증은 별도 운영 검증으로 남아 있습니다.

완료 기준은 원문의 구현 완료 범위에서 이관했다. 체크는 원문 날짜의 기존 증거에 따른 역사적 완료 표시이며 2026-09-29 새 동작 검증을 뜻하지 않는다. 독립 검증/실기기 보류 항목은 후속 작업에 유지한다.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
기존 완료 범위 이관: KST 공통 유틸·경계 단위 테스트·모바일 검증 기록

2026-09-29 KST에는 문서와 현재 로컬 Git 근거를 대조했으며 앱·DB·역할·실기기 검증을 재실행하지 않았다. 독립 후속과 미검증은 연결 작업 및 Implementation Notes를 따른다.
<!-- SECTION:FINAL_SUMMARY:END -->
