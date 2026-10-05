---
id: doc-41
title: backlog-workflow
type: guide
created_date: '2026-09-29 14:45'
updated_date: '2026-10-02 06:50'
---
# Backlog.md 작업·문서 관리 절차

2026-09-29 KST부터 Backlog.md가 이 저장소의 유일한 작업·설계·검증·운영 문서 관리 체계다. 현재 상태·우선순위·다음 행동은 native task/Draft만 갱신한다. 기존 future-todo.md, docs/roadmap/, docs/operations/는 이동 안내이며 병행 편집과 세 문서 동기화는 종료됐다. AGENTS.md는 지속 안전·개발 규칙, README.md는 시작 안내이며 별도 작업 상태표를 두지 않는다.

## 읽기 순서와 로컬 명령

현재 요청과 목표 단위 승인 → 저장소 AGENTS.md → 이 절차 → CLI overview 및 해당 생성/실행/완료 guide → 기존 task 검색·조회 → 연결 doc/decision/Draft → 현재 branch/HEAD/diff/worktree/package.json·필요한 환경을 확인한다. 관련 없는 전체 조사·운영 smoke를 다시 시작하지 않는다.

명령은 저장소 루트에서 프로젝트에 고정한 CLI로 실행한다. 전역 설치와 MCP 등록은 필요하지 않다. `npm run backlog -- ...`는 npm이 로컬 binary를 사용하며, JSON 파싱에는 npm의 banner가 없는 `./node_modules/.bin/backlog`를 사용한다.

```bash
npm run backlog -- --version
npm run backlog -- instructions overview
npm run backlog -- instructions task-creation
npm run backlog -- instructions task-execution
npm run backlog -- instructions task-finalization
npm run backlog -- search R-10 --plain
npm run backlog -- task view TASK-10 --plain
npm run backlog -- task list --exclude-status Done --plain
npm run backlog -- draft list --plain
npm run backlog -- doc list --plain
npm run backlog -- decision list --plain
npm run backlog -- board
./node_modules/.bin/backlog task list --json
```

## 작성과 갱신

- task: 제목에 원래 R ID를 보존하고 상태·P0/P1/P2·완료 기준·dependency·문서/결정 references를 기록한다. 현재 작업의 실행 계획은 `--plan`, 진행·검증·미검증·보류·차단·다음 행동은 `--notes`/`--append-notes`, 완료한 범위와 증거는 `--final-summary`에 남긴다. 담당이 불명확하면 비워 둔다. 원문 내용 전체를 거대한 task 본문으로 붙이지 않는다.
- doc: 기능 계약·상세 설계·검증/배포 근거·관찰 프로토콜·감사/release 이력을 유지한다. 날짜·commit·환경·PR·CI·배포 ID·명령/결과·증거 링크와 검증 한계를 기록한다. 문서의 과거 상태표는 날짜가 있는 불변 스냅샷이며 현재 상태를 수동 복제하지 않는다.
- decision: 확정 선택은 `accepted`, 제안·미결정은 `proposed`로 구분하고 실제 결정 날짜·근거·비교 대안·이유·제약을 남긴다. 구현/발송/운영 승인은 결정 채택과 별개다. 원문에 대안이 없으면 미기록이라고 쓰며 새 대안을 과거 사실로 만들지 않는다.
- 운영 문서: backlog/docs/operations/의 native doc를 반복 실행·검증·복구 절차로 사용한다. 방법을 개선하고 효과를 검증했다면 해당 doc의 현재 절차와 명령을 갱신하고 날짜·대상·근거를 남긴다. 일회성 결과는 작업 notes와 evidence doc에 기록한다. 예전 위치에는 본문·체크리스트를 다시 작성하지 않는다.
- Draft: 미승인 사용성 후보 3개를 backlog/drafts/에 유지한다. 등록은 구현 승인이나 R 번호 예약이 아니다. R-14 실제 관찰 뒤 필요한 후보만 별도 승인으로 승격하며 그 시점의 다음 R 번호를 부여한다.

지원 명령을 우선한다. `task create/edit`, `draft create/edit`, `doc create/update`, `decision create`의 정확한 옵션은 `--help`로 확인한다. 1.53.0은 decision 본문/메타데이터 update 명령이 없다. decision create로 ID·frontmatter를 만든 뒤 본문만 일반 파일 편집으로 작성하며 ID·원래 날짜·상태를 보존하고 diff/재조회한다. 상태·우선순위 list와 onStatusChange도 config set을 지원하지 않아 프로젝트 config.yml의 해당 키만 편집한다. task/doc 메타데이터는 직접 편집하지 않는다.

```bash
npm run backlog -- task create 'R-XX 작업명' --priority P1 -a '' --ac '검증 가능한 완료 기준' --doc 'backlog/docs/관련-문서.md'
npm run backlog -- task edit TASK-17 --append-notes '날짜·환경·결과·남은 범위·다음 행동'
npm run backlog -- doc create '반복 검증 절차' -p operations -t guide
npm run backlog -- doc update doc-ID --content '새 문서 전체 본문'
npm run backlog -- decision create '비교한 선택' -s proposed --plain
npm run backlog -- task create '미승인 후보' --draft -a '' --ac '승격 판단 기준'
```

예제의 TASK/R/path는 설명용 placeholder다. 실제 ID/경로는 조회 결과를 사용한다. 여러 줄은 실제 newline이 있는 argument나 shell=False subprocess argv로 전달하며 literal backtick·달러 기호가 shell에서 실행되지 않게 한다. npx의 원격 다운로드나 다른 이름의 backlog 패키지를 사용하지 않는다.

## 상태·우선순위·승인 의미

| 값 | 의미 |
| --- | --- |
| To Do | 범위·검토·계획 대기. 등록만으로 착수 승인 없음 |
| In Progress | 현재 승인된 작업 진행, 필수 완료 조건이 남음 |
| Waiting Validation | 구현/준비와 별도로 특정 검증·관찰 대기. 실행 승인은 대상별 확인 |
| On Hold | 사용자 보류 또는 재개 조건 대기. design-ready label과 함께 설계 완료·구현 보류 표현 가능 |
| Blocked | 접근·정보·결정 부족으로 특정 단계 수행 불가. 원인·대체 범위·필요 조치 기록 |
| Done | task에 명시한 완료 범위의 증거 있음. 독립 후속·실기기·역할별 검증을 통과했다는 뜻 아님 |
| Draft | 미승인 후보. 현재 승인된 작업 목록과 분리 |
| 미검증 / 확인 필요 | 상태와 별개로 항목별 근거가 없음/오래됨/상충함을 notes에 명시 |

P0는 보안·데이터 보호·예약 운영 연속성/중단 위험, P1은 운영 효율·사용성·통계·일관성, P2는 확장·자동화·관리 편의다. config priorities는 [P0, P1, P2] 순서이며 CLI frontmatter/JSON은 p0/p1/p2 소문자로 정규화한다. 의미·상대 순서는 보존한다. 우선순위·담당·의존관계와 CLI `isReady`는 실행 승인·보류 해제가 아니다. 마지막 configured status Done만 native terminal이다.

작업 등록·계획·기록은 승인을 발명하지 않는다. 사용자가 대상·환경·변경·영향을 특정해 승인한 목표의 통상적인 준비·구현·검증·보고는 단계별 재승인 없이 끝까지 수행한다. 공식 workflow의 review checkpoint나 'Follow-up Work' 문구를 이미 승인된 이관/등록 목표의 재승인 의무로 확대하지 않는다. 새 고영향 결정·데이터/권한/비용/게시/배포 범위 확대·파괴적 삭제와 명시적 보류만 기존 AGENTS.md에 따라 별도로 판단한다. 등록한 후속 작업을 자동 실행하지 않는다.

## 완료 범위와 역사적 근거

원래 R ID는 기능 식별자, TASK ID는 native 기록 식별자다. 이관표가 양자를 연결한다. R-10 구현·배포·권한 검증 기록과 실제 owner/staff, R-14 구현과 대표 사용자 관찰을 별도 task로 나눴다. 기본 구현의 Done과 독립 후속의 Waiting Validation은 함께 읽는다. R-11은 설계 완료·구현 보류, 모바일 로그인·실기기 IME·설치형 PWA는 사용자 보류, 후보는 Draft를 유지한다.

이관일/CLI created_date는 2026-09-29이며 실제 구현/검증일과 다르다. 과거 commit·환경·PR/CI/배포·명령을 새 실행 기준으로 복사하지 않는다. 상충은 최신 직접 근거로 교정하고 못 확인하면 확인 필요로 남긴다. 과거 remote/authentication 실패·미배포가 더 최신 완료 근거로 해결됐는지 구분한다. 이번 전환에서 원격 상태·보류 작업·앱 UI·DB를 재검증하지 않았다.

Done task는 현재 terminal 컬럼에 유지한다. 주기 정리를 명시적으로 요청할 때 `task complete`는 completed/로 이동하며 task list/board에서 제외될 수 있다. `task archive`는 취소/중복/무효 작업용이며 dependency/reference를 제거하므로 완료 기록 보존에 사용하지 않는다. 이번 이관은 완료 task를 archive/complete하거나 worktree/branch를 정리하지 않았다.

## branch·worktree 출처

```bash
pwd
git branch --show-current
git rev-parse HEAD
git status --short
git worktree list --porcelain
npm run backlog -- config list
```

이 프로젝트는 remote_operations=false와 check_active_branches=false로 현재 checkout 파일을 기준으로 조회한다. CLI task list/search와 task view, board는 현재 checkout의 작업을 읽으며 completed store는 상세 dependency 해석에 포함되고 drafts/archives는 active 목록에서 제외된다. doc list/view/search는 현재 checkout의 backlog/docs를 읽는다. 설정을 바꿔 cross-branch 조회를 켜면 보드/웹의 다른 branch 표시 및 최신 상태 해석이 현재 editable 파일과 다를 수 있다.

1.53.0 공식 소스의 task-loader는 다른 local branch와 remote commit tree/blob에서 작업을 읽는다. 이것은 다른 worktree의 미커밋 파일을 실시간 통합하는 기능이 아니다. 원격 작업을 꺼도 cross-branch를 켜면 다른 local branch가 포함될 수 있다. JSON read contract는 branch metadata를 노출하지 않으므로 출력만 보고 출처를 추정하지 않는다. 먼저 cwd·branch·HEAD·config를 함께 기록하고, 다른 worktree의 미커밋 상태는 해당 절대 경로로 이동해 그 checkout의 로컬 CLI를 별도 실행한다. 다른 checkout으로 수정 결과를 임의 복사하지 않는다.

공통 Git 디렉터리의 .git/backlog.md/locks는 CLI 생성 동시성 잠금이다. 동일 clone의 linked worktree가 ID 생성 잠금을 공유하며 task 편집 잠금은 파일 경로 단위다. 잠금 때문에 sandbox가 막히면 정식 도구 권한 검토를 사용하고 잠금을 끄거나 hook/전역 권한을 바꾸지 않는다. 기존 병렬 작업·Pencil 단독 편집·서버 포트/출력 분리는 계속 AGENTS.md를 따른다.

## 검증·배포 결과 기록

task notes에는 실행일·branch/HEAD·대상 환경·명령·실제 결과·증거 링크·미검증·보류·차단·다음 행동을 기록하고, 상세 표/로그 해석/배포 결과는 연결 doc에 남긴다. 문서만 바뀌면 다시 읽기·diff·링크·명령·git diff --check, 설정/의존성 변경은 npm run build, 앱 로직 변경은 해당 필수 npm test, UI·PWA·DB는 AGENTS.md의 전용 검증을 적용한다. 이미 통과한 검사를 새 변경/실패/미해결 위험 없이 넓히거나 반복하지 않는다.

개선된 운영 방법은 검증 후 해당 backlog/docs/operations/ doc를 갱신한다. 지속 규칙 변경이 필요하면 AGENTS.md도 좁게 바꾸되 작업 상태를 복제하지 않는다. instruction 편집, 메모리 업데이트 요청, downstream 메모리 정리는 서로 다르며 사용자 요청 없는 전역 메모리 변경은 하지 않는다.

기존 안전·개인정보·합성 데이터·GitHub CLI 인증·Pencil SSOT·44px/두 viewport·PWA NetworkOnly·migration-first·배포/복구 규칙은 AGENTS.md 그대로 유지된다.

## 설정과 공식 근거

로컬 backlog.md 1.53.0을 devDependency에 정확히 고정했다. auto_commit=false, remote_operations=false, check_active_branches=false, bypass_git_hooks=false, auto_open_browser=false, default_assignee=[], onStatusChange=''이며 task별 callback도 없다. 기존 hook을 설치/수정/우회하지 않는다. production dependencies·전역 CLI/MCP/hook 설정을 변경하지 않는다.

공식 자료는 설치 버전 tag를 기준으로 확인했다: [README](https://github.com/MrLesk/Backlog.md/blob/v1.53.0/README.md), [CLI](https://github.com/MrLesk/Backlog.md/blob/v1.53.0/CLI-INSTRUCTIONS.md), [config](https://github.com/MrLesk/Backlog.md/blob/v1.53.0/ADVANCED-CONFIG.md), [branch/task loader](https://github.com/MrLesk/Backlog.md/blob/v1.53.0/src/core/task-loader.ts), [filesystem/locks](https://github.com/MrLesk/Backlog.md/blob/v1.53.0/src/file-system/operations.ts). CLI help와 instructions는 로컬 binary로 실제 확인했다.

관련 문서: [전체 탐색](../doc-42%20-%20backlog-catalog.md), [이관표](../migration/doc-43%20-%20backlog-migration-20260929.md)

## 이관의 구조화 점검 — 2026-10-02

문서 보존과 task/decision/후속 연결을 함께 대조한다. 기능 설명이 비어 있지 않은지, 완료 기준이 기능의 관찰 가능한 동작·권한·오류 조건을 담는지 확인한다. 완료 근거의 존재만으로 기능 기준을 대체하지 않는다. 체크한 기준마다 원래 검증일·환경·증거와 후속 미검증 경계를 연결한다.

원문의 확정 선택·비교 대안·이유·제약은 native decision과 관련 task에서 찾을 수 있어야 한다. 뒤에 바뀐 계약은 최신 결정/문서를 직접 연결하고 원래 계약은 날짜가 있는 이력으로 유지한다. 완료 구현 뒤의 독립 후속 조건은 기존 task 또는 별도 후속 task에 상태·의존관계·원문 근거를 연결하되 등록을 실행 승인으로 취급하지 않는다.

최초 이관의 output/backlog-migration-20260929/verify.py는 당시 task 상태와 결정 개수 등 고정 조건을 가진 일회성 감사다. 새 decision 추가를 누락으로 오인하지 않도록 현재 승인 변경 목록과 기준 시점을 함께 비교한다. 본문/ID/체크 개수 통과만으로 의미상 이관 완료를 판정하지 않는다.

검증된 보완 사례와 근거: [doc-46](../migration/doc-46%20-%20backlog-migration-repair-20261002.md)
