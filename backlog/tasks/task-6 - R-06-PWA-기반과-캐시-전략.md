---
id: TASK-6
title: R-06 PWA 기반과 캐시 전략
status: Done
assignee: []
created_date: '2026-09-29 14:45'
updated_date: '2026-09-29 14:59'
labels:
  - R-06
  - formal-feature
  - historical-evidence
  - implementation-complete
dependencies: []
references:
  - backlog/decisions/decision-4 - R-06-network-only-sensitive-data.md
documentation:
  - backlog/docs/features/doc-7 - R-06-pwa-completion.md
priority: p1
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
원래 기능 ID: `R-06`. 이 native task는 기록된 구현·배포 완료 범위를 추적합니다.

이관일: 2026-09-29 KST. 구현·검증 날짜는 연결 문서의 원래 날짜를 따릅니다. 과거 검증을 이번 실행으로 표시하지 않습니다.

승인: 작업 등록·우선순위·의존관계·담당 지정은 실행 승인이 아닙니다. 이번 승인은 관리 체계 이관에 한정되며 이 기능을 구현하거나 운영 검증하지 않습니다. 담당은 미지정입니다.

기능 의도와 계약:

### 목표
- `next-pwa` 기반 설치 가능 PWA 구성을 완성합니다.
- 서비스워커 캐시 전략을 명시하고, 예약/고객 데이터가 오래된 캐시에 갇히지 않도록 합니다.
- 모바일 재방문 경험과 오프라인/저속 네트워크 상태의 사용자 피드백을 개선합니다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Next.js 15 호환 `next-pwa` 구성이 추가됨
- [x] #2 manifest, icons, theme color, start URL, scope, display mode 검증
- [x] #3 CRM 데이터와 API를 Cache Storage에 남기지 않는 NetworkOnly 정책 적용
- [x] #4 390x844, 360x800 오프라인 UX 확인
- [x] #5 bundled Node `npm run build` 통과
- [x] #6 `npm audit` 8건(critical 1/high 2/moderate 5)에서 0건으로 감소
- [x] #7 Pencil SSOT 변경의 실제 `.pen` 파일 persistence 확인
- [x] #8 정적 document fallback으로 hydration `#418` 및 실패한 RSC fetch console error 제거
- [x] #9 Vercel Production의 manifest/SW/offline/favicon/192·512 icon HTTP 200 확인
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
과거 계획과 구현 순서는 연결한 원문 설계·release 문서에 보존한다. 이관 이후 신규 구현 계획은 승인된 재개 시 최신 코드·환경 조사 후 이 task 또는 독립 후속 task에 기록한다.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
이관일: 2026-09-29 KST; 검증 실행일과 구분.

2026-09-28 원문 상태 스냅샷: Done
완료·진행 근거: 로컬 PWA·cache·Production 공개 자산 검증 기록
당시 다음 행동 / 남은 범위: 실기기 설치/standalone/SW update는 보류; 고정 URL precache 갱신 정책은 후속

최신 직접 근거: 로컬 HEAD `b095a7546a16169b6706ab8b520b1e38c7776f14`; PR #44 merge `df950f6`가 이 HEAD의 조상임을 확인. PR #45는 2026-09-28 배포 증거를 문서화한 후속이다. 원격 서비스를 이번 이관에서 재조회하지 않았다.

원문에서 유지한 검증 공백·위험·재개 조건:
## 남은 리스크
- `npm audit`는 8건에서 0건으로 감소했습니다. `npm audit fix --force`는 사용하지 않았고 Next.js major도 유지했습니다.
- `serialize-javascript@7.0.5` override는 상위 declared range 밖입니다. 현재 install/tree/build/SW 생성은 통과했지만 상위 패키지 업데이트 시 override 필요성과 호환성을 다시 확인해야 합니다.
- Pencil 앱의 내장 Claude agent는 여전히 `oauth_org_not_allowed`이지만 Pencil MCP + GUI Save 경로로 SSOT persistence와 export를 완료했으므로 R-06 blocker는 아닙니다.
- 정적 fallback은 inline style/script를 사용하므로 향후 CSP에서 inline 실행을 차단하면 nonce/hash 또는 별도 정적 asset 분리가 필요합니다. 현재 저장소에는 CSP가 없습니다.
- manifest/favicon/icons의 `revision: null` precache 항목은 URL이 고정된 자산의 갱신 위험이 있습니다. offline fallback은 next-pwa가 build-ID revision으로 자동 관리하도록 분리했습니다.
- precache된 route별 JS는 실행 코드만 포함하며 고객/예약 레코드는 포함하지 않습니다. 향후 정적 번들에 민감한 상수를 추가하지 않아야 합니다.
- Vercel Hobby의 비상업적 사용 제한과 Supabase Free의 자동 일시정지 가능성은 PWA 구현으로 해소되지 않음
- 실제 기기의 install prompt/standalone/service worker update와 고정 URL `revision: null` 자산 갱신은 후속 검증으로 유지합니다.

완료 기준은 원문의 구현 완료 범위에서 이관했다. 체크는 원문 날짜의 기존 증거에 따른 역사적 완료 표시이며 2026-09-29 새 동작 검증을 뜻하지 않는다. 독립 검증/실기기 보류 항목은 후속 작업에 유지한다.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
기존 완료 범위 이관: 로컬 PWA·cache·Production 공개 자산 검증 기록

2026-09-29 KST에는 문서와 현재 로컬 Git 근거를 대조했으며 앱·DB·역할·실기기 검증을 재실행하지 않았다. 독립 후속과 미검증은 연결 작업 및 Implementation Notes를 따른다.
<!-- SECTION:FINAL_SUMMARY:END -->
