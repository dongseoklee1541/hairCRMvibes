---
id: doc-24
title: astra-feedback-remediation-2026-09-27
type: other
created_date: '2026-09-29 14:45'
updated_date: '2026-09-29 15:04'
tags:
  - migrated
  - dated-source
---
# 이관 안내 — doc-24

기능 계약·설계·날짜별 검증/배포/관찰/감사 근거를 전체 이관했다. 아래 `상태`·`현재`·`다음 행동`·승인 문구와 경로는 원문 기록 시점의 사실/제안/계획이다. 현재 상태·다음 행동의 원본은 연결 task/Draft이며 원문에 과거 미완료가 있어도 완료된 구현을 재실행하지 않는다.

- 원래 경로: `docs/roadmap/astra-feedback-remediation-2026-09-27.md` (역사적 식별자)
- 이관일: 2026-09-29 KST; 실제 구현·검증은 원래 날짜 유지, 이번 이관에서 재실행하지 않음
- 원문 기준 commit: `b095a7546a16169b6706ab8b520b1e38c7776f14`
- 원문 SHA-256: `6da205dcf4174567025162f2d6a8186cf3d54f8a90c7ed0fd912365a68189499`
- 작업: [TASK-26](../../tasks/task-26%20-%20%EC%9E%91%EC%97%85%C2%B7%EC%84%A4%EA%B3%84%C2%B7%EA%B2%80%EC%A6%9D%C2%B7%EC%9A%B4%EC%98%81-%EB%AC%B8%EC%84%9C%EB%A5%BC-Backlog.md%EB%A1%9C-%EC%A0%84%EB%A9%B4-%EC%A0%84%ED%99%98.md), [TASK-10](../../tasks/task-10%20-%20R-10-%EC%A7%81%EC%9B%90-%EC%B4%88%EB%8C%80%C2%B7%EC%97%AD%ED%95%A0-%EA%B4%80%EB%A6%AC-%EA%B5%AC%ED%98%84%EA%B3%BC-%EB%B0%B0%ED%8F%AC.md), [TASK-14](../../tasks/task-14%20-%20R-14-%EC%89%AC%EC%9A%B4-%EC%82%AC%EC%9A%A9%EC%84%B1-%EA%B8%B0%EB%B0%98-%EA%B5%AC%ED%98%84%EA%B3%BC-%EB%B0%B0%ED%8F%AC.md), [TASK-17](../../tasks/task-17%20-%20R-10-%EC%8B%A4%EC%A0%9C-owner-staff-%EA%B2%80%EC%A6%9D%EA%B3%BC-%EC%B4%88%EB%8C%80-%ED%99%9C%EC%84%B1%ED%99%94-gate.md), [TASK-18](../../tasks/task-18%20-%20R-14-%EB%8C%80%ED%91%9C-%EC%82%AC%EC%9A%A9%EC%9E%90-2%EB%AA%85-%EA%B4%80%EC%B0%B0.md)
- 관리 절차: [doc-41](../operations/doc-41%20-%20backlog-workflow.md)

문서/이미지/SQL/증거 Markdown 링크는 이 문서 위치 기준으로 수정했다. 코드 블록과 backtick의 역사적/저장소 루트 경로는 그대로 유지하며 과거 명령을 현재 승인으로 해석하지 않는다.

<!-- migrated-source:start -->
# Astra 피드백 수정·검증 — 2026-09-27

## 상태와 범위

2026-09-28 후속: PR #44로 병합·운영 배포했고 [운영 공개 화면·접근 차단 검증](doc-23%20-%20astra-feedback-release-2026-09-28.md)을 완료했습니다. 아래 로컬 미배포 문구는 09-27 검증 시점의 기록입니다.

기준 `main@76b64f60f594071583aea7c8a030c1a9ee095ff9`의 [R-10 검토](../features/doc-11%20-%20R-10-astra-review-2026-09-27.md), [60대 여성 주 사용자 가정의 검토](../features/doc-16%20-%20R-14-astra-usability-review-2026-09-27.md)를 반영한 **로컬 구현·검증**입니다. 실제 대표 사용자 관찰·운영 계정 검증·운영 초대 활성화·배포 완료를 뜻하지 않습니다. 실제 기기 로그인·IME·설치형 PWA 보류는 유지합니다.

## 수정 내용

| 피드백 | 반영 내용 | 근거 |
| --- | --- | --- |
| F1 결과 불명 재초대 | 미수락 기존 계정만으로 unknown을 종결하지 않습니다. 확인된 이메일 계정의 기존 복구 경로는 유지합니다. | 서버 3회 요청 회귀 + 실제 로컬 PostgreSQL RPC 연동에서 Admin 모의 호출 1회, unknown 유지, 신규 claim·provision 감사행 없음 |
| F2 응답 유실 | AuthGate 밖 AuthProvider의 사용자별 메모리에 정규화 이메일의 미확정 요청 ID를 유지합니다. 성공 응답 후에만 해제하며 사용자 변경 시 분리합니다. 재시도 버튼은 “초대 요청 확인”으로 구분합니다. | 실제 AuthProvider/AuthGate의 재생성·창 복귀·응답 유실·늦은 성공·계정 변경 격리 회귀 및 두 viewport의 동일 ID 재사용 확인 |
| UX-1 고객 오선택 | 일반 새 예약은 고객 미선택으로 시작하며 등록을 차단합니다. 고객 상세에서 명시적으로 전달한 고객은 유지합니다. | 두 viewport에서 첫 고객 자동선택 없음 확인 |
| UX-2 저장 구분 | “시술금액 저장”과 “예약 정보 저장”으로 범위를 구분하고 금액 미저장·완료·다음 행동을 표시합니다. 기존 두 저장 계약은 유지합니다. | 금액 미저장 시 예약 저장 거부, 금액 저장 후 수정 중 시간 유지, 예약 정보 별도 저장 검증 |
| UX-3 오류 복구 | 조회 실패 문구와 차단 동작을 일치시킵니다. 휴무일·시술 재조회 버튼과 staff용 관리자 요청 안내를 추가합니다. | 횟수권 오류 시 등록 차단·재조회, 휴무/시술 재조회 후 입력 시간 보존 |
| UX-4 날짜 조작 | 375px 이하 달력 간격을 2px로 조정합니다. | 360px 날짜 최소 가로 41.70→45.14px, 높이44px. 390px은46×44px |
| UX-5 로그인 복구 | 알려진 오류를 한국어 행동 안내로 매핑하고 원문은 표시하지 않습니다. label/id·오류 alert·비밀번호 보기/숨기기를 추가합니다. | Jest·합성 브라우저 오류 확인, 입력값 유지·보기 전환·재시도 가능 확인 |
| 가독성 후보 | 역할·상태·관리 안내를 최소14px로, 로그인 오류16px·하단안내14px로 조정합니다. 로그인/달력 오류에는 기존 진한 상태색 토큰을 사용합니다. | 직원 화면 두 viewport에 가로 overflow 없음, role badge14px. 실제 사용자 읽기 관찰은 미실행 |

요청 ID는 현재 앱의 사용자별 메모리에만 보관하며 이메일/토큰을 localStorage에 새로 저장하지 않습니다. 권한 재확인과 화면 재진입은 보존하지만 전체 페이지 새로고침·브라우저 종료 후 보존은 보장하지 않습니다.

## 검증 결과

- `npm test`: Node 35개, R-10 서버 계약22개, Jest54개 통과. AuthProvider 생명주기 수정 후 전체 검사를 다시 통과했습니다.
- `.github/workflows/test-build.yml`에 격리 PostgreSQL17과 ACL·schema·R-10 SQL·동시성 검증을 연결했습니다. 이 workflow의 GitHub 실행은 아직 미실행이며 로컬에서 동일 SQL 순서를 검증했습니다.
- 로컬 PostgreSQL17.10: 합성 Auth bootstrap → schema.sql 구성 → `supabase/tests/r10_role_management.sql` → concurrency script 통과. 플랫폼 ACL fixture의 service_role PUBLIC 의존 중단 경우도 추가·통과했습니다. schema 구성 검증이며 전체 forward migration chain replay와 동일하지 않습니다.
- 서버 함수와 실제 로컬 R-10 RPC 연동의 F1 반례는 수정 후 Admin 모의 호출1회·unknown 유지·새 claim 없음으로 검증했습니다. Auth 메일 API는 모의 함수입니다.
- production build: `/private/tmp/haircrm-feedback-build-tjilndeo`에서 합성 Supabase URL/key로 `npm run build` 통과. 저장소 PWA 생성물을 덮어쓰지 않았습니다.
- Chrome headless, 390×844·360×800: 합성 API·격리 앱(localhost:3157)에서 전후 화면 및 고객·날짜·조회 복구·별도 저장·로그인 오류·직원 초대 재시도를 검증했습니다. 실제 계정 로그인/실기기 검증은 아닙니다. pageerror 없음. 합성 오류 응답에 따른 network 실패는 의도된 시나리오입니다.

[브라우저 측정](../../../output/playwright/astra-feedback-20260927/after-measurements.json), [직원 화면 측정](../../../output/playwright/astra-feedback-20260927/staff-measurements.json), [검증 산출물](../../../output/playwright/astra-feedback-20260927)에 스크립트·로그·스크린샷을 보존했습니다. 산출물 스크립트는 이 기기의 격리 경로·합성 환경용이며 운영 실행 명령이 아닙니다.

### 화면 증거

| 화면 | 변경 전 360×800 | 변경 후 360×800 |
| --- | --- | --- |
| 새 예약 | [전](../../../output/playwright/astra-feedback-20260927/before_new_360x800.png) | [후](../../../output/playwright/astra-feedback-20260927/after_new_360x800.png) |
| 날짜 선택 | [전](../../../output/playwright/astra-feedback-20260927/before_calendar_360x800.png) | [후](../../../output/playwright/astra-feedback-20260927/after_calendar_360x800.png) |
| 예약 수정 | [전](../../../output/playwright/astra-feedback-20260927/before_edit_360x800.png) | [후](../../../output/playwright/astra-feedback-20260927/after_edit_360x800.png) |
| 로그인 오류 | [전](../../../output/playwright/astra-feedback-20260927/before_login_360x800.png) | [후](../../../output/playwright/astra-feedback-20260927/after_login_360x800.png) |
| 직원 관리 | [전](../../../output/playwright/astra-feedback-20260927/before_staff_360x800.png) | [후](../../../output/playwright/astra-feedback-20260927/after_staff_360x800.png) |

같은 산출물 폴더에 390×844 증거와 금액 저장 후·초대 결과 유실 후 화면도 있습니다.

## Pencil / Pen과 작업 방식 개선

- `.pen`에 이번 변경의 새 예약/오류 복구(tM0Z7), 두 저장(tRfhc), 로그인(ozUJq), 360px 달력(nehlA), 초대 재시도(L3VJN) 상태 설계를 추가했습니다. 기존 설계는 보존했습니다.
- Pen1.2.10에서 새 레이아웃 자식의 y가50px 밀려 잘리고 export가 배경만 나왔습니다. 사용자 승인으로 공식1.2.14를 적용한 뒤 같은 버튼의 y=61.5→11.5, clipping 해소와 실제 이미지 표시를 확인했습니다. 전체 도구 문제의 일반 해결 보증은 아닙니다.
- 원본·진행 파일은 `/private/tmp/haircrm-pen-update-20260927/`에 백업했습니다. 업데이트 후 MCP 재연결, 관련5개 root의 bounds/problems·placeholder 해제, [설계 PNG](../../../output/playwright/astra-feedback-20260927/design)와 디스크 저장을 확인했습니다.
- 저장소 AGENTS와 [Pencil 절차](../operations/doc-37%20-%20pencil-desktop-workflow.md)를 현재 MCP의 경로 지정·작은 변경·구조/시각/저장 구분 방식으로 갱신했습니다. 전역 안전·권한 규칙은 완화하지 않았습니다.
- 메모리 갱신 노트2개를 작성해 연결 방법과1.2.14 동일 사례 검증 결과를 전달했습니다. MEMORY.md 직접 편집이나 실제 메모리 통합 완료를 주장하지 않습니다.

## 남은 확인

Astra 수정 후 재검토에서 AuthGate 재생성 시 F2가 다시 발생할 수 있음을 지적받아 보관 위치와 늦은 응답 처리를 보완했습니다. 실제 AuthProvider/AuthGate 회귀와 브라우저 창 복귀 검증을 통과했고, 마지막 정적 재검토에서는 추가 차단 결함을 발견하지 못했습니다. 구현·로컬 검증은 완료, 커밋·원격 CI·배포는 미실행입니다. 실제 owner/staff E2E·대표 사용자2명 관찰·실기기 보류·운영 초대 활성화는 이번 로컬 검증으로 완료 처리하지 않습니다.

<!-- migrated-source:end -->
