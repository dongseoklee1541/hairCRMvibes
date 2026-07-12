# Phase 2 Execution Prompt

아래 프롬프트는 R-08 release candidate의 draft PR 통합·release 준비를 새 Codex 세션에서 이어갈 때 사용합니다.

```text
/goal codex/r08-service-master와 연결된 open draft PR을 재감사하고 merge-ready 여부를 확정합니다. R-09는 착수하지 않습니다.

작업 디렉터리: /Users/idongseog/workspace/hairCRMvibes-r08-service-master

반드시 먼저 읽으세요.

- AGENTS.md
- future-todo.md
- docs/roadmap/README.md
- docs/roadmap/R-06-pwa-completion.md
- docs/roadmap/R-07-customer-edit-delete-dedupe.md
- docs/roadmap/R-08-service-master.md
- docs/roadmap/R-09-stats-advanced.md
- docs/operations/supabase-free-keepalive.md
- docs/operations/local-keychain-secrets.md

2026-07-12 인계 기준은 다음과 같지만, 시작할 때 읽기 전용으로 재확인하세요.

- PR #15는 merge됐고 최신 origin/main은 a7a4186e76c9225c9273fa8474cea27440d36d40입니다.
- Production 애플리케이션 release는 여전히 main@16157f89976e41f5218377712d5d77026bc14417입니다. PR #14/#15는 문서 변경이므로 구분합니다.
- R-08 branch는 codex/r08-service-master이며 위 origin/main SHA에서 만든 clean worktree입니다.
- R-08 branch의 commit·push·open PR 상태는 GitHub에서 읽기 전용으로 재확인하세요. 기존 worktree나 검증 산출물을 버리거나 새 branch/worktree로 다시 만들지 마세요.
- live Supabase migration은 9개입니다. 20260712093510_r08_service_master.sql은 로컬 10번째 후보이며 live에 적용하지 않았습니다.
- Production/Preview 배포, 환경변수 변경, 실제 로그인·고객·예약 데이터 smoke를 수행하지 않았습니다.
- Preview Supabase 격리는 기존 공유 기록과 env 제거 인계가 충돌해 계속 확인 필요입니다.

현재 R-08 로컬 구현 범위:

- salon_service_defaults.price_krw nullable integer KRW; NULL과 0원 구분
- salon_operation_settings.default_service_id nullable active-service FK; 이름 추정 backfill 없음
- appointments.service_id, price_snapshot_krw nullable snapshot 컬럼; 기존 service/duration_minutes 유지
- DB BEFORE trigger 기반 이름·가격 snapshot, 활성 서비스, 연결 해제, 신규 상태, 기본 서비스 invariant 강제
- owner create/update/deactivate/reactivate, staff read, authenticated hard delete 차단, anon 차단
- 설정·새 예약·예약 수정·고객 완료 이력 UI와 pencil-hairshopcrm.pen 4개 R-08 frame
- migration, 수동 rollback, schema.sql, supabase/tests/r08_service_master.sql
- future-todo.md와 roadmap SSOT의 local verified/release pending 경계

로컬 검증 인계:

- PostgreSQL 17에서 migration 10개 fresh replay, R-07/R-08 smoke, rollback/reapply 통과
- migration 1~9에 synthetic legacy fixture를 넣은 뒤 10번째 후보를 적용해 서비스/가격/default FK 무추정 backfill 확인
- migration DB와 schema.sql fresh DB public catalog semantic diff 0
- 기본값 변경과 서비스 비활성화의 2-session 경쟁을 양쪽 선행 순서로 각 3회 실행해 FINAL_INVARIANT_OK 확인
- bundled Node npm run build 성공, lint/typecheck script는 없음
- 합성 Auth/Data API만 사용한 Production 모드 Playwright 390x844/360x800 smoke와 console 0건
- 360px 달력 day cell 44x44 실측
- PWA service worker active, offline fallback, manifest/SW/offline/icons 200, 민감 document/data cache 0건
- Pencil R-08 frame 4개 layout problem 0건과 .pen hash 변경

안전 경계:

- 기존 R-07 checkout과 모든 worktree의 .playwright-cli/, output/playwright/**, supabase/.temp/를 삭제·이동·stage하지 마세요.
- 현재 R-08 worktree의 새 Playwright/Pencil 산출물도 검증 근거이므로 정리하지 마세요. stage 대상은 명시적으로 allowlist를 확정합니다.
- 다른 세션이 같은 R-08 worktree를 변경 중이면 쓰기를 중단하고 충돌 여부부터 확인하세요.
- Preview/Production 환경변수, Keychain, Vercel 설정, live DB, 실제 고객·예약 데이터에 접근하거나 변경하지 마세요.
- R-06/R-07을 재구현하지 말고 R-09 기능·aggregate RPC/UI를 시작하지 마세요.

첫 응답에서는 파일·Git index·원격·DB·Vercel을 변경하지 말고 AGENTS.md 형식의 Implementation Plan만 제시하세요. Plan에는 다음을 포함하세요.

1. 현재 git status/diff, open draft PR, origin/main base와 PR head SHA를 확인하는 방법
2. migration/schema/rollback/RLS/trigger/writer 계약 재리뷰와 no-backfill 근거 확인
3. fresh replay, R-07/R-08, rollback/reapply, schema semantic diff 재현 범위
4. build, 390x844/360x800, PWA/offline/cache, Pencil persistence 재확인 범위
5. SSOT의 release candidate·integration/live pending과 live 9개 경계를 유지하는 방법
6. PR review/merge, live migration, Production deploy를 서로 분리하는 승인·rollback 계획
7. R-08 Production 완료 전 R-09 미착수를 유지하는 방법

문서와 구현의 불일치를 발견하면 local verified를 유지하지 말고 사실대로 In Progress와 blocker를 기록하세요.
PR merge/live migration/Production deploy는 각각 승인된 범위 밖에서 실행하지 마세요.
```
