---
id: TASK-8
title: R-08 서비스 마스터와 예약 snapshot
status: Done
assignee: []
created_date: '2026-09-29 14:45'
updated_date: '2026-09-29 14:59'
labels:
  - R-08
  - formal-feature
  - historical-evidence
  - implementation-complete
dependencies: []
references:
  - backlog/decisions/decision-6 - R-08-service-snapshot-and-trigger.md
documentation:
  - backlog/docs/features/doc-9 - R-08-service-master.md
priority: p1
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
원래 기능 ID: `R-08`. 이 native task는 기록된 구현·배포 완료 범위를 추적합니다.

이관일: 2026-09-29 KST. 구현·검증 날짜는 연결 문서의 원래 날짜를 따릅니다. 과거 검증을 이번 실행으로 표시하지 않습니다.

승인: 작업 등록·우선순위·의존관계·담당 지정은 실행 승인이 아닙니다. 이번 승인은 관리 체계 이관에 한정되며 이 기능을 구현하거나 운영 검증하지 않습니다. 담당은 미지정입니다.

기능 의도와 계약:

### 목표
- 기존 `salon_service_defaults`를 서비스 마스터로 확장해 정수 KRW 가격, 기본 소요시간, 활성 여부, 정렬 순서를 관리합니다.
- 예약 시점의 서비스 ID·이름·소요시간·가격을 snapshot으로 보존해 이후 마스터 변경이 과거 예약과 통계를 바꾸지 않게 합니다.
- 가격 미설정 `NULL`과 무료 `0`을 구분하고, 기존 예약에는 서비스 ID나 가격을 추정 backfill하지 않습니다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 기존 `salon_service_defaults`를 서비스 마스터로 확장해 정수 KRW 가격, 기본 소요시간, 활성 여부, 정렬 순서를 관리합니다.
- [x] #2 예약 시점의 서비스 ID·이름·소요시간·가격을 snapshot으로 보존해 이후 마스터 변경이 과거 예약과 통계를 바꾸지 않게 합니다.
- [x] #3 가격 미설정 `NULL`과 무료 `0`을 구분하고, 기존 예약에는 서비스 ID나 가격을 추정 backfill하지 않습니다.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
과거 계획과 구현 순서는 연결한 원문 설계·release 문서에 보존한다. 이관 이후 신규 구현 계획은 승인된 재개 시 최신 코드·환경 조사 후 이 task 또는 독립 후속 task에 기록한다.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
이관일: 2026-09-29 KST; 검증 실행일과 구분.

2026-09-28 원문 상태 스냅샷: Done
완료·진행 근거: PR #16·migration·role/snapshot transaction·Production 기록
당시 다음 행동 / 남은 범위: 실제 로그인 owner/staff UI·운영 초기 가격 입력은 별도 범위

최신 직접 근거: 로컬 HEAD `b095a7546a16169b6706ab8b520b1e38c7776f14`; PR #44 merge `df950f6`가 이 HEAD의 조상임을 확인. PR #45는 2026-09-28 배포 증거를 문서화한 후속이다. 원격 서비스를 이번 이관에서 재조회하지 않았다.

원문에서 유지한 검증 공백·위험·재개 조건:

완료 기준은 원문의 구현 완료 범위에서 이관했다. 체크는 원문 날짜의 기존 증거에 따른 역사적 완료 표시이며 2026-09-29 새 동작 검증을 뜻하지 않는다. 독립 검증/실기기 보류 항목은 후속 작업에 유지한다.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
기존 완료 범위 이관: PR #16·migration·role/snapshot transaction·Production 기록

2026-09-29 KST에는 문서와 현재 로컬 Git 근거를 대조했으며 앱·DB·역할·실기기 검증을 재실행하지 않았다. 독립 후속과 미검증은 연결 작업 및 Implementation Notes를 따른다.
<!-- SECTION:FINAL_SUMMARY:END -->
