# Phase 2 Execution Prompt

아래 프롬프트를 새 Codex 세션에서 그대로 사용합니다.

```text
/goal 완료된 R-06/R-07을 재구현하지 않고, 검증된 최신 main에서 R-08 서비스 마스터 구현 준비를 시작합니다.

작업 디렉터리: /Users/idongseog/workspace/hairCRMvibes

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

2026-07-12 문서 감사 기준 참고값은 다음과 같지만, 시작할 때 모두 읽기 전용으로 재확인하세요.

- Production 애플리케이션 release: main@16157f89976e41f5218377712d5d77026bc14417
- 최신 문서 포함 origin/main: 2f915c2e8f7ec7e736a6ee4c315caa03113416ab
- GitHub PR #9~#14 merge, 열린 PR 0건
- Supabase migration version 9개, R-07 RPC 7개와 audit table 2개 확인
- R-06: 기능·Production 공개 자산 smoke Done, 실기기 install/standalone/SW update 대기
- R-07: Production DB·애플리케이션 release Done, post-deploy authenticated browser 재검증 대기

위 SHA와 상태를 고정된 현재값으로 가정하지 마세요. GitHub remote main, 열린 PR, 현재 checkout, 다른 활성 Codex 세션을 다시 확인하세요.

안전 경계:

- 현재 checkout이 오래된 R-07 브랜치이고 `.playwright-cli/`, `output/playwright/**`, `supabase/.temp/`가 남아 있으면 삭제·이동·stage하지 마세요.
- 최신 remote main SHA를 확인하고, 승인 후 그 SHA의 `origin/main`에서 새 `feature/r08-service-master` 브랜치와 clean worktree를 만드세요. 승인 전에는 브랜치/worktree를 생성·전환하지 마세요.
- 다른 세션이 같은 checkout이나 DB/Vercel을 변경 중이면 이 세션은 읽기 전용 준비만 하고 충돌 가능 작업을 중단하세요.
- Preview Supabase 환경은 기존 공유 기록과 env 제거 인계 기록이 충돌해 현재 `확인 필요`입니다. 설정이 직접 확인되기 전 Preview 로그인·실데이터 smoke를 하지 마세요.
- Production/Preview 환경변수, Keychain, Vercel 설정, 실제 고객·예약 데이터는 별도 승인 없이 조회·변경하지 마세요.

이번 첫 작업의 목표는 R-08 구현 준비입니다.

1. R-01~R-07은 완료 근거와 남은 운영 검증만 읽고 재구현하지 않습니다.
2. 현재 `salon_service_defaults`, 예약 생성/수정 writer, `appointments.service`와 `duration_minutes`, RLS/grant를 조사합니다.
3. docs/roadmap/R-08-service-master.md의 데이터 계약이 실제 코드/schema와 맞는지 검증합니다.
4. clean worktree/브랜치 생성까지 포함한 AGENTS.md 형식의 Implementation Plan을 제시하고 명시적 승인을 기다립니다.
5. 승인 전에는 migration, schema.sql, 코드, UI, `.pen`, 문서, 브랜치, worktree 또는 다른 Git 상태를 수정하지 않습니다.
6. 승인 후 최신 `origin/main`에서 clean worktree와 R-08 브랜치를 만든 뒤 승인된 구현 범위만 진행합니다.

R-08 Implementation Plan에는 반드시 다음을 포함하세요.

- 기존 `salon_service_defaults` 확장을 기본 권장안으로 하고, 신규 `services` 테이블은 독립 lifecycle/권한 요구가 입증될 때만 대안으로 비교
- `price_krw`와 `price_snapshot_krw`는 정수 KRW이며 할인/부가세/다중통화는 범위 밖
- 예약의 nullable `service_id`, `price_snapshot_krw`와 기존 `service`, `duration_minutes` snapshot 유지
- 기존 예약의 서비스 ID·가격 추정 backfill 금지와 NULL 보존
- 참조된 서비스 hard delete 금지, `is_active=false` 비활성화와 FK RESTRICT
- 서비스 변경 시에만 snapshot을 갱신하고 무관한 예약 수정은 기존 snapshot을 유지하는 정책
- DB trigger 기반 snapshot 강제와 전용 RPC + direct write 회수 방식의 장단점 및 선택 게이트
- owner/staff read·manage 권한, 비활성 서비스 조회, Data API grant와 RLS 경계
- migration과 schema.sql 동기화, fresh replay, 기존 예약 보존 검증
- UI 변경 시 기존 pencil-hairshopcrm.pen SSOT 선반영과 390x844·360x800 before/after 검증

R-09는 R-08 완료 후 별도 브랜치·별도 Plan으로만 진행하세요. 구현 전 아래 계약을 유지하세요.

- 매출: completed이면서 price_snapshot_krw가 설정된 예약만 합산
- 객단가: price_snapshot_krw > 0인 유상 완료 예약 기준
- 가격 미설정 완료 예약: 추정하지 않고 별도 데이터 품질 count/rate
- 현재 없는 no-show 상태를 임의 집계하지 않음
- 재방문율 권장안: 선택 KST 기간 내 완료 예약 고객 중 같은 기간 완료 예약 2건 이상 고객 비율. 사업 결정 사항으로 표시
- 브라우저에서 appointments 원본과 고객명을 대량 조회하지 않고 aggregate RPC 또는 security_invoker view, 최소 권한, KST 기간 경계를 사용

각 작업의 검증과 문서화:

- 저장소에 존재하는 script만 사용하고 bundled Node가 필요하면 명시합니다.
- DB 변경은 disposable fresh replay와 schema.sql semantic 비교를 수행합니다.
- owner/staff/anon, snapshot 불변성, 비활성 서비스, FK RESTRICT, NULL 가격 보존을 검증합니다.
- `git diff --check`, 승인 파일 allowlist, secret/개인정보 리터럴 검사를 수행합니다.
- 각 R 작업 완료 후 future-todo.md, docs/roadmap/README.md, 해당 R-xx 문서의 상태·근거·후속 검증을 함께 갱신합니다.
- stage/commit/push/PR/merge/deploy 및 live migration은 각각 별도 명시적 승인 전까지 수행하지 않습니다.
- 최종 보고는 AGENTS.md Result Report Format을 따릅니다.
```
