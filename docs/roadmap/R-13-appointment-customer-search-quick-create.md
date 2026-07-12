# R-13 예약 고객 검색·빠른 등록

## 상태
- Done (production deployed; public/PWA smoke verified)
- 구현 브랜치: `codex/r13-appointment-customer-quick-create`
- 기준: `origin/main@bbcb47b34987f534860422c786dd7354ca818f4a`
- 최종 업데이트: 2026-07-12

## 목표와 결과
- `/appointments/new`의 기존 고객 `<select>`를 활성 고객 이름 검색 combobox로 교체했습니다.
- 예약 화면을 벗어나지 않는 modal bottom sheet에서 기존 고객 등록 계약을 재사용합니다.
- 신규 고객 생성 또는 중복 후보의 기존 고객 선택 뒤 새 고객을 자동 선택하고 날짜·시간·서비스·소요시간·가격 snapshot 선택·메모 draft를 유지합니다.
- R-13은 R-09보다 먼저 수행하는 P1 작업이며 R-09 지표·집계 계약은 변경하지 않습니다.

## 개인정보·DB 경계
- 고객 목록 요청은 `customers?select=id,name&archived_at=is.null&order=name.asc`이며 전화번호를 검색·대량 전송하지 않습니다.
- 검색은 최초 최소 필드 목록을 브라우저에서 이름으로만 필터링합니다. 입력마다 전체 고객을 재조회하지 않습니다.
- 고객 생성은 기존 authenticated insert grant와 RLS를 사용하며 새 migration, RPC, RLS, table 변경이 없습니다.
- 전화번호 중복 확인은 R-07 `find_customer_duplicates` RPC와 `CustomerForm`의 `parseKoreanPhone` validation·명시적 acknowledgment를 그대로 사용합니다.
- 중복 후보에는 이름·예약 건수와 기존 고객 선택 행동만 표시하고 전화번호를 출력하지 않습니다.
- 전화번호 검색은 후속 범위입니다. 필요 시 masked 결과만 반환하는 제한 RPC와 RLS 경계를 별도 설계합니다.

## 구현 구조
- `AppointmentCustomerPicker`: combobox/listbox ARIA, 한글 IME composition, ArrowUp/Down, Enter, Escape, Tab, 로딩·오류·결과 없음·선택 상태를 담당합니다.
- `CustomerQuickCreateSheet`: portal dialog, 배경 scroll lock, Tab focus trap, Escape/취소, safe-area 내부 scroll을 담당합니다.
- 예약 draft는 `app/appointments/new/page.js`가 소유하고 picker/sheet 상태와 분리했습니다.
- `CustomerForm`은 신규 고객 페이지와 빠른 등록 sheet가 함께 사용합니다. 중복 후보가 있으면 기존 고객 선택 또는 별도 고객 acknowledgment 중 하나를 명시적으로 수행합니다.
- `lib/customerCreate.js`가 두 화면의 고객 insert와 오류 메시지 경계를 공통화합니다.
- 생성 성공 시 반환된 `id,name`만 목록에 국소 반영하고 전체 고객 재조회 없이 자동 선택합니다.

## Pencil SSOT
- 원본: `pencil-hairshopcrm.pen`
- Git hash: `1f3968be7e65c2d24a59e0bad8d0a01a4ad99905` → `b05e35508b88f5570f2b1ec1e41c85a31130e0de`
- 코드 변경 전에 다음 top-level 상태를 추가하고 각 `snapshot_layout(problemsOnly)` 0건을 확인했습니다.
  - `VIBfU`: R-13 / 고객 검색 기본
  - `MHRnI`: R-13 / 고객 검색 결과
  - `ImrTz`: R-13 / 검색 결과 없음
  - `oOlpJ`: R-13 / 고객 빠른 등록
  - `Fefoe`: R-13 / 중복 전화번호 경고
  - `ZLQe1`: R-13 / 등록 후 자동 선택
- Pencil MCP의 in-memory 편집 뒤 Pencil 앱 `File → Save`로 원본 파일 persistence와 hash 변경을 확인했습니다.

## 검증 결과
- `package.json`에 실제 존재하는 검증 script는 `dev`, `build`, `start`이며 lint/typecheck 전용 script는 없습니다.
- bundled Node `npm ci`: audit 0 vulnerabilities.
- bundled Node `npm run build`: Next 15.5.20 production build 통과, `/appointments/new` 9.5 kB, PWA service worker 생성.
- local mock Supabase만 사용해 390×844와 360×800에서 다음을 검증했습니다.
  - 이름 검색, 결과 없음, ArrowDown/Enter 선택, Tab 정상 이동
  - 중복 전화번호 경고와 기존 고객 선택
  - 신규 고객 성공 후 자동 선택·focus 복귀
  - 성공·실패·취소·중복 기존 고객 선택 뒤 시간 13:30, 소요시간 90분, 서비스/가격, 메모 draft 유지
  - 주요 현재 viewport 버튼·combobox hit area 44~48px 이상
  - bottom sheet 내부 scroll, 배경 scroll lock, 360×800 레이아웃·safe-area
- production build 서버에서 service worker `activated`, controller `true`, offline revisit의 `/offline.html` 전환, online 복구 후 `/appointments/new` 재진입, console error/warning 0건을 확인했습니다.
- 네트워크 기록에서 고객 목록 요청은 `select=id,name`만 포함했습니다.
- Preview/Production에는 고객·예약을 생성하지 않았고 실제 고객 개인정보를 조회·출력하지 않았습니다.

## 스크린샷
- before: `/Users/idongseog/workspace/hairCRMvibes-r08-service-master/output/playwright/r08-service-master/browser/20260712_r08_appointments_new_390x844_after.png` (R-13 직전 R-08 예약 등록 화면)
- after 390×844: `output/playwright/r13-appointment-customer-quick-create/20260712_r13_appointments_new_390x844_after.png`
- after 360×800: `output/playwright/r13-appointment-customer-quick-create/20260712_r13_appointments_new_360x800_after.png`
- sheet 360×800: `output/playwright/r13-appointment-customer-quick-create/20260712_r13_quick_create_sheet_360x800_after.png`

## Production release
- PR #18 merge commit: `f904bcfe676e73e4f629eef6e1003a186a7bbec9`
- Vercel deployment: `dpl_5VemJYn7XhZAorkpEaHBNZN9x85o`
- Deployment URL: `https://hair-cr-mvibes-81bpponh2-dongseoklee1541s-projects.vercel.app`
- 상태: `READY`, target `production`, canonical alias `https://hair-cr-mvibes.vercel.app` 연결
- 비로그인·비변경 smoke:
  - `/appointments/new`와 R-13 page chunk HTTP 200 후 `/login?from=%2Fappointments%2Fnew` redirect
  - `/login`, `/manifest.json`, `/sw.js`, `/offline.html`, `/favicon.ico`, `/icons/icon-192.png`, `/icons/icon-512.png` HTTP 200
  - browser console error/warning 0건
  - Supabase 고객·예약 요청 0건, 실데이터 생성·수정·삭제 0건

## 남은 리스크와 release 경계
- Preview Supabase 격리가 확인되지 않아 Preview/Production 실제 고객 생성 smoke는 금지 상태입니다.
- 실제 owner/staff 로그인 세션과 모바일 실기기 IME·standalone install은 후속 운영 검증입니다.
- 실제 owner/staff authenticated Production 기능 smoke는 실데이터 변경 위험 때문에 수행하지 않았습니다.
