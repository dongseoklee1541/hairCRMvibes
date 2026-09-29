---
id: decision-8
title: R-10-server-only-claim-ledger
date: '2026-09-29 14:45'
status: accepted
---

# R-10-server-only-claim-ledger

이관일: 2026-09-29 KST; native 생성 날짜는 원래 결정일/구현일을 대신하지 않는다. 상태: `accepted`. 등록은 실행 승인이 아니다.

## 선택·대안·이유·제약

A′ server-only Admin API·profiles.role·private claim ledger·unknown fail-closed와 at-most-once 호출을 선택했다. exactly-once 메일 전달·자동 unknown 재발송·Auth 사용자 자동 삭제는 보장/허용하지 않는다.

원문 결정·비교·제약: [docs/roadmap/R-10-role-management.md](../docs/features/doc-12%20-%20R-10-role-management.md)

<!-- migrated-decision:start -->
## 선택한 방식
- A′안: Supabase Admin API는 Node server-only route에서만 사용하고 앱 역할의 SSOT는 `public.profiles.role`로 유지하되, 외부 Auth 호출 전에 private invitation claim ledger를 원자적으로 선점합니다.
- 초대 신규 profile의 초기 역할은 `staff`로 고정합니다. 역할 승격은 별도 owner action으로 분리합니다.
- Auth invite와 profile provisioning은 단일 transaction이 아니므로 Auth 사용자를 자동 삭제하지 않습니다. profile 실패는 `auth_succeeded` 상태로 보존하고 같은 email 재요청이 이메일 재전송 없이 provisioning을 멱등 복구합니다.
- ledger에는 raw email 대신 server-only `SUPABASE_SECRET_KEY`를 domain-separated HMAC-SHA256 key로 사용한 64자리 fingerprint만 저장합니다. 역할 audit에는 actor/target/이전·이후 역할/event/request/time만 보관합니다.
- 상태는 `claimed`, `auth_succeeded`, `provisioned`, `failed_definitive`, `unknown`으로 제한합니다. 동일 request/email의 winner 한 건만 Admin invite를 호출하고, 호출 결과가 모호하거나 claim이 stale이면 `unknown`으로 닫아 자동 재전송하지 않습니다.
- 이는 외부 이메일의 exactly-once 전달 보장이 아니라 logical request/active fingerprint당 Admin API **at-most-once 호출** 보장입니다. `unknown`은 운영 확인 대상이며 UI도 즉시 재시도를 권하지 않습니다.
- 계정 삭제, 비활성화, Auth ban은 범위 밖입니다.
- 초대 route는 server-only `R10_INVITATIONS_ENABLED === 'true'`일 때만 활성화하며, 비활성 상태는 owner/ledger/Admin side effect 없이 `503 + invitation_maintenance + private, no-store`로 닫습니다. 역할 조회·역할 변경 route에는 이 gate를 적용하지 않습니다.


## A′ claim ledger 결정
- `private.staff_invitation_requests`는 queue/worker가 아니라 요청 claim과 복구 상태만 보존하는 최소 ledger입니다. private schema/table은 RLS를 켜고 Data API role에 schema/table 직접 권한을 주지 않습니다.
- public `SECURITY DEFINER` RPC는 user JWT 구조를 유지하기 위한 제한적 예외입니다. 모든 RPC가 빈 `search_path`, 완전 수식 객체, `auth.uid()` owner 재검사, transaction advisory lock을 사용하며 PUBLIC/anon/service_role EXECUTE를 회수하고 authenticated만 명시적으로 허용합니다.
- 동일 request ID를 다른 actor/fingerprint가 재사용하면 충돌하고, 활성 fingerprint의 부분 unique index가 다른 request ID 경합도 canonical row 하나로 수렴시킵니다. 신규 claim과 `failed_definitive` 재claim은 같은 request ID가 기존 `role_management_events`에 있으면 Admin side effect 전에 `22023`으로 거부합니다. claim token은 최초 winner의 server 흐름에서만 사용하고 API 응답·로그·replay에는 노출하지 않습니다.
- stale `claimed`와 Admin API의 timeout/모호한 오류는 `unknown`으로 유지해 자동 takeover/reinvite를 금지합니다. `unknown`은 active unique index를 계속 점유하며 자동 만료·재전송·직접 UPDATE/DELETE로 해제하지 않습니다. 운영자는 비식별 ledger 상태와 Auth user/profile/동일 request provisioning audit을 대조하고 세 증거가 일치할 때만 reconcile로 `provisioned` 처리합니다. 증거가 없거나 상충하면 초대 route를 중지하고 incident로 유지하며, 감사 가능한 별도 resolution 계약이 승인되기 전에는 임의 해제하지 않습니다.
- HMAC key를 겸하는 `SUPABASE_SECRET_KEY`가 회전하면 기존 active fingerprint와 새 fingerprint가 달라져 at-most-once 장벽을 우회할 수 있습니다. 회전은 초대 route `503 + no-store` 선중지 → in-flight 0 → 기존 key의 active `claimed`/`auth_succeeded`/`unknown` 0 확인 → 모든 server instance secret 교체·재배포 → 새 key smoke와 old active 0 재확인 → route 재개의 순서로만 진행합니다. 기존 fingerprint를 재계산·삭제하지 않습니다.
<!-- migrated-decision:end -->
