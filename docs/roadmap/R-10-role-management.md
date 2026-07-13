# R-10 Role Management

## 상태
- In Progress (A′ local implementation/verification and new-head PR checks complete; live/release gates remain)
- 구현 브랜치: `codex/r10-role-management`
- 최초 구현 기준: `origin/main@b2258844642fae0d7a5f07798a95c9a3091cd502`
- 최신 통합 기준: `origin/main@a85c3f7597a0a326844f639da757d6d3f5f4c8bc`
- Draft PR: [#26](https://github.com/dongseoklee1541/hairCRMvibes/pull/26)
- 최종 업데이트: 2026-07-14

## 목표
- owner가 앱에서 직원 초대 상태를 확인하고 기존 `profiles.role`을 안전하게 변경합니다.
- DB가 owner 권한, 자기 강등 금지, 마지막 owner와 동시 강등 불변식을 강제합니다.
- 초대·목록에서 raw email, service secret, token을 브라우저 번들·응답·로그·스크린샷에 노출하지 않습니다.
- 기존 `pencil-hairshopcrm.pen`, migration/schema/rollback/test, 앱, 로드맵 SSOT를 같은 작업에서 동기화합니다.

## 선택한 방식
- A′안: Supabase Admin API는 Node server-only route에서만 사용하고 앱 역할의 SSOT는 `public.profiles.role`로 유지하되, 외부 Auth 호출 전에 private invitation claim ledger를 원자적으로 선점합니다.
- 초대 신규 profile의 초기 역할은 `staff`로 고정합니다. 역할 승격은 별도 owner action으로 분리합니다.
- Auth invite와 profile provisioning은 단일 transaction이 아니므로 Auth 사용자를 자동 삭제하지 않습니다. profile 실패는 `auth_succeeded` 상태로 보존하고 같은 email 재요청이 이메일 재전송 없이 provisioning을 멱등 복구합니다.
- ledger에는 raw email 대신 server-only `SUPABASE_SECRET_KEY`를 domain-separated HMAC-SHA256 key로 사용한 64자리 fingerprint만 저장합니다. 역할 audit에는 actor/target/이전·이후 역할/event/request/time만 보관합니다.
- 상태는 `claimed`, `auth_succeeded`, `provisioned`, `failed_definitive`, `unknown`으로 제한합니다. 동일 request/email의 winner 한 건만 Admin invite를 호출하고, 호출 결과가 모호하거나 claim이 stale이면 `unknown`으로 닫아 자동 재전송하지 않습니다.
- 이는 외부 이메일의 exactly-once 전달 보장이 아니라 logical request/active fingerprint당 Admin API **at-most-once 호출** 보장입니다. `unknown`은 운영 확인 대상이며 UI도 즉시 재시도를 권하지 않습니다.
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
- 전용 `burtyhairCRM-preview` 프로젝트와 Vercel Preview 공개 URL/key 격리는 R-12에서 완료됐습니다. 다만 R-10 Admin 경로의 Preview server secret은 이번 범위에서 추가·변경·검증하지 않았고 실제 Preview/Production 초대·로그인·역할 변경 smoke도 수행하지 않습니다.

## UI/Pencil 범위
- `/settings`에 권한관리 진입점을 두고 상세 화면은 `/settings/team`으로 분리합니다.
- 직원 목록, 초대 form, 성공/pending/중복, loading/empty/error-retry, 역할 변경 confirmation, self/last-owner 차단, owner-only forbidden을 설계·구현합니다.
- 390×844와 360×800, 44×44px touch target, safe-area, keyboard/focus/aria-live를 검증합니다.
- before 캡처는 `output/playwright/r10-role-management/20260713_r10_settings_before_390x844.png`와 `20260713_r10_settings_before_360x800.png`입니다.
- after 캡처는 같은 디렉터리의 `20260713_r10_settings_after_*`, `20260713_r10_team_after_*`, `20260713_r10_role_confirmation_after_390x844.png`, `20260713_r10_forbidden_after_390x844.png`입니다.
- 최신 main과 통합한 Pencil node는 직원 목록 `v5otbf`, 초대 상태 `ckGvh`, 역할 변경 `CaBNI`, 시스템 상태 `PtvkE`이며 네 node 모두 layout problem 0건입니다. R-12 설정 `rYt9h`와 `DataBackupCard` `mVQYv`, R-14 Home Before `U1DsdP`와 After `e8e2Nz`도 같은 SSOT에 보존했고 각각 layout problem 0건입니다. 파일 SHA-1은 최초 `9b4f4b0ad1b07b92b10d296aefd109cfd72597ef`, R-10 설계 저장 `c2dff27286addba3c990040bd68a06bcbe9be51a`, R-12 통합·초안 정리 `140b7833a1a1eec4a0a93843919fbde13722a8e3`, 최신 R-14 main 충돌 해소 `a2019b2e78c386bc589f0003de090e051b0d358b` 순으로 변경됐습니다.
- A′ 추가 UI 변경은 레이아웃·정보구조가 아니라 `in_progress`/`unknown` 안전 문구 보강이므로 별도 Pencil 편집을 하지 않는 micro-copy 예외로 승인됐습니다. 디스크의 `.pen` SHA-1은 `a2019b2e78c386bc589f0003de090e051b0d358b`로 불변이지만, 이번 세션의 Pencil 앱 transport 연결 실패로 node/layout read-only 재검증은 blocked입니다. 연결이 복구되면 기존 R-10 node를 다시 읽기 전용 검증합니다.

## 검증 결과
- PostgreSQL 17 disposable DB에서 forward migration 13/13과 R-07/R-08/R-09/R-10 회귀를 통과했습니다. migration replay DB와 `schema.sql` replay DB의 R-10 semantic catalog diff는 없고, `20260713143746` ledger migration 657행은 `schema.sql` 마지막 657행과 byte-identical입니다.
- 두 session owner 교차 강등은 한 transaction만 성공해 owner 1명과 audit 1건을 보존했습니다. 동시 동일 fingerprint claim은 token-bearing acquisition 1건과 tokenless replay 1건으로 수렴했습니다. ledger rollback은 claim/settle/reconcile RPC 3개를 제거하면서 private table/RLS/no-grant/evidence를 보존했고 재적용과 R-10 회귀를 통과했습니다. 기존 R-10 rollback의 staff RPC 3개 제거/audit 보존/profiles SELECT-only 근거도 유지합니다.
- 서버 계약 mock 20/20은 신규·재초대, confirmed profileless canonical 복구, 부분 실패 후 무재전송 복구, 성공 replay, 동일 active fingerprint의 다른 request 동시 경합, `unknown` 무재전송·무token·무email, Admin 반환 email mismatch 격리, 기존 역할 audit request ID의 Auth side effect 전 거부, 역할 변경과 안정 오류 응답을 통과했습니다.
- 두 mobile viewport에서 목록·초대 validation/success·역할 confirmation/change·loading/empty/error/retry·staff forbidden·profileless·anon redirect·초대 수락/로그아웃을 확인했습니다. dialog focus trap, Escape, focus restore, body scroll 복원, 44px touch target과 수평 overflow 0건도 통과했습니다.
- Production-mode local PWA에서 SW activated/controller, 390×844·360×800 offline fallback, online refresh recovery, console error 0건, API/Supabase/document response cache 0건을 확인했습니다. manifest/SW/offline/icon 192·512는 HTTP 200입니다.
- 무환경·synthetic-env `npm run build`, `git diff --check`, browser bundle secret/HMAC domain/claim token scan을 통과했습니다. 실제 Auth 사용자·초대·역할·고객·예약 데이터는 변경하지 않았습니다.
- 기존 최신 main 통합에서 R-14 사용성 변경, R-12 `DataBackupCard`, R-10 진입점을 함께 보존했습니다. A′에서는 390×844·360×800의 `unknown` 안내 상태를 추가 검증해 수평 overflow 0건, 모든 주요 touch target 44px 이상, 일반 page load console 0건을 확인했습니다. 실제 409 mock에는 Chromium의 예상 resource error 1건만 있고 app exception은 없습니다. 캡처는 `output/playwright/r10-role-management/20260714_r10_invitation_unknown_{before,after}_{390x844,360x800}.png`이며 synthetic masked data만 사용했습니다.

## Draft PR checks와 migration diff
- A′ 구현 commit `726e1b8`을 push한 뒤 최신 `origin/main@a85c3f7`이 HEAD ancestor(`0 behind / 6 ahead`)임을 확인했고 `git merge-tree --write-tree HEAD origin/main`이 충돌 없이 tree를 생성했습니다. Draft PR #26의 새 head에서 `Vercel`, `Vercel Preview Comments` checks가 통과했고 GitHub `CLEAN/MERGEABLE`을 확인했습니다.
- 2026-07-14 읽기 전용 재확인에서 Production은 R-09까지 11개 migration만 존재하며 R-10 role audit/table/RPC와 private invitation ledger/RPC가 모두 없습니다.
- 전용 Preview도 R-09까지 11개만 존재하고 R-10 public/private 객체가 없습니다. Preview의 migration version은 connector 적용 시각이지만 이름/순서는 기존 11개와 대응합니다.
- 따라서 현재 migration diff는 local-only R-10 migration 2개(`20260712153420`, `20260713143746`)이며 live migration은 실행하지 않았습니다.

## A′ claim ledger 결정
- `private.staff_invitation_requests`는 queue/worker가 아니라 요청 claim과 복구 상태만 보존하는 최소 ledger입니다. private schema/table은 RLS를 켜고 Data API role에 schema/table 직접 권한을 주지 않습니다.
- public `SECURITY DEFINER` RPC는 user JWT 구조를 유지하기 위한 제한적 예외입니다. 모든 RPC가 빈 `search_path`, 완전 수식 객체, `auth.uid()` owner 재검사, transaction advisory lock을 사용하며 PUBLIC/anon/service_role EXECUTE를 회수하고 authenticated만 명시적으로 허용합니다.
- 동일 request ID를 다른 actor/fingerprint가 재사용하면 충돌하고, 활성 fingerprint의 부분 unique index가 다른 request ID 경합도 canonical row 하나로 수렴시킵니다. 신규 claim과 `failed_definitive` 재claim은 같은 request ID가 기존 `role_management_events`에 있으면 Admin side effect 전에 `22023`으로 거부합니다. claim token은 최초 winner의 server 흐름에서만 사용하고 API 응답·로그·replay에는 노출하지 않습니다.
- stale `claimed`와 Admin API의 timeout/모호한 오류는 `unknown`으로 유지해 자동 takeover/reinvite를 금지합니다. `unknown`은 active unique index를 계속 점유하며 자동 만료·재전송·직접 UPDATE/DELETE로 해제하지 않습니다. 운영자는 비식별 ledger 상태와 Auth user/profile/동일 request provisioning audit을 대조하고 세 증거가 일치할 때만 reconcile로 `provisioned` 처리합니다. 증거가 없거나 상충하면 초대 route를 중지하고 incident로 유지하며, 감사 가능한 별도 resolution 계약이 승인되기 전에는 임의 해제하지 않습니다.
- HMAC key를 겸하는 `SUPABASE_SECRET_KEY`가 회전하면 기존 active fingerprint와 새 fingerprint가 달라져 at-most-once 장벽을 우회할 수 있습니다. 회전은 초대 route `503 + no-store` 선중지 → in-flight 0 → 기존 key의 active `claimed`/`auth_succeeded`/`unknown` 0 확인 → 모든 server instance secret 교체·재배포 → 새 key smoke와 old active 0 재확인 → route 재개의 순서로만 진행합니다. 기존 fingerprint를 재계산·삭제하지 않습니다.

## 현재 release blocker
- Supabase Auth에 canonical `https://hair-cr-mvibes.vercel.app/invite/accept`를 허용하는 URL 설정이 없습니다.
- 이 설정은 저장소 migration이나 Vercel env가 아닌 외부 Auth configuration 변경이므로 구현·PR 검증과 분리해 승인 범위를 다시 확인한 뒤 변경해야 합니다.
- `unknown`을 증거 기반으로 조사·종결할 운영 runbook과 route 선중지 수단이 아직 배포되지 않았습니다. 미해소 `unknown`은 해당 fingerprint를 계속 잠그는 fail-closed 가용성 위험이므로 Production 전 별도 승인·검증이 필요합니다.
- Production/Preview에는 R-10 두 forward migration이 아직 적용되지 않았고 실제 owner 초대·역할 smoke를 수행하지 않았습니다. PR checks와 migration diff 보고 후 별도 승인을 받아 live migration/Auth 설정/Production release를 진행합니다.
