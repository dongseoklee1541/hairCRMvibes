---
id: TASK-16
title: R-16 고객별 횟수권
status: Done
assignee: []
created_date: '2026-09-29 14:45'
updated_date: '2026-09-29 14:59'
labels:
  - R-16
  - formal-feature
  - historical-evidence
  - implementation-complete
dependencies:
  - TASK-2
  - TASK-7
  - TASK-8
  - TASK-15
references:
  - backlog/decisions/decision-12 - R-16-pass-scope-and-atomic-ledger.md
documentation:
  - backlog/docs/features/doc-20 - R-16-customer-session-pass.md
priority: p1
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
원래 기능 ID: `R-16`. 이 native task는 기록된 구현·배포 완료 범위를 추적합니다.

이관일: 2026-09-29 KST. 구현·검증 날짜는 연결 문서의 원래 날짜를 따릅니다. 과거 검증을 이번 실행으로 표시하지 않습니다.

승인: 작업 등록·우선순위·의존관계·담당 지정은 실행 승인이 아닙니다. 이번 승인은 관리 체계 이관에 한정되며 이 기능을 구현하거나 운영 검증하지 않습니다. 담당은 미지정입니다.

기능 의도와 계약:

### 사용자 요구
- 고객이 10회권 같은 횟수형 상품을 미리 등록해 둘 수 있어야 합니다.
- 예약할 때 횟수권을 선택하면 1회가 차감되어야 합니다.
- 예약 후 남은 횟수를 즉시 알 수 있어야 합니다.
- 고객 상세에서 보유 횟수권, 남은 횟수와 사용 이력을 확인할 수 있어야 합니다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pencil에서 고객 상세 정상·없음·소진·만료·오류, 새 예약 선택·잔여 부족, 예약 취소 복구 상태를 코드보다 먼저 설계합니다.
- [x] #2 owner는 고객에게 전체 시술형 또는 단일 서비스형 횟수권을 등록·관리할 수 있습니다.
- [x] #3 owner/staff는 예약에서 사용 가능한 횟수권을 선택하고 차감 후 잔여를 즉시 확인할 수 있습니다.
- [x] #4 confirmed 예약은 1회를 reserved하고 completed는 consumed, cancelled는 released로 원자 전이합니다.
- [x] #5 동일 마지막 1회를 두 동시 예약이 사용할 수 없습니다.
- [x] #6 날짜·시간 변경은 중복 차감하지 않고 서비스·횟수권 변경은 원자적으로 반환·재차감합니다.
- [x] #7 고객 상세에서 보유 상태와 예약별 사용·복구 이력을 확인할 수 있습니다.
- [x] #8 보관·병합·익명 처리 고객의 횟수권 lifecycle 경계를 검증합니다.
- [x] #9 owner/staff/profileless/anon RLS·RPC·grant 경계를 통과합니다.
- [x] #10 기존 고객·예약을 추정해 횟수권에 연결하지 않습니다.
- [x] #11 390×844·360×800과 production-mode PWA에서 loading/error/empty/offline/recovery와 cache 0건을 검증합니다.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
과거 계획과 구현 순서는 연결한 원문 설계·release 문서에 보존한다. 이관 이후 신규 구현 계획은 승인된 재개 시 최신 코드·환경 조사 후 이 task 또는 독립 후속 task에 기록한다.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
이관일: 2026-09-29 KST; 검증 실행일과 구분.

2026-09-28 원문 상태 스냅샷: Done
완료·진행 근거: 2026-09-11 PR #37·Production DB/배포·로그인 조회 완료 기록
당시 다음 행동 / 남은 범위: Production 쓰기·staff 별도 로그인은 미검증; 실기기 IME/PWA는 보류

최신 직접 근거: 로컬 HEAD `b095a7546a16169b6706ab8b520b1e38c7776f14`; PR #44 merge `df950f6`가 이 HEAD의 조상임을 확인. PR #45는 2026-09-28 배포 증거를 문서화한 후속이다. 원격 서비스를 이번 이관에서 재조회하지 않았다.

원문에서 유지한 검증 공백·위험·재개 조건:

완료 기준은 원문의 구현 완료 범위에서 이관했다. 체크는 원문 날짜의 기존 증거에 따른 역사적 완료 표시이며 2026-09-29 새 동작 검증을 뜻하지 않는다. 독립 검증/실기기 보류 항목은 후속 작업에 유지한다.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
기존 완료 범위 이관: 2026-09-11 PR #37·Production DB/배포·로그인 조회 완료 기록

2026-09-29 KST에는 문서와 현재 로컬 Git 근거를 대조했으며 앱·DB·역할·실기기 검증을 재실행하지 않았다. 독립 후속과 미검증은 연결 작업 및 Implementation Notes를 따른다.
<!-- SECTION:FINAL_SUMMARY:END -->
