---
id: TASK-12
title: R-12 CSV 내보내기·백업
status: Done
assignee: []
created_date: '2026-09-29 14:45'
updated_date: '2026-10-02 06:50'
labels:
  - R-12
  - formal-feature
  - historical-evidence
  - implementation-complete
dependencies: []
references:
  - backlog/decisions/decision-11 - R-12-export-privacy-and-retention.md
documentation:
  - backlog/docs/features/doc-14 - R-12-csv-export-backup.md
priority: p2
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
원래 기능 ID: `R-12`. 이 native task는 기록된 구현·배포 완료 범위를 추적합니다.

이관일: 2026-09-29 KST. 구현·검증 날짜는 연결 문서의 원래 날짜를 따릅니다. 과거 검증을 이번 실행으로 표시하지 않습니다.

승인: 작업 등록·우선순위·의존관계·담당 지정은 실행 승인이 아닙니다. 이번 승인은 관리 체계 이관에 한정되며 이 기능을 구현하거나 운영 검증하지 않습니다. 담당은 미지정입니다.

기능 의도와 계약:

### 목표와 결과
- owner가 `/settings`에서 고객과 예약 전체 데이터를 각각 CSV로 내려받을 수 있습니다.
- 다운로드 전에 민감정보 보관 책임을 명시적으로 확인해야 하며, 미확인 상태에서는 두 버튼이 비활성화됩니다.
- 서버 Route Handler가 사용자 JWT를 검증하고 profile role을 `owner`로 다시 확인한 뒤 기존 RLS로 데이터를 읽습니다.
- 데이터베이스 migration, RLS, RPC, grant, schema는 변경하지 않았습니다.
- 응답은 1,000행 단위로 스트리밍하며 기존 100,000행 애플리케이션 상한을 제거했습니다.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 owner가 /settings에서 민감정보 보관 책임을 확인한 뒤 고객 CSV와 예약 CSV를 각각 내려받을 수 있고 미확인 상태에서는 다운로드 버튼을 비활성화한다.
- [x] #2 /api/export는 사용자 JWT·owner profile·기존 RLS를 검사한다. staff는 403, 미인증/만료 세션은 401, 허용하지 않은 데이터셋은 400으로 거부하고 service-role/secret key를 사용하지 않는다.
- [x] #3 고객/예약 필드를 원문 CSV 계약의 고정 순서로 내보내고 UTF-8 BOM·CRLF·셀 큰따옴표 인용 및 spreadsheet formula injection 방어를 적용한다.
- [x] #4 created_at,id 순서의 1000행 페이지를 순차 스트리밍한다. 첫 페이지 오류는 JSON으로 반환하고 임의 100000행 상한을 두지 않는다. 여러 조회의 완전한 DB 시점 snapshot은 보장하지 않는다.
- [x] #5 응답을 private no-store로 제공하고 고객 데이터를 서버 파일·localStorage·IndexedDB·Cache Storage에 저장하지 않는다. 지원 브라우저는 파일 스트리밍을 사용하고 Blob fallback은 URL을 해제한다.
- [x] #6 공통 KST helper로 파일명 날짜를 생성하고 전체 CSV에 연락처·메모가 포함된다는 안내와 원문의 암호화 보관·최대30일 취급 기준을 제공한다.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
과거 계획과 구현 순서는 연결한 원문 설계·release 문서에 보존한다. 이관 이후 신규 구현 계획은 승인된 재개 시 최신 코드·환경 조사 후 이 task 또는 독립 후속 task에 기록한다.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
이관일: 2026-09-29 KST; 검증 실행일과 구분.

2026-09-28 원문 상태 스냅샷: Done
완료·진행 근거: PR #22·Preview 역할/모바일/PWA·Production 공개/API 기록
당시 다음 행동 / 남은 범위: 대량 export 부하·모바일 Blob 메모리는 미검증; Production 실제 CSV 생성은 미실행

최신 직접 근거: 로컬 HEAD `b095a7546a16169b6706ab8b520b1e38c7776f14`; PR #44 merge `df950f6`가 이 HEAD의 조상임을 확인. PR #45는 2026-09-28 배포 증거를 문서화한 후속이다. 원격 서비스를 이번 이관에서 재조회하지 않았다.

원문에서 유지한 검증 공백·위험·재개 조건:
## 남은 리스크와 통합 검증 경계
- Production 실제 owner 다운로드는 고객 개인정보 파일 생성과 보관 책임이 발생하므로 이번 범위에서 실행하지 않았습니다.
- 페이지 단위 조회는 완전한 시점 스냅샷이 아닙니다. 불변 정렬키를 사용하더라도 대량 내보내기 중 생성·삭제가 발생하면 파일 내 값의 기준 시점이 달라질 수 있으므로 운영 절차에서 편집 중단을 요구합니다.
- 서버는 페이지 단위로 스트리밍하지만 Vercel 함수 실행 시간과 Supabase/네트워크 지연은 남아 있습니다. 현 데이터 규모를 크게 넘기는 운영 전에는 실제 규모 부하 검증과 필요 시 비동기 export를 별도 설계합니다.
- File System Access API가 없는 모바일·Safari 계열은 Blob fallback을 사용하므로 매우 큰 파일에서 클라이언트 메모리 사용량이 커질 수 있습니다.
- 브라우저 다운로드 이후 파일의 암호화·접근통제·삭제주기는 운영자와 기기 정책의 책임이며 애플리케이션이 강제하지 못합니다.
- `main` merge와 Production 배포·공개/API 경계 검증은 완료했습니다. Production 실제 owner 다운로드는 민감정보 파일 생성 책임 때문에 의도적으로 실행하지 않았습니다.

2026-10-02 이관 보완: 원문의 기능 조건을 native 완료 기준으로 복원했다. 체크는 다음 기존 구현/검증 기록의 재사용이며 오늘 새 앱/DB/브라우저 검증을 실행했다는 뜻이 아니다.
근거: doc-14 목표·권한/보관·CSV 계약과 전용 Preview 통합 근거(2026-07-13 PR #22); doc-33 CSV 취급 절차.
미검증 경계: 실제 Production CSV 생성은 TASK-23, 대량/Blob 부하는 TASK-24 대기다.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
기존 완료 범위 이관: PR #22·Preview 역할/모바일/PWA·Production 공개/API 기록

2026-09-29 KST에는 문서와 현재 로컬 Git 근거를 대조했으며 앱·DB·역할·실기기 검증을 재실행하지 않았다. 독립 후속과 미검증은 연결 작업 및 Implementation Notes를 따른다.
<!-- SECTION:FINAL_SUMMARY:END -->
