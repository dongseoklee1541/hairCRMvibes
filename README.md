# Hair CRM Vibes

미용실에서 고객, 예약, 영업시간, 휴무일, 시술 가격과 직원 권한을 관리하는 모바일 우선 Next.js 웹 서비스입니다.

## 기술 구성

- Next.js 15 App Router, React 19
- Tailwind CSS 4와 CSS Modules
- Supabase 데이터베이스·인증·RLS
- `@ducanh2912/next-pwa` 기반 PWA
- Outfit 글꼴과 Lucide 아이콘

## 시작하기

Node.js와 npm을 준비한 뒤 의존성을 설치합니다.

```bash
npm ci
```

루트에 `.env.local`을 만들고 Supabase 브라우저 환경변수를 설정합니다. 실제 값은 문서나 저장소에 기록하지 않습니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

개발 서버를 실행합니다.

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

## 사용 가능한 명령

```bash
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드와 PWA 산출물 생성
npm run start      # 빌드된 앱 실행
npm test           # Node 단위 테스트와 예약·고객 입력 회귀 테스트
npm run test:node  # 날짜·예약 규칙·CSV·표시 유틸 테스트
npm run test:race  # 예약 비동기 경쟁 상태·고객 금액 입력 회귀 테스트
```

현재 `lint`와 `typecheck` 전용 명령은 없습니다.

## 작업·문서 관리 시작하기

Backlog.md가 이 저장소의 유일한 작업·설계·검증·운영 문서 관리 체계입니다. `npm ci`가 정확히 고정한 `backlog.md@1.53.0` devDependency를 설치합니다. 전역 설치·MCP·hook 설정은 필요하지 않습니다.

```bash
npm run backlog -- instructions overview
npm run backlog -- task list --exclude-status Done --plain
npm run backlog -- search R-10 --plain
npm run backlog -- task view TASK-10 --plain
npm run backlog -- draft list --plain
npm run backlog -- doc list --plain
npm run backlog -- board
```

- 지속 안전·개발/검증 규칙: [AGENTS.md](./AGENTS.md)
- 작성·승인·보류·검증·branch/worktree 출처: [Backlog 작업 절차](backlog/docs/operations/doc-41%20-%20backlog-workflow.md)
- 정식 R ID와 task/doc/decision/Draft 탐색: [Backlog 인덱스](backlog/docs/doc-42%20-%20backlog-catalog.md)
- 전체 원문 연결·과거 상태·이관 근거: [이관표](backlog/docs/migration/doc-43%20-%20backlog-migration-20260929.md)
- UI 디자인 기준: `pencil-hairshopcrm.pen`
- DB 변경/현재 스키마: `supabase/migrations/`, `schema.sql`

읽기 순서는 AGENTS.md → Backlog 작업 절차/CLI guide → task 검색·조회 → 연결 doc/decision입니다. 현재 상태·우선순위·완료 기준·계획·진행/검증 메모·다음 행동은 task, 계약·설계·상세 검증/배포·관찰·감사 이력은 doc, 확정/제안은 decision, 미승인 후보는 Draft에서 관리합니다. 개선된 운영 방법은 검증 후 backlog/docs/operations/의 해당 doc를 갱신합니다.

Done은 기록된 완료 범위, Waiting Validation은 독립 검증 대기, On Hold는 재개 요청 전 보류입니다. 등록·우선순위·dependency·담당은 실행 승인이 아닙니다. 이미 승인된 목표는 준비·구현·검증·보고를 단계별 재승인 없이 마칩니다. R-10/R-14 구현 완료와 실제 역할/대표 사용자 관찰을 구분하고 R-11 및 모바일 로그인·실기기 IME·설치형 PWA 보류와 후보 3개의 Draft를 유지합니다.

기존 future-todo.md·docs/roadmap/·docs/operations/는 이동 안내이며 편집/동기화를 종료했습니다. 날짜가 있는 과거 상태표·승인·검증 기록을 현재값으로 갱신하지 않습니다. 자동 커밋·원격 Git 조회·상태 callback은 꺼져 있고 기존 hook·전역 설정은 유지됩니다.

## 개인정보와 배포 주의사항

- 실제 고객 전화번호, 메모, 예약 이력, 인증 토큰과 비밀키를 코드·로그·스크린샷에 남기지 않습니다.
- 데이터베이스 변경은 migration-first로 진행하고 RLS와 역할별 접근 경계를 함께 검증합니다.
- PWA 빌드가 생성한 `public/sw.js`와 `public/workbox-*.js`는 직접 수정하지 않습니다.
- 커밋, 푸시, PR, 배포와 원격 서비스 변경은 승인된 계획에 포함된 경우에만 실행합니다.
