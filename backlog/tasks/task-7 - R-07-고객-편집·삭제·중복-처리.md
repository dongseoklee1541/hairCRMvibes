---
id: TASK-7
title: R-07 고객 편집·삭제·중복 처리
status: Done
assignee: []
created_date: '2026-09-29 14:45'
updated_date: '2026-09-29 14:59'
labels:
  - R-07
  - formal-feature
  - historical-evidence
  - implementation-complete
dependencies:
  - TASK-1
references:
  - backlog/decisions/decision-5 - R-07-lifecycle-and-explicit-merge.md
documentation:
  - backlog/docs/features/doc-8 - R-07-customer-edit-delete-dedupe.md
priority: p1
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
원래 기능 ID: `R-07`. 이 native task는 기록된 구현·배포 완료 범위를 추적합니다.

이관일: 2026-09-29 KST. 구현·검증 날짜는 연결 문서의 원래 날짜를 따릅니다. 과거 검증을 이번 실행으로 표시하지 않습니다.

승인: 작업 등록·우선순위·의존관계·담당 지정은 실행 승인이 아닙니다. 이번 승인은 관리 체계 이관에 한정되며 이 기능을 구현하거나 운영 검증하지 않습니다. 담당은 미지정입니다.

기능 의도와 계약:

### 목표
- 고객 이름·전화번호·메모를 편집하고 명시적인 loading/error/empty/success 상태를 제공합니다.
- hard delete 없이 고객 키와 예약 이력을 보존하면서 일반 보관과 개인정보 비식별화를 분리합니다.
- 중복 후보를 자동 병합하지 않고 비교·대표 고객 선택·transaction 병합·감사·제한된 undo로 정리합니다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 고객 이름·전화번호·메모를 편집하고 명시적인 loading/error/empty/success 상태를 제공합니다.
- [x] #2 hard delete 없이 고객 키와 예약 이력을 보존하면서 일반 보관과 개인정보 비식별화를 분리합니다.
- [x] #3 중복 후보를 자동 병합하지 않고 비교·대표 고객 선택·transaction 병합·감사·제한된 undo로 정리합니다.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
과거 계획과 구현 순서는 연결한 원문 설계·release 문서에 보존한다. 이관 이후 신규 구현 계획은 승인된 재개 시 최신 코드·환경 조사 후 이 task 또는 독립 후속 task에 기록한다.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
이관일: 2026-09-29 KST; 검증 실행일과 구분.

2026-09-28 원문 상태 스냅샷: Done
완료·진행 근거: Phase 1·R-07 통합 release, DB·role smoke·Production 기록
당시 다음 행동 / 남은 범위: post-deploy owner/staff UI·체감 속도는 미검증

최신 직접 근거: 로컬 HEAD `b095a7546a16169b6706ab8b520b1e38c7776f14`; PR #44 merge `df950f6`가 이 HEAD의 조상임을 확인. PR #45는 2026-09-28 배포 증거를 문서화한 후속이다. 원격 서비스를 이번 이관에서 재조회하지 않았다.

원문에서 유지한 검증 공백·위험·재개 조건:
## 남은 리스크
- Preview가 Production Supabase 값을 공유한다는 기존 문서와 Preview 환경변수를 제거했다는 작업 인계 기록이 충돌합니다. 이번 감사에서 Vercel connector의 project 목록이 비어 있고 환경변수 target/scope를 값 없이 조회하는 수단도 없어 현재 설정은 `확인 필요`입니다. 확인 전 Preview 실제 로그인·데이터 smoke는 금지합니다.
- 최신 Advisor의 GraphQL/`SECURITY DEFINER`, leaked-password protection, unindexed FK/unused index/multiple permissive policy는 별도 hardening backlog입니다. 실제 권한 회귀는 발견되지 않았지만 설정·성능 개선과 R-07 release를 섞어 즉시 변경하지 않습니다.
- audit event는 개인정보 snapshot을 남기지 않으므로 비식별화 이후 당시 이름/전화번호를 복구하는 용도로 사용할 수 없습니다. 이는 의도된 privacy 경계입니다.
- production DB owner/staff/anon 검증은 완료됐습니다. 이번 release에서는 canonical public/PWA/Cron/DB smoke만 반복했으므로 실제 browser owner/staff 시나리오와 install/standalone/service worker update는 후속 검증으로 유지합니다.
- `prefetch={false}`를 적용한 정적 진입은 첫 이동이 소폭 느려질 수 있으므로 production 실기기에서 체감 속도를 다시 확인합니다.

완료 기준은 원문의 구현 완료 범위에서 이관했다. 체크는 원문 날짜의 기존 증거에 따른 역사적 완료 표시이며 2026-09-29 새 동작 검증을 뜻하지 않는다. 독립 검증/실기기 보류 항목은 후속 작업에 유지한다.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
기존 완료 범위 이관: Phase 1·R-07 통합 release, DB·role smoke·Production 기록

2026-09-29 KST에는 문서와 현재 로컬 Git 근거를 대조했으며 앱·DB·역할·실기기 검증을 재실행하지 않았다. 독립 후속과 미검증은 연결 작업 및 Implementation Notes를 따른다.
<!-- SECTION:FINAL_SUMMARY:END -->
