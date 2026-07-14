# Phase 2 실행 프롬프트 — R-10 Release Plan A 결과 및 후속 게이트

## 2026-07-14 Release Plan A 실행 결과

이 문서는 승인된 R-10 Release Plan A의 실행 결과와 다음 세션 handoff를 기록합니다. 반복 승인은 필요하지 않으며, 실제 직원 초대·역할 변경·테스트 계정·고객·예약 데이터 변경은 수행하지 않았습니다.

- 구현 commit `fccf3753856abbe0c254813eafd48bcbfffafcb0`을 PR [#26](https://github.com/dongseoklee1541/hairCRMvibes/pull/26)으로 squash merge했고 `main@6cfb71e88cbe4bbfd3a8469a3c5b4487a3ccb449`를 확인했습니다.
- Preview에는 connector apply-time `20260714145253 r10_role_management`, `20260714145314 r10_invitation_claim_ledger`, Production에는 local version `20260712153420 r10_role_management`, `20260713143746 r10_invitation_claim_ledger`가 기록됐습니다.
- 두 프로젝트의 R-10 catalog/RLS/ACL/owner policy와 private ledger aggregate를 비식별 검증했습니다. `private.staff_invitation_requests` aggregate는 0건입니다.
- Supabase Auth dashboard는 sign-in으로 리다이렉트됐고 CLI management access token도 없어 Site/Redirect URL 변경은 실행하지 않았습니다. 목표 설정은 Site URL `https://hair-cr-mvibes.vercel.app`과 exact redirect 3개이며 wildcard Preview redirect는 금지합니다.
- Vercel Production deployment `dpl_2vuPaKZxcv93nF71Nxk1DQKCZnHV`는 READY/canonical alias 연결입니다. Production `R10_INVITATIONS_ENABLED=false`를 유지합니다.
- canonical 390×844 login redirect, manifest/SW/offline 자산, 무인증 staff API `401 + no-store`, synthetic bearer maintenance `503 + private, no-store`, offline fallback과 online recovery를 확인했습니다.
- Preview/Production advisor에서 R-10 `SECURITY DEFINER` 함수 6개 WARN이 확인됐고 Production에는 `role_management_events` GraphQL exposure WARN도 있습니다. 권한 경계를 넓히지 않고 별도 hardening blocker로 남깁니다.

## 현재 상태

- R-10: `In Progress`
- 완료: maintenance gate/runbook, PR #26 merge, Preview/Production migration, Vercel Production release, release SSOT 동기화
- 차단: Supabase Auth Site/Redirect URL 설정, R-10 advisor hardening 검토
- 의도적 미수행: authenticated owner 실제 login/invite/role smoke 및 실제 이메일 발송
- Pencil: 별도 세션에서 관리. A′의 추가 UI 변경은 승인된 micro-copy 예외이며 `.pen` SHA-1 `a2019b2e78c386bc589f0003de090e051b0d358b`는 불변입니다.

## 다음 세션용 handoff

```text
/goal R-10을 Done으로 전환하지 말고, 승인된 후속 범위에서 Supabase Auth URL blocker와 advisor hardening을 먼저 해결·검증합니다. 실제 직원 초대·역할 변경·테스트 계정·고객·예약 데이터 변경은 수행하지 않습니다.

기준:
- 최신 main: 6cfb71e88cbe4bbfd3a8469a3c5b4487a3ccb449
- PR #26: merged
- Production deployment: dpl_2vuPaKZxcv93nF71Nxk1DQKCZnHV
- Production flag: R10_INVITATIONS_ENABLED=false
- Auth 목표 Site URL: https://hair-cr-mvibes.vercel.app
- exact Redirect URLs:
  - https://hair-cr-mvibes.vercel.app/invite/accept
  - http://localhost:3000/invite/accept
  - http://127.0.0.1:3000/invite/accept
- wildcard Preview redirect 금지

진행 조건:
1. 인증된 Supabase dashboard 또는 승인된 management 접근이 실제로 가능한지 먼저 확인합니다. 불가능하면 Auth URL은 변경하지 말고 blocker로 보고합니다.
2. R-10 함수 6개의 SECURITY DEFINER execute 경고와 Production role_management_events GraphQL 노출 경고를 현재 owner/authenticated 경계, RPC 호출 경로, ACL 증거로 재검토합니다. 권한 완화나 public 노출 확대는 하지 않습니다.
3. hardening migration을 제안할 경우 별도 계획/승인을 받고, 적용 전후 advisor·catalog·ACL·rollback을 검증합니다.
4. Auth URL과 advisor blocker가 모두 해소되고 별도 승인된 경우에만 flag 활성화 전 owner/synthetic smoke, in-flight 0, unknown 0, cache/secret 경계를 다시 확인합니다.
5. 모든 결과를 `future-todo.md`, `docs/roadmap/README.md`, `docs/roadmap/R-10-role-management.md`에 함께 동기화하고, evidence가 없으면 `In Progress`를 유지합니다.
```

## 안전 경계

- 초대 route는 활성화 전까지 `503 + invitation_maintenance + private, no-store`를 유지합니다.
- `unknown`은 자동 만료·재전송·직접 UPDATE/DELETE로 해제하지 않고 Auth user/profile/동일 request provisioning audit 증거가 모두 일치할 때만 runbook 절차로 reconcile합니다.
- key rotation과 rollback은 [`docs/operations/r10-invitation-ledger.md`](../operations/r10-invitation-ledger.md)의 route 선중지 → in-flight 0 → 증거 확인 → 변경 → 재검증 순서를 따릅니다.
- 보호된 `.pen`, `output/pencil/**`, `output/playwright/**`, `.playwright-cli/**`, `supabase/.temp/**`와 사용자 변경은 정리·삭제·stage하지 않습니다.
