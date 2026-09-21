# R-10 Release Plan A 이력과 재개 참고

이 문서는 2026-07-14 실행 이력을 보존한 참고 자료이며 전체 Phase 2의 현재 실행 프롬프트가 아닙니다. 2026-09-22 문서 점검에서 R-10 잔여 gate의 해소 근거는 확인되지 않았습니다. 현재 상태는 [R-10 상세](./R-10-role-management.md), 승인 경계는 [AGENTS.md](../../AGENTS.md)를 따릅니다. 과거 승인·환경값·접근 장애를 현재 실행 권한이나 live 상태로 복사하지 않습니다.

## 2026-07-14 Release Plan A 실행 결과

이 문서는 승인된 R-10 Release Plan A의 실행 결과와 다음 세션 handoff를 기록합니다. 반복 승인은 필요하지 않으며, 실제 직원 초대·역할 변경·테스트 계정·고객·예약 데이터 변경은 수행하지 않았습니다.

- 구현 commit `fccf3753856abbe0c254813eafd48bcbfffafcb0`을 PR [#26](https://github.com/dongseoklee1541/hairCRMvibes/pull/26)으로 squash merge했고 `main@6cfb71e88cbe4bbfd3a8469a3c5b4487a3ccb449`를 확인했습니다.
- Preview에는 connector apply-time `20260714145253 r10_role_management`, `20260714145314 r10_invitation_claim_ledger`, Production에는 local version `20260712153420 r10_role_management`, `20260713143746 r10_invitation_claim_ledger`가 기록됐습니다.
- 두 프로젝트의 R-10 catalog/RLS/ACL/owner policy와 private ledger aggregate를 비식별 검증했습니다. `private.staff_invitation_requests` aggregate는 0건입니다.
- Supabase Auth dashboard는 sign-in으로 리다이렉트됐고 CLI management access token도 없어 Site/Redirect URL 변경은 실행하지 않았습니다. 목표 설정은 Site URL `https://hair-cr-mvibes.vercel.app`과 exact redirect 3개이며 wildcard Preview redirect는 금지합니다.
- Vercel Production deployment `dpl_2vuPaKZxcv93nF71Nxk1DQKCZnHV`는 READY/canonical alias 연결입니다. Production `R10_INVITATIONS_ENABLED=false`를 유지합니다.
- canonical 390×844 login redirect, manifest/SW/offline 자산, 무인증 staff API `401 + no-store`, synthetic bearer maintenance `503 + private, no-store`, offline fallback과 online recovery를 확인했습니다.
- Preview/Production advisor에서 R-10 `SECURITY DEFINER` 함수 6개 WARN이 확인됐고 Production에는 `role_management_events` GraphQL exposure WARN도 있습니다. 권한 경계를 넓히지 않고 별도 hardening blocker로 남깁니다.

## 당시 완료 범위와 남은 gate

- R-10: `In Progress`
- 완료: maintenance gate/runbook, PR #26 merge, Preview/Production migration, Vercel Production release, release SSOT 동기화
- 차단: Supabase Auth Site/Redirect URL 설정, R-10 advisor hardening 검토
- 의도적 미수행: authenticated owner 실제 login/invite/role smoke 및 실제 이메일 발송
- Pencil: 별도 세션에서 관리. A′의 추가 UI 변경은 승인된 micro-copy 예외이며 `.pen` SHA-1 `a2019b2e78c386bc589f0003de090e051b0d358b`는 불변입니다.

## 명시적으로 재개할 때

1. 현재 요청과 이전 대화에서 승인된 대상·행위·환경을 확인합니다. 이미 승인된 범위는 재승인 없이 진행하며 이 문서를 읽었다는 이유로 goal이나 원격 변경을 시작하지 않습니다.
2. 현재 main/HEAD·worktree와 R-10 문서의 마지막 검증 날짜를 확인합니다. `6cfb71e`는 R-10 release 당시 SHA입니다.
3. 필요한 Auth dashboard/management 접근을 읽기 전용 확인합니다. 2026-07-14 접근 실패를 현재 장애로 단정하지 않습니다. 접근이 없으면 해당 설정 단계만 차단으로 남깁니다.
4. Auth URL·advisor·flag·migration/catalog/ACL을 현재 환경에서 확인합니다. 해소되지 않은 경고를 권한 완화로 숨기지 않습니다. 필요한 hardening은 승인 범위에 따라 계획·migration·검증합니다.
5. 초대 활성화 전 Auth URL·advisor gate를 해소하고 승인된 synthetic owner 검증, in-flight/unknown 0, cache/secret 경계를 확인합니다. 실제 초대·계정 생성·역할 변경은 명시적 범위 밖이면 수행하지 않습니다.
6. 상세 결과와 요약 두 곳을 동기화합니다. 필수 근거가 없으면 R-10 In Progress를 유지합니다.

당시 제안한 Auth 목표값은 Site URL `https://hair-cr-mvibes.vercel.app`, exact redirect `https://hair-cr-mvibes.vercel.app/invite/accept`, `http://localhost:3000/invite/accept`, `http://127.0.0.1:3000/invite/accept`입니다. 이것은 실제 적용값이 아닙니다. 승인된 환경에서 유효성을 확인하고 wildcard Preview redirect는 추가하지 않습니다.

## 안전 경계

- 초대 route는 활성화 전까지 `503 + invitation_maintenance + private, no-store`를 유지합니다.
- `unknown`은 자동 만료·재전송·직접 UPDATE/DELETE로 해제하지 않고 Auth user/profile/동일 request provisioning audit 증거가 모두 일치할 때만 runbook 절차로 reconcile합니다.
- key rotation과 rollback은 [`docs/operations/r10-invitation-ledger.md`](../operations/r10-invitation-ledger.md)의 route 선중지 → in-flight 0 → 증거 확인 → 변경 → 재검증 순서를 따릅니다.
- 보호된 `.pen`, `output/pencil/**`, `output/playwright/**`, `.playwright-cli/**`, `supabase/.temp/**`와 사용자 변경은 정리·삭제·stage하지 않습니다.
