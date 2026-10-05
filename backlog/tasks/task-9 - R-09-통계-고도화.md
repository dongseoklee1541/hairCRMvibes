---
id: TASK-9
title: R-09 통계 고도화
status: Done
assignee: []
created_date: '2026-09-29 14:45'
updated_date: '2026-10-02 08:52'
labels:
  - R-09
  - formal-feature
  - historical-evidence
  - implementation-complete
dependencies:
  - TASK-4
  - TASK-8
  - TASK-13
references:
  - backlog/decisions/decision-13 - R-09-stats-aggregate-rpc.md
  - backlog/decisions/decision-7 - R-09-and-R-15-revenue-contract.md
  - backlog/tasks/task-23 - 완료-기능의-실제-역할별-UI·운영-쓰기-검증-공백.md
documentation:
  - backlog/docs/features/doc-10 - R-09-stats-advanced.md
  - backlog/docs/features/doc-19 - R-15-customer-service-price.md
priority: p1
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
원래 기능 ID: `R-09`. 이 native task는 기록된 구현·배포 완료 범위를 추적합니다.

이관일: 2026-09-29 KST. 구현·검증 날짜는 연결 문서의 원래 날짜를 따릅니다. 과거 검증을 이번 실행으로 표시하지 않습니다.

승인: 작업 등록·우선순위·의존관계·담당 지정은 실행 승인이 아닙니다. 이번 승인은 관리 체계 이관에 한정되며 이 기능을 구현하거나 운영 검증하지 않습니다. 담당은 미지정입니다.

### 기능 의도와 범위

/stats가 선택한 KST 기간의 매출·유료 객단가·완료 건수·가격 누락·재방문율·시술별 지표를 집계 RPC로 조회하게 한다. 기간과 권한을 서버에서 제한하고 고객·예약 원본 행을 브라우저에 대량 전달하지 않는다. 현재 실제 매출은 R-15에서 확정된 completed + non-null actual_price_krw 계약을 따르며 snapshot fallback이나 추정 backfill을 사용하지 않는다. 초기 R-09 가격 snapshot 집계는 연결 문서의 당시 계약으로 보존한다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 KST 시작일·종료일을 포함하는 최대 366일의 기간을 검증하고, 적용 행동 한 번에 get_stats_summary 집계를 한 번 요청한다.
- [x] #2 completed 예약의 non-null actual_price_krw만 실제 매출에 합산하며 snapshot fallback·기존 예약 추정 backfill을 하지 않는다. 0원은 매출에 포함하고 유료 객단가 분모에서 제외한다.
- [x] #3 매출·유료 객단가·완료 건수·가격 미입력 건수/비율·원인 구분·시술별 상위 5개 지표를 제공한다. 재방문율은 선택 기간 완료 고객 중 같은 기간 2회 이상 완료 고객의 비율이며 분모가 0이면 NULL/데이터 없음으로 표시한다.
- [x] #4 loading·error/retry·empty·가격 부분 데이터·0원 완료·기간 선택 상태를 구분하고 이전 요청의 늦은 응답이 최신 선택을 덮어쓰지 못하게 한다.
- [x] #5 집계 RPC는 caller 인증과 owner/staff 역할을 검사하며 profileless·anon·PUBLIC 접근을 차단한다. 응답에는 고객 식별자·이름·전화번호·메모와 예약 원본 행을 포함하지 않는다.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
과거 계획과 구현 순서는 연결한 원문 설계·release 문서에 보존한다. 이관 이후 신규 구현 계획은 승인된 재개 시 최신 코드·환경 조사 후 이 task 또는 독립 후속 task에 기록한다.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
이관일: 2026-09-29 KST; 검증 실행일과 구분.

2026-09-28 원문 상태 스냅샷: Done
완료·진행 근거: PR #20·migration/ACL·Production 공개/PWA 기록
당시 다음 행동 / 남은 범위: Production authenticated stats는 미검증

최신 직접 근거: 로컬 HEAD `b095a7546a16169b6706ab8b520b1e38c7776f14`; PR #44 merge `df950f6`가 이 HEAD의 조상임을 확인. PR #45는 2026-09-28 배포 증거를 문서화한 후속이다. 원격 서비스를 이번 이관에서 재조회하지 않았다.

원문에서 유지한 검증 공백·위험·재개 조건:
## 남은 리스크
- Preview Supabase 격리는 문서 충돌로 `확인 필요`이며 확인 전 Preview 로그인·실데이터 smoke는 금지합니다.
- Production/Preview 테스트 고객·예약은 생성하지 않았고, live owner/staff 실제 데이터 집계 브라우저 smoke도 개인정보 보호를 위해 생략했습니다. SQL role fixture와 catalog/ACL로 권한 계약을 검증했습니다.
- advisor에는 기존 GraphQL authenticated table 노출, `rls_auto_enable`, SECURITY DEFINER RPC, leaked-password protection, 미사용/누락 index와 중복 permissive policy 항목이 남습니다. R-09 함수 자체에 대한 신규 advisor 항목은 없습니다.
- 실기기 install/standalone/SW update는 기존 R-06 후속 운영 범위로 유지합니다.

지표 계약 버전: 초기 R-09 price_snapshot_krw 집계는 당시 계약이다. R-15 실제 매출 계약 및 이후 구현·release 절을 함께 읽고 최신 코드와 대조한다.

2026-10-02 이관 보완: 원문의 기능 조건을 native 완료 기준으로 복원했다. 체크는 다음 기존 구현/검증 기록의 재사용이며 오늘 새 앱/DB/브라우저 검증을 실행했다는 뜻이 아니다.
근거: doc-10 구현 결과·확정 지표 계약·DB/권한·로컬 검증(2026-07-12 PR #20); doc-19 현재 계약·구현/release 결과와 decision-7의 R-15 실제 매출 A안(PR #34).
미검증 경계: Production authenticated stats는 TASK-23 검증 대기다.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
기존 완료 범위 이관: PR #20·migration/ACL·Production 공개/PWA 기록

2026-09-29 KST에는 문서와 현재 로컬 Git 근거를 대조했으며 앱·DB·역할·실기기 검증을 재실행하지 않았다. 독립 후속과 미검증은 연결 작업 및 Implementation Notes를 따른다.
<!-- SECTION:FINAL_SUMMARY:END -->
