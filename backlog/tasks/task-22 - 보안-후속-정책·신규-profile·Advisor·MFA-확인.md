---
id: TASK-22
title: 보안 후속 정책·신규 profile·Advisor·MFA 확인
status: To Do
assignee: []
created_date: '2026-09-29 14:45'
labels:
  - follow-up
  - not-authorized
  - unverified
dependencies:
  - TASK-1
  - TASK-10
documentation:
  - backlog/docs/features/doc-2 - R-01-rls-policy.md
  - backlog/docs/features/doc-12 - R-10-role-management.md
  - backlog/docs/history/doc-31 - security-audit-2026-09-26.md
  - backlog/docs/operations/doc-39 - rls-auto-enable-hardening.md
priority: p0
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
09-27 rls_auto_enable ACL hardening 완료를 재실행하지 않는다. GraphQL 사용/노출 정책, leaked-password protection/MFA, 의도된 SECURITY DEFINER 권한, 신규 profile provisioning, FK/index·정책 중복과 Preview Disk IO는 잔여 검토/확인 필요다. 운영 설정·권한·비용 변경 승인은 없다.

다음 행동: 대상·재개 조건과 현재 승인 범위를 확인한다. 등록·담당·우선순위·의존관계는 실행 승인이 아니다. 담당 미지정. 이관일 2026-09-29 KST; 이관 기능의 구현·운영 검증·보류 작업은 이번 목표에 포함되지 않는다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 현재 원격 설정·정책은 승인된 읽기 범위에서 대조하고 완료·미검증·새 결정으로 분류한다.
- [ ] #2 새 운영 변경이 필요하면 대안·위험·정확한 대상과 영향을 제시한다.
<!-- AC:END -->
