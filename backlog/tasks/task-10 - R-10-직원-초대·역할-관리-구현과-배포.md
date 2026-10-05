---
id: TASK-10
title: R-10 직원 초대·역할 관리 구현과 배포
status: Done
assignee: []
created_date: '2026-09-29 14:45'
updated_date: '2026-10-02 08:52'
labels:
  - R-10
  - formal-feature
  - historical-evidence
  - implementation-complete
dependencies:
  - TASK-1
  - TASK-2
references:
  - backlog/tasks/task-17 - R-10-실제-owner-staff-검증과-초대-활성화-gate.md
  - backlog/decisions/decision-8 - R-10-server-only-claim-ledger.md
documentation:
  - backlog/docs/features/doc-11 - R-10-astra-review-2026-09-27.md
  - backlog/docs/features/doc-12 - R-10-role-management.md
  - backlog/docs/history/doc-24 - astra-feedback-remediation-2026-09-27.md
  - backlog/docs/history/doc-23 - astra-feedback-release-2026-09-28.md
priority: p2
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
원래 기능 ID: `R-10`. 이 native task는 기록된 구현·배포 완료 범위를 추적합니다.

이관일: 2026-09-29 KST. 구현·검증 날짜는 연결 문서의 원래 날짜를 따릅니다. 과거 검증을 이번 실행으로 표시하지 않습니다.

승인: 작업 등록·우선순위·의존관계·담당 지정은 실행 승인이 아닙니다. 이번 승인은 관리 체계 이관에 한정되며 이 기능을 구현하거나 운영 검증하지 않습니다. 담당은 미지정입니다.

기존 묶음 상태는 `In Progress (보안 경고·owner 검증 잔여)`였습니다. 구현·배포 완료와 독립적인 후속 검증을 분리해 이 task의 Done 범위를 한정합니다. 후속 task가 끝나기 전 전체 기능의 검증 완료를 주장하지 않습니다.

기능 의도와 계약:

### 목표
- owner가 앱에서 직원 초대 상태를 확인하고 기존 `profiles.role`을 안전하게 변경합니다.
- DB가 owner 권한, 자기 강등 금지, 마지막 owner와 동시 강등 불변식을 강제합니다.
- 초대·목록에서 raw email, service secret, token을 브라우저 번들·응답·로그·스크린샷에 노출하지 않습니다.
- 기존 `pencil-hairshopcrm.pen`, migration/schema/rollback/test, 앱, 로드맵 SSOT를 같은 작업에서 동기화합니다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 직원 목록·초대·역할 변경은 서버/RPC에서 caller JWT와 owner 역할을 다시 검사하고 profiles.role을 앱 역할의 기준으로 사용한다.
- [x] #2 역할 변경은 잠금과 재검사 아래 수행하며 자기 강등과 마지막 owner 강등을 거부하고 역할 변경과 감사 기록을 원자적으로 처리한다.
- [x] #3 신규 초대의 초기 역할은 staff로 고정하고 승격은 별도 owner 행동으로 처리한다. Admin API와 secret은 server-only 경계에 둔다.
- [x] #4 private claim ledger로 동일 요청/active fingerprint의 Admin 초대 호출을 최대 한 번으로 제한하고 auth_succeeded의 profile 복구는 메일 재전송 없이 멱등 처리한다.
- [x] #5 모호한 외부 결과·stale claim은 unknown으로 유지하고 자동 재초대하지 않는다. 미수락 기존 계정만으로 unknown을 완료 처리하지 않는다.
- [x] #6 응답 유실 시 AuthProvider의 인증 사용자별 메모리에 미확정 request ID를 보존해 재사용하고 성공 후 해제한다. 사용자 변경과 늦은 응답을 격리하며 새로고침 이후 보존을 보장하지 않는다.
- [x] #7 인증 헤더가 없는 초대 요청은 401로 거부한다. R10_INVITATIONS_ENABLED가 정확히 문자열 true일 때만 초대를 활성화하고, 비활성 handler는 503 invitation_maintenance와 private no-store를 반환하며 downstream owner/ledger/Admin 호출을 하지 않는다.
- [x] #8 private ledger의 Data API 직접 접근을 막고 raw email·secret·claim token을 브라우저 응답/번들/로그에 노출하지 않는다. 두 desktop 모바일 viewport의 접근 차단·확인·오류·재시도·포커스 피드백을 제공한다.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
과거 계획과 구현 순서는 연결한 원문 설계·release 문서에 보존한다. 이관 이후 신규 구현 계획은 승인된 재개 시 최신 코드·환경 조사 후 이 task 또는 독립 후속 task에 기록한다.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
이관일: 2026-09-29 KST; 검증 실행일과 구분.

2026-09-28 원문 상태 스냅샷: In Progress (보안 경고·owner 검증 잔여)
완료·진행 근거: PR #26 migration·배포 완료 기록. 2026-09-26 양 환경 Auth URL 적용·재조회 완료. RPC 6개 본문·ACL·private 원장 접근 차단 확인
당시 다음 행동 / 남은 범위: ACL migration 적용·권한 검증 완료. [Astra 사전 검토](../docs/features/doc-11%20-%20R-10-astra-review-2026-09-27.md)의 F1/F2 수정·합성 재검증·Astra 재검토 후 PR #44 운영 배포·공개 경계 검증 완료. Vercel Production 설정 flag=false 재확인; 실제 owner/staff smoke는 미검증

최신 직접 근거: 로컬 HEAD `b095a7546a16169b6706ab8b520b1e38c7776f14`; PR #44 merge `df950f6`가 이 HEAD의 조상임을 확인. PR #45는 2026-09-28 배포 증거를 문서화한 후속이다. 원격 서비스를 이번 이관에서 재조회하지 않았다.

원문에서 유지한 검증 공백·위험·재개 조건:
## 현재 판정과 재개 조건

- 2026-09-27 [Astra 사전 검토](../docs/features/doc-11%20-%20R-10-astra-review-2026-09-27.md)에서 초대 재시도 결함 P1·P2를 확인했습니다. 기존 서버 계약 22개 통과와 별개로 두 반례를 합성 재현했습니다. 이후 두 결함을 수정하고 [로컬 회귀·Astra 재검토](../docs/history/doc-24%20-%20astra-feedback-remediation-2026-09-27.md)를 완료했습니다. 2026-09-28 PR #44로 운영 배포하고 [공개 경계 검증](../docs/history/doc-23%20-%20astra-feedback-release-2026-09-28.md)을 완료했습니다. 실제 계정 검증은 별도입니다.

- 구현·PR #26 병합·Preview/Production migration·배포는 아래 2026-07-14 release 근거로 완료입니다. 초기 인덱스의 `live 미적용`은 이 release 이전 기록입니다.
- Auth URL 적용·재조회는 완료했고 advisor hardening·authenticated owner smoke가 남아 In Progress를 유지합니다. 초대 활성화 gate는 닫혀 있습니다.
- 2026-09-26 관리 화면과 catalog SELECT에서 양 환경의 Site URL=`http://localhost:3000`, Redirect URL 0개, R-10 6개 함수의 본문·ACL·owner 검사 계약과 private 원장의 직접 접근 차단을 확인했습니다. authenticated EXECUTE 경고를 없애려고 정상 owner RPC 권한을 일괄 회수하지 않습니다. 이후 사용자 승인으로 환경별 Auth URL을 적용하고 새로고침 후 반영을 확인했습니다. 변경 전 점검과 적용 후 값은 위 점검 기록에서 구분합니다.
- `R10_INVITATIONS_ENABLED=false`는 2026-09-27 Vercel Production 설정에서 재확인했습니다. 기존 배포 환경 snapshot은 미검증입니다. Pencil transport 실패는 **과거 관찰**이며 현재 지속 여부를 확인하지 않았습니다. Supabase 관리 접근은 사용자 로그인 후 가능해졌습니다. CLI의 대상 프로젝트 접근 문제와 관리 화면 접근을 구분하고 과거 장애를 현재 모든 경로의 실패로 간주하지 않습니다.
- 다음 행동: 잔여 운영 정책·실제 owner/staff 검증 범위 결정. 2026-09-27 ACL migration 양 환경 적용·권한 검증·대상 Advisor 경고 해소는 완료했습니다. 완료된 Auth URL 적용은 반복하지 않습니다. 실제 초대·계정·역할 변경과 flag 활성화는 승인된 대상/환경에 한정합니다. [운영 runbook](../docs/operations/doc-38%20-%20r10-invitation-ledger.md)을 따릅니다.

이하 구현·검증·release 절의 환경값·hash·접근 실패는 2026-07-14 당시 기록입니다.

상충 교정: 09-26/07-14의 미적용·Advisor 잔여 문구는 당시 기록이다. 09-27 ACL 적용·권한 검증·대상 경고 해소는 후속 직접 기록으로 완료. GraphQL·MFA·password protection 등 다른 정책과 실제 owner/staff는 별도 후속이다. Production 설정 flag=false는 09-27 관찰값이며 기존 배포 snapshot·현재값을 새로 확인한 것은 아니다.

독립 후속: TASK-17 (backlog/tasks/task-17 - R-10-실제-owner-staff-검증과-초대-활성화-gate.md). 후속 검증 완료 전 전체 기능의 검증 완료를 주장하지 않는다.

2026-10-02 이관 보완: 원문의 기능 조건을 native 완료 기준으로 복원했다. 체크는 다음 기존 구현/검증 기록의 재사용이며 오늘 새 앱/DB/브라우저 검증을 실행했다는 뜻이 아니다.
근거: doc-12 선택 방식·권한 경계·검증 결과(2026-07-14 PR #26); doc-24 F1/F2 합성 회귀(2026-09-27); doc-23 PR #44 배포/공개 접근 경계(2026-09-28).
미검증 경계: 실제 owner/staff·초대/역할 변경·메일 및 flag 배포 snapshot은 TASK-17 대기다. native Done은 구현·배포 기록 범위다.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
기존 완료 범위 이관: PR #26 migration·배포 완료 기록. 2026-09-26 양 환경 Auth URL 적용·재조회 완료. RPC 6개 본문·ACL·private 원장 접근 차단 확인

2026-09-29 KST에는 문서와 현재 로컬 Git 근거를 대조했으며 앱·DB·역할·실기기 검증을 재실행하지 않았다. 독립 후속과 미검증은 연결 작업 및 Implementation Notes를 따른다.
<!-- SECTION:FINAL_SUMMARY:END -->
