---
id: TASK-11
title: R-11 알림 자동화 설계 완료·구현 보류
status: On Hold
assignee: []
created_date: '2026-09-29 14:45'
updated_date: '2026-09-29 14:53'
labels:
  - R-11
  - formal-feature
  - historical-evidence
  - design-ready
  - implementation-on-hold
dependencies:
  - TASK-2
  - TASK-3
  - TASK-8
  - TASK-10
references:
  - backlog/decisions/decision-9 - R-11-channel-C-and-dry-run.md
  - backlog/decisions/decision-10 - R-11-proposed-model-and-live-gates.md
documentation:
  - backlog/docs/features/doc-13 - R-11-notification-automation.md
priority: p2
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
원래 기능 ID: `R-11`. 이 native task는 설계 완료와 구현 보류를 추적합니다.

이관일: 2026-09-29 KST. 구현·검증 날짜는 연결 문서의 원래 날짜를 따릅니다. 과거 검증을 이번 실행으로 표시하지 않습니다.

승인: 작업 등록·우선순위·의존관계·담당 지정은 실행 승인이 아닙니다. 이번 승인은 관리 체계 이관에 한정되며 이 기능을 구현하거나 운영 검증하지 않습니다. 담당은 미지정입니다.

기능 의도와 계약:

### 목표
- 고객 예약 안내와 직원 운영 알림을 같은 기능으로 오해하지 않도록 제품·데이터·화면 경계를 분리합니다.
- 발송 채널보다 먼저 공통 scheduler/outbox, claim, attempt, settle, reconciliation 계약을 정의합니다.
- 취소·과거 예약, 비활성 고객, 동의 철회, 중복 Cron, 외부 응답 유실에 안전한 후보 규칙과 상태 전이를 정의합니다.
- R-10의 `profiles.role` 권한 SSOT를 재사용하되 invitation ledger의 내부 상태명이나 RPC에는 결합하지 않습니다.
- 실제 고객·예약·전화번호·Push endpoint를 문서, 로그, 응답, 스크린샷, 캐시에 남기지 않는 경계를 정의합니다.
- 구현 전에 Pencil에서 owner 설정, 직원 Push 활성화, 발송 상태의 모바일 UX를 검증합니다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PR #31의 설계·채널 C안·dry-run 첫 단위가 문서로 준비되어 있다.
- [ ] #2 명시적 재개와 구체적 구현 범위 승인 뒤에만 dry-run foundation을 구현·검증한다.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
과거 계획과 구현 순서는 연결한 원문 설계·release 문서에 보존한다. 이관 이후 신규 구현 계획은 승인된 재개 시 최신 코드·환경 조사 후 이 task 또는 독립 후속 task에 기록한다.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
이관일: 2026-09-29 KST; 검증 실행일과 구분.

2026-09-28 원문 상태 스냅샷: Design Ready (설계 완료 · 구현 보류)
완료·진행 근거: PR #31 설계 병합 기록; 저장소에 구현 추가 근거 없음
당시 다음 행동 / 남은 범위: 명시적 재개 시 최신 계약을 확인하고 dry-run 전용 foundation 범위 승인

최신 직접 근거: 로컬 HEAD `b095a7546a16169b6706ab8b520b1e38c7776f14`; PR #44 merge `df950f6`가 이 HEAD의 조상임을 확인. PR #45는 2026-09-28 배포 증거를 문서화한 후속이다. 원격 서비스를 이번 이관에서 재조회하지 않았다.

원문에서 유지한 검증 공백·위험·재개 조건:
## 현재 결정 상태와 구현 전 게이트

Dry-run 전용 foundation에 대해서는 다음이 결정됐습니다.

- 구현은 현재 보류하고 다른 roadmap 업무를 우선합니다.
- 재개 시 `dry_run`만 허용하고 live·attempt·`manual_review`·외부 dispatch를 비활성화합니다.
- dry-run run 집계와 `simulated` job/delivery는 제품 기본값 30일 뒤 파기합니다.
- 실제 발송을 위한 보존·tombstone·HMAC·`manual_review` 절차는 live 단계 gate로 유지합니다.

다음은 live 단계 전에 별도로 확정해야 합니다.

- SMS 사업자·요금·발신번호와 provider idempotency/webhook 지원
- `confirmed_not_sent` 재시도에서 provider idempotency key 재사용이 안전한지에 대한 사업자 계약
- 예약 안내의 정보성 메시지 범위와 동의·수신거부 정책
- 재방문 마케팅의 동의 문구·동의 확인·보존·야간·빈도 정책
- Hobby의 일일 익일 일괄 처리 유지 또는 Pro/Supabase Cron 전환
- live job/delivery/attempt와 최소 dedupe tombstone의 retention
- provider 증거 수준, 늦은 callback 충돌 처리, owner resolve 권한을 포함한 `manual_review` 운영 절차
- recipient fingerprint HMAC key rotation·version·보존 범위
- VAPID key 발급·회전·폐기 및 Preview/Production 분리
- staff용 `/notifications/device` 진입점을 홈 또는 다른 공용 authenticated 화면 중 어디에 둘지

현재는 구현을 보류합니다. 재개 시에는 별도 Implementation Plan 승인 후 dry-run 전용 foundation만 먼저 진행하며, 위 live gate가 모두 닫히기 전에는 live migration 확장, dependency, Cron, worker, 실제 발송을 시작하지 않습니다.

설계 완료(Design Ready)·구현 보류(On Hold). 선행 구현 완료가 재개 승인으로 바뀌지 않는다. provider·법적·비용·동의·SLA·retention live gate는 문서와 proposed 결정에 보존한다.
<!-- SECTION:NOTES:END -->
