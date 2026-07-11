# R-06 PWA Completion

## 상태
- Done (local verified; production smoke pending)
- 브랜치: `feature/r06-pwa-completion`
- 최종 업데이트: 2026-07-11

## 목표
- `next-pwa` 기반 설치 가능 PWA 구성을 완성합니다.
- 서비스워커 캐시 전략을 명시하고, 예약/고객 데이터가 오래된 캐시에 갇히지 않도록 합니다.
- 모바일 재방문 경험과 오프라인/저속 네트워크 상태의 사용자 피드백을 개선합니다.

## 선행조건
- Phase 1과 keepalive 커밋 위에 stacked branch로 구현했습니다. main 반영 전에는 R-06만 독립 병합하지 않습니다.
- Supabase Free keepalive는 `feature/ops-supabase-keepalive`에서 로컬 구현됐으며 production 환경변수/배포/cron 실행 검증은 별도 운영 게이트입니다.
- keepalive route는 `no-store`이며 서비스워커 `/api/**` NetworkOnly 규칙으로 Cache Storage에서 제외했습니다.
- CRM 데이터 최신성과 개인정보 보호를 우선해 문서/Supabase/API/나머지 런타임 요청을 모두 NetworkOnly로 고정했습니다.
- 정적 JS/CSS/font, offline fallback, manifest, favicon, 192/512 아이콘만 precache합니다.

## 구현 결과
- `@ducanh2912/next-pwa@10.2.9`를 사용해 Next.js 15.5.20/React 19.0.7 production build에서 서비스워커 생성과 자동 등록을 확인했습니다.
- Next.js/React를 같은 major의 patched release로 올리고 `postcss@8.5.10`, `serialize-javascript@7.0.5`, `ws@8.21.0`을 제한 override했습니다. 특히 `serialize-javascript`는 상위 `@rollup/plugin-terser@0.4.4`의 선언 범위 `^6.0.1` 밖이므로 install/tree/build/SW 생성 검증을 완료했고 향후 Workbox가 안전한 범위를 선언하면 override 제거를 우선 검토합니다.
- `public/offline.html`은 Next.js/React를 실행하지 않는 독립 document fallback으로 동작하며 연결 상태, 개인정보 캐시 제외 안내, 52px 재시도 버튼을 제공합니다.
- manifest에 `id`, `scope`, `standalone`, maskable 192/512 PNG 아이콘을 반영했습니다.
- 기존 `icon-192.png`의 ICO 컨테이너를 실제 192x192 PNG로 교체하고 512x512 PNG를 추가했습니다.
- Pencil MCP에서 임시본에 `오프라인 페이지 (R-06 SSOT)`와 `PWA App Icon 512 (R-06 SSOT)`를 추가하고 GUI Save/Save As로 원본에 반영했습니다. 원본 top-level node는 12→14개, reusable component는 2개로 유지됐고 원본 Git hash는 `b1c8ec48946627bcc2fe747d107c78d36601e03d`로 변경됐습니다.
- 두 신규 Pencil subtree는 `snapshot_layout` problem 0건, screenshot/export 성공을 확인했습니다. 문서 전체에는 R-06 이전부터 있던 `새 고객 등록 페이지(QmN8k)` 부분 clipping 1건이 그대로 남아 있으며 R-06 노드에서 새 layout 문제는 추가되지 않았습니다.
- App Router `/offline` route를 제거하고 정적 `/offline.html`을 build-ID revision으로 precache해 요청 route와 fallback React tree가 달라지던 hydration 경계를 없앴습니다.
- 서비스워커 생성물(`sw.js`, Workbox/fallback/worker 파일)은 build output이므로 `.gitignore` 처리했습니다.

## 완료 기준
- [x] Next.js 15 호환 `next-pwa` 구성이 추가됨
- [x] manifest, icons, theme color, start URL, scope, display mode 검증
- [x] CRM 데이터와 API를 Cache Storage에 남기지 않는 NetworkOnly 정책 적용
- [x] 390x844, 360x800 오프라인 UX 확인
- [x] bundled Node `npm run build` 통과
- [x] `npm audit` 8건(critical 1/high 2/moderate 5)에서 0건으로 감소
- [x] Pencil SSOT 변경의 실제 `.pen` 파일 persistence 확인
- [x] 정적 document fallback으로 hydration `#418` 및 실패한 RSC fetch console error 제거
- [ ] Vercel production 배포 후 install prompt/standalone/서비스워커 update 확인

## 검증 계획
- bundled Node `npm run build`: 통과
- manifest fetch: HTTP 200, `display=standalone`, icons `192x192`/`512x512`
- Service Worker: active, scope `/`, `/offline.html` fallback precache 확인
- Cache Storage: `/offline.html`, manifest, favicon, 192/512 아이콘 확인; API 응답과 고객/예약/설정/통계 문서 0건
- offline navigation: `/appointments`, `/settings`, `/customers`에서 원래 URL을 유지한 정적 fallback HTTP 200 표시
- offline 해제 후 `다시 연결하기`: 온라인 로그인 route 복귀 확인
- 2026-07-11 정적 fallback 재검증: 390x844/360x800에서 52px CTA, `현재 오프라인`, safe-area 레이아웃, 오프라인 재시도, 온라인 복구를 확인
- 두 viewport 모두 Next script 0건, RSC 요청 0건, console error/warning 0건, page error 0건, hydration marker 0건
- 두 viewport 모두 Cache Storage required missing 0건, API/Supabase/고객·예약·설정·통계 document 0건
- 증거: `output/playwright/r06-pwa-completion/20260711_offline_before_390x844.png`
- 증거: `output/playwright/r06-pwa-completion/20260711_offline_after_390x844.png`
- 증거: `output/playwright/r06-pwa-completion/20260711_offline_after_360x800.png`
- Pencil 증거: `output/playwright/r06-pwa-completion/20260711_offline_pencil_ssot.png`
- Pencil 증거: `output/playwright/r06-pwa-completion/20260711_pwa_icon_pencil_ssot.png`
- 보안 패치 후 증거: `output/playwright/r06-pwa-completion/20260711_security_patch_offline_390x844.png`
- 보안 패치 후 증거: `output/playwright/r06-pwa-completion/20260711_security_patch_offline_360x800.png`
- 정적 fallback 최종 증거: `output/playwright/r06-pwa-completion/20260711_offline_static_after_390x844.png`
- 정적 fallback 최종 증거: `output/playwright/r06-pwa-completion/20260711_offline_static_after_360x800.png`
- Pencil 최종 export: `output/playwright/r06-pwa-completion/pencil-verified/m2vOg.png`
- Pencil 최종 export: `output/playwright/r06-pwa-completion/pencil-verified/mLNRr.png`

## 남은 리스크
- `npm audit`는 8건에서 0건으로 감소했습니다. `npm audit fix --force`는 사용하지 않았고 Next.js major도 유지했습니다.
- `serialize-javascript@7.0.5` override는 상위 declared range 밖입니다. 현재 install/tree/build/SW 생성은 통과했지만 상위 패키지 업데이트 시 override 필요성과 호환성을 다시 확인해야 합니다.
- Pencil 앱의 내장 Claude agent는 여전히 `oauth_org_not_allowed`이지만 Pencil MCP + GUI Save 경로로 SSOT persistence와 export를 완료했으므로 R-06 blocker는 아닙니다.
- 정적 fallback은 inline style/script를 사용하므로 향후 CSP에서 inline 실행을 차단하면 nonce/hash 또는 별도 정적 asset 분리가 필요합니다. 현재 저장소에는 CSP가 없습니다.
- manifest/favicon/icons의 `revision: null` precache 항목은 URL이 고정된 자산의 갱신 위험이 있습니다. offline fallback은 next-pwa가 build-ID revision으로 자동 관리하도록 분리했습니다.
- precache된 route별 JS는 실행 코드만 포함하며 고객/예약 레코드는 포함하지 않습니다. 향후 정적 번들에 민감한 상수를 추가하지 않아야 합니다.
- Vercel Hobby의 비상업적 사용 제한과 Supabase Free의 자동 일시정지 가능성은 PWA 구현으로 해소되지 않음
