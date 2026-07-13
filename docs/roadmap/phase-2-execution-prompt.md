# Next Execution Prompt

R-10 Draft PR #26의 local A′ 검증 보고 후 main/live/Production release를 별도 승인 아래 진행할 때 사용합니다.

```text
/goal R-10 권한관리 UI Draft PR #26의 최신 head, checks, main 충돌, Production/Preview migration diff와 Supabase Auth URL metadata를 먼저 읽기 전용으로 재검증하고 보고합니다. 그 보고와 별도 승인 전에는 main merge, live migration, Auth 설정, Vercel Production release, 실제 직원 초대·역할 변경을 수행하지 않습니다. 승인을 받으면 검증된 두 R-10 migration과 canonical Auth redirect를 순서대로 적용하고 비식별 release smoke를 완료합니다.

읽기 전용 착수 디렉터리:
- /Users/idongseog/workspace/hairCRMvibes

반드시 먼저 읽기:
- AGENTS.md
- future-todo.md
- docs/roadmap/README.md
- docs/roadmap/R-10-role-management.md
- docs/operations/local-keychain-secrets.md
- docs/operations/supabase-free-keepalive.md
- lib/server/staffManagementCore.mjs
- lib/server/staffManagementSupabase.mjs
- app/api/staff/**
- supabase/migrations/20260712153420_r10_role_management.sql
- supabase/migrations/20260713143746_r10_invitation_claim_ledger.sql
- supabase/rollbacks/20260712153420_r10_role_management.down.sql
- supabase/rollbacks/20260713143746_r10_invitation_claim_ledger.down.sql
- supabase/tests/r10_role_management.sql
- supabase/tests/r10_role_management_concurrency.sh
- scripts/verify-r10-staff-management.mjs

현재 계약:
- Draft PR #26: https://github.com/dongseoklee1541/hairCRMvibes/pull/26
- 브랜치: `codex/r10-role-management`
- A′ 구현 commit `726e1b8` 기준 최신 `origin/main@a85c3f7` merge-tree, `Vercel`/`Vercel Preview Comments`, GitHub `CLEAN/MERGEABLE`을 통과했습니다. release 세션에서는 더 최신 head/main이 있는지 다시 확인합니다.
- A′안은 raw email을 저장하지 않는 private HMAC claim ledger와 owner-only claim/settle/reconcile RPC를 사용합니다.
- 동일 logical request/active email fingerprint의 Admin invite 호출은 winner 1건으로 제한합니다. 외부 이메일 전달 exactly-once는 보장하지 않으며 stale/모호한 결과는 `unknown`으로 두고 자동 재전송하지 않습니다.
- Auth 성공 후 profile 실패는 `auth_succeeded`로 보존해 후속 요청이 이메일 재전송 없이 복구합니다.
- `unknown`은 active unique index를 계속 점유하고 자동 만료·재전송·임의 UPDATE/DELETE를 금지합니다. Auth user/profile/동일 request provisioning audit가 모두 일치할 때만 reconcile로 종결하며, 그렇지 않으면 route를 중지하고 incident로 유지합니다.
- `SUPABASE_SECRET_KEY`는 browser bundle·응답·로그에 노출하지 않으며 HMAC domain separation에도 사용합니다. key 회전은 route `503 + no-store` 선중지, in-flight 0, 기존 key active ledger 0, 모든 server instance 재배포, 새 key smoke 후에만 재개합니다. 기존 fingerprint는 재계산·삭제하지 않습니다.
- Production/Preview는 R-09까지 11개 migration만 존재하고 R-10 table/RPC는 아직 없습니다.
- 실제 Auth 사용자·초대·역할 변경, live migration, Production deploy는 수행하지 않았습니다.
- 전용 Preview Supabase와 공개 URL/key 격리는 완료됐지만 R-10 Admin route용 Preview server secret은 미변경·미검증입니다.
- Supabase Auth Site URL은 `http://localhost:3000`, Redirect URL은 0개로 확인됐습니다.

첫 보고 gate:
1. `git fetch --prune origin` 후 PR head와 최신 `origin/main`의 실제 conflict test 및 checks
2. Production/Preview migration history와 local 13개 비교. `--include-all`로 backdated migration을 재실행하지 말 것
3. Production/Preview의 R-10 table/function/ACL 부재와 Auth Site/Redirect URL metadata를 값·사용자 PII 없이 확인
4. local 13/13 fresh/schema replay, R-07~R-10, 동시성, rollback/reapply, R-10 catalog parity, 서버 20/20, build·mobile·PWA·secret scan 근거와 미검증 항목을 구분해 보고
5. `unknown` 조사/종결 runbook, 초대 POST route 선중지 수단, HMAC 회전 및 rollback 순서가 실제 운영 가능함을 제시. 없으면 release blocker로 유지

승인 후 release 순서:
1. `unknown` runbook과 route `503 + no-store` 선중지/재개 수단을 승인·검증하고 active ledger가 아직 없는 기준선을 기록
2. PR #26을 main에 병합하고 merge SHA를 확인
3. Production에 local 순서 그대로 `20260712153420`, `20260713143746` 두 migration만 적용
4. migration version, private ledger RLS/no-grant, public RPC owner/search_path/EXECUTE ACL, 기존 role RPC/마지막 owner 보호를 비식별 검증
5. Supabase Auth Production Site URL을 `https://hair-cr-mvibes.vercel.app`으로 설정
6. exact Redirect URLs만 등록:
   - `https://hair-cr-mvibes.vercel.app/invite/accept`
   - `http://localhost:3000/invite/accept`
   - `http://127.0.0.1:3000/invite/accept`
7. wildcard Preview redirect는 추가하지 않고 Preview Site URL은 localhost로 유지
8. Vercel Production 배포/Promote 후 canonical 공개 route, manifest/SW/offline/icon, 무인증 staff API 401/no-store, 민감 응답 cache 0을 확인
9. 실제 초대 이메일·역할 변경 없이 migration/Auth URL/배포 전후 비식별 count와 synthetic residue 0을 확인

rollback 원칙:
- 앱 문제는 merge commit revert와 직전 성공 Production deployment 재연결을 우선합니다.
- 초대 POST route를 먼저 `503 + no-store`로 중지하고 in-flight 0을 확인합니다. ledger 계약이 없는 구버전 앱으로 먼저 되돌리거나 route를 재개해 Admin invite가 ledger를 우회하게 만들지 않습니다.
- 호환 앱/DB 순서를 확인한 뒤 claim/settle/reconcile EXECUTE를 회수하고 함수를 제거하되 private table/RLS/no-grant와 상태 증거는 보존합니다. 앱과 DB 계약이 다시 맞는 것을 확인한 뒤에만 route를 재개합니다.
- 역할 audit과 ledger를 삭제하지 않으며 이미 적용된 역할을 자동 역전하지 않습니다.
- Auth URL 문제는 직전 Site/Redirect metadata를 복원하되 운영 초대 중단과 active/`unknown` ledger 확인을 먼저 수행합니다.

Non-Goals:
- 승인 전 실제 직원 초대·역할 변경·계정 삭제
- Preview/Production 테스트 계정 생성
- 고객·예약 데이터 변경
- PWA cache 전략 변경
- 기존 미추적 산출물 정리
- R-11 구현 / R-14 추가 변경·대표 사용자 검증

첫 응답은 AGENTS.md 형식의 Implementation Plan과 읽기 전용 gate 결과만 제시하고, 별도 승인 전에는 외부 상태를 변경하지 마세요.
```
