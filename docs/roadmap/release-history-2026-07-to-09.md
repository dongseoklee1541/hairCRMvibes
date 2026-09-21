# 2026-07~09 release·감사 이력

이 문서는 2026-09-22 문서 정리 때 `future-todo.md`와 로드맵 인덱스의 과거 기록을 옮긴 보관본입니다. 아래 `현재`, `최신`, `이번 감사`, 미완료·차단 표현은 각 절의 당시 관찰을 뜻합니다. 현재 상태·다음 행동은 [future-todo.md](../../future-todo.md), 개별 완료 근거는 [R 상세 문서](./README.md)를 따릅니다.

과거 명령·승인은 현재 실행 지시가 아닙니다. 운영 절차는 [migration·release](../operations/migration-release-workflow.md)를 사용합니다. 고객/예약 count·migration 개수·서비스 상태·배포 alias·인증 장애를 현재값으로 재사용하지 않습니다. R-10 migration은 아래 초기 미적용 기록 이후 2026-07-14 Preview/Production 적용이 완료됐고, R-16은 2026-09-11 운영 반영됐습니다.

## 이전 future-todo.md 기록

## 교차 품질 개선 (2026-07-16)

- [AI-slop remediation](./ai-slop-remediation-2026-07-16.md): 홈 고객/오늘 예약과 예약 월/일 조회의 실패 상태를 분리하고, 고객 서버 검색의 최소 select·exact count·50개 pagination·특수문자-only 방어, 가격 미설정/무료/유료 구분, 설정 조회 실패 시 저장 잠금, 휴무일 dialog 접근성을 정비했습니다.
- 현재 코드에서 Node 33개·예약 race 9개 테스트, synthetic production/PWA build, diff check와 390×844·360×800 합성 모바일/Pencil 근거를 재검증했습니다. Preview transaction 기반 owner/staff/profileless/anon RLS 검증과 fixture residue 0 선행 근거를 기록하되, 실제 owner/staff Auth/JWT PostgREST·브라우저 검증은 안전한 Admin 경로 부재와 합성 signup 거부로 **미검증 · 비차단 운영 후속으로 defer**합니다.
- Production DB/Auth/고객·예약 데이터, migration, RLS, policy, grant, Supabase/Vercel 설정과 수동 배포는 이번 범위에서 조회·변경하지 않습니다.

## Phase 1 live 검증 요약 (2026-07-08)
- Supabase 프로젝트 `burtyhairCRM`은 `ACTIVE_HEALTHY` 상태였고, Phase 1 migration 5개(`r01`, `r02`, `r05`, `r03`, `phase1_function_privilege_hardening`)를 live DB에 적용했습니다.
- RLS/RPC/R-03 live smoke는 owner/staff/anon 경계, 설정 write 권한, `set_appointment_status`, 더블부킹, 영업시간 외, 휴게시간, 휴무일, cancelled/completed 비점유, 동시성 guard를 포함해 통과했습니다.
- R-02 UI는 `/appointments` 인증 세션에서 완료/취소/확정/수정 버튼, 취소 reason 저장, 재확정 시 감사 필드 초기화, 390x844/360x800 편집 패널을 검증했습니다.
- Pencil MCP는 `.pen` 파일을 직접 읽지 않고 `snapshot_layout`과 PNG export를 실행했으며, 예약 페이지 layout problem은 없었습니다.
- 당시 Claude Opus alias 리뷰에서는 R-03/R-05 상대 migration 순서만 정리됐고 기존 MVP base table migration 부재로 전체 빈 DB replay가 미지원이라는 리스크를 확인했습니다. 이 리스크는 아래 2026-07-11 통합 준비에서 A안 baseline으로 해소했습니다.

## Phase 1 통합 준비 검증 (2026-07-11)
- 선택 결과: fresh DB A안, Auth profile 자동 생성 별도 작업 분리, hardening 의도적 rollback 불가.
- `20260219000000_phase1_genesis_baseline.sql`을 추가하고 forward migration 8개를 14자리 timestamp로 정규화했습니다. live 적용된 Phase 1 다섯 파일은 live migration version과 timestamp를 일치시켰습니다.
- `*.down.sql`은 fresh replay 대상에서 빠지도록 `supabase/rollbacks/`로 분리했습니다.
- PostgreSQL 17 disposable DB에서 전체 forward replay, 핵심 테이블/RLS/realtime, owner/staff/anon, 상태 RPC, 더블부킹, 영업시간, 휴게시간, 휴무일을 검증했습니다.
- migration replay와 `schema.sql` snapshot의 table/constraint/index/policy/function/trigger/ACL/realtime 구성을 정규화 비교해 semantic diff가 없음을 확인했습니다.
- live read-only 재확인에서 프로젝트 `ACTIVE_HEALTHY`, Auth/profile 각 2건과 누락 0건, 자동 profile 함수/trigger 부재, Phase 1 함수 `search_path=public`, 사용자 호출 RPC/helper anon 차단을 확인했습니다.
- 2026-07-12 별도 승인 아래 genesis/기존 R-03 세 version의 live 객체 동등성을 다시 확인하고 SQL 재실행 없이 history만 `applied`로 repair했습니다. R-08 착수 전에는 live/local migration 9개가 일치했고, R-08 release 후 local filename과 같은 10번째 version까지 적용됐습니다. 4~8번 live history name에는 repair 전 timestamp suffix가 남아 있어 filename stem까지 동일하다는 의미의 `exact match`로 표현하지 않습니다.

## Phase 1 통합 및 Production release 메모 (2026-07-12)
- Phase 1/R-02, Ops, R-06, R-07 stacked PR #9~#12와 Keychain 운영 보완 PR #13을 `main`에 순서대로 merge했습니다. 당시 R-07 Production 애플리케이션 release 기준은 PR #13 merge `main@16157f89976e41f5218377712d5d77026bc14417`입니다.
- Production release 기록 문서 PR #14와 Phase 2 감사 문서 PR #15가 merge됐으며 당시 최신 문서 main은 `origin/main@a7a4186e76c9225c9273fa8474cea27440d36d40`이었습니다. 두 PR은 Markdown만 변경했으므로 당시 애플리케이션 release SHA와 구분합니다.
- Vercel Production deployment `5z5MKHSAyxtLrRt6ACF3UZtLBGh7`은 build 성공 후 `Staged` 상태로 custom domain 할당이 생략돼, 정확한 merge SHA를 Dashboard에서 Promote했습니다. canonical `https://hair-cr-mvibes.vercel.app`이 새 deployment의 `Current` domain임을 확인했습니다.
- migration baseline A안의 disposable fresh replay, Phase 1 history repair, R-07 production migration, 실제 role smoke, Production build/deploy와 canonical PWA/Cron/DB smoke까지 release 세션에서 완료했습니다. 이번 문서 감사에서는 canonical 공개/PWA 자산 200과 Cron 무인증 401만 현재 상태로 재확인했으며 승인 Cron 200·DB probe·Runtime log는 과거 release 근거로 유지합니다.

## Phase 2 착수 전 운영 선행 작업 (2026-07-12)
- Supabase Free inactivity 완화를 위한 Vercel 일일 keepalive를 Production에 배포했습니다.
- `CRON_SECRET`으로 보호된 server route가 고객/예약 데이터 대신 `salon_operation_settings.id` 한 컬럼만 read-only 조회합니다.
- 실제 secret은 저장소에 기록하지 않습니다. release 세션 기록상 Vercel Production에는 `SUPABASE_SECRET_KEY`, `CRON_SECRET`이 Sensitive 변수로 존재하며 로컬 검증 사본은 macOS login Keychain의 고정 alias로만 접근합니다.
- release 세션 기록상 Vercel Cron Jobs는 Enabled이고 `/api/cron/supabase-keepalive`가 `17 3 * * *`로 등록됐으며 Keychain 승인 호출 200·Runtime Warning/Error/Fatal 0건을 확인했습니다. 이번 감사에서는 무인증 `401 + application/json + no-store`만 현재 재확인했습니다.
- 2026-07-13 전용 `burtyhairCRM-preview` 프로젝트를 만들고 Vercel Preview 범위에 공개 URL/key를 설정했습니다. Preview 검증은 synthetic 데이터만 사용하며 Production 프로젝트의 고객·예약 데이터에는 접근하지 않습니다.
- keepalive는 Supabase Free uptime을 보장하지 않으며, Vercel Hobby는 내부 테스트/개인 베타 전제로만 사용합니다.
- 운영 절차: `docs/operations/supabase-free-keepalive.md`

### Phase 2 기능 착수 기준 (2026-07-12 감사)
- R-06/R-07은 재구현하지 않습니다. 미완료 실기기/browser/Preview 검증은 기능 완료 근거와 분리한 후속 운영 작업으로 추적합니다.
- R-08은 `origin/main@a7a4186e76c9225c9273fa8474cea27440d36d40`에서 시작해 PR #16 merge `main@01440b6c4e3386c26a60ba786dacc90fa6d95223`, exact 10번째 live migration, Production 배포와 live transaction smoke까지 완료했습니다. 기존 worktree와 미추적 산출물은 삭제·이동·stage하지 않았습니다.
- R-13은 `origin/main@bbcb47b`에서 별도 clean worktree로 구현한 뒤 PR #18 merge `main@f904bcf`와 Production 배포·공개/PWA smoke까지 완료했습니다. 이어 R-09도 별도 clean worktree에서 구현해 PR #20 merge와 Production release까지 완료했습니다.
- R-09는 `origin/main@a360cea`에서 별도 clean worktree로 구현했고 PR #20 merge `main@b63f9a3`, exact 11번째 live migration, Production canonical 공개/PWA smoke까지 완료했습니다.

## 당시 누적 업데이트 기록
- 당시 표기한 최종 업데이트: 2026-07-20 (이후 9월 기록이 누적된 상태였음)
- R-15 release 기록: PR #34 merge `main@52fa394d783cb418883d413ef4796be32f8afcde` (구현 `a0f324f`, ignore `96bd4b7`). Vercel Preview READY, Production deployment success. Preview migration `20260717140419_r15_customer_service_price`, Production migration `20260717140540_r15_customer_service_price` + signature fix `r15_customer_service_price_stats_signature_fix` 적용. catalog 검증: actual_price 4컬럼, check/trigger/RPC, authenticated EXECUTE 허용·anon 차단, nonnull actual_price 0. 실제 고객·예약 데이터 변경 없음.
- R-16 로컬 구현·검증 기록: `main@b87eb6873f3ab873b5d7cc8c6e9db641bd1c6e4d` 기준 전용 worktree/branch에서 mutable 잔여 컬럼 없는 원장형 모델과 고객→횟수권 UUID→예약 잠금, request UUID idempotency, owner/staff·RLS/ACL, R-07/R-08/R-15 경계를 구현했습니다. DB replay·rollback·semantic digest·동시성, 합성 모바일 UI/PWA/cache, `npm test`, Production build를 통과했으며 원격 delivery와 remote migration은 수행하지 않았습니다.
- R-10 구현/통합 기록: `origin/main@b225884`에서 시작해 R-14 변경과 Pencil node 공존을 보존했고, 승인된 A′ private HMAC invitation claim ledger·fail-closed gate·운영 runbook을 구현했습니다. implementation commit `fccf3753856abbe0c254813eafd48bcbfffafcb0`은 PR #26으로 `main@6cfb71e`에 merge됐으며, Preview/Production migration과 Vercel Production release는 완료됐습니다. Pencil transport 재검증은 별도 세션 blocker이고 `.pen` SHA-1은 불변입니다. Auth URL은 이번 release에서 변경하지 않았고, advisor WARN 및 authenticated owner smoke blocker 때문에 R-10은 `In Progress`입니다.
- R-11 선행 설계/보류 기록: 설계 PR #31을 merge commit `93c94bbac22d263cdca5fcb6ab0ee6b7e7295523`으로 `main`에 반영했습니다. 구현은 보류하고 다른 roadmap 업무를 우선합니다. 재개 시 첫 단위는 dry-run run 집계와 `simulated` job/delivery만 30일 보존하는 foundation이며 live·attempt·manual-review·외부 dispatch는 비활성화합니다. 실제 발송의 최소 dedupe tombstone 보존, HMAC rotation, provider 증거 기반 manual-review, 법적 동의/SLA·VAPID는 별도 live gate입니다.
- 2026-07-12 감사 직접 확인: GitHub PR #9~#15 merge, PR #15 merge commit `origin/main@a7a4186e76c9225c9273fa8474cea27440d36d40`; 당시 Supabase live migration 9개·R-07 RPC 7개/audit table 2개·고객 5건/예약 6건 비식별 count; canonical 공개/PWA 자산 200·Cron 무인증 401
- R-07 Production release 기록: 애플리케이션 `main@16157f8`, Vercel deployment `5z5MKHSAyxtLrRt6ACF3UZtLBGh7` Promote, 실제 role smoke 106개/residue 0건, 승인 Cron 200·DB probe·Runtime log 0건. 이번 감사에서 secret 기반 검증은 재실행하지 않음
- R-08 Production 기록: PR #16 merge `main@01440b6`, live migration `20260712093510_r08_service_master`, 고객 5건·예약 7건·서비스 4건 기준선과 기존 snapshot NULL 보존, live transactional role/snapshot smoke·residue 0건, Vercel deployment `6N4gbJURzr8GX4omNErBZEA8VRzQ`, canonical R-08 bundle/PWA/Cron 공개 경계를 확인
- R-13 release 기록: PR #18 merge `main@f904bcf`, Vercel deployment `dpl_5VemJYn7XhZAorkpEaHBNZN9x85o` READY 및 canonical alias 연결, `/appointments/new` R-13 chunk·로그인 redirect·manifest/SW/offline/favicon/192·512 icon HTTP 200·console 0건 확인. Supabase 요청과 실데이터 smoke는 수행하지 않음
- R-09 release 기록: PR #20 merge `main@b63f9a3`, exact live migration `20260712124959_r09_stats_advanced`, RPC ACL 계약, Vercel deployment `dpl_FBDsYn26v2ZXiJthe5z97vsJDwk2` READY/canonical 연결, 공개 PWA/offline/Cron 무인증 경계 확인. 실제 고객·예약 fixture와 authenticated live 데이터 smoke는 수행하지 않음
- R-12 기록: `origin/main@07eefe8` 기반 `codex/r12-csv-backup`, Pencil 설정 카드, owner-only 고객/예약 스트리밍 CSV, Node tests 10/10·100,005행, build, 전용 Preview synthetic 390×844·360×800, PWA NetworkOnly·민감 응답 cache 0건 확인
- 전용 `burtyhairCRM-preview`에 forward migration 11개를 replay하고 synthetic anon/staff/owner 실제 handler smoke에서 401/403/고객 200/예약 200과 CSV 계약을 확인. Vercel Preview deployment `EXjXJCPCCjNJ3gPZgPLsntu71Cb7`, 실제 owner/staff UI, 390×844·360×800/PWA cache를 검증하고 users/identities/profiles/customers/appointments/sessions/refresh tokens residue 0을 확인
- R-12 Production release: PR #22 merge `main@7a107c4`, Vercel deployment `FxRGiDSgHQFXARsc2mUyCrsydtY8`, canonical 공개/PWA 200·설정 chunk marker·무인증 export `401 + no-store`를 확인. Production DB는 고객 6·예약 7·profile 2, RLS 9/9, 핵심 grant 3/3, residue 0의 비식별 상태만 재확인했으며 실제 owner CSV는 생성하지 않음
- R-14 Production release 기록: 구현 commit `c7eaaabaabb47cbe4b11fabb6aaaccc1c428cb67`가 PR #25로 `main@cdabf40982c1b8d2dcc196bacc116b3d399efa15`에 병합됐고, GitHub Production deployment record `5424206017`은 `success`입니다. canonical `https://hair-cr-mvibes.vercel.app`에서 공개/PWA 자산 200과 R-14 bundle marker, Cron 무인증 `401/no-store`, CSV export `dataset=customers` 무인증 `401/private/no-store`를 확인했습니다. 실제 고객·예약 데이터는 조회하거나 변경하지 않았으며, 대표 사용자 2명 관찰은 미수행이므로 `Done` 대신 `In Progress (구현 완료 · 대표 사용자 검증 대기)`를 유지합니다.
- R-10 Release Plan A 기록: 구현 commit `fccf3753856abbe0c254813eafd48bcbfffafcb0`가 PR #26으로 merge되어 `main@6cfb71e`가 되었습니다. Preview는 connector apply-time `20260714145253`/`20260714145314`, Production은 local version `20260712153420`/`20260713143746`으로 R-10 migration이 적용됐고, 두 환경의 RLS/ACL/catalog와 private ledger 0건을 확인했습니다. Vercel Production deployment `dpl_2vuPaKZxcv93nF71Nxk1DQKCZnHV`는 READY/canonical alias 연결이며 Production `R10_INVITATIONS_ENABLED=false`입니다. Auth URL은 dashboard sign-in/CLI token blocker로 변경하지 않았고, R-10 advisor WARN과 authenticated owner 실제 smoke 미수행 때문에 `In Progress`를 유지합니다. 실제 직원 초대·역할 변경·테스트 계정·고객·예약 데이터는 변경하지 않았으며 Pencil은 별도 세션/승인된 micro-copy 예외로 처리했습니다.

- R-16 2026-09-10 최신 기록: `aaa168a`까지 Draft PR #37의 CI 및 Vercel Preview가 통과했고 Preview owner 로그인·취소 복구를 실제 버튼과 DB 원장으로 확인했습니다. 이후 재확정 보완은 취소 직전 원장을 RPC에 전달하고, 제거/교체 원장 및 미사용 재확정 후 재취소한 과거 원장을 제외합니다. 편집의 명시적 미사용/다른 권 선택은 유지합니다. 이 추가 변경은 로컬 검증 단계이며 Production과 기존 합성 예약 A/B/C의 상태를 변경하지 않았습니다.

- R-16 2026-09-11 운영 반영: PR #37 merge `main@668cd099f397ea9cedcd86d8b216014554bf04aa`, 검토 head `edff562b821fd8a9763c8821a9a0545f1d710356`. Production migration `20260719150346`, Vercel `U8xemVbjjv8NqrfbvwuFezVk8sux`의 canonical 전환 완료. 기존 고객 7건·예약 7건의 개수와 전체 행 해시 보존, RLS/RPC 권한, 로그인 예약·고객·횟수권 조회를 확인했습니다. 자동 도메인 할당을 일시 해제해 운영 빌드를 준비한 뒤 DB 적용→승격을 수행했고 Enabled로 복원했습니다. 기존 데이터 backfill 및 운영 쓰기 smoke는 수행하지 않았습니다. 상세 검증 경계는 R-16 문서의 Production 반영 절을 따릅니다.

## 이전 로드맵 인덱스 기록

## Phase 1 검증 기준
- 기준일: 2026-07-13
- 2026-09-11에 추가된 R-16 Production release 기준: R-16 PR #37 merge `main@668cd099f397ea9cedcd86d8b216014554bf04aa` (검토 head `edff562`; docs-only SSOT 동기화 PR은 별도)
- 2026-07-12 감사 착수 baseline은 PR #14 merge `2f915c2e8f7ec7e736a6ee4c315caa03113416ab`이었고, 감사 문서 PR #15 merge 후 최신 `origin/main`은 `a7a4186e76c9225c9273fa8474cea27440d36d40`입니다. 두 PR은 문서만 변경했으므로 Production 애플리케이션 release SHA와 구분합니다.
- release 세션의 live Supabase migration/RLS/RPC/R-03 smoke, R-02 Playwright mobile smoke, Pencil R-02 `snapshot_layout`/export, `npm run build`, `git diff --check`, Vercel Production canonical smoke를 완료 근거로 사용합니다. 이번 감사에서는 현재 GitHub/Supabase catalog와 canonical 공개 endpoint만 읽기 전용으로 재확인했습니다.
- Fresh DB 정책은 A안을 선택했습니다. `20260219000000_phase1_genesis_baseline.sql`을 포함한 forward migration 8개를 disposable PostgreSQL 17에서 전체 replay했고, 핵심 객체/RLS/RPC/예약 guard를 검증했습니다.
- migration replay 결과와 `schema.sql` snapshot을 별도 DB에 적용해 public schema 의미 구성을 비교했으며 semantic diff가 없습니다.
- 신규 Auth 사용자 profile 자동 생성은 별도 보안/운영 작업으로 분리했습니다. live와 `schema.sql` 모두 자동 owner trigger가 없으며 profile provisioning 전 사용자는 RLS 접근이 차단됩니다.
- `20260707161054_phase1_function_privilege_hardening.sql`은 forward-only입니다. 보안 권한을 되돌리는 down migration은 두지 않고 additive forward-fix만 허용합니다.
- `output/playwright/r03-main-smoke/`는 이전 세션 산출물이며 이번 정리 작업에서는 변경하지 않습니다.

## Migration baseline 및 운영 절차

`supabase/migrations/`에는 forward migration만 두고, 수동 rollback 참고 SQL은 `supabase/rollbacks/`에 분리합니다.

| 순서 | Forward migration | 의존성/역할 |
| --- | --- | --- |
| 1 | `20260219000000_phase1_genesis_baseline.sql` | `customers`, `appointments`, `profiles`, 기본 RLS/realtime |
| 2 | `20260220000000_r03_mvp.sql` | 휴무일, 취소 감사, 기본 guard/RPC |
| 3 | `20260221000000_r03_closed_days_lite.sql` | 기간/정기 휴무일 RPC |
| 4 | `20260707155922_r01_rls_policy.sql` | owner/staff RLS 및 grants |
| 5 | `20260707155948_r02_appointment_status.sql` | 상태 constraint/RPC |
| 6 | `20260707160023_r05_settings_business_hours.sql` | 영업시간/기본값 설정 |
| 7 | `20260707160103_r03_booking_conflict_hours.sql` | 더블부킹/영업시간 guard |
| 8 | `20260707161054_phase1_function_privilege_hardening.sql` | search path/anon execute hardening |
| 9 | `20260711110928_r07_customer_lifecycle_dedupe.sql` | 고객 archive/anonymize, 중복 후보, 원자적 merge/undo |
| 10 | `20260712093510_r08_service_master.sql` | 서비스 가격·활성 기본 서비스·예약 snapshot·trigger/RLS; live 적용·검증 완료 |
| 11 | `20260712124959_r09_stats_advanced.sql` | KST 기간 통계 aggregate RPC·owner/staff role check·explicit EXECUTE; live 적용·ACL 검증 완료 |
| 12 | `20260712153420_r10_role_management.sql` | owner-only 직원 목록/profile provisioning/역할 변경 RPC, audit, self/last-owner·동시 강등·request replay 보호; local fresh replay 완료, 당시 live 미적용 (후속 R-10 release에서 적용) |
| 13 | `20260713143746_r10_invitation_claim_ledger.sql` | private email-HMAC claim ledger와 claim/settle/reconcile RPC로 Admin invite logical request당 at-most-once 호출·unknown 자동 재전송 차단; local fresh/schema replay·동시성·rollback 검증 완료, 당시 live 미적용 (후속 R-10 release에서 적용) |

2026-07-12 production 작업에서 1~3번의 live 객체 동등성을 다시 확인한 뒤 SQL을 재실행하지 않고 migration history만 `applied`로 repair했습니다. 이어 9번 R-07과 10번 R-08을 적용했습니다. R-08 connector 적용 직후 생성된 실행시각 version은 SQL 재실행 없이 local filename version `20260712093510`으로 history만 교정했고, R-09 release 시점에는 live/local migration 11개가 일치했습니다. 2026-07-14 R-10 release 전 local은 R-10 두 migration을 포함한 13개, Production/Preview는 11개입니다. 4~8번 live history name에는 repair 전 timestamp suffix가 남아 있어 filename stem까지 같은 `exact match`는 아니며, R-07/R-08/R-09 row는 각각 `r07_customer_lifecycle_dedupe`, `r08_service_master`, `r09_stats_advanced`입니다.

실행 순서는 다음과 같았고, `--include-all`로 backdated migration을 재실행하지 않았습니다.

```bash
supabase migration repair --status applied 20260219000000
supabase migration repair --status applied 20260220000000
supabase migration repair --status applied 20260221000000
supabase migration list
supabase db push --dry-run
supabase db push --linked --yes
```

R-07 release 세션에서 catalog/ACL/RPC 29개 계약과 실제 owner/staff/anon Data API/RPC smoke 106개를 통과했고 synthetic fixture residue 0건을 확인했습니다. 이번 감사에서는 live RPC 7개, audit table 2개, 고객 5건·예약 6건 및 audit residue 0건을 비식별 조회로 재확인했습니다. canonical 홈페이지·로그인·manifest/SW/offline/icon 200과 Cron 무인증 401도 현재 재확인했지만 승인 Cron 200, DB `select 1`, Runtime log 0건은 재실행하지 않고 release 세션 근거로 유지합니다.

## Auth profile 운영 제약

- R-01 migration은 적용 시점에 존재하는 Auth 사용자만 `profiles`로 backfill합니다.
- 이후 신규 사용자는 초대/운영 절차에서 `profiles(id, role)`을 명시적으로 만들어야 합니다.
- owner 지정은 자동 선출하지 않습니다. 기존 owner가 확인된 관리 절차로 부여해야 합니다.
- profile이 없는 사용자는 `customers`, `appointments`, 설정 테이블의 owner/staff RLS 조건을 통과하지 못합니다.
- 운영 검증 SQL은 사용자 식별자를 출력하지 않고 `auth.users`/`profiles` count와 missing count만 확인합니다.

## 보안 hardening 장애 대응

- 자동 down migration은 제공하지 않습니다.
- 장애가 발생하면 함수 signature, `proconfig`, owner, `anon`/`authenticated` execute 권한을 먼저 읽기 전용으로 확인합니다.
- 필요한 함수 하나만 신규 forward migration으로 교정하고, mutable `search_path` 또는 anon 권한을 일괄 복원하지 않습니다.
- 기존 rollback SQL은 production 자동 실행용이 아니라 수동 검토 자료입니다.

## Phase 1 및 R-08 통합·release 결과
- Phase 1/R-02, Ops, R-06, R-07 stacked PR #9~#12와 Keychain 운영 보완 PR #13을 모두 `main`에 merge했습니다. 당시 R-07 Production 애플리케이션 release 기준은 `main@16157f89976e41f5218377712d5d77026bc14417`입니다.
- release 기록 문서 PR #14와 Phase 2 감사 문서 PR #15가 merge됐으며 당시 최신 문서 main은 `origin/main@a7a4186e76c9225c9273fa8474cea27440d36d40`이었습니다. PR #15 merge commit도 문서만 변경했으므로 당시 Production 애플리케이션 release SHA와 구분합니다.
- Vercel `main` auto-deploy는 merge SHA의 Production build를 성공시켰지만 custom domain 할당은 `Staged` 상태에서 생략됐습니다. deployment `5z5MKHSAyxtLrRt6ACF3UZtLBGh7`을 명시적으로 Promote해 `hair-cr-mvibes.vercel.app`을 갱신했습니다.
- release 세션 기록상 Production에는 `SUPABASE_SECRET_KEY`, `CRON_SECRET`이 Sensitive 변수로 존재하고 Cron Jobs는 Enabled, `/api/cron/supabase-keepalive`는 `17 3 * * *`로 등록됐습니다.
- 이번 감사에서 canonical 홈페이지·로그인·PWA 핵심 자산 200과 Cron 무인증 401/no-store를 재확인했습니다. 승인 200, DB `select 1`, Runtime Warning/Error/Fatal 0건은 secret을 사용하지 않는 이번 범위에서 재실행하지 않았습니다.
- R-08은 PR #16 merge `main@01440b6c4e3386c26a60ba786dacc90fa6d95223`, live migration `20260712093510_r08_service_master`, live transactional owner/staff/anon·snapshot smoke와 residue 0건을 확인했습니다. Vercel Production deployment `6N4gbJURzr8GX4omNErBZEA8VRzQ`와 canonical R-08 bundle/PWA 공개 경계도 검증했습니다.


## 이전 로드맵의 의사결정 옵션

아래는 당시 비교안이며 새로운 승인 요청이 아닙니다. 현재 확정 방향은 future-todo.md와 R 상세를 따릅니다.

### 1) 예약 충돌 처리
- `A안`: 충돌 시 경고를 노출하되 저장 허용
- `B안`: 충돌 시 저장 차단 + 대체 시간 추천
- 기본값(권장): `B안` (운영 안정성 우선)

### 2) 알림 채널
- `A안`: PWA Push 중심 — 현재 고객 인증·설치·구독 흐름이 없어 직원 운영 알림에만 적합
- `B안`: SMS 중심 — 고객 도달성은 높지만 provider·발신번호·비용·동의 운영을 먼저 확정해야 함
- `C안`(선택): 공통 outbox와 dry-run을 먼저 만들고 고객 예약 안내는 SMS, 직원 운영 알림은 PWA Push, 재방문 안내는 별도 마케팅 동의 후 고객 직접 채널로 단계적으로 활성화
