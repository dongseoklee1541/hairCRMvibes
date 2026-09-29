---
id: decision-4
title: R-06-network-only-sensitive-data
date: '2026-09-29 14:45'
status: accepted
---

# R-06-network-only-sensitive-data

이관일: 2026-09-29 KST; native 생성 날짜는 원래 결정일/구현일을 대신하지 않는다. 상태: `accepted`. 등록은 실행 승인이 아니다.

## 선택·대안·이유·제약

문서·Supabase·API·런타임은 NetworkOnly, 정적 asset만 precache한다. 캐시 우선/민감 응답 저장은 현재 경계와 맞지 않아 채택하지 않는다.

원문 결정·비교·제약: [docs/roadmap/R-06-pwa-completion.md](../docs/features/doc-7%20-%20R-06-pwa-completion.md)

<!-- migrated-decision:start -->
## 선행조건
- Phase 1과 keepalive 커밋 위에 stacked branch로 구현했고 PR #11을 통해 `main`에 반영했습니다.
- Supabase Free keepalive도 PR #10으로 `main`에 반영됐으며 Production 환경변수·Cron Jobs·실행 검증을 완료했습니다.
- keepalive route는 `no-store`이며 서비스워커 `/api/**` NetworkOnly 규칙으로 Cache Storage에서 제외했습니다.
- CRM 데이터 최신성과 개인정보 보호를 우선해 문서/Supabase/API/나머지 런타임 요청을 모두 NetworkOnly로 고정했습니다.
- 정적 JS/CSS/font, offline fallback, manifest, favicon, 192/512 아이콘만 precache합니다.
<!-- migrated-decision:end -->
