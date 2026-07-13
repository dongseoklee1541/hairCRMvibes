# Roadmap Detail Index

이 디렉터리는 `future-todo.md`의 R-xx 항목별 상세 진행 상태와 완료 기준을 기록합니다. 번호 미배정 후보는 `candidate-*` 문서로 분리하며 별도 승인 전에는 정식 R 업무로 세지 않습니다.

## Phase 1
| ID | 문서 | 상태 |
| --- | --- | --- |
| R-01 | [R-01-rls-policy.md](./R-01-rls-policy.md) | Done (live + fresh replay verified) |
| R-05 | [R-05-settings-page.md](./R-05-settings-page.md) | Done (live verified) |
| R-03 | [R-03-booking-conflict-business-hours.md](./R-03-booking-conflict-business-hours.md) | Done (live + fresh replay verified) |
| R-04 | [R-04-kst-date-time-consistency.md](./R-04-kst-date-time-consistency.md) | Done (live verified) |
| R-02 | [R-02-appointment-edit-cancel-status.md](./R-02-appointment-edit-cancel-status.md) | Done (live verified) |

## Phase 1 검증 기준
- 기준일: 2026-07-12
- 현재 Production 애플리케이션 release 기준: R-12 PR #22 merge `main@7a107c434f272bf33b0a35c7db6fba36e33b1946`
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
| 12 | `20260712153420_r10_role_management.sql` | owner-only 직원 목록/profile provisioning/역할 변경 RPC, audit, self/last-owner·동시 강등·request replay 보호; local fresh replay 완료, live 미적용 |

2026-07-12 production 작업에서 1~3번의 live 객체 동등성을 다시 확인한 뒤 SQL을 재실행하지 않고 migration history만 `applied`로 repair했습니다. 이어 9번 R-07과 10번 R-08을 적용했습니다. R-08 connector 적용 직후 생성된 실행시각 version은 SQL 재실행 없이 local filename version `20260712093510`으로 history만 교정했고, R-09 release 후 현재 live/local migration version 11개가 일치합니다. 4~8번 live history name에는 repair 전 timestamp suffix가 남아 있어 filename stem까지 같은 `exact match`는 아니며, R-07/R-08/R-09 row는 각각 `r07_customer_lifecycle_dedupe`, `r08_service_master`, `r09_stats_advanced`입니다.

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

## Phase 2
| ID | 문서 | 상태 |
| --- | --- | --- |
| R-06 | [R-06-pwa-completion.md](./R-06-pwa-completion.md) | Done (production asset smoke verified; install/standalone/update pending) |
| R-07 | [R-07-customer-edit-delete-dedupe.md](./R-07-customer-edit-delete-dedupe.md) | Done (production deployed; public endpoint rechecked) |
| R-08 | [R-08-service-master.md](./R-08-service-master.md) | Done (production deployed; live transactional smoke verified) |
| R-13 | [R-13-appointment-customer-search-quick-create.md](./R-13-appointment-customer-search-quick-create.md) | Done (production deployed; public/PWA smoke verified) |
| R-09 | [R-09-stats-advanced.md](./R-09-stats-advanced.md) | Done (production deployed; exact live migration/ACL/PWA verified) |
| R-14 | [R-14-easy-usability-foundation.md](./R-14-easy-usability-foundation.md) | Planned |

R-07 로컬 완료 게이트에는 등록·편집 미저장 상태의 브라우저 Back/Forward·내부 이동 확인, 제출 중 dirty 유지·지연 응답 stale route 차단, 저장 성공 시 대화상자 0건, 홈 390×844·360×800 지속 콘솔 0건, 새 브라우저 컨텍스트의 PWA/offline 재검증이 포함됩니다. Production release에서는 canonical PWA 핵심 자산과 Cron/DB/runtime log 경계를 추가 확인했습니다.

R-08은 기존 `salon_service_defaults` 확장, 10번째 migration, 예약 snapshot trigger/RLS, 설정·예약 생성·수정·완료 이력 UI와 Pencil SSOT를 구현했습니다. PR #16 merge, exact live migration 10개, no-backfill과 live transactional role/snapshot smoke, Production deployment 및 canonical R-08 bundle/PWA 공개 검증을 통과했습니다.

R-13은 R-09보다 먼저 수행하는 P1 작업입니다. 활성 고객 `id,name`만 조회하는 이름 combobox와 R-07 `CustomerForm`·`find_customer_duplicates`를 재사용한 인라인 빠른 등록을 구현했고, 성공·실패·취소·중복 기존 고객 선택 뒤 예약 draft 보존을 local mock으로 검증했습니다. DB migration/RPC/RLS 및 PWA cache 전략은 변경하지 않았습니다.

R-13은 PR #18 merge `main@f904bcf`로 Production에 배포됐습니다. deployment `dpl_5VemJYn7XhZAorkpEaHBNZN9x85o`가 READY이고 canonical alias가 연결됐으며, `/appointments/new`와 R-13 chunk, 로그인 redirect, manifest/SW/offline/favicon/192·512 icon 200 및 console 0건을 비로그인·비변경 smoke로 확인했습니다. 고객·예약 API와 실데이터는 건드리지 않았습니다.

R-09는 `origin/main@a360cea` 기반 별도 worktree에서 aggregate RPC, 기간 통계 UI, Pencil 6개 상태를 구현했습니다. forward 11개와 `schema.sql` 양 경로 R-07/R-08/R-09 SQL 회귀, 390×844·360×800 mobile mock, production-mode PWA/offline을 통과했습니다. PR #20 merge `main@b63f9a3`, exact 11번째 live migration, RPC catalog/ACL, Production deployment `dpl_FBDsYn26v2ZXiJthe5z97vsJDwk2`와 canonical 공개/PWA/offline 검증까지 완료했습니다.

R-14는 50~60대 여성 사용자를 중심으로 핵심 화면의 가독성, 쉬운 용어, 조작 영역, 폼 피드백을 정비하는 다음 P1 작업입니다. 홈 정보구조 개편, 반복 예약, 별도 저장 완료 흐름은 R-14 범위에 섞지 않고 아래 번호 미배정 후보로 평가합니다.

## Phase 2 착수 기준
- R-06/R-07은 재구현하지 않습니다. 실기기 install/standalone/SW update와 post-deploy authenticated browser 검증은 완료 근거와 분리한 후속 운영 작업입니다.
- R-08은 `/Users/idongseog/workspace/hairCRMvibes-r08-service-master` clean worktree에서 구현한 뒤 PR #16 merge `main@01440b6`, live migration 10개와 Production 배포까지 완료했습니다. 기존 R-07 checkout과 미추적 산출물은 변경하지 않았습니다.
- R-09는 PR #20 merge, exact 11번째 live migration과 Production 공개/PWA smoke까지 완료했습니다. R-10/R-11은 별도 작업으로 유지합니다.
- 2026-07-13 `burtyhairCRM-preview` 전용 Supabase 프로젝트를 만들고 forward migration 11개를 순서대로 replay했습니다. Vercel에는 Preview 범위의 공개 URL/key만 추가했으며 기존 Production/Development 값은 변경하지 않았습니다.
- R-12는 Preview의 synthetic owner/staff/anon·모바일/PWA 검증 후 PR #22 merge `main@7a107c4`와 Production deployment `FxRGiDSgHQFXARsc2mUyCrsydtY8`까지 완료했습니다. canonical R-12 bundle, 공개/PWA 자산과 무인증 `/api/export`의 `401 + no-store`를 확인했으며 Production 실제 CSV는 생성하지 않았습니다.
- R-14 구현은 `pencil-hairshopcrm.pen` 설계, 별도 Implementation Plan 승인, 코드·모바일 브라우저·대표 사용자 검증 순서로 진행합니다.

## 번호 미배정 사용성 후보

| 상태 | 문서 | 핵심 가설 |
| --- | --- | --- |
| Candidate (ID 미배정) | [오늘 예약 중심 홈](./candidate-today-centered-home.md) | 첫 화면의 최우선 정보가 고객 목록보다 오늘 일정이면 일상 업무가 빨라진다 |
| Candidate (ID 미배정) | [지난 시술 그대로 재예약](./candidate-repeat-last-service.md) | 고객 이력에서 반복 예약을 시작하면 재입력과 선택 실수가 줄어든다 |
| Candidate (ID 미배정) | [예약 등록 완료 확인 강화](./candidate-appointment-save-confirmation.md) | 저장 직후 큰 완료 표시와 예약 요약을 보여주면 저장 여부에 대한 불안과 중복 입력이 줄어든다 |

후보는 R-14 검증 결과와 실제 사용 빈도를 근거로 하나씩 채택·보류합니다. 채택 시에도 이 표에서 번호를 미리 예약하지 않고 별도 승인으로 당시의 다음 사용 가능 R 번호를 부여합니다.

## Phase 3
| ID | 문서 | 상태 |
| --- | --- | --- |
| R-12 | [R-12-csv-export-backup.md](./R-12-csv-export-backup.md) | Done (production deployed; Preview role/PWA + Production public/API boundary verified) |

R-12는 owner JWT·기존 RLS를 사용하는 스트리밍 Route Handler, 고객/예약 CSV, 명시적 암호화 보관·30일 삭제 확인 UI를 구현했습니다. 전용 Preview에서 anon 401, staff 403, owner 고객·예약 200과 CSV 계약, Vercel branch Preview 실제 owner/staff UI, 390×844·360×800/PWA cache를 검증하고 synthetic residue 0을 확인했습니다. Production 데이터·RLS·service-role·PWA cache 전략은 변경하지 않았습니다.

## Phase 3
| ID | 문서 | 상태 |
| --- | --- | --- |
| R-10 | [R-10-role-management.md](./R-10-role-management.md) | In Progress (local verified; Draft PR merge-blocked) |

R-10은 `origin/main@b225884` 기반 별도 clean worktree에서 A안(server-only Supabase Admin invite + `profiles.role` SSOT)을 구현하고 local 검증을 완료했습니다. 실제 Auth 사용자·초대·역할은 변경하지 않았습니다. invitation request ledger를 제외한 승인안에서는 동시 동일 request의 Auth 이메일 exactly-once를 원자 보장할 수 없고, Supabase Auth URL도 Production 초대 수락 경로를 허용하지 않습니다. 두 항목은 Draft PR merge/release blocker입니다.

## 실행 프롬프트
- [Phase 2 Execution Prompt](./phase-2-execution-prompt.md)

## 업데이트 규칙
- 각 R 작업 완료 시 상태, 근거, 검증 결과, 남은 리스크를 해당 문서에 갱신합니다.
- 같은 완료 변경에서 `future-todo.md`의 구현 상태와 이 인덱스도 함께 갱신하며, PR·merge SHA·배포·검증 중 실제로 확인한 근거만 기록합니다.
- 후보 문서는 `Candidate (ID 미배정)` 상태를 유지하고, 정식 승격 승인 전에는 R 번호 파일로 이름을 바꾸거나 구현을 시작하지 않습니다.
- `future-todo.md`의 구현 상태 표와 이 디렉터리 문서의 상태가 서로 다르면 `future-todo.md`를 요약본, R-xx 문서를 상세 근거로 봅니다.
