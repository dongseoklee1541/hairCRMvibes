# R-10 Role Management

## 상태
- In Progress (local implementation verified; Draft PR merge-blocked)
- 구현 브랜치: `codex/r10-role-management`
- 기준: `origin/main@b2258844642fae0d7a5f07798a95c9a3091cd502`
- 최종 업데이트: 2026-07-13

## 목표
- owner가 앱에서 직원 초대 상태를 확인하고 기존 `profiles.role`을 안전하게 변경합니다.
- DB가 owner 권한, 자기 강등 금지, 마지막 owner와 동시 강등 불변식을 강제합니다.
- 초대·목록에서 raw email, service secret, token을 브라우저 번들·응답·로그·스크린샷에 노출하지 않습니다.
- 기존 `pencil-hairshopcrm.pen`, migration/schema/rollback/test, 앱, 로드맵 SSOT를 같은 작업에서 동기화합니다.

## 선택한 방식
- A안: Supabase Admin API는 Node server-only route에서만 사용하고 앱 역할의 SSOT는 `public.profiles.role`로 유지합니다.
- 초대 신규 profile의 초기 역할은 `staff`로 고정합니다. 역할 승격은 별도 owner action으로 분리합니다.
- Auth invite와 profile provisioning은 단일 transaction이 아니므로 Auth 사용자를 자동 삭제하지 않습니다. profile 실패는 repairable partial failure로 반환하고 같은 email 재요청이 provisioning을 멱등 복구합니다.
- pending queue와 raw email DB 저장은 추가하지 않습니다. audit에는 actor/target/이전·이후 역할/event/request/time만 보관합니다.
- profile provisioning RPC는 최초 처리와 replay를 `replayed`로 구분합니다. 성공 replay와 신규 초대 후 profile 부분 실패의 순차 재시도에서는 Auth 이메일을 다시 보내지 않습니다.
- 계정 삭제, 비활성화, Auth ban은 범위 밖입니다.

## 권한 경계
- client 역할 숨김은 UX일 뿐 권한 근거로 사용하지 않습니다.
- authenticated caller JWT를 유지한 `SECURITY DEFINER` RPC가 `auth.uid()`와 owner profile을 다시 확인합니다.
- 함수는 빈 `search_path`, 완전 수식 객체, PUBLIC/anon EXECUTE 회수, authenticated 명시 grant를 사용합니다.
- 역할 변경은 공통 transaction advisory lock 뒤 actor 역할을 재검사하고 target row를 잠급니다. self-demotion과 마지막 owner demotion을 거부하며 update와 audit을 원자적으로 처리합니다.

## 확인된 기준선
- live Auth 사용자 2명, profile 2명, owner 1명, staff 1명, profile 누락 0명이며 읽기 전용 aggregate만 확인했습니다.
- Vercel project `hair-cr-mvibes`의 `SUPABASE_SECRET_KEY`는 값 확인 없이 `Sensitive / Production`으로 존재함을 확인했습니다.
- Supabase Auth Site URL은 `http://localhost:3000`, Redirect URL은 0개입니다. 실제 Production 초대 수락 경로는 현재 설정으로 완료할 수 없으므로 외부 Auth URL 변경 전 release blocker입니다.
- Preview Supabase 격리는 계속 `확인 필요`이며 실제 Preview/Production 초대·로그인·역할 변경 smoke는 금지합니다.

## UI/Pencil 범위
- `/settings`에 권한관리 진입점을 두고 상세 화면은 `/settings/team`으로 분리합니다.
- 직원 목록, 초대 form, 성공/pending/중복, loading/empty/error-retry, 역할 변경 confirmation, self/last-owner 차단, owner-only forbidden을 설계·구현합니다.
- 390×844와 360×800, 44×44px touch target, safe-area, keyboard/focus/aria-live를 검증합니다.
- before 캡처는 `output/playwright/r10-role-management/20260713_r10_settings_before_390x844.png`와 `20260713_r10_settings_before_360x800.png`입니다.
- after 캡처는 같은 디렉터리의 `20260713_r10_settings_after_*`, `20260713_r10_team_after_*`, `20260713_r10_role_confirmation_after_390x844.png`, `20260713_r10_forbidden_after_390x844.png`입니다.
- Pencil node는 직원 목록 `qupvk`, 초대 상태 `UwRep`, 역할 변경 `uAdC5`, 시스템 상태 `Nabfm`이며 네 node 모두 layout problem 0건입니다. 파일 hash는 `9b4f4b0ad1b07b92b10d296aefd109cfd72597ef`에서 `c2dff27286addba3c990040bd68a06bcbe9be51a`로 변경됐습니다.

## 검증 결과
- PostgreSQL 17 disposable DB에서 forward migration 12/12와 R-07/R-08/R-09/R-10 회귀를 통과했습니다. 별도 `schema.sql` replay와 R-10 test도 통과했고 migration의 R-10 구간과 snapshot 마지막 447행이 일치합니다.
- 두 session owner 교차 강등은 한 transaction만 성공해 owner 1명과 audit 1건을 보존했습니다. manual rollback 뒤 RPC 3개 제거, audit/RLS 보존, profiles SELECT-only를 확인했습니다.
- 서버 계약 mock 14건은 신규 초대, 중복, 재초대, profileless 복구, 부분 실패, 성공 replay, 다른 email의 request ID 충돌, 역할 변경과 안정 오류 응답을 통과했습니다.
- 두 mobile viewport에서 목록·초대 validation/success·역할 confirmation/change·loading/empty/error/retry·staff forbidden·profileless·anon redirect·초대 수락/로그아웃을 확인했습니다. dialog focus trap, Escape, focus restore, body scroll 복원, 44px touch target과 수평 overflow 0건도 통과했습니다.
- Production-mode local PWA에서 SW activated/controller, offline fallback, online revisit, console error 0건, API/Supabase/document response cache 0건을 확인했습니다. manifest/SW/offline/icon 192·512는 HTTP 200입니다.
- `npm run build`, `git diff --check`, 브라우저 bundle secret scan을 통과했습니다. 실제 Auth 사용자·초대·역할·고객·예약 데이터는 변경하지 않았습니다.

## merge 전 미해결 설계
- 현재 승인안은 invitation pending/outbox ledger를 두지 않습니다. 따라서 신규 이메일의 동시 동일 `requestId` 두 요청이 `findRequest`와 Admin invite 사이를 함께 통과하는 check-then-act 경합은 DB transaction으로 원자 차단할 수 없습니다.
- 기존 unconfirmed 계정 재초대는 profile no-op event 뒤 Admin invite를 호출합니다. invite 실패 뒤 같은 request replay는 거짓 성공 대신 `invite_state_unknown`을 반환하지만, 이메일 attempt를 정확히 한 번 보장하려면 Auth 호출 전 request claim과 상태를 보존하는 별도 ledger가 필요합니다.
- 이 ledger는 승인된 "pending queue 없음" 결정을 바꾸는 DB/API 범위 확장이므로 Draft PR에서는 merge blocker로 유지하고 별도 Plan 승인 전에는 추가하지 않습니다.

## 현재 release blocker
- invitation request ledger 부재로 동시 동일 요청의 Auth 이메일 exactly-once 계약을 보장하지 못합니다. 이 상태에서는 merge하지 않습니다.
- Supabase Auth에 canonical `https://hair-cr-mvibes.vercel.app/invite/accept`를 허용하는 URL 설정이 없습니다.
- 이 설정은 저장소 migration이나 Vercel env가 아닌 외부 Auth configuration 변경이므로 구현·PR 검증과 분리해 승인 범위를 다시 확인한 뒤 변경해야 합니다.
