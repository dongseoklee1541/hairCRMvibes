# Phase 2 Execution Prompt

아래 프롬프트는 R-13 merge 이후 R-09 통계 고도화를 별도 작업으로 시작할 때 사용합니다.

```text
/goal R-08 Production과 R-13 merge 근거를 재확인하고 R-09 통계 고도화의 데이터·권한·KST 집계 계약을 확정한 뒤 구현합니다. R-06~R-08과 R-13은 재구현하지 않습니다.

읽기 전용 착수 디렉터리: /Users/idongseog/workspace/hairCRMvibes

반드시 먼저 읽으세요.

- AGENTS.md
- future-todo.md
- docs/roadmap/README.md
- docs/roadmap/R-06-pwa-completion.md
- docs/roadmap/R-07-customer-edit-delete-dedupe.md
- docs/roadmap/R-08-service-master.md
- docs/roadmap/R-09-stats-advanced.md
- docs/roadmap/R-13-appointment-customer-search-quick-create.md
- docs/operations/supabase-free-keepalive.md
- docs/operations/local-keychain-secrets.md

2026-07-12 release 기록은 다음과 같지만, 시작할 때 GitHub·Supabase·canonical public endpoint에서 읽기 전용으로 재확인하세요.

- R-08 PR #16은 merge됐고 애플리케이션 release는 `main@01440b6c4e3386c26a60ba786dacc90fa6d95223`입니다.
- R-13은 `origin/main@bbcb47b` 기준 clean branch에서 이름 combobox·R-07 공통 빠른 등록·예약 draft 보존을 구현하고 local mock/Pencil/PWA 검증을 완료했습니다. 시작 시 R-13 PR merge SHA와 `main` 포함 여부를 재확인하고, 미포함이면 R-09를 시작하지 마세요.
- Supabase live migration은 local filename과 같은 `20260712093510_r08_service_master`를 포함한 10개입니다.
- live R-08 컬럼 4개, trigger 함수 3개, snapshot/default guard, FK/index, explicit grant/RLS를 확인했습니다.
- 기존 고객 5건·예약 7건·서비스 4건의 서비스 가격/default/service FK/price snapshot은 no-backfill 원칙에 따라 NULL로 유지됐습니다.
- `supabase/tests/r08_service_master.sql`을 live 단일 transaction에서 실행해 owner/staff/anon, 0원/NULL, snapshot 불변, hard delete, 상태 전환과 기본 서비스 guard를 검증했고 synthetic residue는 0건입니다.
- Vercel Production deployment `6N4gbJURzr8GX4omNErBZEA8VRzQ`가 성공했고 canonical 공개 route/PWA asset 200, Cron 무인증 401, 네 route의 R-08 bundle marker를 확인했습니다.
- Vercel connector 계정에서 대상 프로젝트가 보이지 않아 환경변수·Runtime log는 확인하지 않았습니다. Chrome fallback이나 설정 변경을 시도하지 마세요.
- 실제 로그인 owner/staff browser smoke와 Preview Supabase 격리는 후속 운영 검증이며 R-09 코드 착수의 blocker는 아닙니다.
- 기존 R-07/R-08 checkout과 모든 `.playwright-cli/`, `output/playwright/**`, `supabase/.temp/`, disposable DB 디렉터리는 삭제·이동·stage하지 마세요.
- R-13은 DB migration/RPC/RLS 및 R-09 지표 계약을 변경하지 않았습니다. 예약 고객 검색·빠른 등록을 재설계하거나 재구현하지 마세요.

첫 응답에서는 파일·Git index·브랜치·worktree·원격·DB·Vercel을 변경하지 말고 AGENTS.md 형식의 Implementation Plan만 제시하세요. 승인 후 최신 `origin/main`에서 `codex/r09-stats-advanced` branch와 별도 clean worktree를 만들고 아래 범위만 진행하세요.

Goals:
- 브라우저가 `appointments.*`와 고객명을 대량 조회해 집계하는 현재 `/stats` 구조를 aggregate RPC 또는 최소 권한 `security_invoker` view 기반으로 교체
- 사용자 선택 KST 시작일·종료일을 서버 집계 경계로 사용
- 매출, 유상 완료 예약 객단가, 가격 미설정 완료 예약 품질 지표, 재방문율을 문서 계약대로 구현
- owner/staff/anon 권한과 반환 column을 최소화하고 고객 이름·전화번호·메모·원본 예약 목록을 통계 응답에서 제외
- Pencil SSOT를 먼저 갱신하고 390x844·360x800에서 loading/error/empty/partial-quality 상태를 검증

Metric contract:
- 매출: `status='completed' AND price_snapshot_krw IS NOT NULL`만 합산. 0원은 합계에 포함하되 유상 객단가에서는 제외
- 객단가: `status='completed' AND price_snapshot_krw > 0`인 유상 완료 예약 매출 합계 / 해당 예약 건수
- 가격 미설정: completed이면서 `price_snapshot_krw IS NULL`인 건수와 비율을 별도 표시하고 추정 backfill 금지
- no-show: 현재 상태에 없으므로 신설하거나 임의 집계하지 않음
- 재방문율 권장안: 선택 KST 기간 내 완료 예약 고객 중 같은 기간 완료 예약 2건 이상 고객 비율. 첫 방문 제외·관찰 기간은 사업 결정 사항으로 명시
- 시술별 집계: 예약 당시 text `service`와 `price_snapshot_krw` snapshot 기준. 현재 master 이름·가격으로 과거 재분류 금지

Implementation decisions required in Plan:
1. aggregate RPC 권장안과 `security_invoker` view 대안 비교
2. owner 전용 매출인지 owner/staff 공통인지 권한 매트릭스 확정
3. KST inclusive date 범위와 empty denominator 처리
4. SQL fixture에서 completed/confirmed/cancelled × 양수/0/NULL 가격, 재방문 0/1/2회 경계 검증
5. PUBLIC·anon execute 회수, `auth.uid()`/role 검사, 고정 `search_path`, 최소 반환 column 검증
6. 현재 `/stats` raw query 제거와 mobile UI/Pencil before-after 검증
7. migration/schema/rollback 동기화, fresh replay, R-07/R-08 회귀, build/PWA/cache 검증

Non-Goals:
- 기존 서비스·예약 가격 또는 service_id 추정 backfill
- no-show 신설, 할인/쿠폰/부가세/환불/원가/이익/다중통화
- 고객별 원본·이름·전화번호·메모를 통계 API/UI에 제공
- R-08 서비스 마스터 재구현 또는 live 실데이터 변경
- Preview/Production 환경변수·Keychain·Vercel 설정 변경

문서와 실제 근거가 충돌하면 R-09를 구현하지 말고 blocker와 `확인 필요`를 먼저 SSOT에 기록하세요. stage/commit/push/PR/merge/live migration/deploy는 승인된 범위와 검증 gate를 분리하세요.
```
