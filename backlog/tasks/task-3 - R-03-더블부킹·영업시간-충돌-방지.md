---
id: TASK-3
title: R-03 더블부킹·영업시간 충돌 방지
status: Done
assignee: []
created_date: '2026-09-29 14:45'
updated_date: '2026-09-29 14:59'
labels:
  - R-03
  - formal-feature
  - historical-evidence
  - implementation-complete
dependencies:
  - TASK-5
references:
  - backlog/decisions/decision-2 - R-03-confirmed-slot-guard.md
documentation:
  - backlog/docs/features/doc-4 - R-03-booking-conflict-business-hours.md
priority: p0
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
원래 기능 ID: `R-03`. 이 native task는 기록된 구현·배포 완료 범위를 추적합니다.

이관일: 2026-09-29 KST. 구현·검증 날짜는 연결 문서의 원래 날짜를 따릅니다. 과거 검증을 이번 실행으로 표시하지 않습니다.

승인: 작업 등록·우선순위·의존관계·담당 지정은 실행 승인이 아닙니다. 이번 승인은 관리 체계 이관에 한정되며 이 기능을 구현하거나 운영 검증하지 않습니다. 담당은 미지정입니다.

기능 의도와 계약:

### 목표
- 같은 시간대의 확정 예약 중복 저장을 DB 레벨에서 차단합니다.
- R-05 영업시간 설정을 기준으로 영업시간 외 예약과 휴게시간 겹침을 DB 레벨에서 차단합니다.
- 기존 R-03 Lite 휴무일 guard와 함께 예약 운영 중단 리스크를 줄입니다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 겹치는 `confirmed` 예약 insert/update 차단
- [x] #2 영업시간 외 `confirmed` 예약 차단
- [x] #3 휴게시간과 겹치는 `confirmed` 예약 차단
- [x] #4 `cancelled`/`completed` 이력은 기존 운영 흐름을 깨지 않음
- [x] #5 `schema.sql`과 migration 동기화
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
과거 계획과 구현 순서는 연결한 원문 설계·release 문서에 보존한다. 이관 이후 신규 구현 계획은 승인된 재개 시 최신 코드·환경 조사 후 이 task 또는 독립 후속 task에 기록한다.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
이관일: 2026-09-29 KST; 검증 실행일과 구분.

2026-09-28 원문 상태 스냅샷: Done
완료·진행 근거: 예약 guard·동시성·PostgreSQL replay 완료 기록
당시 다음 행동 / 남은 범위: full Supabase reset·대량 부하는 미검증; 필요 시 환경부터 확인

최신 직접 근거: 로컬 HEAD `b095a7546a16169b6706ab8b520b1e38c7776f14`; PR #44 merge `df950f6`가 이 HEAD의 조상임을 확인. PR #45는 2026-09-28 배포 증거를 문서화한 후속이다. 원격 서비스를 이번 이관에서 재조회하지 않았다.

원문에서 유지한 검증 공백·위험·재개 조건:
## 남은 리스크
- advisory lock은 같은 날짜의 confirmed 예약 저장을 직렬화해 TOCTOU 리스크를 실측 smoke 수준에서 줄였습니다. 다만 DB isolation/lock 경합을 장시간 부하로 검증한 것은 아니므로 대량 동시 예약 부하는 별도 테스트가 필요합니다.
- 현재 모델은 stylist/resource 차원을 구분하지 않습니다. 여러 디자이너 동시 예약을 허용하려면 충돌 키에 resource dimension을 추가해야 합니다.
- 승인된 A안으로 `20260219000000_phase1_genesis_baseline.sql`을 추가해 `customers`, `appointments`, `profiles` 선행 객체를 만들고 전체 빈 DB replay를 지원합니다.
- R-05/R-03는 live 적용 이력과 같은 `20260707160023`/`20260707160103` 순서로 정규화했습니다.
- vanilla PostgreSQL 17 + Supabase role/auth stub replay는 통과했습니다. 전체 Supabase local stack의 `supabase db reset`은 이 저장소에 `supabase/config.toml`이 없고 Docker가 설치되지 않아 아직 실행하지 않았습니다.

완료 기준은 원문의 구현 완료 범위에서 이관했다. 체크는 원문 날짜의 기존 증거에 따른 역사적 완료 표시이며 2026-09-29 새 동작 검증을 뜻하지 않는다. 독립 검증/실기기 보류 항목은 후속 작업에 유지한다.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
기존 완료 범위 이관: 예약 guard·동시성·PostgreSQL replay 완료 기록

2026-09-29 KST에는 문서와 현재 로컬 Git 근거를 대조했으며 앱·DB·역할·실기기 검증을 재실행하지 않았다. 독립 후속과 미검증은 연결 작업 및 Implementation Notes를 따른다.
<!-- SECTION:FINAL_SUMMARY:END -->
