---
id: doc-21
title: historic-roadmap-index-20260928
type: other
created_date: '2026-09-29 14:45'
updated_date: '2026-09-29 14:45'
tags:
  - migrated
  - dated-source
---
# 이관 안내 — doc-21

2026-09-28까지 기록된 원문과 상태표의 과거 스냅샷이다. 이관일은 2026-09-29 KST이며 당시 날짜·본문을 고치거나 현재 상태표로 계속 갱신하지 않는다. 현재 상태는 native task만 갱신한다. 세 문서 동기화 규칙은 2026-09-29 종료됐다.

- 원래 경로: `docs/roadmap/README.md` (역사적 식별자)
- 이관일: 2026-09-29 KST; 실제 구현·검증은 원래 날짜 유지, 이번 이관에서 재실행하지 않음
- 원문 기준 commit: `b095a7546a16169b6706ab8b520b1e38c7776f14`
- 원문 SHA-256: `c264ee0505a32a0039a05168c00c8c48036c62dbef8d1c62ef830ec64412b943`
- 작업: [TASK-26](../../tasks/task-26%20-%20%EC%9E%91%EC%97%85%C2%B7%EC%84%A4%EA%B3%84%C2%B7%EA%B2%80%EC%A6%9D%C2%B7%EC%9A%B4%EC%98%81-%EB%AC%B8%EC%84%9C%EB%A5%BC-Backlog.md%EB%A1%9C-%EC%A0%84%EB%A9%B4-%EC%A0%84%ED%99%98.md)
- 관리 절차: [doc-41](../operations/doc-41%20-%20backlog-workflow.md)

문서/이미지/SQL/증거 Markdown 링크는 이 문서 위치 기준으로 수정했다. 코드 블록과 backtick의 역사적/저장소 루트 경로는 그대로 유지하며 과거 명령을 현재 승인으로 해석하지 않는다.

<!-- migrated-source:start -->
# Roadmap Detail Index

현재 상태·다음 행동의 요약은 [future-todo.md](doc-1%20-%20historic-future-todo-20260928.md), 작업별 계약·검증·release 근거는 아래 상세 문서에 둡니다. 이 인덱스는 탐색과 상태를 연결하며 상세 결과를 복제하지 않습니다.

- 최신 점검: 2026-09-26 KST, PR #42 병합 `main@a8ce414`. [R-01·R-10 설정·catalog 점검과 변경안](doc-31%20-%20security-audit-2026-09-26.md). [PR #39/#40 문서 점검 이력](doc-28%20-%20documentation-audit-2026-09-22.md)은 당시 근거로 유지합니다.
- 모바일 로그인 조사·실기기 IME·설치형 PWA는 사용자 보류입니다. 관련 상세 문서의 과거 후속 목록을 자동 실행하지 않습니다.

## 정식 업무

| ID | 상세 문서 | 상태 |
| --- | --- | --- |
| R-01 | [R-01-rls-policy.md](../features/doc-2%20-%20R-01-rls-policy.md) | Done |
| R-02 | [R-02-appointment-edit-cancel-status.md](../features/doc-3%20-%20R-02-appointment-edit-cancel-status.md) | Done |
| R-03 | [R-03-booking-conflict-business-hours.md](../features/doc-4%20-%20R-03-booking-conflict-business-hours.md) | Done |
| R-04 | [R-04-kst-date-time-consistency.md](../features/doc-5%20-%20R-04-kst-date-time-consistency.md) | Done |
| R-05 | [R-05-settings-page.md](../features/doc-6%20-%20R-05-settings-page.md) | Done |
| R-06 | [R-06-pwa-completion.md](../features/doc-7%20-%20R-06-pwa-completion.md) | Done |
| R-07 | [R-07-customer-edit-delete-dedupe.md](../features/doc-8%20-%20R-07-customer-edit-delete-dedupe.md) | Done |
| R-08 | [R-08-service-master.md](../features/doc-9%20-%20R-08-service-master.md) | Done |
| R-09 | [R-09-stats-advanced.md](../features/doc-10%20-%20R-09-stats-advanced.md) | Done |
| R-10 | [R-10-role-management.md](../features/doc-12%20-%20R-10-role-management.md) | In Progress (보안 경고·owner 검증 잔여) |
| R-11 | [R-11-notification-automation.md](../features/doc-13%20-%20R-11-notification-automation.md) | Design Ready (설계 완료 · 구현 보류) |
| R-12 | [R-12-csv-export-backup.md](../features/doc-14%20-%20R-12-csv-export-backup.md) | Done |
| R-13 | [R-13-appointment-customer-search-quick-create.md](../features/doc-15%20-%20R-13-appointment-customer-search-quick-create.md) | Done |
| R-14 | [R-14-easy-usability-foundation.md](../features/doc-17%20-%20R-14-easy-usability-foundation.md) | In Progress (구현 완료 · 대표 사용자 검증 대기) |
| R-15 | [R-15-customer-service-price.md](../features/doc-19%20-%20R-15-customer-service-price.md) | Done (PR #39 병합·Production 배포 기록 확인) |
| R-16 | [R-16-customer-session-pass.md](../features/doc-20%20-%20R-16-customer-session-pass.md) | Done |

## 다음 행동의 경계

- **R-14:** [60대 여성 주 사용자 가정의 Astra 피드백](../features/doc-16%20-%20R-14-astra-usability-review-2026-09-27.md)을 준비했습니다. [피드백 수정·로컬 검증](doc-24%20-%20astra-feedback-remediation-2026-09-27.md)을 완료했으며 2026-09-28 [운영 배포·공개 검증](doc-23%20-%20astra-feedback-release-2026-09-28.md)까지 완료했습니다. 실제 관찰 결과와 구분합니다. 구현·배포와 합성 모바일 검증은 완료 기록이 있습니다. [대표 사용자 프로토콜](../features/doc-18%20-%20R-14-user-validation-protocol.md)은 결과가 아닌 준비 자료이며 실제 2명 관찰 전에는 Done으로 바꾸지 않습니다.
- **R-10:** [Astra 사전 검토](../features/doc-11%20-%20R-10-astra-review-2026-09-27.md)의 초대 재시도 결함 F1/F2의 수정·합성 재검증·Astra 재검토는 완료한 뒤 PR #44로 운영 배포했습니다. 2026-09-26 양 환경 Auth URL 적용·재조회와 RPC 본문·권한 계약 확인을 완료했습니다. 경고는 의도된 owner 검사와 불필요한 실행 권한을 구분해 [보안 점검 기록](doc-31%20-%20security-audit-2026-09-26.md)에 정리했습니다. 2026-09-27 ACL migration 양 환경 적용·권한 검증·대상 Advisor 경고 해소는 완료됐으며, Vercel Production 설정 flag=false를 재확인했습니다. 실제 owner smoke는 미검증입니다.
- **R-11:** 설계 병합 이후 구현 보류입니다. 재개가 승인되면 dry-run 전용 foundation부터 진행하고 live/provider/발송 gate는 별도로 유지합니다.
- **R-15:** 입력 포커스·증감 제거는 PR #39 병합 및 Production success 기록이 확인됐습니다. Preview owner·두 viewport 검증은 2026-09-11의 근거이며 모바일 새 로그인·실기기·staff/Production 권한 검증과 구분합니다.
- **R-16:** 2026-09-11 운영 반영 완료 기록을 유지합니다. 과거 미완료 기록만으로 원장 복구·병합·DB 적용을 다시 시작하지 않습니다.

## 번호 미배정 후보

| 문서 | 상태 |
| --- | --- |
| [오늘 예약 중심 홈](../candidates/doc-27%20-%20candidate-today-centered-home.md) | Candidate (ID 미배정) |
| [지난 시술 그대로 재예약](../candidates/doc-26%20-%20candidate-repeat-last-service.md) | Candidate (ID 미배정) |
| [예약 등록 완료 확인 강화](../candidates/doc-25%20-%20candidate-appointment-save-confirmation.md) | Candidate (ID 미배정) |

R-14 관찰 결과를 근거로 필요한 후보만 별도 승인 후 당시의 다음 R 번호로 승격합니다.

## 절차와 과거 기록

- [브라우저 검증](../operations/doc-32%20-%20browser-validation-workflow.md), [Pencil Desktop](../operations/doc-37%20-%20pencil-desktop-workflow.md), [migration·release](../operations/doc-36%20-%20migration-release-workflow.md)
- [2026-07~09 release·감사 이력](doc-30%20-%20release-history-2026-07-to-09.md): 이전 요약에서 분리한 당시 기록. 명령·count·SHA를 현재 실행 기준으로 복사하지 않습니다.
- [R-10 후속 재개 참고](doc-29%20-%20phase-2-execution-prompt.md): 과거 Release Plan A와 재개 조건. 자동 실행 프롬프트가 아닙니다.
- [2026-07-16 교차 품질 개선](doc-22%20-%20ai-slop-remediation-2026-07-16.md)

## 상태 표기

| 표기 | 의미 |
| --- | --- |
| Planned | 범위 검토 전 또는 구현 계획 대기 |
| In Progress | 승인된 구현·검증의 필수 완료 조건이 남음 |
| Design Ready | 설계 완료; 구현 완료와 구분. 보류 여부를 함께 표기 |
| Done | 명시된 완료 범위에 근거가 있음; 별도 후속 검증의 통과를 뜻하지 않음 |
| 보류 | 사용자 결정 또는 선행조건으로 실행을 미룸. 재개 요청/조건을 기록 |
| 미검증 / 확인 필요 | 실행·확인 근거가 없거나 오래돼 현재 상태를 알 수 없음 |
| 차단 | 진행에 필요한 접근·정보·결정이 없어 특정 단계를 수행할 수 없음 |

보류·미검증·차단은 업무 상태와 함께 검증 항목별로 붙입니다. 필수 완료 조건이 남으면 Done으로 바꾸지 않습니다.

## 갱신 규칙

1. 상태가 바뀌면 같은 변경에서 `future-todo.md`, 이 인덱스, 해당 상세 문서를 맞춥니다. 상세에는 확인 날짜(KST/UTC 구분)·commit·환경·PR/CI/배포·실행 명령/증거·남은 범위를 기록하고 요약은 링크합니다.
2. 과거 기록은 날짜를 유지하고 당시의 계획·차단·미배포를 현재 상태와 분리합니다. 문서 간 상충은 최신 직접 근거로 해소하며 확인할 수 없으면 확인 필요로 남깁니다.
3. 동일 commit·환경의 관련 검증은 이후 변경 유무를 확인해 재사용합니다. 상태 요약을 고치기 위해 운영 데이터 smoke·계정 생성·이미 통과한 전체 검사를 반복하지 않습니다.
4. PR 병합·CI·배포 성공·canonical 연결·새 로그인·역할별 동작·실기기 검증은 서로 대체하지 않습니다. 사용자 보류를 임의 완료/재개하지 않습니다.
5. 문서에 남은 예전 승인 문구·실행 프롬프트는 현재 권한이 아닙니다. 현재 요청과 이어진 승인 범위는 재확인 없이 진행하고, 새 외부·고영향·파괴적 단계만 별도 판단합니다.

<!-- migrated-source:end -->
