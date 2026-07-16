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
npm test           # Node 단위 테스트와 예약 화면 경쟁 상태 테스트
npm run test:node  # 날짜·예약 규칙·CSV·표시 유틸 테스트
npm run test:race  # 예약 화면 비동기 경쟁 상태 테스트
```

현재 `lint`와 `typecheck` 전용 명령은 없습니다.

## 저장소 기준 문서

- 개발 및 검증 규칙: [`AGENTS.md`](./AGENTS.md)
- 현재 상태와 우선순위: [`future-todo.md`](./future-todo.md)
- 로드맵 인덱스: [`docs/roadmap/README.md`](./docs/roadmap/README.md)
- UI 디자인 기준: `pencil-hairshopcrm.pen`
- 데이터베이스 변경: `supabase/migrations/`
- 현재 스키마 스냅샷: `schema.sql`

로드맵 작업은 `AGENTS.md` → `future-todo.md` → `docs/roadmap/README.md` → 관련 `R-*.md` 순서로 확인합니다.

## 개인정보와 배포 주의사항

- 실제 고객 전화번호, 메모, 예약 이력, 인증 토큰과 비밀키를 코드·로그·스크린샷에 남기지 않습니다.
- 데이터베이스 변경은 migration-first로 진행하고 RLS와 역할별 접근 경계를 함께 검증합니다.
- PWA 빌드가 생성한 `public/sw.js`와 `public/workbox-*.js`는 직접 수정하지 않습니다.
- 커밋, 푸시, PR, 배포와 원격 서비스 변경은 승인된 계획에 포함된 경우에만 실행합니다.
