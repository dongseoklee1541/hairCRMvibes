# Next Execution Prompt

R-09 Production 완료 뒤 다음 우선순위인 R-10 권한관리 UI의 계획을 시작할 때 사용합니다.

```text
/goal R-10 권한관리 UI(직원 초대·역할 변경)의 현재 Auth/profile 운영 경계를 조사하고 안전한 설계 대안을 제시합니다. 첫 응답은 AGENTS.md 형식의 Implementation Plan만 작성하고 승인 전에는 파일·Git·Supabase·Vercel·Pencil을 변경하지 않습니다.

읽기 전용 착수 디렉터리:
- /Users/idongseog/workspace/hairCRMvibes

반드시 먼저 읽기:
- AGENTS.md
- future-todo.md
- docs/roadmap/README.md
- docs/roadmap/R-01-rls-policy.md
- docs/roadmap/R-09-stats-advanced.md
- docs/operations/local-keychain-secrets.md
- schema.sql
- supabase/migrations/**
- components/AuthProvider.js
- components/AuthGate.js
- app/settings/**

현재 release 기준:
- R-09 PR #20 merge `main@b63f9a3771409776593c6ad61727e24c68082186`
- Supabase exact migration 11개, 최신 `20260712124959_r09_stats_advanced`
- R-09 live RPC는 owner/staff 동일 read, anon/PUBLIC 차단
- Production deployment `dpl_FBDsYn26v2ZXiJthe5z97vsJDwk2` READY/canonical 연결
- 신규 Auth 사용자는 profile 자동 생성이 없고 운영 절차에서 `profiles(id, role)`을 명시적으로 만들어야 함
- Preview Supabase 격리는 `확인 필요`; 확인 전 Preview 로그인·실데이터 smoke 금지

Plan에서 최소 두 대안을 비교하세요:
1. Supabase Admin API를 server-only route에서 사용하는 초대/역할 변경 방식
2. Dashboard/운영 절차를 유지하고 앱은 profile 역할 관리만 제공하는 방식

반드시 결정할 항목:
- owner만 초대·역할 변경 가능한 DB/API 경계와 자기 강등·마지막 owner 보호
- service-role secret의 browser 번들/로그/응답 비노출
- Auth user와 profiles 생성 실패의 원자성·보상·재시도
- 이메일 초대 링크, 만료, 중복 초대, 탈퇴/비활성화의 범위
- SECURITY DEFINER가 필요할 때 auth.uid role 검사, 빈 search_path, PUBLIC/anon 회수
- 개인정보 최소 표시, audit log, loading/error/empty/forbidden 상태
- Pencil 선반영, SQL role fixture, owner/staff/anon, 390×844·360×800, PWA NetworkOnly 회귀

Non-Goals:
- R-01~R-09/R-13 재구현
- Preview/Production 테스트 계정 생성
- 실제 직원 초대·권한 변경을 승인 없이 실행
- Keychain/Vercel env 변경
- 기존 미추적 산출물 정리

최신 `origin/main`과 열린 PR/worktree/병행 세션을 읽기 전용으로 재확인하고, 승인 후에만 `codex/r10-role-management` clean worktree를 만듭니다.
```
