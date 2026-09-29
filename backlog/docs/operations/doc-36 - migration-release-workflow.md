---
id: doc-36
title: migration-release-workflow
type: guide
created_date: '2026-09-29 14:45'
updated_date: '2026-09-29 15:04'
tags:
  - migrated
  - operations
---
# 이관 안내 — doc-36

반복 실행·검증·복구 절차의 새 관리 위치다. 원래 실행·적용 날짜는 본문을 따른다. 아래 원문의 옛 상태 관리 지시와 당시 결과는 날짜가 있는 이관 기록이며 새 기록 방식은 [doc-41](doc-41%20-%20backlog-workflow.md)를 따른다. 검증된 절차 개선은 이 native doc를 CLI로 갱신한다.

- 원래 경로: `docs/operations/migration-release-workflow.md` (역사적 식별자)
- 이관일: 2026-09-29 KST; 실제 구현·검증은 원래 날짜 유지, 이번 이관에서 재실행하지 않음
- 원문 기준 commit: `b095a7546a16169b6706ab8b520b1e38c7776f14`
- 원문 SHA-256: `53b8b5f44c34c73c912f1c6d9fa0158bccd9b4de2c326db8abf86d48671d8521`
- 작업: [TASK-26](../../tasks/task-26%20-%20%EC%9E%91%EC%97%85%C2%B7%EC%84%A4%EA%B3%84%C2%B7%EA%B2%80%EC%A6%9D%C2%B7%EC%9A%B4%EC%98%81-%EB%AC%B8%EC%84%9C%EB%A5%BC-Backlog.md%EB%A1%9C-%EC%A0%84%EB%A9%B4-%EC%A0%84%ED%99%98.md), [TASK-10](../../tasks/task-10%20-%20R-10-%EC%A7%81%EC%9B%90-%EC%B4%88%EB%8C%80%C2%B7%EC%97%AD%ED%95%A0-%EA%B4%80%EB%A6%AC-%EA%B5%AC%ED%98%84%EA%B3%BC-%EB%B0%B0%ED%8F%AC.md), [TASK-15](../../tasks/task-15%20-%20R-15-%EA%B3%A0%EA%B0%9D%EB%B3%84-%EC%8B%A4%EC%A0%9C-%EC%8B%9C%EC%88%A0%EA%B8%88%EC%95%A1.md), [TASK-16](../../tasks/task-16%20-%20R-16-%EA%B3%A0%EA%B0%9D%EB%B3%84-%ED%9A%9F%EC%88%98%EA%B6%8C.md)
- 관리 절차: [doc-41](doc-41%20-%20backlog-workflow.md)

문서/이미지/SQL/증거 Markdown 링크는 이 문서 위치 기준으로 수정했다. 코드 블록과 backtick의 역사적/저장소 루트 경로는 그대로 유지하며 과거 명령을 현재 승인으로 해석하지 않는다.


## 현재 운영 결과 기록 규칙 — 2026-09-29

이 절차의 실행 계획·승인 범위·상태·진행/검증·다음 행동은 해당 native task에 기록합니다. 날짜·commit·환경·명령·결과·증거와 미검증/보류/차단은 task notes와 연결한 evidence/release doc에 남깁니다. 실제 적용 상태는 task를 조회하고 연결 doc는 당시 근거로 읽습니다. 운영 방법 개선은 효과를 검증한 뒤 이 doc의 절차를 갱신합니다. 원문에 남은 future-todo/roadmap 동기화 문구는 2026-09-29 종료된 역사적 규칙이며 실행하지 않습니다.

<!-- migrated-source:start -->
# Migration·release 확인 절차

이 문서는 실행 절차입니다. 적용 상태와 과거 검증은 [로드맵 상세 문서](../history/doc-21%20-%20historic-roadmap-index-20260928.md)에 기록하며, 이 문서를 읽는 것만으로 DB·Auth·Git 게시·배포 변경이 승인되지는 않습니다.

## 재개 전 확인

1. 현재 요청에서 승인된 대상·행위·환경, branch/HEAD와 사용자 변경을 확인합니다. 이미 승인된 동일 범위는 다시 승인받지 않습니다.
2. `supabase/migrations/`의 forward 파일과 대상 환경의 migration history·catalog를 비교합니다. 과거 문서의 migration 개수나 최신 SHA를 실행 기준으로 복사하지 않습니다.
3. 원격 조회·변경에 필요한 인증이 없으면 해당 단계만 차단으로 기록합니다. 과거 dashboard 로그인 실패나 CLI 인증 실패를 현재 장애로 단정하지 않습니다. GitHub 게시에는 [AGENTS.md §2.5](../../../AGENTS.md#25-github-게시-도구와-재인증)에 따라 `git`/`gh`를 우선하고, `gh` 인증 실패 시 사용자 재인증을 요청하며 브라우저로 자동 전환하지 않습니다.
4. 로컬 검증 결과를 재사용할 때 commit·환경·명령·증거와 이후 관련 변경 유무를 확인합니다. 원격 DB 상태, 배포 alias, Auth/권한 설정은 실제 변경·release 직전에 다시 확인합니다.

## DB·권한 경계

- forward migration만 `supabase/migrations/`에 두고 수동 rollback 참고 SQL은 `supabase/rollbacks/`에 둡니다. 승인된 변경 후 `schema.sql`을 동기화합니다.
- R-10·R-15에는 환경별 apply-time version 차이가 기록돼 있습니다. 버전 문자열 차이만으로 미적용이라고 판단하거나 SQL을 재실행하지 않습니다. [R-10](../features/doc-12%20-%20R-10-role-management.md), [R-15](../features/doc-19%20-%20R-15-customer-service-price.md)의 이력과 실제 객체를 대조합니다.
- `migration repair`, `db push`, `--include-all`은 읽기 전용 검사가 아닙니다. 특히 backdated migration을 `--include-all`로 재실행하지 않습니다. 이력 교정은 객체 동등성·정확한 대상·승인 범위가 확인된 경우에만 수행합니다.
- R-01 backfill은 당시 Auth 사용자에만 적용됐습니다. 신규 사용자의 `profiles(id, role)` provisioning은 승인된 운영 절차로 수행하고 owner를 자동 선출하지 않습니다. profileless 접근은 차단을 유지합니다.
- 운영 SQL 결과에는 사용자 식별자 대신 필요한 count·missing count·catalog/ACL만 포함합니다.
- `20260707161054_phase1_function_privilege_hardening.sql`은 forward-only입니다. 장애 시 함수 signature·search_path·owner·role별 EXECUTE를 확인하고 필요한 함수만 forward-fix합니다. mutable search_path나 anon 권한을 일괄 복원하지 않습니다.
- rollback은 데이터와 감사 원장을 보존하고 앱/DB 호환성을 먼저 검토합니다. R-16은 이전 앱만 단독 복원하면 예약 쓰기 계약이 달라질 수 있으므로 [R-16 rollback](../features/doc-20%20-%20R-16-customer-session-pass.md#rollback)을 따릅니다.

## 배포 근거 구분

- PR 병합, CI 성공, Preview/Production deployment 성공, canonical alias 연결, 인증 후 실제 동작은 각각 별도 증거입니다.
- 원격 DB 적용이 필요한 release는 계획된 DB·앱 순서와 검증을 마친 뒤 승격합니다. 과거 Promote 기록을 현재 alias 연결의 증거로 사용하지 않습니다.
- 새 코드 변경이 없는 문서 PR의 CI·자동 배포 성공을 인증·실기기 검증으로 확대하지 않습니다.
- release 뒤 상세 문서에 날짜·SHA·환경·배포 ID·실행한 검증과 미실행 범위를 기록하고, `future-todo.md`와 인덱스에는 상태와 다음 행동만 동기화합니다.

관련 운영 절차: [직원 초대](doc-38%20-%20r10-invitation-ledger.md), [keepalive](doc-40%20-%20supabase-free-keepalive.md), [Keychain](doc-35%20-%20local-keychain-secrets.md), [브라우저 검증](doc-32%20-%20browser-validation-workflow.md).

<!-- migrated-source:end -->
