# R-08 Service Master

## 상태
- Done (production deployed; live transactional smoke verified)
- 구현 브랜치: `codex/r08-service-master`, base `origin/main@a7a4186e76c9225c9273fa8474cea27440d36d40` (PR #15 merge)
- 통합 PR: PR #16 merge `main@01440b6c4e3386c26a60ba786dacc90fa6d95223`
- 최종 업데이트: 2026-07-12

## 목표
- 기존 `salon_service_defaults`를 서비스 마스터로 확장해 정수 KRW 가격, 기본 소요시간, 활성 여부, 정렬 순서를 관리합니다.
- 예약 시점의 서비스 ID·이름·소요시간·가격을 snapshot으로 보존해 이후 마스터 변경이 과거 예약과 통계를 바꾸지 않게 합니다.
- 가격 미설정 `NULL`과 무료 `0`을 구분하고, 기존 예약에는 서비스 ID나 가격을 추정 backfill하지 않습니다.

## 착수 전 `origin/main` 근거
- `salon_service_defaults`에는 이미 `id`, `name`, `default_duration_minutes`, `is_active`, `sort_order`, 생성·수정 시각이 있었습니다.
- `/settings` owner UI가 이 테이블을 관리하고 `/appointments/new`는 활성 서비스의 이름과 기본 소요시간을 예약의 `service`, `duration_minutes`에 저장했습니다.
- `appointments`에는 필수 text `service`와 nullable `duration_minutes`가 있었지만 서비스 FK와 가격 snapshot은 없었습니다.
- 설정 UI는 서비스를 hard delete할 수 있어 예약 FK 추가 전에 비활성화 UX와 DB 권한 경계를 함께 바꿔야 했습니다.

## 채택한 모델

### 기존 `salon_service_defaults` 확장
- 신규 `services` 테이블을 만들지 않고 기존 설정 UI·RLS·예약 기본값 연결을 재사용합니다.
- `salon_service_defaults.price_krw`는 nullable integer KRW이며 값이 있으면 `0 이상`입니다.
- `salon_operation_settings.default_service_id`는 nullable FK이며 삭제 정책은 `ON DELETE SET NULL`입니다. 이름으로 추정 backfill하지 않고, non-NULL 값은 활성 서비스만 허용합니다.
- 현재 기본 서비스는 다른 활성 기본 서비스를 먼저 저장하기 전까지 비활성화할 수 없습니다.
- 사용한 서비스는 hard delete하지 않고 `is_active=false`로 비활성화하며 과거 예약 snapshot은 유지합니다.
- 할인, 쿠폰, 부가세 분리, 원가, 다중통화는 R-08 범위 밖입니다.

### 예약 snapshot
- `appointments.service_id`: nullable FK → `salon_service_defaults.id`, `ON DELETE RESTRICT`.
- `appointments.price_snapshot_krw`: nullable integer KRW, 값이 있으면 `0 이상`.
- 기존 `appointments.service`, `appointments.duration_minutes`는 당시 이름·소요시간 snapshot으로 계속 유지합니다.
- 신규 `confirmed` 예약은 활성 `service_id`가 필수입니다. 신규 `cancelled` 자유입력도 허용하지 않으며, 서비스 없는 신규 자유입력은 `completed` 이력에만 허용합니다.
- 기존 `confirmed + service_id NULL` 행의 무관한 수정은 호환을 위해 허용하지만, 완료/취소 상태에서 `confirmed`로 되돌릴 때는 활성 서비스를 요구합니다.
- 한 번 서비스가 연결된 예약은 `service_id`를 NULL로 해제할 수 없습니다.
- 서비스 ID가 바뀌면 DB가 당시 마스터 이름과 가격을 강제합니다. `duration_minutes`가 NULL이면 새 서비스 기본시간을 사용하고, non-NULL 값은 이전 값과 같더라도 예약별 override로 보존합니다.
- 같은 서비스 ID의 메모·상태·소요시간 수정은 과거 이름·가격 snapshot을 현재 마스터 값으로 재평가하지 않습니다.
- 기존 예약과 기존 서비스에는 현재 이름·가격을 추정 backfill하지 않습니다. 새 컬럼은 그대로 NULL로 보존합니다.

## 채택한 저장·권한 경계

### DB trigger
- `BEFORE INSERT/UPDATE` trigger가 서비스 존재·활성 여부, 이름·가격 snapshot, 연결 해제 금지, NULL 자유입력 상태 경계를 강제합니다.
- snapshot trigger가 먼저 실행된 뒤 R-03 영업시간/충돌 guard가 최종 `duration_minutes`로 검사하도록 trigger 이름 순서와 `service_id` 감시 대상을 고정했습니다.
- 기본 서비스 지정과 비활성화의 교차 테이블 invariant도 별도 `BEFORE` trigger 두 개와 공통 transaction advisory lock으로 직렬화해 강제합니다.
- 관련 함수는 `SECURITY INVOKER`, `search_path=public`이며 PUBLIC·anon·authenticated 직접 EXECUTE 권한을 회수했습니다.
- 전용 예약 RPC + direct write 회수 대안은 기존 writer 전체 이관 비용 때문에 이번 단계에서 채택하지 않았습니다.

### RLS와 Data API grant
- owner는 서비스 생성·수정·비활성화·재활성화를 수행합니다.
- owner/staff는 active/inactive 서비스 전체를 읽어 기존 예약 이력을 해석할 수 있습니다.
- staff는 서비스 마스터를 변경할 수 없습니다.
- authenticated에는 `SELECT`, `INSERT`, `UPDATE`만 부여하고 `DELETE`는 grant와 RLS 모두에서 허용하지 않습니다. anon 권한은 없습니다.

### UI writer
- `/settings`: NULL/0원 구분, 생성·수정, 비활성화·재활성화, 활성 기본 서비스 ID 선택을 제공합니다.
- `/appointments/new`: 활성 서비스만 선택하고 `service_id`와 예약별 소요시간을 보내며 가격은 보내지 않습니다.
- `/appointments`: 서비스를 실제로 변경할 때만 `service_id`를 보내고 A→B→A 복귀 시 원래 snapshot을 복원합니다.
- `/customers/[id]`: 완료 이력을 활성 마스터로 기록하거나, 서비스 ID와 가격이 없는 자유입력 이력으로 기록할 수 있습니다.

## 구현·release Non-Goals
- 기존 예약 가격·서비스 ID 추정 또는 매출 backfill
- 할인/쿠폰/부가세/원가/다중통화/결제·정산 기능
- R-09 통계 UI 또는 aggregate RPC 구현
- 새 `services` 테이블의 선제 생성
- Preview 배포·환경변수 변경, 실제 로그인·실데이터 smoke

## 로컬 검증 결과
- PostgreSQL 17 disposable DB에서 forward migration 10개 fresh replay, R-07/R-08 smoke, R-08 rollback/reapply를 통과했습니다.
- migration replay DB와 `schema.sql` fresh DB의 public catalog를 정규화 비교해 semantic diff가 없음을 확인했습니다.
- 실제 upgrade 경로로 migration 1~9 적용 → synthetic legacy 서비스·설정·완료 예약 생성 → 10번째 후보 적용을 수행했고 `price_krw`, `default_service_id`, `service_id`, `price_snapshot_krw`가 모두 NULL로 유지됐습니다.
- owner/staff/anon grant·RLS, hard delete 차단, 활성 기본 서비스, 0원/NULL 가격, 서비스 변경·동일 ID 불변·연결 해제, 신규 상태 경계를 회귀 검증했습니다.
- 기본값 변경과 같은 서비스 비활성화를 두 PostgreSQL session에서 양쪽 선행 순서로 각각 3회 경쟁시켰고, 후행 transaction이 최신 commit을 확인해 거부되며 최종 invariant가 유지됐습니다.
- bundled Node `npm run build`가 13개 route와 PWA service worker를 생성하며 통과했습니다. 저장소에는 별도 lint/typecheck script가 없습니다.
- 합성 로컬 Auth/Data API 응답만 사용한 Production 모드 browser smoke에서 `/settings`, `/appointments/new`, `/appointments`, `/customers/[id]`를 390×844·360×800으로 검증했습니다. 캘린더 날짜 셀은 360px에서 44×44px이고 console warning/error는 0건입니다.
- PWA는 활성 service worker, offline fallback, manifest/SW/offline/icons HTTP 200, Supabase/API/고객·예약 document cache 0건을 확인했습니다.
- Pencil SSOT에는 설정, 새 예약, 예약 수정, 완료 이력 4개 R-08 frame을 반영했고 각 frame의 layout problem 0건과 `.pen` hash 변경을 확인했습니다.

## Production 검증 결과
- PR #16은 merge commit `01440b6c4e3386c26a60ba786dacc90fa6d95223`으로 main에 통합됐습니다.
- live migration은 local filename과 같은 `20260712093510_r08_service_master`를 포함한 10개입니다. connector가 처음 생성한 실행시각 version은 SQL 재실행 없이 해당 단일 history row만 local version으로 교정했습니다.
- live에는 R-08 컬럼 4개, trigger 함수 3개, snapshot/default guard trigger와 FK/index가 존재합니다. 함수는 `SECURITY INVOKER`, `search_path=public`, anon/authenticated 직접 EXECUTE 차단 상태입니다.
- 기존 고객 5건·예약 7건·서비스 4건에서 서비스 가격, 기본 서비스 ID, 예약 서비스 ID·가격 snapshot은 모두 NULL로 유지돼 추정 backfill이 없었습니다.
- `supabase/tests/r08_service_master.sql`을 live 단일 transaction으로 실행해 owner/staff/anon, hard delete, snapshot, 0원/NULL, 상태 전환, FK와 기본 서비스 guard를 검증했고 전체 fixture를 rollback했습니다. synthetic auth/customer/service/appointment residue는 모두 0건입니다.
- advisor에는 R-08로 새로 생긴 security warning이 없습니다. singleton 설정 FK의 미인덱스와 새 appointment 서비스 index 미사용은 초기 상태의 performance INFO로 후속 관찰하며, 기존 서비스 manage/read 중복 policy warning은 R-08 정책 분리 후 제거됐습니다.
- Vercel Production deployment `6N4gbJURzr8GX4omNErBZEA8VRzQ`가 merge SHA로 성공했습니다. canonical `/`, `/settings`, `/appointments/new`, manifest/SW/offline/favicon/192·512 icon은 200, Cron 무인증은 401이며 네 route의 JS bundle에서 R-08 고유 marker를 확인했습니다.
- Vercel connector 계정에는 대상 프로젝트가 표시되지 않아 환경변수·Runtime log는 확인하지 않았고 Chrome fallback이나 설정 변경도 수행하지 않았습니다.

## 완료 경계와 다음 단계
- main 통합, exact live migration, Production 배포, live transactional owner/staff/anon·snapshot smoke와 public bundle 검증을 완료해 R-08을 `Done`으로 확정합니다.
- 실제 로그인 owner/staff browser smoke와 Preview Supabase 격리 확인은 완료 근거와 분리한 후속 운영 검증입니다.
- 기본 서비스 invariant의 순차 회귀와 2-session 경쟁은 통과했습니다. 더 큰 동시 부하 시험은 Production 완료 필수조건이 아니라 후속 성능 검증으로 분리합니다.
- R-09는 최신 `origin/main`의 별도 clean worktree와 Plan에서 시작합니다.
