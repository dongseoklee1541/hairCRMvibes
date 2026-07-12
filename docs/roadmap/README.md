# Roadmap Detail Index

이 디렉터리는 `future-todo.md`의 R-xx 항목별 상세 진행 상태와 완료 기준을 기록합니다.

## Phase 1
| ID | 문서 | 상태 |
| --- | --- | --- |
| R-01 | [R-01-rls-policy.md](./R-01-rls-policy.md) | Done (live verified) |
| R-05 | [R-05-settings-page.md](./R-05-settings-page.md) | Done (live verified) |
| R-03 | [R-03-booking-conflict-business-hours.md](./R-03-booking-conflict-business-hours.md) | Done (live verified) |
| R-04 | [R-04-kst-date-time-consistency.md](./R-04-kst-date-time-consistency.md) | Done (live verified) |
| R-02 | [R-02-appointment-edit-cancel-status.md](./R-02-appointment-edit-cancel-status.md) | Done (live verified) |

## Phase 1 검증 기준
- 기준일: 2026-07-12
- release 기준: remote `main@16157f89976e41f5218377712d5d77026bc14417`
- live Supabase migration/RLS/RPC/R-03 smoke, R-02 Playwright mobile smoke, Pencil R-02 `snapshot_layout`/export, `npm run build`, `git diff --check`, Vercel Production canonical smoke를 통과 기준으로 삼습니다.
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

2026-07-12 production 작업에서 1~3번의 live 객체 동등성을 다시 확인한 뒤 SQL을 재실행하지 않고 migration history만 `applied`로 repair했습니다. 이어 9번 R-07 migration 한 개만 적용했습니다. 현재 live history 9개는 위 forward migration 9개와 exact match이며 R-07 row는 name `r07_customer_lifecycle_dedupe`, statements 94개입니다.

실행 순서는 다음과 같았고, `--include-all`로 backdated migration을 재실행하지 않았습니다.

```bash
supabase migration repair --status applied 20260219000000
supabase migration repair --status applied 20260220000000
supabase migration repair --status applied 20260221000000
supabase migration list
supabase db push --dry-run
supabase db push --linked --yes
```

R-07 적용 후 catalog/ACL/RPC 29개 계약과 실제 owner/staff/anon Data API/RPC smoke 106개를 통과했고 synthetic fixture residue 0건을 확인했습니다. Vercel Production 배포 후 canonical 홈페이지·로그인·manifest/SW/offline/icon, Cron 401/200, DB `select 1`, Runtime log 0건도 확인했습니다.

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

## Phase 1 통합 및 release 결과
- Phase 1/R-02, Ops, R-06, R-07 stacked PR #9~#12와 Keychain 운영 보완 PR #13을 모두 `main`에 merge했습니다. 최종 release 기준은 `main@16157f89976e41f5218377712d5d77026bc14417`입니다.
- Vercel `main` auto-deploy는 merge SHA의 Production build를 성공시켰지만 custom domain 할당은 `Staged` 상태에서 생략됐습니다. deployment `5z5MKHSAyxtLrRt6ACF3UZtLBGh7`을 명시적으로 Promote해 `hair-cr-mvibes.vercel.app`을 갱신했습니다.
- Production에는 `SUPABASE_SECRET_KEY`, `CRON_SECRET`이 Sensitive 변수로 존재하고 Cron Jobs는 Enabled, `/api/cron/supabase-keepalive`는 `17 3 * * *`로 등록됐습니다.
- canonical smoke는 홈페이지·로그인·PWA 핵심 자산 200, Cron 무인증 401/승인 200, DB `select 1`, Runtime Warning/Error/Fatal 0건을 통과했습니다.

## Phase 2
| ID | 문서 | 상태 |
| --- | --- | --- |
| R-06 | [R-06-pwa-completion.md](./R-06-pwa-completion.md) | Done (production asset smoke verified; install/standalone/update pending) |
| R-07 | [R-07-customer-edit-delete-dedupe.md](./R-07-customer-edit-delete-dedupe.md) | Done (production deployed and verified) |
| R-08 | [R-08-service-master.md](./R-08-service-master.md) | Planned |
| R-09 | [R-09-stats-advanced.md](./R-09-stats-advanced.md) | Planned |

R-07 로컬 완료 게이트에는 등록·편집 미저장 상태의 브라우저 Back/Forward·내부 이동 확인, 제출 중 dirty 유지·지연 응답 stale route 차단, 저장 성공 시 대화상자 0건, 홈 390×844·360×800 지속 콘솔 0건, 새 브라우저 컨텍스트의 PWA/offline 재검증이 포함됩니다. Production release에서는 canonical PWA 핵심 자산과 Cron/DB/runtime log 경계를 추가 확인했습니다.

## 실행 프롬프트
- [Phase 2 Execution Prompt](./phase-2-execution-prompt.md)

## 업데이트 규칙
- 각 R 작업 완료 시 상태, 근거, 검증 결과, 남은 리스크를 해당 문서에 갱신합니다.
- `future-todo.md`의 구현 상태 표와 이 디렉터리 문서의 상태가 서로 다르면 `future-todo.md`를 요약본, R-xx 문서를 상세 근거로 봅니다.
