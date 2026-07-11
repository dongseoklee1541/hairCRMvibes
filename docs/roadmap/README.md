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
- 기준일: 2026-07-11
- 브랜치: `feature/r02-appointment-edit-status`
- live Supabase migration/RLS/RPC/R-03 smoke, R-02 Playwright mobile smoke, Pencil R-02 `snapshot_layout`/export, `npm run build`, `git diff --check`를 통과 기준으로 삼습니다.
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

live DB에는 4~8번과 동일한 timestamp가 기록되어 있습니다. 1~3번은 기존 schema가 이미 동등하지만 migration history에 없으므로, 향후 Supabase CLI 배포 전에 다음 절차가 필요합니다.

1. `supabase migration list`와 read-only schema 검증으로 live 객체 동등성을 다시 확인합니다.
2. 사용자의 live history 변경 승인을 받습니다.
3. SQL을 재실행하지 않고 history만 맞춥니다.

```bash
supabase migration repair --status applied 20260219000000 20260220000000 20260221000000
supabase migration list
supabase db push --dry-run
```

`migration repair`는 live schema를 변경하지 않지만 migration history를 변경하므로 이번 정리 작업에서는 실행하지 않았습니다. `--include-all`로 backdated migration을 live에 재실행해서는 안 됩니다.

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

## Phase 1 통합 전략
- 현재 Phase 1 브랜치는 local `main`과 `origin/main` 모두에 대해 fast-forward 가능한 ahead 상태입니다.
- 권장 PR 단위는 Phase 1 전체 단일 PR입니다. R-01~R-05가 DB/RLS/UI smoke로 서로 연결되어 있어 잘게 나누면 migration 순서와 검증 근거가 분산됩니다.
- main 병합과 live DB 배포는 분리합니다. 코드/문서 PR을 먼저 리뷰할 수 있지만, 향후 `db push` 전에는 위 migration history repair를 별도 승인·검증해야 합니다.
- push/PR 생성은 사용자 승인 전 수행하지 않습니다.

## Phase 2
| ID | 문서 | 상태 |
| --- | --- | --- |
| R-06 | [R-06-pwa-completion.md](./R-06-pwa-completion.md) | Planned |
| R-07 | [R-07-customer-edit-delete-dedupe.md](./R-07-customer-edit-delete-dedupe.md) | Planned |
| R-08 | [R-08-service-master.md](./R-08-service-master.md) | Planned |
| R-09 | [R-09-stats-advanced.md](./R-09-stats-advanced.md) | Planned |

## 실행 프롬프트
- [Phase 2 Execution Prompt](./phase-2-execution-prompt.md)

## 업데이트 규칙
- 각 R 작업 완료 시 상태, 근거, 검증 결과, 남은 리스크를 해당 문서에 갱신합니다.
- `future-todo.md`의 구현 상태 표와 이 디렉터리 문서의 상태가 서로 다르면 `future-todo.md`를 요약본, R-xx 문서를 상세 근거로 봅니다.
