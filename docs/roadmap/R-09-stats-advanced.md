# R-09 Stats Advanced

## 상태
- Ready for PR (local implementation and verification complete; live migration/Production release pending)
- 구현 브랜치: `codex/r09-stats-advanced`
- 기준: `origin/main@a360cea279abd250670dfd47ca6e8cd213b7131c`
- 최종 업데이트: 2026-07-12

## 구현 결과
- `/stats`의 `appointments.*`, `customers(id, name)`, 브라우저 원본 집계를 제거하고 `get_stats_summary(p_start_date, p_end_date)` RPC 한 번으로 교체했습니다.
- 사용자 선택 KST 시작일·종료일을 inclusive date 범위로 사용하며 최대 366일만 허용합니다.
- 매출, 유료 완료 객단가, 완료 건수, 가격 미입력 건수·비율·원인 구분, 재방문 고객률, 서비스별 상위 5개 집계를 반환합니다.
- loading, error/retry, empty, 가격 부분 데이터, 0원 완료, 기간 선택 상태를 분리했습니다. 기간 입력 중에는 호출하지 않고 적용 시 한 번만 POST하며 request sequence guard로 이전 응답을 폐기합니다.

## 확정 지표 계약

### 매출·객단가
- 매출은 `status='completed'`이고 `price_snapshot_krw is not null`인 snapshot을 합산합니다. 0원은 합계에 포함하지만 가격 NULL은 추정하지 않습니다.
- 객단가는 `status='completed'`이고 `price_snapshot_krw > 0`인 유료 완료 예약만 분자·분모에 사용합니다.
- confirmed/cancelled는 제외하며 현재 존재하지 않는 no-show를 신설·추정하지 않습니다.

### 가격 데이터 품질
- 가격 NULL 완료 예약을 건수와 완료 예약 대비 비율로 반환합니다.
- `service_id is null`과 `service_id is not null`을 각각 자유입력/서비스 연결 보조 분류로 반환하되 snapshot 회귀라고 자동 단정하지 않습니다.
- 기존 서비스·예약의 가격 또는 service FK를 현재 마스터 값으로 backfill하지 않습니다.

### 재방문율
- 선택 기간 내 완료 예약 고객을 분모로, 같은 기간 완료 예약이 2건 이상인 고객을 분자로 사용합니다.
- 기간 이전 이력이나 첫 방문 제외 관찰 창은 사용하지 않습니다.
- 완료 고객 분모가 0이면 `NULL`을 반환하고 UI는 `데이터 없음`으로 표현합니다.

### 시술별 지표
- 예약 당시 text `service`와 `price_snapshot_krw` snapshot으로 집계합니다.
- 건수, 매출, 유료 건수·객단가, 가격 미입력 건수만 반환하고 상위 5개로 제한합니다.
- 현재 서비스 마스터 이름·가격으로 과거 이력을 재분류하지 않습니다.

## DB·권한 설계
- 기간 검증과 의미가 확정된 KPI를 한 번에 반환하는 aggregate RPC를 선택했습니다. 임의 기간 필터와 raw row 조합을 허용하는 view보다 반환·권한 경계가 좁습니다.
- 함수는 `STABLE SECURITY INVOKER`, 빈 `search_path`, 완전 수식 테이블명을 사용합니다.
- 함수 내부에서 `auth.uid()`와 `profiles.role in ('owner','staff')`를 확인합니다. 현재 appointment/service 가격은 두 역할 모두 읽을 수 있어 owner/staff 동일 집계를 허용했습니다.
- `PUBLIC`, `anon`, `authenticated`의 기본 EXECUTE를 모두 회수한 뒤 `authenticated`에만 명시적으로 부여합니다. profile이 없거나 허용 역할이 아니면 `42501`로 차단합니다.
- 응답에는 고객 ID·이름·전화번호·메모와 예약 ID·원본 row가 없습니다.
- 범위가 최대 366일이고 현재 데이터 규모에서 별도 index 근거가 없어 index를 추가하지 않았습니다.

## 변경 파일
- `pencil-hairshopcrm.pen`
- `app/stats/page.js`
- `app/stats/page.module.css`
- `supabase/migrations/20260712124959_r09_stats_advanced.sql`
- `supabase/rollbacks/20260712124959_r09_stats_advanced.down.sql`
- `supabase/tests/r09_stats_advanced.sql`
- `schema.sql`
- `future-todo.md`, `docs/roadmap/README.md`, `docs/roadmap/phase-2-execution-prompt.md`

## Pencil SSOT
- 기존 통계 화면을 `통계 페이지 (R-09 이전)`으로 보존하고 재사용 KPI component `UJyM5`를 추가했습니다.
- 기본 `e0g4Gi`, 기간 선택 `sNWZW`, loading `JEqvV`, error/retry `t7WjbV`, empty `oqkpx`, 가격 부분 데이터 `sj5OP` 상태를 같은 `.pen`에 반영했습니다.
- 여섯 상태 모두 `snapshot_layout(problemsOnly)` 문제 0건입니다.
- Pencil 앱 저장 후 파일 SHA-1이 `b05e35508b88f5570f2b1ec1e41c85a31130e0de`에서 `be8ea7276aca5f792c63d19f627f1a41275d2356`으로 변경된 것을 확인했습니다.

## 로컬 검증 근거
- PostgreSQL 17 disposable DB 두 개에서 forward migration 11개 누적 경로와 `schema.sql` 경로를 각각 적용했습니다.
- 두 경로 모두 R-07, R-08, R-09 SQL 테스트를 통과했고 synthetic Auth/customer/service/appointment residue는 각 0건입니다.
- R-09 fixture는 completed/confirmed/cancelled × 양수/0/NULL, KST 시작 전·시작·종료·종료 후, 1회/2회 고객, 자유입력·연결 서비스 가격 NULL, 빈 분모, 역방향·366일 초과, owner/staff/profileless/anon/PUBLIC, 최소 JSON key를 검증합니다.
- `pg_dump` 공개 스키마 비교에서 객체 의미 차이는 없고 과거 `ALTER TABLE` 이력 때문에 발생한 세 테이블의 물리적 column order 차이만 남습니다.
- bundled Node `npm ci`는 audit 0, 환경변수를 포함한 `npm run build`는 warning/error 없이 통과했습니다.
- Playwright mock에서 390×844와 360×800 기본/기간/부분 데이터, error/retry, empty, loading을 확인했습니다. 날짜 입력 중 RPC POST 0회, 적용 시 POST 1회를 확인했습니다.
- production-mode local PWA에서 SW active/controller, manifest standalone, 192/512 icon과 offline 문서 200, 임의 미캐시 URL offline fallback, console error/warning 0건을 확인했습니다.
- Supabase API는 기존 `NetworkOnly` 규칙을 유지하며 SW/cache 전략을 변경하지 않았습니다.

## 스크린샷
- before: `output/playwright/r09-stats/20260712_stats_before_390x844.png`
- after: `output/playwright/r09-stats/20260712_stats_after_390x844.png`
- Android: `output/playwright/r09-stats/20260712_stats_after_360x800.png`
- period/error/empty/loading 상태도 같은 디렉터리에 보관하며 Git에는 stage하지 않습니다.

## Rollback
- 애플리케이션은 이 변경 commit을 revert합니다.
- DB는 `supabase/rollbacks/20260712124959_r09_stats_advanced.down.sql`을 수동 검토 후 실행해 grant를 회수하고 함수만 drop합니다. 데이터 변경·backfill이 없어 row rollback은 없습니다.

## Release gate 및 남은 리스크
- Draft PR checks와 migration diff를 먼저 확인한 뒤 main merge, live migration, Production deploy 순서로 진행합니다.
- live 적용 전까지 live DB migration은 기존 10개이며 RPC는 존재하지 않습니다. Preview Supabase 격리는 문서 충돌로 `확인 필요`이고 Preview 실데이터 smoke는 금지합니다.
- Production/Preview 테스트 고객·예약은 생성하지 않습니다. live 후에는 migration version, 함수 catalog/ACL과 canonical 공개/PWA 자산만 비식별·비변경 방식으로 확인합니다.
- 실기기 install/standalone/SW update는 기존 R-06 후속 운영 범위로 유지합니다.
