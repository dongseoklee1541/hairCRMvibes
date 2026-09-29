---
id: TASK-5
title: R-05 설정 페이지
status: Done
assignee: []
created_date: '2026-09-29 14:45'
updated_date: '2026-09-29 14:59'
labels:
  - R-05
  - formal-feature
  - historical-evidence
  - implementation-complete
dependencies: []
references:
  - backlog/decisions/decision-3 - R-05-normalized-settings.md
documentation:
  - backlog/docs/features/doc-6 - R-05-settings-page.md
priority: p0
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
원래 기능 ID: `R-05`. 이 native task는 기록된 구현·배포 완료 범위를 추적합니다.

이관일: 2026-09-29 KST. 구현·검증 날짜는 연결 문서의 원래 날짜를 따릅니다. 과거 검증을 이번 실행으로 표시하지 않습니다.

승인: 작업 등록·우선순위·의존관계·담당 지정은 실행 승인이 아닙니다. 이번 승인은 관리 체계 이관에 한정되며 이 기능을 구현하거나 운영 검증하지 않습니다. 담당은 미지정입니다.

기능 의도와 계약:

### 목표
- 설정 페이지에서 영업시간, 기본 시술, 기본 소요시간을 관리합니다.
- R-03 더블부킹/영업시간 충돌 방지가 SQL에서 조회할 수 있도록 정규화된 설정 데이터를 제공합니다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `.pen`에 설정 화면의 영업시간/기본 시술/기본 소요시간 UI 반영
- [x] #2 설정 페이지에서 owner가 영업시간과 기본 시술을 조회/저장할 수 있음
- [x] #3 staff는 설정 페이지 접근이 차단되고, 예약 생성 화면에서는 기본 시술/소요시간을 조회해 사용할 수 있음
- [x] #4 `schema.sql`과 migration이 동기화됨
- [x] #5 모바일 390x844, 360x800에서 설정 페이지 UI 검증
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
과거 계획과 구현 순서는 연결한 원문 설계·release 문서에 보존한다. 이관 이후 신규 구현 계획은 승인된 재개 시 최신 코드·환경 조사 후 이 task 또는 독립 후속 task에 기록한다.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
이관일: 2026-09-29 KST; 검증 실행일과 구분.

2026-09-28 원문 상태 스냅샷: Done
완료·진행 근거: 설정 UI·live owner/staff/anon 경계 검증 기록
당시 다음 행동 / 남은 범위: staff 설정 UI·실기기 SW update는 후속 미검증

최신 직접 근거: 로컬 HEAD `b095a7546a16169b6706ab8b520b1e38c7776f14`; PR #44 merge `df950f6`가 이 HEAD의 조상임을 확인. PR #45는 2026-09-28 배포 증거를 문서화한 후속이다. 원격 서비스를 이번 이관에서 재조회하지 않았다.

원문에서 유지한 검증 공백·위험·재개 조건:
## 남은 리스크
- staff의 `/settings` UI 접근 차단 화면은 이번 세션에서 별도 browser session으로 재검증하지 않았습니다. DB RLS write 차단은 live로 확인했습니다.
- settings 관련 select 정책은 Supabase advisor에서 multiple permissive policy 경고가 남습니다. 동작 문제는 아니지만 정책 수를 줄이는 후속 정리가 가능합니다.
- R-06에서 설정 문서를 NetworkOnly로 고정하고 Cache Storage의 설정 문서 0건을 확인했습니다. 실제 설치본의 service worker update와 고정 URL precache 갱신은 R-06 후속 검증으로 유지합니다.

완료 기준은 원문의 구현 완료 범위에서 이관했다. 체크는 원문 날짜의 기존 증거에 따른 역사적 완료 표시이며 2026-09-29 새 동작 검증을 뜻하지 않는다. 독립 검증/실기기 보류 항목은 후속 작업에 유지한다.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
기존 완료 범위 이관: 설정 UI·live owner/staff/anon 경계 검증 기록

2026-09-29 KST에는 문서와 현재 로컬 Git 근거를 대조했으며 앱·DB·역할·실기기 검증을 재실행하지 않았다. 독립 후속과 미검증은 연결 작업 및 Implementation Notes를 따른다.
<!-- SECTION:FINAL_SUMMARY:END -->
