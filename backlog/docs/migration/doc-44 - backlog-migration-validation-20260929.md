---
id: doc-44
title: backlog-migration-validation-20260929
type: other
created_date: '2026-09-29 14:45'
updated_date: '2026-09-29 15:06'
---
# Backlog 전면 이관 검증 — 2026-09-30 00:04:24 KST

이관 시작: 2026-09-29 KST. 실제 최종 점검: 2026-09-30 00:04:24 KST. 원문 구현·검증일과 구분한다. 대상 local main/HEAD `b095a7546a16169b6706ab8b520b1e38c7776f14`, native 전환 작업 `TASK-26`.

## 실제 실행과 결과

| 명령/검사 | 결과 |
| --- | --- |
| npm view backlog.md version/dist-tags/bin/optionalDependencies/dist.integrity | 공식 npm latest 1.53.0 및 무결성·플랫폼 패키지 확인 |
| npm install --save-dev --save-exact backlog.md@1.53.0 --ignore-scripts --no-audit --no-fund | local devDependency 고정. 앱 production 의존성·다른 lock package 불변 |
| ./node_modules/.bin/backlog --version / npm run backlog -- --version | 1.53.0, npm 로컬 wrapper 실행 확인 |
| instructions overview/task-creation/task-execution/task-finalization, 관련 --help | 현재 설치 버전 공식 workflow·입력·읽기/쓰기 의미 확인 |
| python3 output/backlog-migration-20260929/verify.py | 원문·경로·상태/우선순위·관계·CLI·설정·diff 감사 통과; JSON 근거 연결 |
| task list/view --json, draft list/view, doc list/view/search, decision list, search --type task/document/decision --json | native 읽기·검색 정상. 미완료/완료·Draft·제안 구분 확인 |
| board view / board export | status 컬럼·26 tasks 정상; 날짜/버전이 있는 출력 스냅샷 생성 |
| doctor | duplicate ID/self dependency/cycle 없음 |
| git diff --check 및 새 backlog 파일의 git diff --no-index --check /dev/null <file> | 공백 검사 통과 |
| 합성 env npm run build | 별도 검증 worktree에서 exit 0, compile·static 15/15·PWA 생성 성공, 새 관련 경고 없음 |

최종 감사는 전체 원문 40개/445,606바이트, 코드 블록 24개, 표 행 390개를 `git show b095a7546a16169b6706ab8b520b1e38c7776f14:<원래 경로>`와 비교한다. 원문 payload는 Markdown destination 변경만 반영한 정확한 동일 본문이며 SHA-256도 확인했다. 신규 관리 링크·옛 heading anchor의 이동 안내·metadata docs/references를 확인했다. 이관한 원문의 상태표는 당시 기록이며 current task 상태를 수동 복제하지 않는다.

## build 환경과 재사용 범위

검증 worktree: `/Users/idongseog/.codex/worktrees/backlog-migration-checks/hairCRMvibes`. 기존 checkout의 Node/검증 프로세스와 .next/output을 보존하기 위해 관리 worktree 도구로 격리했다. build 입력 116개(앱·공통 코드·정적/SQL·Pencil 및 package/lock/config)를 루트와 hash 대조해 차이 0개를 확인했다. 루트의 기존 node_modules는 읽기 링크로 재사용했고 worktree .env/계정 파일은 복사하지 않았다.

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329 NEXT_PUBLIC_SUPABASE_ANON_KEY=backlog-migration-synthetic-key npm run build
```

빌드 뒤의 변경은 doc/task/decision 및 이관 감사 기록에 한정됐다. 앱 소스·package/lock·Next/PWA build 설정이 그대로라 통과한 build를 재사용한다. 기존 사용자 서버를 종료하지 않았고 루트 .next·PWA 생성물을 덮어쓰지 않았다. 검증 worktree는 이 작업의 build snapshot이며 현재 작업 관리의 출처는 루트 main이다. worktree/branch 정리는 별도이며 이 요청에서는 제거/archival을 실행하지 않았다.

앱 로직/UI/DB 변경이 없어 npm test·브라우저·운영 smoke는 추가하지 않았다. 이관 원문의 과거 테스트·배포·실기기/역할 검증은 이번 새 실행이 아니다.

## 보존과 불확실성

루트의 기존 앱·Pencil·SQL·public·output·복구/검증 증거 3,334개 보호 파일은 SHA-256이 모두 동일하고 기존 미추적 파일도 모두 남아 있다. main/HEAD는 바뀌지 않았다. 전역 설정·MCP·hook·계정·권한·DB·배포와 commit/push/PR/merge는 실행하지 않았다.

원문 literal 증거 경로 8개는 현재 checkout에 없고 과거 glob 1개는 미확인이다. 당시 위치·정보는 보존했다. R-11의 구현 제안 파일 4개는 보류이므로 의도적으로 생성하지 않았다. 새 Markdown 링크/앵커 오류와 이관 본문 누락·필수 검증 차단은 없다. R-10 실제 owner/staff·R-14 실제 관찰·다른 기능 운영 쓰기/부하 등은 기존 후속 미검증, R-11/모바일 로그인/실기기 IME/설치형 PWA는 기존 보류다. 현재 운영 상태를 이번 이관에서 재확인하지 않았다.

## 감사 산출물

- [40개 원문/ID/새 경로/원문·본문 hash manifest](../../../output/backlog-migration-20260929/source-manifest.json)
- [본문·링크·관계·CLI 감사 JSON](../../../output/backlog-migration-20260929/verification.json)
- [기존 증거·복구 보호 hash 검사](../../../output/backlog-migration-20260929/preservation.json)
- [원문 역사적 경로 미확인/제안 분류](../../../output/backlog-migration-20260929/historical-path-audit.json)
- [격리 npm build 전체 로그](../../../output/backlog-migration-20260929/build.log)
- [CLI 생성 최종 보드 스냅샷](../../../output/backlog-migration-20260929/board-final-20260930.md)

관리/복구 원칙과 전체 이관표: [doc-43](doc-43%20-%20backlog-migration-20260929.md), [doc-41](../operations/doc-41%20-%20backlog-workflow.md)

## checkout 범위 실제 확인

remote/checkActiveBranches를 끈 같은 로컬 binary로 TASK-26을 두 cwd에서 조회했다. 루트 main은 Done, 동일 HEAD의 격리 worktree(detached HEAD)는 복사 당시 In Progress를 반환했다. 다른 worktree의 미커밋 상태가 자동 합쳐지지 않고 cwd가 조회 원본을 결정함을 확인했다. current 상태의 원본은 루트 main이며 격리 worktree는 빌드 스냅샷이다. [실제 조회 JSON](../../../output/backlog-migration-20260929/worktree-scope.json)을 보존했다.
