# Phase 2 Execution Prompt

아래 프롬프트를 새 Codex 세션에서 그대로 사용합니다.

```text
/goal Phase 2 운영 고도화 작업을 진행합시다.

먼저 AGENTS.md, future-todo.md, docs/roadmap/README.md를 읽고, 아래 Phase 2 상세 문서를 모두 확인하세요.

- docs/roadmap/R-06-pwa-completion.md
- docs/roadmap/R-07-customer-edit-delete-dedupe.md
- docs/roadmap/R-08-service-master.md
- docs/roadmap/R-09-stats-advanced.md

목표는 Phase 2 전체를 순서대로 진행할 수 있게 만드는 것입니다. 단, 한 번에 모두 구현하지 말고 먼저 현재 git 상태, 현재 브랜치, main 대비 차이, 미커밋 변경, Phase 1 브랜치 스택이 main에 반영됐는지 확인하세요.

권장 실행 순서는 다음과 같습니다.

1. Phase 1 반영 상태 확인 및 main 동기화 전략 수립
2. R-06 PWA 완성: next-pwa 또는 호환 PWA 구성, manifest/icons, SW/캐시 전략
3. R-07 고객 정보 편집·삭제 + 중복고객 처리
4. R-08 서비스 마스터: 가격/기본 소요시간/활성 여부/예약 연결
5. R-09 통계 고도화: 매출/객단가/재방문율

브랜치 전략은 작업별로 분리하세요.

- feature/r06-pwa-completion
- feature/r07-customer-edit-delete-dedupe
- feature/r08-service-master
- feature/r09-stats-advanced

먼저 현재 상태를 조사한 뒤, Phase 2 전체 실행 전략과 첫 번째 작업(R-06 또는 선행 병합/정리 작업)에 대한 Implementation Plan을 작성하세요. AGENTS.md 규칙에 따라 승인 전에는 파일을 수정하지 마세요.

Implementation Plan에는 반드시 다음을 포함하세요.

- Phase 2 전체 진행 순서
- 각 작업별 브랜치명
- 현재 브랜치/워킹트리 상태
- Phase 1 커밋이 main에 반영됐는지 여부와 미반영 시 위험
- PWA 캐시 정책: Supabase 인증/고객/예약 데이터는 stale cache 위험을 어떻게 피할지
- R-07의 고객 삭제/비활성화/병합 정책 후보와 데이터 손실 위험
- R-08의 서비스 마스터 데이터 모델: 기존 salon_service_defaults 확장 vs 신규 services 테이블
- R-09의 매출/객단가/재방문율 정의와 R-04 KST 날짜 기준 적용 계획
- DB 변경 시 migration과 schema.sql 동기화 전략
- Pencil/.pen 업데이트가 필요한 UI 작업 구분
- 각 작업 완료 후 future-todo.md와 해당 docs/roadmap/R-xx 문서 반영 방식
- 검증 계획: npm run build, Owner/Staff 검증, 모바일 viewport 390x844/360x800, PWA install/offline/cache, 고객 병합/삭제, 서비스 마스터, 통계/KST 회귀 검증

작업은 승인받은 범위부터 순차 진행하고, 각 R 작업이 끝날 때마다 다음을 수행하세요.

- 해당 기능의 완료 기준 확인
- 필요한 테스트/검증 실행
- future-todo.md 상태/근거/다음 액션 갱신
- 관련 docs/roadmap/R-xx 문서의 잔여 작업 또는 완료 기준 갱신
- UI 변경 시 Pencil/.pen 업데이트와 before/after screenshots 보고
- 최종 보고는 AGENTS.md의 Result Report Format을 따르세요.
```
