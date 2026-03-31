# Hair CRM Vibes

Next.js 15 기반의 소형 헤어샵 CRM입니다. 고객 관리, 예약, 통계, 권한 기반 설정 화면을 포함합니다.

## 주요 화면

- `/` 고객 검색 및 오늘 예약 요약
- `/appointments` 예약 목록
- `/customers/new` 고객 등록
- `/customers/[id]` 고객 상세 및 이력
- `/stats` 월간 통계
- `/settings` 원장 전용 휴무일 관리
- `/login` 이메일/비밀번호 로그인

## 기술 스택

- Next.js 15
- React 19
- Supabase
- Node built-in test runner

## 실행

```bash
npm install
npm run dev
```

## 검증

```bash
npm test
npm run build
```

현재 저장소에는 별도 ESLint 설정이 없어 `next lint`가 대화형 초기화 프롬프트를 띄웁니다. 따라서 기본 검증 절차는 테스트와 빌드 성공 여부입니다.

## 권한 경계

- `owner`는 전체 탭과 설정 화면 접근 가능
- `staff`는 설정 탭 비노출
- 역할 조회 실패 시 보호 화면에서 로그아웃 복구 유도

자세한 내용은 `docs/auth-role-boundary.md`와 `docs/reviews/2026-03-25-multi-module-refactor-review.md`를 참고하세요.
