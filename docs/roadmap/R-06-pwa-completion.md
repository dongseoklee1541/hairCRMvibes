# R-06 PWA Completion

## 상태
- Planned
- 브랜치: `feature/r06-pwa-completion`
- 최종 업데이트: 2026-07-11

## 목표
- `next-pwa` 기반 설치 가능 PWA 구성을 완성합니다.
- 서비스워커 캐시 전략을 명시하고, 예약/고객 데이터가 오래된 캐시에 갇히지 않도록 합니다.
- 모바일 재방문 경험과 오프라인/저속 네트워크 상태의 사용자 피드백을 개선합니다.

## 선행조건
- Phase 1 브랜치 스택이 main에 반영되어 있어야 합니다.
- Supabase Free keepalive는 `feature/ops-supabase-keepalive`에서 로컬 구현됐으며 production 환경변수/배포/cron 실행 검증은 별도 운영 게이트입니다.
- keepalive route는 `no-store`이며 R-06 service worker/runtime cache 대상에서 반드시 제외해야 합니다.
- 캐시 정책 결정 필요: 화면 shell은 캐시 가능, Supabase 데이터 요청은 network-first 권장.
- 아이콘/manifest 최종 자산 확인 필요.

## 완료 기준
- `next-pwa` 또는 현 Next.js 버전에 맞는 PWA 구성이 추가됨
- manifest, icons, theme color, start URL, display mode 검증
- 서비스워커가 데이터 최신성을 해치지 않는 캐시 전략을 사용
- 오프라인/재접속 UX가 모바일 viewport에서 확인됨
- `npm run build` 통과

## 검증 계획
- `npm run build`
- 390x844, 360x800 viewport에서 설치성/재방문 확인
- offline/reload/cache refresh smoke
- 예약/고객/설정 데이터가 stale cache로 표시되지 않는지 확인

## 남은 리스크
- Next.js 15와 `next-pwa` 조합의 호환성 확인 필요
- Supabase 인증/데이터 요청을 캐시하면 보안/최신성 문제가 생길 수 있으므로 제외 규칙 필요
- Vercel Hobby의 비상업적 사용 제한과 Supabase Free의 자동 일시정지 가능성은 PWA 구현으로 해소되지 않음
