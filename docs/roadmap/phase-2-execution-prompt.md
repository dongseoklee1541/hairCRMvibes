# Phase 2 Execution Prompt

아래 프롬프트는 R-09 local 구현 완료 뒤 PR·live migration·Production release를 이어갈 때 사용합니다.

```text
/goal R-09 `codex/r09-stats-advanced`의 local 검증 근거를 재확인하고 Draft PR checks와 migration diff를 먼저 보고한 뒤 main merge, 11번째 live migration, Production deploy와 canonical 공개/PWA smoke를 완료합니다.

작업 디렉터리:
- /Users/idongseog/workspace/hairCRMvibes-r09-stats-advanced

반드시 먼저 읽기:
- AGENTS.md
- future-todo.md
- docs/roadmap/README.md
- docs/roadmap/R-09-stats-advanced.md
- supabase/migrations/20260712124959_r09_stats_advanced.sql
- supabase/rollbacks/20260712124959_r09_stats_advanced.down.sql
- supabase/tests/r09_stats_advanced.sql

현재 local 근거:
- 기준 `origin/main@a360cea279abd250670dfd47ca6e8cd213b7131c`, branch `codex/r09-stats-advanced`
- SECURITY INVOKER aggregate RPC, owner/staff 동일 집계, anon/PUBLIC 차단, 최대 366일 inclusive KST 기간
- forward migration 11개와 schema.sql 양 경로 R-07/R-08/R-09 SQL 회귀 통과, fixture residue 0건
- Pencil 6개 상태 layout 0건과 disk hash 변경
- build, 390×844·360×800 UI, production-mode PWA/offline 통과
- Preview Supabase 격리는 `확인 필요`; Preview/Production 테스트 고객·예약 생성 금지

순서:
1. branch diff와 commit allowlist를 재확인하고 output/playwright, 기존 worktree 산출물, secrets를 stage하지 않습니다.
2. commit/push/Draft PR 후 required checks와 migration diff를 먼저 보고합니다.
3. checks가 성공하고 diff가 승인 범위와 일치할 때만 ready/merge합니다.
4. merge 후 live migration 10개 기준선을 재확인하고 `20260712124959_r09_stats_advanced`만 적용합니다. backfill/destructive SQL은 실행하지 않습니다.
5. live catalog에서 함수 signature, SECURITY INVOKER/STABLE/빈 search_path, authenticated EXECUTE, anon/PUBLIC 차단을 비식별 조회로 확인합니다.
6. synthetic fixture는 Production에 만들지 않습니다. 실제 고객·예약 row를 출력하지 않습니다.
7. Vercel main deployment를 확인하고 필요 시 정확한 merge SHA deployment만 Production으로 승격합니다.
8. canonical route/login/manifest/SW/offline/icon/Cron 무인증 경계를 비변경 smoke하고 roadmap을 실제 release 근거로 갱신합니다.

PWA cache 전략, Preview/Production 환경변수, Keychain, 고객·예약 실데이터는 변경하지 않습니다. 막히면 상태를 과장하지 말고 `확인 필요` 또는 blocker로 기록합니다.
```
