---
id: TASK-15
title: R-15 고객별 실제 시술금액
status: Done
assignee: []
created_date: '2026-09-29 14:45'
updated_date: '2026-09-29 14:59'
labels:
  - R-15
  - formal-feature
  - historical-evidence
  - implementation-complete
dependencies:
  - TASK-8
  - TASK-9
references:
  - backlog/decisions/decision-7 - R-09-and-R-15-revenue-contract.md
documentation:
  - backlog/docs/features/doc-19 - R-15-customer-service-price.md
priority: p1
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
원래 기능 ID: `R-15`. 이 native task는 기록된 구현·배포 완료 범위를 추적합니다.

이관일: 2026-09-29 KST. 구현·검증 날짜는 연결 문서의 원래 날짜를 따릅니다. 과거 검증을 이번 실행으로 표시하지 않습니다.

승인: 작업 등록·우선순위·의존관계·담당 지정은 실행 승인이 아닙니다. 이번 승인은 관리 체계 이관에 한정되며 이 기능을 구현하거나 운영 검증하지 않습니다. 담당은 미지정입니다.

기능 의도와 계약:

### 사용자 요구
- 고객에게 실제로 적용한 시술 금액을 기록할 수 있어야 합니다.
- 새 예약에서 금액을 입력할 수 있으면 좋지만 필수는 아닙니다.
- 예약 후 또는 시술 완료 후에도 금액을 별도로 입력·수정할 수 있어야 합니다.
- 고객 상세의 시술 이력에서 당시 금액을 확인하고 수정할 수 있어야 합니다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pencil에서 새 예약, 예약 수정, 고객 이력 정상·미입력·무료·오류 상태를 코드보다 먼저 설계하고 `.pen` persistence를 확인합니다.
- [x] #2 예약 생성 시 실제 금액을 선택적으로 입력할 수 있고 미입력 저장도 가능합니다.
- [x] #3 예약과 고객 상세 양쪽에서 실제 금액을 입력·수정할 수 있습니다.
- [x] #4 기본가격, 예약 당시 snapshot, 실제 금액을 혼동하지 않게 표시합니다.
- [x] #5 서비스 변경과 취소가 실제 금액을 조용히 삭제하거나 현재가로 덮어쓰지 않습니다.
- [x] #6 owner/staff/profileless/anon 권한과 수정자 감사 필드를 SQL·Data API로 검증합니다.
- [x] #7 기존 예약에 실제 금액을 추정 backfill하지 않습니다.
- [x] #8 390×844와 360×800에서 숫자 키보드, 저장 CTA, 오류·성공·뒤로 가기와 focus 복귀를 검증합니다.
- [x] #9 R-09 통계 계약을 승인한 방식으로 갱신하고 snapshot/실제값 혼합 여부를 UI에 명확히 표시합니다.
- [x] #10 Production 데이터 변경 없이 synthetic Preview에서 migration·RLS·UI·PWA cache를 검증합니다.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
과거 계획과 구현 순서는 연결한 원문 설계·release 문서에 보존한다. 이관 이후 신규 구현 계획은 승인된 재개 시 최신 코드·환경 조사 후 이 task 또는 독립 후속 task에 기록한다.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
이관일: 2026-09-29 KST; 검증 실행일과 구분.

2026-09-28 원문 상태 스냅샷: Done (PR #39 병합·Production 배포 기록 확인)
완료·진행 근거: PR #34 원기능 + #39 입력 수정. 2026-09-22 GitHub 병합·CI·Production success 재확인, Preview owner 검증 기록 보존
당시 다음 행동 / 남은 범위: staff UI·Production authenticated stats는 미검증. 모바일 로그인 조사·실기기 IME·설치형 PWA는 사용자 보류

최신 직접 근거: 로컬 HEAD `b095a7546a16169b6706ab8b520b1e38c7776f14`; PR #44 merge `df950f6`가 이 HEAD의 조상임을 확인. PR #45는 2026-09-28 배포 증거를 문서화한 후속이다. 원격 서비스를 이번 이관에서 재조회하지 않았다.

원문에서 유지한 검증 공백·위험·재개 조건:
## 현재 계약과 남은 범위

- PR #34에서 실제 금액 컬럼·RPC·R-09 실제 매출 계약을 구현했고, PR #39에서 고객 상세 금액창의 연속 입력·포커스 유지·브라우저 증감 제거를 반영했습니다. 병합/CI/Production 근거는 [2026-09-22 점검](../docs/history/doc-28%20-%20documentation-audit-2026-09-22.md)에 있습니다.
- 실제 매출은 completed + non-null `actual_price_krw`만 집계하며 snapshot fallback과 기존 예약 추정 backfill은 없습니다. 빈값 `null`과 무료 `0`을 구분합니다. 아래 설계 대안·결정 게이트는 구현 전 기록이며 재승인할 미결정이 아닙니다.
- 2026-09-11 Preview owner 로그인과 390×844·360×800 입력·저장·재조회 검증은 완료 기록입니다. staff 별도 로그인/쓰기와 Production authenticated stats는 미검증입니다.
- 모바일 로그인 조사·실기기 키보드/IME·설치형 PWA 검증은 **사용자 보류**입니다. 이전 Preview 로그인 오류는 당시 관찰이며 현재 로그인 장애로 단정하거나 자동 재조사하지 않습니다. Preview owner 성공도 해당 모바일 새 자격 증명 문제의 해결 증거로 확대하지 않습니다.
- 이번 점검은 canonical alias·Production 인증 동작을 재검증하지 않았습니다. 아래 `구현·release 결과` 이후의 기록을 현재 완료 근거로 읽습니다.

## 남은 리스크
- Preview owner 입력 UI는 아래 2026-09-11 기록에서 검증했습니다. staff UI와 Production authenticated stats는 미검증입니다.
- Production connector history version은 local filename `20260716151141`과 다른 apply-time version을 사용
- Production 첫 apply에서 stats returns table에 `repeat_rate` 누락이 있었고 즉시 follow-up migration으로 교정함

완료 기준은 원문의 구현 완료 범위에서 이관했다. 체크는 원문 날짜의 기존 증거에 따른 역사적 완료 표시이며 2026-09-29 새 동작 검증을 뜻하지 않는다. 독립 검증/실기기 보류 항목은 후속 작업에 유지한다.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
기존 완료 범위 이관: PR #34 원기능 + #39 입력 수정. 2026-09-22 GitHub 병합·CI·Production success 재확인, Preview owner 검증 기록 보존

2026-09-29 KST에는 문서와 현재 로컬 Git 근거를 대조했으며 앱·DB·역할·실기기 검증을 재실행하지 않았다. 독립 후속과 미검증은 연결 작업 및 Implementation Notes를 따른다.
<!-- SECTION:FINAL_SUMMARY:END -->
