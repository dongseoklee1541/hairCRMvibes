---
id: TASK-1
title: R-01 RLS 정책 정리
status: Done
assignee: []
created_date: '2026-09-29 14:45'
updated_date: '2026-10-02 06:50'
labels:
  - R-01
  - formal-feature
  - historical-evidence
  - implementation-complete
dependencies: []
references:
  - backlog/tasks/task-22 - 보안-후속-정책·신규-profile·Advisor·MFA-확인.md
documentation:
  - backlog/docs/features/doc-2 - R-01-rls-policy.md
priority: p0
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
원래 기능 ID: `R-01`. 이 native task는 기록된 구현·배포 완료 범위를 추적합니다.

이관일: 2026-09-29 KST. 구현·검증 날짜는 연결 문서의 원래 날짜를 따릅니다. 과거 검증을 이번 실행으로 표시하지 않습니다.

승인: 작업 등록·우선순위·의존관계·담당 지정은 실행 승인이 아닙니다. 이번 승인은 관리 체계 이관에 한정되며 이 기능을 구현하거나 운영 검증하지 않습니다. 담당은 미지정입니다.

### 기능 의도와 범위

고객·예약 데이터의 포괄 허용 정책을 제거하고 인증된 원장/직원 역할에 따라 읽기·쓰기를 제한한다. profiles의 역할 상승을 막고 휴무일 변경은 owner에 한정하며 migration과 schema.sql에 권한 계약을 함께 유지한다. 이후 R-07 lifecycle 계약의 hard delete 차단과 제한된 RPC 경계는 연결한 원문 권한 매트릭스를 따른다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `customers`, `appointments`의 `Allow all` 정책 제거
- [x] #2 `auth.role()` 기반 정책 제거
- [x] #3 `profiles.role`의 `owner`/`staff`를 기준으로 고객/예약 운영 데이터 접근 허용
- [x] #4 `profiles` 자체 role escalation 방지
- [x] #5 `salon_closed_dates`는 owner/staff 읽기, owner 변경으로 제한
- [x] #6 DB 변경은 migration과 `schema.sql`에 동기화
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
과거 계획과 구현 순서는 연결한 원문 설계·release 문서에 보존한다. 이관 이후 신규 구현 계획은 승인된 재개 시 최신 코드·환경 조사 후 이 task 또는 독립 후속 task에 기록한다.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
이관일: 2026-09-29 KST; 검증 실행일과 구분.

2026-09-28 원문 상태 스냅샷: Done
완료·진행 근거: RLS·grant, live/fresh role 검증 완료 기록
당시 다음 행동 / 남은 범위: 신규 profile provisioning·advisor 후속은 별도 보안 작업

최신 직접 근거: 로컬 HEAD `b095a7546a16169b6706ab8b520b1e38c7776f14`; PR #44 merge `df950f6`가 이 HEAD의 조상임을 확인. PR #45는 2026-09-28 배포 증거를 문서화한 후속이다. 원격 서비스를 이번 이관에서 재조회하지 않았다.

원문에서 유지한 검증 공백·위험·재개 조건:
## 남은 리스크

2026-09-26 [설정·catalog 점검](../docs/history/doc-31%20-%20security-audit-2026-09-26.md)에서 Production의 GraphQL 설치, `rls_auto_enable` 실행 권한과 활성 이벤트 트리거, 유출 비밀번호 보호 비활성을 확인했습니다. 아래 항목은 최초 release의 후속 목록이며 최신 분류·미검증 범위는 점검 기록을 따릅니다. 기존 RLS 구현 완료 상태는 유지합니다.

- Supabase advisor가 signed-in GraphQL table exposure를 보고합니다. anon 공개는 아니지만 GraphQL 사용 여부에 따라 비활성화 또는 노출 정책을 별도 결정해야 합니다.
- 기존 `public.rls_auto_enable()`은 anon/authenticated가 실행 가능한 `SECURITY DEFINER` 함수로 advisor 경고가 남습니다. Phase 1 신규 함수는 아니지만 별도 보안 hardening 우선순위로 다뤄야 합니다.
- Auth leaked-password protection이 비활성화되어 있다는 advisor 경고가 남습니다. 애플리케이션 migration이 아니라 Supabase Auth 운영 설정에서 결정해야 합니다.
- `apply_closed_day_with_cancellations`, `apply_closed_days_batch_with_cancellations`, `remove_closed_day_range`는 `security definer`를 유지합니다. 내부 owner 검증은 있으나 advisor 경고가 남으므로 후속 보안 리뷰 대상입니다.
- `appointments.customer_id`, `appointments.cancelled_by`, `salon_closed_dates.created_by/updated_by` FK index와 일부 settings/closed_dates select 정책 중복은 성능/정책 정리 backlog로 남깁니다.
- 신규 Auth 사용자 profile 자동 생성은 별도 보안/운영 작업으로 분리했습니다. 초대/운영 절차가 profile row를 만들기 전에는 해당 사용자가 RLS 보호 데이터에 접근할 수 없습니다. 첫 사용자를 자동 owner로 승격하는 trigger는 live, migration, `schema.sql` 어디에도 두지 않습니다.
- `phase1_function_privilege_hardening`은 의도적인 forward-only migration입니다. mutable `search_path` 또는 anon execute를 자동 복원하는 down SQL은 만들지 않으며, 장애 시 영향 함수만 검토 후 additive forward-fix로 교정합니다.
- genesis와 기존 R-03 두 migration(`20260219000000`, `20260220000000`, `20260221000000`)의 history repair는 2026-07-12 별도 승인 아래 완료됐습니다. SQL을 재실행하지 않았으며 향후에는 version 일치와 live history name suffix 차이를 함께 확인해야 합니다.

완료 기준은 원문의 구현 완료 범위에서 이관했다. 체크는 원문 날짜의 기존 증거에 따른 역사적 완료 표시이며 2026-09-29 새 동작 검증을 뜻하지 않는다. 독립 검증/실기기 보류 항목은 후속 작업에 유지한다.

2026-10-02 이관 보완: 빈 기능 설명을 이관 원문의 RLS 목표·완료 기준·권한 매트릭스로 채웠다. 기능/권한·Done 범위·과거 검증일은 그대로이며 보안 후속은 TASK-22에서 추적한다.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
기존 완료 범위 이관: RLS·grant, live/fresh role 검증 완료 기록

2026-09-29 KST에는 문서와 현재 로컬 Git 근거를 대조했으며 앱·DB·역할·실기기 검증을 재실행하지 않았다. 독립 후속과 미검증은 연결 작업 및 Implementation Notes를 따른다.
<!-- SECTION:FINAL_SUMMARY:END -->
