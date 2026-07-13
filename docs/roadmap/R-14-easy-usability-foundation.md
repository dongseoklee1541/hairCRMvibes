# R-14 쉬운 사용성 1차

## 상태
- In Progress (구현 완료 · 대표 사용자 검증 대기)
- 우선순위: P1
- 정식 ID: `R-14`
- 주요 사용자 가정: 스마트폰으로 살롱 업무를 처리하는 50~60대 여성
- 최종 업데이트: 2026-07-13

## 목적
- 핵심 업무 화면을 처음 보거나 자주 사용하지 않아도 글을 읽고 다음 행동을 판단하기 쉽게 만듭니다.
- 작은 글씨, 아이콘 의미 추측, 촘촘한 조작, 기술 용어 때문에 생기는 망설임과 오조작을 줄입니다.
- 기존 기능과 권한·데이터 계약을 유지하면서 공통 가독성·조작성 기반을 먼저 정비합니다.

50~60대 여성이라는 설명은 글자 크기나 디지털 숙련도를 단정하기 위한 것이 아닙니다. 설계 우선순위를 세우는 사용자 가정이며, 실제 대표 사용자 검증으로 맞는지 확인해야 합니다.

## 현재 근거
- 핵심 버튼 다수는 이미 최소 44px 조작 영역을 사용하므로 이 기준을 회귀시키지 않고 화면 전체로 점검합니다.
- `/appointments/new`에는 `서비스 마스터`, `DB`, `snapshot`처럼 내부 구현을 설명하는 문구가 사용자 화면에 남아 있습니다.
- 아이콘 전용 버튼과 작은 보조 문구는 일부 화면에서 주변 맥락이나 접근성 이름을 읽어야 의미를 알 수 있습니다.
- 예약·고객·설정 기능이 늘면서 한 화면의 설명과 선택지가 많아졌습니다. 기능을 제거하지 않더라도 정보 위계와 문구를 단순하게 만들 여지가 있습니다.
- 홈의 오늘 예약 우선순위, 이력 기반 반복 예약, 예약 저장 완료 전용 흐름은 별도 후보입니다. R-14에서 함께 구현하지 않습니다.

## Goals
1. 핵심 정보와 행동 문구를 확대하고 한눈에 구분되도록 위계를 정리합니다.
2. 주요 행동은 아이콘만으로 표현하지 않고 짧고 익숙한 한글 라벨을 제공합니다.
3. 폼은 입력 목적, 필수·선택 여부, 오류 원인, 다음 행동을 같은 위치와 말투로 안내합니다.
4. 저장·변경·취소 같은 결과를 색상만이 아니라 아이콘과 문장으로 전달합니다.
5. 390×844와 360×800에서 한 손 조작과 세로 스크롤을 방해하지 않도록 유지합니다.

## Non-Goals
- 홈을 오늘 예약 중심으로 재구성하는 정보구조 변경
- 지난 시술을 복사해 새 예약을 만드는 기능
- 예약 저장 후 별도 완료 화면이나 완료 sheet 추가
- 데이터 모델, migration, RLS, Auth 역할, API 또는 캐시 전략 변경
- 사용자별 글자 크기 설정이나 별도 접근성 모드 추가
- 모든 저빈도 관리자 화면을 한 번에 재설계

## 1차 적용 범위

### 화면
- 공통: `app/globals.css`, `components/AppShell.js`, `components/TabBar.js`
- 홈: `app/page.js`
- 예약 목록·수정: `app/appointments/page.js`
- 새 예약: `app/appointments/new/page.js`
- 고객 상세: `app/customers/[id]/page.js`

설정·통계·중복 고객의 복잡한 관리 흐름은 공통 토큰 회귀만 확인하고, 화면 전체 재설계는 별도 범위로 둡니다.

### 가독성 기준
| 항목 | 계획 기준 |
| --- | --- |
| 핵심 본문·입력값 | 기본 16px 이상, 충분한 행간 유지 |
| 필수 안내·오류·완료 문구 | 16px 이상을 우선하고 색상 외 텍스트 의미 제공 |
| 보조 설명 | 14px 이상을 원칙으로 하며 핵심 행동 판단을 작은 글씨에만 두지 않음 |
| 제목 | 화면 제목, 섹션 제목, 카드 제목의 단계가 시각적으로 구분됨 |
| 대비 | 기존 색상 토큰을 기준으로 실제 화면에서 읽기 어려운 조합을 점검 |

### 조작성 기준
- 모든 상호작용 영역은 최소 44×44px을 유지합니다.
- 저장·등록 등 핵심 CTA는 가능하면 높이 52~56px과 텍스트 라벨을 사용합니다.
- 자주 쓰는 행동은 엄지손가락이 닿기 쉬운 위치를 우선하되 safe-area와 콘텐츠 가림을 함께 확인합니다.
- 아이콘 전용 행동이 유지되는 경우 항상 명확한 접근성 이름과 주변 설명을 제공합니다.
- 파괴적 행동은 일반 행동과 색상·위치·확인 문구가 구분되어야 합니다.

### 문구 기준
- `서비스 마스터`는 사용자 맥락에 맞는 `시술 선택` 또는 동등한 쉬운 표현을 Pencil 설계에서 검토합니다.
- `DB`, `snapshot`, `confirmed` 같은 구현 용어는 사용자 화면에서 제거하고 `예약 당시 시술명과 가격을 저장합니다`처럼 결과 중심으로 바꿉니다.
- `다시 시도`, `저장 중`, `저장 완료`처럼 같은 상황의 문구와 말투를 통일합니다.
- 오류 문구는 문제 설명 뒤 사용자가 할 수 있는 행동을 이어서 안내합니다.

## 설계 순서
1. `pencil-hairshopcrm.pen`에 적용 대상 화면의 현재 상태를 복제해 before 기준을 보존합니다.
2. 글자·버튼·문구·폼 피드백을 반영한 after와 loading/error/empty/disabled 상태를 설계합니다.
3. 390×844와 360×800 기준으로 주요 CTA, safe-area, 긴 한글 문구, 키보드 노출 상태를 확인합니다.
4. Pencil 재실행 후 예상 node와 화면이 남아 있고 파일 hash가 변경됐는지 확인합니다.
5. 별도 Implementation Plan 승인 뒤 코드 구현을 시작합니다.

## 완료 기준

### 디자인
- Pencil SSOT에 대상 화면과 필요한 상태가 반영되어 있습니다.
- 주요 텍스트와 조작 영역의 크기 기준이 화면별로 확인됩니다.
- `snapshot_layout(problemsOnly)` 또는 동등한 검증에서 신규 clipping·overflow 문제가 없습니다.

### 코드·브라우저
- 승인된 대상 화면에서 작은 핵심 문구, 기술 용어, 의미가 불명확한 주요 아이콘 행동을 정비합니다.
- 390×844와 360×800에서 터치 영역, 가로 overflow, safe-area, 키보드 가림, loading/error/empty/disabled 상태를 검증합니다.
- 예약·고객 저장 계약, 권한, KST 날짜, PWA NetworkOnly 민감정보 경계에 회귀가 없습니다.
- `npm run build`가 성공하고 신규 relevant warning이 없습니다.
- UI 변경 전·후 스크린샷을 저장하고 민감한 고객 데이터는 synthetic mock만 사용합니다.

### 대표 사용자 검증
- 최소 2명의 50~60대 여성 대표 사용자가 다음 과제를 도움 없이 수행하는지 관찰합니다.
  1. 고객 찾기
  2. 새 예약 등록
  3. 예약 확인 또는 상태 변경
- 각 과제에서 막힌 위치, 잘못 누른 횟수, 이해하지 못한 용어, 완료 여부 확신을 기록합니다.
- 실제 대표 사용자 검증이 없다면 구현이 끝나도 `Done` 대신 사용자 검증 대기 상태로 기록합니다.

## 위험과 완화
- 글자를 키우며 정보가 잘리거나 스크롤이 과도해질 수 있습니다. 두 모바일 viewport와 긴 한글 mock으로 검증합니다.
- 쉬운 문구로 바꾸며 업무 의미가 달라질 수 있습니다. 원장 사용자 검토와 기존 데이터 계약 대조를 거칩니다.
- 모든 화면을 한 번에 손대면 회귀 범위가 커집니다. 고빈도 네 화면과 공통 요소로 1차 범위를 제한합니다.
- 사용자를 나이만으로 일반화할 수 있습니다. 실제 대표 사용자 과제를 완료 기준에 포함하고 관찰 결과로 후보 우선순위를 조정합니다.

## Rollback
- 애플리케이션 변경은 R-14 구현 commit을 revert하고 직전 성공 Production deployment를 다시 연결합니다.
- 데이터베이스와 PWA 캐시 계약은 R-14에서 변경하지 않으므로 별도 데이터 rollback은 없어야 합니다.
- Pencil은 구현 전 hash와 node 기준을 기록해 R-14 frame만 되돌릴 수 있게 합니다.

## 후속 후보와의 경계
- [오늘 예약 중심 홈](./candidate-today-centered-home.md)
- [지난 시술 그대로 재예약](./candidate-repeat-last-service.md)
- [예약 등록 완료 확인 강화](./candidate-appointment-save-confirmation.md)

세 항목은 정식 ID가 없는 후보입니다. R-14 사용자 검증에서 실제 불편이 확인된 항목만 별도 승인으로 승격합니다.

## 완료 시 문서 갱신
- `future-todo.md`: R-14 상태, 근거, 다음 액션
- `docs/roadmap/README.md`: 인덱스 상태와 검증 요약
- 이 문서: 브랜치/PR/merge SHA, Pencil 근거, 실행 명령, 모바일 결과, 대표 사용자 결과, 스크린샷, 남은 위험

세 위치가 같은 완료 근거를 가리키기 전에는 R-14를 `Done`으로 표시하지 않습니다.

## 2026-07-13 구현 및 검증 기록

### 실행 범위
- 기준: `origin/main@ec8bff1873a11f618087620156a8e463f39f9fb4`
- 브랜치/작업트리: `codex/r14-easy-usability-foundation` / `/Users/idongseog/workspace/hairCRMvibes-r14-easy-usability`
- 구현: 공통 가독성·포커스·탭바, 홈, 예약 목록·상태, 새 예약 폼, 고객 상세를 정비했습니다.
- 유지: Supabase 조회·저장 payload, RLS/Auth 역할, migration/schema, KST 날짜, PWA runtime cache 전략은 변경하지 않았습니다.
- Git/배포: 구현 commit과 로컬 검증 이후 Production release 결과는 아래 `Production release record`에 동기화합니다.

### Pencil SSOT
- 저장 전 SHA-256: `4bcb62cb825c95ce6b72e30023fdda903ea626ee760656ae7ea7c07d4da395c8`
- 저장 후 SHA-256: `ee3aa659662ef54d1dd4c085d28a009666cc121a3a4c634523a72432a8e28b33`
- Before/After node: 홈 `L8H49G`/`AXhKf`, 예약 `u192T8`/`cbVN7`, 새 예약 `ijcLf`/`I1Zx5d`, 고객 상세 `f4UdzF`/`gRWiu`
- 공통 상태 node: `p3oLwb` (loading/error/empty/disabled)
- After 4개와 상태 매트릭스 모두 `snapshot_layout(problemsOnly)`에서 `No layout problems.`를 확인했습니다.
- PNG export: `output/playwright/r14-easy-usability/pencil-verified/`

### 코드·모바일·PWA
- `npm ci`: 439 packages, audit 취약점 0건
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-anon-key npm run build`: Next.js 15.5.20 production build 성공, 13개 route 생성, 신규 relevant warning 0건
- 합성 데이터 정상 화면 4개를 390×844와 360×800에서 검증했습니다. 8개 화면 모두 가로 overflow 0, 44×44px 미만 상호작용 요소 0, console warning/error 0이었습니다.
- 홈 empty/error, 예약 empty/error, 새 예약 service error + disabled CTA, 고객 상세 error를 390×844에서 검증했습니다. 상태 화면도 가로 overflow와 44px 미만 요소가 없었고, 실패 상태의 503 console 항목은 의도적으로 주입한 API 오류입니다.
- 새 예약 메모 포커스에서 뷰포트를 390×524와 360×480으로 줄여 가상 키보드 상황을 모사했습니다. 두 경우 모두 포커스 영역이 visual viewport 안에 남고 가로 overflow가 없었습니다.
- Production service worker는 `activated`/controlled였고 precache 47개 중 Auth·고객·예약 민감 cache entry는 0개였습니다. `/appointments` 오프라인 탐색은 `/offline.html`로 전환됐고 합성 고객·시술 문구와 console 문제가 없었습니다.
- 실제 고객·예약 데이터는 조회하거나 변경하지 않았습니다. Production 확인은 고객·예약 데이터가 아닌 공개/PWA 자산과 비인증 경계만 대상으로 했습니다.

### Production release record (2026-07-13)
- 구현 commit: `c7eaaabaabb47cbe4b11fabb6aaaccc1c428cb67`
- 애플리케이션 release PR: [#25](https://github.com/dongseoklee1541/hairCRMvibes/pull/25)
- `main` merge SHA: `cdabf40982c1b8d2dcc196bacc116b3d399efa15`
- GitHub Production deployment record: `5424206017` (`success`)
- canonical: `https://hair-cr-mvibes.vercel.app`
- 공개/PWA 자산은 HTTP `200`이며 R-14 bundle marker를 확인했습니다.
- Cron 무인증 요청은 `401` 및 `no-store`를 반환했습니다.
- CSV export 무인증 `dataset=customers` 요청은 `401`, `private`, `no-store`를 반환했습니다.
- 실제 고객·예약 데이터는 조회하거나 변경하지 않았습니다.
- 대표 사용자 검증은 수행하지 않았습니다. 따라서 R-14는 `In Progress (구현 완료 · 대표 사용자 검증 대기)`를 유지하며 `Done`으로 변경하지 않습니다.

### Before/After 스크린샷
모든 고객·예약 정보는 합성 데이터입니다.

| 화면 | 390×844 | 360×800 |
| --- | --- | --- |
| 홈 | `20260713_r14_home_390x844_before.png` / `20260713_r14_home_390x844_after.png` | `20260713_r14_home_360x800_before.png` / `20260713_r14_home_360x800_after.png` |
| 예약 | `20260713_r14_appointments_390x844_before.png` / `20260713_r14_appointments_390x844_after.png` | `20260713_r14_appointments_360x800_before.png` / `20260713_r14_appointments_360x800_after.png` |
| 새 예약 | `20260713_r14_appointment-new_390x844_before.png` / `20260713_r14_appointment-new_390x844_after.png` | `20260713_r14_appointment-new_360x800_before.png` / `20260713_r14_appointment-new_360x800_after.png` |
| 고객 상세 | `20260713_r14_customer-detail_390x844_before.png` / `20260713_r14_customer-detail_390x844_after.png` | `20260713_r14_customer-detail_360x800_before.png` / `20260713_r14_customer-detail_360x800_after.png` |

공통 경로: `output/playwright/r14-easy-usability/`. Empty/error/disabled, 키보드 축소, 오프라인 fallback 캡처도 같은 폴더에 있습니다.

### 대표 사용자 검증과 남은 게이트
- 실제 50~60대 여성 대표 사용자 2명에 대한 관찰 검증은 수행하지 못했습니다.
- 고객 찾기, 새 예약 등록, 예약 확인 또는 상태 변경 과제의 막힌 위치·오조작·이해하지 못한 용어·완료 확신을 실제 사용자와 기록해야 합니다.
- 모바일 실기기 IME, standalone, 서비스워커 update는 이번 합성 브라우저 검증에 포함되지 않았습니다.
- 따라서 현재 상태는 `구현 완료 · 대표 사용자 검증 대기`이며 R-14를 `Done`으로 표시하지 않습니다.
