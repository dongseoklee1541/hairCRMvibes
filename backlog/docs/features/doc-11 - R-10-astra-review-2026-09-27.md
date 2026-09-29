---
id: doc-11
title: R-10-astra-review-2026-09-27
type: specification
created_date: '2026-09-29 14:44'
updated_date: '2026-09-29 15:04'
tags:
  - migrated
  - dated-source
---
# 이관 안내 — doc-11

기능 계약·설계·날짜별 검증/배포/관찰/감사 근거를 전체 이관했다. 아래 `상태`·`현재`·`다음 행동`·승인 문구와 경로는 원문 기록 시점의 사실/제안/계획이다. 현재 상태·다음 행동의 원본은 연결 task/Draft이며 원문에 과거 미완료가 있어도 완료된 구현을 재실행하지 않는다.

- 원래 경로: `docs/roadmap/R-10-astra-review-2026-09-27.md` (역사적 식별자)
- 이관일: 2026-09-29 KST; 실제 구현·검증은 원래 날짜 유지, 이번 이관에서 재실행하지 않음
- 원문 기준 commit: `b095a7546a16169b6706ab8b520b1e38c7776f14`
- 원문 SHA-256: `b29c19137178e689764c92d24aa22c931bbb6c0cdf0087037f6c1ff7f68d17fb`
- 작업: [TASK-26](../../tasks/task-26%20-%20%EC%9E%91%EC%97%85%C2%B7%EC%84%A4%EA%B3%84%C2%B7%EA%B2%80%EC%A6%9D%C2%B7%EC%9A%B4%EC%98%81-%EB%AC%B8%EC%84%9C%EB%A5%BC-Backlog.md%EB%A1%9C-%EC%A0%84%EB%A9%B4-%EC%A0%84%ED%99%98.md), [TASK-10](../../tasks/task-10%20-%20R-10-%EC%A7%81%EC%9B%90-%EC%B4%88%EB%8C%80%C2%B7%EC%97%AD%ED%95%A0-%EA%B4%80%EB%A6%AC-%EA%B5%AC%ED%98%84%EA%B3%BC-%EB%B0%B0%ED%8F%AC.md), [TASK-17](../../tasks/task-17%20-%20R-10-%EC%8B%A4%EC%A0%9C-owner-staff-%EA%B2%80%EC%A6%9D%EA%B3%BC-%EC%B4%88%EB%8C%80-%ED%99%9C%EC%84%B1%ED%99%94-gate.md)
- 관리 절차: [doc-41](../operations/doc-41%20-%20backlog-workflow.md)

문서/이미지/SQL/증거 Markdown 링크는 이 문서 위치 기준으로 수정했다. 코드 블록과 backtick의 역사적/저장소 루트 경로는 그대로 유지하며 과거 명령을 현재 승인으로 해석하지 않는다.

<!-- migrated-source:start -->
# R-10 Astra 사전 검토 — 2026-09-27

2026-09-27 후속: 아래 내용은 수정 전 검토 기록입니다. [수정·검증 결과](../history/doc-24%20-%20astra-feedback-remediation-2026-09-27.md)에 로컬 구현 완료와 미배포·실사용 미검증 범위를 정리했습니다.

## 판정과 범위

사용자 요청으로 실제 owner/staff 동작 검증에 앞서 GPT-6 Astra(ultra) 독립 검토를 수행했습니다. 기준은 `main@76b64f60f594071583aea7c8a030c1a9ee095ff9`입니다. Astra는 코드·SQL·문서를 읽기 전용 검토했고, 주 작업자는 현재 서버 계약 스크립트와 합성 반례를 실행해 지적을 대조했습니다.

**초대 활성화 전에 수정할 결함 2건을 확인했습니다.** 최근 ACL migration에서 추가 권한 결함은 발견하지 못했습니다. 실제 계정·운영 DB·브라우저 검증, 초대 발송·역할 변경은 이번 검토에서 수행하지 않았습니다. 이 결과는 실제 owner/staff E2E 완료 판정이 아닙니다.

## F1 · P1 · unknown 재시도가 재발송 차단을 해제

- 위치: `lib/server/staffManagementCore.mjs:399-416,433-445`.
- 근거: `supabase/migrations/20260713143746_r10_invitation_claim_ledger.sql:96-98,595-617`, `supabase/migrations/20260712153420_r10_role_management.sql:228-260`.
- 계약: [초대 원장 운영 절차](../operations/doc-38%20-%20r10-invitation-ledger.md)의 unknown 상태는 운영 증거 대조 전 재초대·임의 종결을 금지합니다.

기존 미수락 계정의 재초대 Admin 결과가 불명확해지면 원장이 `unknown`이 됩니다. 재시도 POST는 `recoverProvisioning()`으로 provisioning/no-op 감사행을 만들고 reconcile하여 `provisioned`로 바꾼 뒤, 미수락 사용자에게 여전히 `invitation_outcome_unknown`을 반환합니다. `provisioned`는 활성 fingerprint 고유 인덱스에서 제외됩니다. 이후 새 UUID로 제출하면 Admin invite를 다시 시도할 수 있습니다.

SQL 역시 기존 profile의 `staff_provision_noop` 감사행을 새 request ID에 생성할 수 있고, reconcile은 unknown의 null Auth ID와 그 감사행을 받아 종결할 수 있습니다. 따라서 mock만의 허용 동작으로 판단하지 않았습니다. 다만 이 반례의 실제 PostgreSQL 연동 재현은 아직 하지 않았습니다.

주 작업자 재현: 기존 `scripts/verify-r10-staff-management.mjs:433-476`의 harness에서 ① Admin 실패 → unknown, ② 동일 ID 재시도 → provisioned로 변경되지만 unknown 응답, ③ 새 ID 재시도 → Admin 호출 총 2회. 기존 테스트가 ② 이후 `provisioned`를 기대하므로 현재의 잘못된 계약을 통과시킵니다. 확신 높음.

권장 수정: 메일 결과 미확정 원장을 일반 POST 재시도로 종결하지 않습니다. provisioning 존재와 메일 발송 결과 확정을 분리하고, 허용된 복구 근거를 명확히 합니다. 3회 제출 후에도 unknown과 Admin 호출 1회가 유지되는 회귀 및 SQL 연동 검증을 추가합니다.

## F2 · P2 · 응답 유실 재시도에 새로운 요청 ID 발급

- 위치: `components/settings/RoleManagementPanel.js:232-236`.
- 기존 검증 공백: `scripts/verify-r10-staff-management.mjs:632-685`는 동일 request ID replay만 검사합니다.

서버가 초대·provisioning에 성공했지만 클라이언트가 응답을 받지 못한 경우 입력이 남습니다. UI는 매 제출마다 새 UUID를 발급합니다. 동일 입력의 복구 시도가 서버에는 새로운 재초대로 전달되므로, 사용자의 의도와 달리 메일을 다시 보낼 수 있습니다. F1 없이 정상 성공한 경우에도 발생하는 별도 문제입니다.

주 작업자 합성 재현: 기존 성공 replay 테스트에 새 request ID 재시도를 추가하면 `status=reinvited`, Admin 호출 총 2회입니다. UI의 UUID 발급 경로는 정적 확인했으며 브라우저의 실제 응답 유실은 재현하지 않았습니다. 확신 높음.

권장 수정: 같은 입력의 결과 미확정 재시도에는 request ID를 보존하고, 사용자가 의도한 새 재발송만 구분해 새 ID를 발급합니다. 응답 유실 후 재시도에서도 Admin 호출 1회인 회귀가 필요합니다.

## 추가 검토 결과와 검증 공백

- ACL migration `20260926000000`: PUBLIC·anon·authenticated 회수 후 유효 권한과 service_role 보존을 검사하며, 실패 시 DO 블록 변경이 취소됩니다. `schema.sql`과 일치합니다. 추가 수정이 필요한 결함은 발견하지 못했습니다. service_role이 PUBLIC 경유로만 권한을 가진 경우의 중단 fixture는 추가 가능한 커버리지입니다.
- 역할 변경 RPC: 잠금 후 owner 재검사, 자기 강등·마지막 owner 방지, 감사행 원자 기록을 정적으로 확인했습니다. 이번 범위에서 staff 권한 상승이나 private 원장 직접 접근 경로는 발견하지 못했습니다. 이는 동적 무결함 보증이 아닙니다.
- `node scripts/verify-r10-staff-management.mjs`: 기준 HEAD에서 기존 22 checks 통과. CI의 `npm test`는 이 스크립트나 R-10 SQL/동시성 suite를 실행하지 않습니다(`package.json:9-11`, `.github/workflows/test-build.yml:34-38`). CI 성공을 R-10 전체 검증으로 간주하지 않습니다.
- 주 작업자 반례 실험: `/private/tmp/haircrm-astra-review-repro.mjs`에 원본 harness를 이용한 두 실험을 추가했습니다. `node /private/tmp/haircrm-astra-review-repro.mjs`에서 원본 22개와 반례 2개가 예상대로 실행됐습니다. 마지막 `PASS 24`는 **결함 수정 성공이 아니라 문제 동작의 재현 성공**입니다. 임시 파일은 정식 회귀 suite가 아닙니다.
- 실제 owner/staff API 거부, 권한 변경 후 기존 세션, 초대 수락·재로그인, 배포된 maintenance 응답, 전체 migration replay는 이번 검토에서 실행하지 않았습니다. 기존 성공 기록을 새 검증으로 다시 세지 않습니다.

## 후속 순서

1. F1의 unknown 종결 조건과 F2의 요청 ID 수명을 수정하고 재현 테스트를 정상 계약의 회귀로 전환합니다.
2. 서버 계약 테스트를 CI에 연결하고, 격리 PostgreSQL에서 SQL·동시성 계약을 검증합니다.
3. Astra 재검토 후 실제 owner/staff 검증 범위를 정합니다. 최신 Vercel 설정 조회에서 확인한 초대 flag=false를 이번 검토가 해제하지 않습니다.

검토·피드백 기록까지의 결과이며 애플리케이션·SQL 수정은 아직 적용하지 않았습니다. 모바일 로그인·실기기 IME·설치형 PWA 보류는 유지합니다.

<!-- migrated-source:end -->
