# Next Execution Prompt

R-10 Draft PR #26의 merge/release blocker를 별도 승인 아래 해소할 때 사용합니다.

```text
/goal R-10 권한관리 UI Draft PR #26의 두 merge blocker를 재검증하고, invitation request ledger와 canonical Supabase Auth redirect를 안전하게 완성할 Implementation Plan을 제시합니다. 첫 응답은 AGENTS.md 형식의 Plan만 작성하고 승인 전에는 파일·Git·Supabase·Vercel·Pencil을 변경하지 않습니다.

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
- supabase/rollbacks/20260712153420_r10_role_management.down.sql
- supabase/tests/r10_role_management.sql
- scripts/verify-r10-staff-management.mjs

현재 기준:
- Draft PR #26: https://github.com/dongseoklee1541/hairCRMvibes/pull/26
- 브랜치: `codex/r10-role-management`
- 통합 base: `origin/main@a85c3f7597a0a326844f639da757d6d3f5f4c8bc`
- 최신 main 통합 PR head의 Vercel checks와 Preview Comments check 통과, GitHub `CLEAN/MERGEABLE` 확인(기능 통합 merge commit `06de442`)
- 실제 latest-main merge에서 source/docs는 자동 병합됐고 `pencil-hairshopcrm.pen`만 충돌했습니다. Pencil SSOT에서 R-10/R-12/R-14 node 공존과 layout problem 0건으로 해소했습니다.
- Production/Preview는 R-09까지 11개 migration만 존재하고 R-10 table/RPC는 없음
- 실제 Auth 사용자·초대·역할 변경, live migration, Production deploy는 수행하지 않음
- 전용 Preview Supabase와 공개 URL/key 격리는 완료됐지만 R-10 Admin route용 Preview server secret은 미변경·미검증
- Supabase Auth Site URL은 `http://localhost:3000`, Redirect URL은 0개

blocker 1:
- 현재 승인안은 pending/outbox ledger를 제외했습니다.
- 신규 이메일의 동시 동일 `requestId` 요청은 `findRequest -> Admin invite` 사이를 함께 통과할 수 있어 Auth 이메일 exactly-once를 원자 보장하지 못합니다.
- 기존 audit event는 profile provisioning 결과만 증명하며 Auth email attempt/sent 상태를 증명하지 않습니다.

반드시 비교할 대안:
1. Auth 호출 전 DB에서 request를 원자 claim하고 `prepared/attempted/sent/provisioned/failed_or_unknown` 상태를 보존하는 최소 invitation request ledger 추가
2. 앱의 Auth invite를 제거하고 Dashboard/운영 절차로 되돌리며 앱은 기존 사용자 역할 변경만 제공
3. exactly-once를 비보장 운영 제약으로 수용하는 안은 권장하지 않되, 선택 시 중복 이메일 위험·UI 문구·운영 보상 절차를 명시

blocker 2:
- canonical `https://hair-cr-mvibes.vercel.app/invite/accept`가 Supabase Auth 허용 URL에 없습니다.
- Site URL/Redirect URL 변경 범위, localhost 개발 유지 방식, Preview wildcard 필요 여부, rollback을 Plan에서 결정하세요.
- 실제 초대 이메일을 보내지 않고 설정·링크 구성만 검증하는 방법을 제시하세요.

Plan 필수 항목:
- ledger schema/RLS/retention/PII 최소화와 raw email 저장 필요 여부
- request claim transaction, crash/retry, unknown 상태, 동일 requestId·다른 email 충돌
- Auth invite 성공 후 profile provisioning 부분 실패 보상
- owner/staff/profileless/anon/PUBLIC 권한 매트릭스
- migration/schema/rollback/SQL concurrency test 동기화
- Admin API mock 동시성 test와 serverless 다중 인스턴스 가정
- Preview/Production 실제 계정·초대 없이 검증하는 방법
- 기존 Draft PR 업데이트, checks, migration diff, merge/live/deploy 승인 게이트

Non-Goals:
- 승인 전 실제 직원 초대·역할 변경·계정 삭제
- Preview/Production 테스트 계정 생성
- 고객·예약 데이터 변경
- PWA cache 전략 변경
- 기존 미추적 산출물 정리
- R-11 구현 / R-14 추가 변경·대표 사용자 검증

최신 origin/main, PR #26 diff/checks, worktree와 병행 세션, Production/Preview migration 및 Auth URL metadata를 모두 읽기 전용으로 재확인한 뒤 Plan을 작성하세요.
```
