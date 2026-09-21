# 2026-09-22 문서·지침·메모리 점검

## 범위와 확인 기준

- 최초 점검 승인: 로컬 문서·저장소 AGENTS.md·메모리 갱신 노트. 이 점검 단계에서는 코드·DB·계정/권한·전역 설정·Git 게시·배포·워크트리 정리를 제외했습니다.
- 점검 보고 뒤 사용자가 커밋부터 병합까지 추가 승인했습니다. 저장소 문서 18개만 전달하며, 저장소 밖 메모리 노트와 기존 산출물은 Git 대상에서 제외합니다. 전달 결과는 이 문서를 포함한 PR의 commit·CI·병합 기록으로 확인합니다.
- 확인 날짜: 2026-09-22 KST. 착수 시 로컬 `main`과 GitHub `main`은 `cd0f3ebf25b98c9d7dd772101f7798fc4f413009`으로 일치했습니다. 추적 파일 변경은 없었고 기존 미추적 검증 산출물·복구 사본·워크트리는 보존 대상입니다.
- 근거: 현재 Git history·문서·관련 코드, GitHub PR/CI 및 공개 deployment/status API. `gh` 인증 실패 뒤 GitHub connector와 공개 API로 읽기 전용 확인했습니다. 인증정보를 추출하지 않았습니다.

## PR #39 — 실제 시술금액 입력 수정

- [PR #39](https://github.com/dongseoklee1541/hairCRMvibes/pull/39): head `6b97caa40a2a6ce37f536397d6b834cc0e9f4257`, merge `8f8e45cc4cd85850bbda6b7e1e34344a2173f2ea`, 2026-09-21 02:39:55 KST 병합.
- [PR head CI](https://github.com/dongseoklee1541/hairCRMvibes/actions/runs/34560757400)와 [merge CI](https://github.com/dongseoklee1541/hairCRMvibes/actions/runs/35526585866)는 success입니다.
- merge SHA의 [Production deployment 6555714417](https://api.github.com/repos/dongseoklee1541/hairCRMvibes/deployments/6555714417)과 [status](https://api.github.com/repos/dongseoklee1541/hairCRMvibes/deployments/6555714417/statuses)는 2026-09-21 02:40:45 KST success입니다. [Vercel 배포](https://vercel.com/dongseoklee1541s-projects/hair-cr-mvibes/4bszhaJBvZXUvDhnSedGXCYwpZTv)의 commit status도 success입니다.
- 현재 코드에서 `priceEditorId`를 사용하는 focus effect와 `type="text"`/`inputMode="numeric"`를 확인했습니다. `운영 미배포`를 현재 상태에서 제거했습니다. 구현·Preview 검증과 제한은 [R-15](./R-15-customer-service-price.md)에 보존합니다.

## PR #40 — Astra·브라우저 작업 지침

- [PR #40](https://github.com/dongseoklee1541/hairCRMvibes/pull/40): head `4e0c7f87e9017ce1b923f20ce6384261df092cdd`, merge `cd0f3ebf25b98c9d7dd772101f7798fc4f413009`, 2026-09-21 23:57:21 KST 병합.
- [PR head CI](https://github.com/dongseoklee1541/hairCRMvibes/actions/runs/35615465896)와 [merge CI](https://github.com/dongseoklee1541/hairCRMvibes/actions/runs/35615645392)는 success입니다.
- [Production deployment 6571311571](https://api.github.com/repos/dongseoklee1541/hairCRMvibes/deployments/6571311571)의 [status](https://api.github.com/repos/dongseoklee1541/hairCRMvibes/deployments/6571311571/statuses)는 2026-09-21 23:58:02 KST success입니다.
- PR #39 이후 #40의 변경 파일은 `AGENTS.md`, `docs/operations/browser-validation-workflow.md` 두 문서뿐입니다. 지침은 이미 기본 branch에 통합됐으며 미적용 제안으로 취급하지 않습니다. 이 자동 배포 기록이 앱 동작·실기기 검증을 추가하는 것은 아닙니다.

## 이번에 교정한 판단 경계

- R-10 migration의 초기 미적용 기록은 2026-07-14 release 기록보다 오래됐습니다. Preview/Production 적용 완료 기록과 Auth URL·advisor·owner 검증 잔여를 구분합니다.
- R-14는 구현 완료·대표 사용자 2명 검증 대기입니다. 프로토콜의 PR #27 선행 병합은 이미 충족된 역사이며, 현재 R-10 작업이 진행 중이라고 가정해 일괄 중단하지 않습니다.
- R-11은 설계 완료·구현 보류, R-16은 2026-09-11 운영 반영 완료를 유지합니다. 이번에 원격 설정·DB 검증을 새로 수행한 것은 아닙니다.
- 전역 지침과 중복된 설명·고정 계획/보고 양식을 줄이고, Pencil·migration 실행 절차는 `docs/operations/`로 분리했습니다. 필수 build/test/mobile/PWA·개인정보·권한·게시/배포 경계는 유지합니다.
- 기존 메모리의 미구현/미통합 설명을 교정하는 갱신 노트 1개를 지정된 `extensions/ad_hoc/notes/`에 작성하고 재조회했습니다. 기존 MEMORY.md·요약은 수정하지 않았습니다. 메모리 관리자의 실제 반영 완료는 확인하지 않았습니다.

## 변경 문서

기존 14개 문서를 수정하고 4개를 추가했습니다. 아래 검증 결과는 Git 전달 승인 전의 로컬 점검 기록이며, 이후의 커밋·병합 상태와 구분합니다.

- 지속 규칙·명령 안내: [AGENTS.md](../../AGENTS.md), [프로젝트 README](../../README.md)
- 현재 요약: [future-todo.md](../../future-todo.md), [로드맵 인덱스](./README.md)
- 작업 상태·근거: [R-10](./R-10-role-management.md), [R-11](./R-11-notification-automation.md), [R-14](./R-14-easy-usability-foundation.md), [R-15](./R-15-customer-service-price.md), [R-16](./R-16-customer-session-pass.md)
- 과거 실행 gate 정리: [R-14 프로토콜](./R-14-user-validation-protocol.md), [R-10 재개 참고](./phase-2-execution-prompt.md)
- 운영 문서 보정: [Keychain](../operations/local-keychain-secrets.md), [keepalive](../operations/supabase-free-keepalive.md), [직원 초대](../operations/r10-invitation-ledger.md)
- 새 절차: [Pencil Desktop](../operations/pencil-desktop-workflow.md), [migration·release](../operations/migration-release-workflow.md)
- 새 기록: [과거 release·감사 이력](./release-history-2026-07-to-09.md), 본 점검 기록

## 문서 검증 결과 (Git 전달 전)

- `git diff --check`: 통과. 새 문서 4개의 공백/EOF 검사도 포함했습니다.
- `git diff -- <변경 문서>`와 변경 문서 재독: 승인 범위인 Markdown만 변경됐고, 기존 보안·설계 SSOT·필수 build/test/mobile/PWA 검증을 유지했습니다.
- `python3 /private/tmp/haircrm-doc-audit-20260922/verify_docs.py`: 로컬 링크/앵커·파일 경로·npm scripts 대조, 두 요약의 16개 상태 일치, 보호 파일·HEAD·stage·worktree·기존 미추적 경로 보존 검사를 통과했습니다. 이 스크립트는 이번 점검의 임시 도구이며 프로젝트 실행 의존성이 아닙니다.
- R-11 예정 경로 14개는 미구현 설계 후보로 분류했습니다. 존재하는 파일이라고 표시하거나 코드 파일을 생성하지 않았습니다.
- 요약에서 옮긴 과거 commit/migration/deployment 식별자 33개가 보관본에 모두 남아 있음을 비교했습니다.
- 외부 링크 전체의 가용성을 재검사한 것은 아닙니다. 이번 결론에 필요한 PR #39/#40·CI·배포와 OpenAI 지침을 직접 확인했으며 다른 과거 외부 링크는 기존 참고 자료로 유지합니다.
- 전역 AGENTS.md·MEMORY.md·memory_summary.md는 착수 시 SHA-256과 동일합니다. 기존 미추적 경로 2,963개와 worktree 목록, HEAD를 보존했고 staged 변경은 없습니다.

## 검증 범위와 재확인 조건

- 문서 재독·diff·로컬 링크/앵커·파일 경로·명령 대조·`git diff --check`가 이번 변경의 검증 대상입니다. 문서만 변경하므로 애플리케이션 build·브라우저 테스트·스크린샷은 N/A입니다.
- 기존 테스트 숫자와 Preview 결과는 해당 commit·환경의 과거 증거입니다. 새로 실행한 결과로 표기하지 않습니다.
- canonical 도메인의 현재 deployment 연결과 인증 후 동작은 이번에 확인하지 않았습니다. Production deployment success와 구분하며 실제 release/운영 점검이 요청될 때 확인합니다.
- R-10 Auth URL·flag·advisor와 과거 인증/Pencil 장애의 현재 지속 여부도 미확인입니다. 해당 업무 재개 시 필요한 경로만 재확인합니다.
- 모바일 로그인 조사·실기기 IME·설치형 PWA는 사용자 요청으로 보류합니다. 이번 문서 정리는 재개 승인이 아닙니다. staff UI·Production 쓰기/statistics·대표 사용자 결과도 새로 검증하지 않았습니다.
