---
id: TASK-13
title: R-13 예약 고객 검색·빠른 등록
status: Done
assignee: []
created_date: '2026-09-29 14:45'
updated_date: '2026-09-29 14:53'
labels:
  - R-13
  - formal-feature
  - historical-evidence
  - implementation-complete
dependencies:
  - TASK-7
documentation:
  - >-
    backlog/docs/features/doc-15 -
    R-13-appointment-customer-search-quick-create.md
priority: p1
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
원래 기능 ID: `R-13`. 이 native task는 기록된 구현·배포 완료 범위를 추적합니다.

이관일: 2026-09-29 KST. 구현·검증 날짜는 연결 문서의 원래 날짜를 따릅니다. 과거 검증을 이번 실행으로 표시하지 않습니다.

승인: 작업 등록·우선순위·의존관계·담당 지정은 실행 승인이 아닙니다. 이번 승인은 관리 체계 이관에 한정되며 이 기능을 구현하거나 운영 검증하지 않습니다. 담당은 미지정입니다.

기능 의도와 계약:

### 목표와 결과
- `/appointments/new`의 기존 고객 `<select>`를 활성 고객 이름 검색 combobox로 교체했습니다.
- 예약 화면을 벗어나지 않는 modal bottom sheet에서 기존 고객 등록 계약을 재사용합니다.
- 신규 고객 생성 또는 중복 후보의 기존 고객 선택 뒤 새 고객을 자동 선택하고 날짜·시간·서비스·소요시간·가격 snapshot 선택·메모 draft를 유지합니다.
- R-13은 R-09보다 먼저 수행하는 P1 작업이며 R-09 지표·집계 계약은 변경하지 않습니다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 연결된 원문 문서의 명시된 구현·release 범위에 완료 근거가 있으며 원래 날짜·commit·환경을 추적할 수 있다.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
과거 계획과 구현 순서는 연결한 원문 설계·release 문서에 보존한다. 이관 이후 신규 구현 계획은 승인된 재개 시 최신 코드·환경 조사 후 이 task 또는 독립 후속 task에 기록한다.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
이관일: 2026-09-29 KST; 검증 실행일과 구분.

2026-09-28 원문 상태 스냅샷: Done
완료·진행 근거: PR #18·Production 공개/PWA·합성 모바일 검증 기록
당시 다음 행동 / 남은 범위: 실제 owner/staff UI는 미검증, 실기기 IME/standalone은 보류

최신 직접 근거: 로컬 HEAD `b095a7546a16169b6706ab8b520b1e38c7776f14`; PR #44 merge `df950f6`가 이 HEAD의 조상임을 확인. PR #45는 2026-09-28 배포 증거를 문서화한 후속이다. 원격 서비스를 이번 이관에서 재조회하지 않았다.

원문에서 유지한 검증 공백·위험·재개 조건:
## 남은 리스크와 release 경계
- Preview Supabase 격리가 확인되지 않아 Preview/Production 실제 고객 생성 smoke는 금지 상태입니다.
- 실제 owner/staff 로그인 세션과 모바일 실기기 IME·standalone install은 후속 운영 검증입니다.
- 실제 owner/staff authenticated Production 기능 smoke는 실데이터 변경 위험 때문에 수행하지 않았습니다.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
기존 완료 범위 이관: PR #18·Production 공개/PWA·합성 모바일 검증 기록

2026-09-29 KST에는 문서와 현재 로컬 Git 근거를 대조했으며 앱·DB·역할·실기기 검증을 재실행하지 않았다. 독립 후속과 미검증은 연결 작업 및 Implementation Notes를 따른다.
<!-- SECTION:FINAL_SUMMARY:END -->
