---
id: decision-10
title: R-11-proposed-model-and-live-gates
date: '2026-09-29 14:45'
status: proposed
---

# R-11-proposed-model-and-live-gates

이관일: 2026-09-29 KST; native 생성 날짜는 원래 결정일/구현일을 대신하지 않는다. 상태: `proposed`. 등록은 실행 승인이 아니다.

## 선택·대안·이유·제약

제안 데이터 모델과 미확정 live/provider·동의·비용·retention·manual_review·HMAC/VAPID·진입점 gate를 확정 결정으로 승격하지 않는다. 부분적으로 이미 확정된 dry-run 경계는 accepted 결정과 구분한다.

원문 결정·비교·제약: [docs/roadmap/R-11-notification-automation.md](../docs/features/doc-13%20-%20R-11-notification-automation.md)

<!-- migrated-decision:start -->
## 제안 데이터 모델
아래는 구현 전 계약이며 이번 설계 작업에서 migration을 만들지 않습니다.

### `notification_automation_settings`
- singleton 또는 salon scope key
- 목적별 enabled 상태
- 예약 안내 기준일, KST 처리 시간대
- 재방문 임계기간과 frequency cap
- 활성 channel과 `dry_run` 여부
- owner actor, 갱신 시각, 설정 version

현재 단일 salon 구조에서는 고정 singleton key를 사용합니다. 다중 salon을 도입하기 전까지 임의 scope 문자열로 설정 행을 늘리지 않습니다.

### `notification_scheduler_runs`
- `run_id`, `schedule_key`, `execution_mode`
- `window_from`, `window_to`
- `started_at`, `finished_at`, `status`
- 비식별 aggregate counts와 정규화 오류 code

Cron 성공 시각 하나에 의존하지 않고 매 실행마다 안전한 overlap window를 다시 검색합니다. run은 어떤 window를 완전히 스캔했는지 설명하는 운영 근거이고, 실제 중복 차단은 source/job unique key가 담당합니다. 실패한 run의 checkpoint를 성공으로 전진시키지 않습니다.

### `notification_jobs`
- `id`, `event_kind`
- `appointment_id` 또는 `customer_id`; 둘 중 해당 source만 사용
- `execution_mode`, `rule_version`, `template_version`
- 발송 자격에 영향을 주는 필드만으로 만든 `source_revision_hash`
- `scheduled_for`; job 상태는 delivery 집계로 파생
- `dedupe_key` unique
- `created_at`, `fanout_completed_at`, `settled_at`, `last_error_code`

job은 하나의 업무 사건을 나타내며 수신자·기기별 발송은 아래 delivery로 fan-out합니다. job 생성과 해당 시점의 전체 delivery fan-out은 한 SECURITY DEFINER RPC transaction에서 함께 commit하고, 일부 delivery만 생긴 job을 공개하지 않습니다. transaction 경계 밖의 fan-out이 필요한 규모가 되면 `fanout_pending | fanout_complete` 상태와 누락 delivery reconciliation을 먼저 별도 승인받습니다. derived aggregate는 자식 delivery가 0건이거나 `fanout_completed_at`이 없는 job을 정상 완료로 해석하지 않습니다. raw phone, 고객 이름, 메모, SMS 본문, Push endpoint는 저장하지 않습니다.

### `notification_deliveries`
- `job_id`, `channel`
- `recipient_kind`, `customer_id` 또는 `push_subscription_id`
- versioned keyed HMAC `recipient_fingerprint`; raw phone이나 Push endpoint의 대체 공개 식별자로 사용하지 않음
- job identity(`job_id`, 또는 event kind·source ID·source revision·rule/template version) + execution mode + channel + recipient fingerprint 단위 `dedupe_key` unique
- `status`, `claim_token`, `claimed_at`, `lease_until`
- `attempt_count`, `next_attempt_at`, `settled_at`, `last_error_code`

SMS는 customer 단위 delivery 1건을 만들고, 직원 Push는 활성 subscription별 delivery를 만듭니다. 한 직원이 여러 기기를 구독해도 각 기기의 결과·만료·재시도를 독립적으로 처리합니다.

### `notification_attempts`
- delivery ID와 순번
- 시작·완료 시각
- 외부 호출 직전 커밋하는 `dispatch_started_at`
- provider의 최소 식별자 또는 hash
- `provider_accepted`, `delivered`, `failed_definitive`, `unknown` 결과
- 정규화한 오류 code와 retryable 여부
- `manual_review` 해소 시 `resolved_by`, `resolved_at`, `resolution_code`와 비식별 근거

provider 전체 응답, phone, 고객 이름, token, endpoint를 저장하지 않습니다.

### `staff_push_subscriptions`
- `user_id`, subscription 식별 hash
- endpoint와 암호화 key를 포함한 server-only subscription material
- 생성·최근 확인·만료·비활성 시각
- 브라우저·기기 전체 user-agent 문자열 대신 최소 플랫폼 분류
- 마지막으로 소유권을 확인한 user ID, `ownership_verified_until`, session 전환 시 비활성화할 lifecycle 상태

Push endpoint는 발송 권한을 제공하는 capability URL이므로 일반 authenticated 조회나 owner 목록 응답에도 노출하지 않습니다.

### `customer_contact_preferences` — SMS 구현 시
- `customer_id`, versioned `recipient_fingerprint`, `purpose`, `channel`, `status`
- 동의·철회 시각, 출처, 문구 version
- 법적 보존 필요성과 개인정보 최소 보유 원칙을 조정한 retention 정책

`appointment_transactional`과 `revisit_marketing` 목적을 같은 동의로 합치지 않습니다.

현재 active customer의 `phone_normalized`는 unique가 아니므로 contact-point 판단을 customer ID만으로 하지 않습니다. server-only 비밀로 만든 versioned keyed HMAC fingerprint를 delivery dedupe와 frequency cap에 사용하되 fingerprint 자체도 개인정보로 취급합니다. 전화번호 변경 시 기존 마케팅 동의를 새 번호로 자동 승계하지 않습니다. 동일 번호를 공유하는 활성 고객의 마케팅 동의가 모호하거나 상충하면 발송하지 않고 중복 고객 정리 또는 명시적 재동의를 요구합니다. 예약 안내는 appointment와 material revision 단위로 구분하되 같은 appointment·전화번호의 중복 발송을 차단합니다.


## 현재 결정 상태와 구현 전 게이트

Dry-run 전용 foundation에 대해서는 다음이 결정됐습니다.

- 구현은 현재 보류하고 다른 roadmap 업무를 우선합니다.
- 재개 시 `dry_run`만 허용하고 live·attempt·`manual_review`·외부 dispatch를 비활성화합니다.
- dry-run run 집계와 `simulated` job/delivery는 제품 기본값 30일 뒤 파기합니다.
- 실제 발송을 위한 보존·tombstone·HMAC·`manual_review` 절차는 live 단계 gate로 유지합니다.

다음은 live 단계 전에 별도로 확정해야 합니다.

- SMS 사업자·요금·발신번호와 provider idempotency/webhook 지원
- `confirmed_not_sent` 재시도에서 provider idempotency key 재사용이 안전한지에 대한 사업자 계약
- 예약 안내의 정보성 메시지 범위와 동의·수신거부 정책
- 재방문 마케팅의 동의 문구·동의 확인·보존·야간·빈도 정책
- Hobby의 일일 익일 일괄 처리 유지 또는 Pro/Supabase Cron 전환
- live job/delivery/attempt와 최소 dedupe tombstone의 retention
- provider 증거 수준, 늦은 callback 충돌 처리, owner resolve 권한을 포함한 `manual_review` 운영 절차
- recipient fingerprint HMAC key rotation·version·보존 범위
- VAPID key 발급·회전·폐기 및 Preview/Production 분리
- staff용 `/notifications/device` 진입점을 홈 또는 다른 공용 authenticated 화면 중 어디에 둘지

현재는 구현을 보류합니다. 재개 시에는 별도 Implementation Plan 승인 후 dry-run 전용 foundation만 먼저 진행하며, 위 live gate가 모두 닫히기 전에는 live migration 확장, dependency, Cron, worker, 실제 발송을 시작하지 않습니다.
<!-- migrated-decision:end -->
