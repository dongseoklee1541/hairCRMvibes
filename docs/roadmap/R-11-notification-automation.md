# R-11 알림 자동화 선행 설계

## 상태
- Design Ready (PR #31 merged; implementation deferred)
- 우선순위: P2
- 설계 브랜치: `codex/r11-notification-design`
- 최초 기준: `origin/codex/r10-role-management@0d14192b665779cf7476a2c77fa7ac4985bfb45b` (이력)
- R-10 최종 병합 기준: PR #26 merge `main@6cfb71e88cbe4bbfd3a8469a3c5b4487a3ccb449`
- 현재 설계 기준: PR #31 merge `origin/main@93c94bbac22d263cdca5fcb6ab0ee6b7e7295523`
- 구현 재개 조건: 최신 `main`·provider·법령·요금제·예약 계약을 다시 감사하고 별도 R-11 Implementation Plan을 승인
- 최종 업데이트: 2026-07-16

## 2026-07-16 결정 기록 — 구현 보류와 첫 실행 단위
- PR #31은 merge commit `93c94bbac22d263cdca5fcb6ab0ee6b7e7295523`으로 `main`에 병합됐습니다.
- R-11은 취소된 것이 아니라 설계가 준비된 채 구현을 보류한 상태입니다. 현재 구현 branch/PR, migration, dependency, provider/Cron/VAPID 설정, 실제 발송은 없습니다.
- 다른 roadmap 업무를 먼저 진행할 수 있으며, 재개할 때는 최신 `main`과 외부 계약을 다시 감사합니다.
- 재개 시 첫 실행 단위는 채널 대안의 A안과 구분해 **dry-run 전용 foundation**으로 부릅니다. 이 단위는 대상 선정·권한·dedupe·비식별 집계만 검증하고 외부 채널을 활성화하지 않습니다.

### Dry-run 전용 foundation의 확정 경계
- `execution_mode = 'dry_run'`만 생성할 수 있고 `live`, provider attempt, `manual_review`, Push 구독, 외부 dispatch는 구조적으로 비활성화합니다.
- dry-run run 집계와 `simulated` job/delivery의 제품 기본 보존기간은 30일입니다. 이는 법정 보존기간이 아니라 운영 확인을 위한 최소 제품 정책이며, 30일 만료 데이터를 복구 불가능하게 자동 파기하는 경로가 검증되지 않으면 dry-run도 활성화하지 않습니다.
- dry-run은 raw 전화번호, Push endpoint, 메시지 본문, provider 식별자·응답을 조회하거나 저장하지 않습니다.
- dry-run 기록을 삭제해도 live dedupe·frequency cap에는 영향을 주지 않도록 execution mode의 key 공간을 분리합니다.

### Live 단계에 남기는 결정 게이트
- 실제 발송을 도입할 때 상세 job/delivery/attempt를 파기하더라도 재발송 가능 기간에는 `dedupe_key`, event/source revision, channel, execution mode, terminal status, 처리·만료 시각, HMAC key version으로 제한한 최소 tombstone을 유지합니다.
- live 상세 이력과 tombstone의 보존기간은 provider 조회·재시도 계약, 예약 안내 유효기간, 마케팅 frequency cap, 동의 증빙 의무를 검토해 별도 승인합니다.
- `manual_review`와 재시도 절차는 아래 상태 전이 계약을 따르며 provider가 확정되기 전에는 구현하거나 활성화하지 않습니다.

## 문제 정의
R-11의 기존 설명은 "예약 전/재방문 리마인드 자동 발송"이고 채널 기본값은 PWA Push였습니다. 그러나 현재 PWA의 authenticated 사용자는 원장과 직원이며 고객용 로그인·설치·구독 흐름은 없습니다. 따라서 현재 앱의 PWA Push는 고객 리마인드가 아니라 직원의 내부 운영 알림입니다.

R-11에서는 목적과 수신자를 먼저 분리합니다.

| 목적 | 수신자 | 권장 채널 | 제품 효과 |
| --- | --- | --- | --- |
| 예약 안내 | 고객 | SMS adapter | 예약 일시 확인과 노쇼 감소에 직접 기여 |
| 예약 운영 알림 | 원장·직원 | PWA Push | 당일·익일 예약 확인 업무 지원 |
| 재방문 유도 | 명시적으로 동의한 고객 | SMS 등 고객 직접 채널 | 재방문율 향상, 별도 마케팅 동의 필요 |

고객용 Web Push는 별도 고객 인증, 동일 origin 설치, 구독 연결 흐름이 없으므로 이번 설계의 채널로 선택하지 않습니다.

## 목표
- 고객 예약 안내와 직원 운영 알림을 같은 기능으로 오해하지 않도록 제품·데이터·화면 경계를 분리합니다.
- 발송 채널보다 먼저 공통 scheduler/outbox, claim, attempt, settle, reconciliation 계약을 정의합니다.
- 취소·과거 예약, 비활성 고객, 동의 철회, 중복 Cron, 외부 응답 유실에 안전한 후보 규칙과 상태 전이를 정의합니다.
- R-10의 `profiles.role` 권한 SSOT를 재사용하되 invitation ledger의 내부 상태명이나 RPC에는 결합하지 않습니다.
- 실제 고객·예약·전화번호·Push endpoint를 문서, 로그, 응답, 스크린샷, 캐시에 남기지 않는 경계를 정의합니다.
- 구현 전에 Pencil에서 owner 설정, 직원 Push 활성화, 발송 상태의 모바일 UX를 검증합니다.

## 비목표
- SMS 사업자, 요금제, 발신번호, webhook 계약 확정
- 실제 SMS·Push 발송이나 브라우저 권한 요청
- 고객용 PWA·고객 로그인·공개 구독 링크 구현
- R-10 invitation ledger 재사용 또는 변경
- 예약 상태에 `no_show` 추가, 기존 통계·예약 화면 변경
- Supabase Cron/PGMQ extension 활성화
- live migration, 환경변수 변경, Production 배포

## 확인된 저장소 기준선
- 예약은 `customer_id`, `date`, `time`, `service`, `service_id`, `duration_minutes`, `price_snapshot_krw`, `memo`, `status`를 사용합니다.
- 예약 상태는 `confirmed`, `completed`, `cancelled` 세 종류이며 `no_show`는 없습니다.
- 고객 `phone`은 선택값이고 `phone_normalized`가 있지만 SMS 수신 동의·철회·채널 선호 데이터는 없습니다.
- `archived_at`, `merged_into_customer_id`, `anonymized_at`이 있는 고객 lifecycle을 사용합니다.
- `lib/dateTime.js`는 KST date key를 지원하지만 `date + time`을 KST instant로 변환하는 공용 helper는 없습니다.
- 기존 `/api/cron/supabase-keepalive`는 `CRON_SECRET`, Node runtime, `no-store`, server-only Supabase 패턴을 사용합니다.
- `next.config.mjs`는 Supabase, `/api/**`, document와 catch-all을 NetworkOnly로 유지합니다.
- 생성된 `public/sw.js`를 직접 수정하지 않습니다. Push 구현 시 source custom worker를 사용하고 build로 합성합니다.

## 채널 대안과 결정

### A안: 직원 PWA Push만 구현
- 장점: 현재 PWA와 staff Auth를 재사용하고 고객 전화번호를 외부 사업자에게 전달하지 않습니다.
- 단점: 고객에게 직접 도달하지 않아 예약 리마인드·재방문 자동 발송이라는 R-11 목표를 완전히 충족하지 못합니다.

### B안: 고객 SMS만 구현
- 장점: 고객의 앱 설치 없이 예약 안내를 직접 전달합니다.
- 단점: 외부 사업자, 비용, 발신번호, 동의·철회, 개인정보 처리위탁, 발송 결과 webhook 계약이 필요합니다.

### C안: 채널 공통 기반 + 목적별 adapter — 선택
- 공통 outbox와 권한·감사·재조정 구조를 먼저 구현합니다.
- 고객 예약 안내는 SMS adapter를 첫 고객 채널로 둡니다.
- 직원 운영 알림은 별도 PWA Push adapter로 둡니다.
- 재방문 유도는 예약 안내와 분리된 마케팅 동의·빈도 제한 후 활성화합니다.
- 최초 구현은 provider 미선정 상태의 `dry_run`까지 허용해 대상 선정·중복 방지·권한을 먼저 검증할 수 있게 합니다.

## 기능 단계

### 1단계: Dry-run 및 대상 검증
- owner만 자동화 설정과 예상 대상 건수를 확인합니다.
- 실제 수신처를 반환하지 않고 예약 안내·재방문·직원 운영 알림의 집계만 표시합니다.
- 미래 live 단계에서는 `execution_mode = 'dry_run' | 'live'`를 job과 delivery dedupe key에 포함해 두 실행 공간을 분리하되, 첫 foundation에서는 `dry_run`만 허용합니다.
- dry-run은 raw 수신처를 조회하거나 provider attempt를 만들지 않고 live attempt count·frequency cap도 소비하지 않습니다.
- outbox 생성, dedupe, 취소·동의 철회 재검증을 synthetic 데이터로 검증하며, live 전환 시에는 별도의 live job을 생성합니다.
- dry-run delivery는 live claim·dispatch 상태로 들어가지 않고 DB 안에서 `queued -> simulated`로 종료합니다. lease 만료·재claim·외부 호출 전후 crash는 synthetic provider를 사용한 live-mode mock에서 별도로 검증합니다.
- dry-run run 집계와 `simulated` job/delivery는 30일 뒤 파기하고 provider attempt와 `manual_review` row는 만들지 않습니다.

### 2단계: 고객 예약 안내 SMS
- 순수 예약 정보만 보내며 할인·쿠폰·재예약 유도 문구를 섞지 않습니다.
- 발송 직전에 예약 상태, 예약 시각, 고객 lifecycle, 전화번호와 수신 자격을 다시 확인합니다.
- 사업자가 provider idempotency key를 지원하면 R-11 dedupe key를 전달합니다.
- provider 결과가 불명확하면 자동 재발송하지 않고 `manual_review`로 격리합니다.

### 3단계: 직원 PWA Push
- owner와 staff가 자신의 현재 기기에서 직접 구독합니다.
- 잠금 화면 payload에는 고객 이름, 전화번호, 서비스, 메모를 포함하지 않습니다.
- `410 Gone` 등 만료 응답과 앱 재진입 시 reconciliation으로 subscription을 비활성화합니다.

### 4단계: 재방문 마케팅
- 예약 안내 동의와 분리된 명시적 수신 동의가 있어야 합니다.
- 동의 시각, 출처, 문구 버전, 철회 시각과 채널을 보존합니다.
- 고객별 frequency cap, 야간 차단, 즉시 수신거부와 동의 재확인 정책을 별도 승인받습니다.

## 후보 선정 규칙

### 고객 예약 안내
발송 후보는 다음을 모두 만족해야 합니다.

- 예약 `status = 'confirmed'`
- 예약 KST instant가 현재보다 미래이고 설정한 안내 window 안에 있음
- 고객 `archived_at`, `merged_into_customer_id`, `anonymized_at`이 모두 `null`
- 유효한 `phone_normalized`가 있음
- 예약 안내 SMS가 금지 또는 철회 상태가 아님
- 동일 예약 revision, 안내 종류, 채널, 수신자에 대한 완료·불명확 job이 없음

예약 revision은 일반 `updated_at`이 아니라 `date`, `time`, `status`, `customer_id`, `event_kind`, `template_version`처럼 발송 자격·메시지 의미에 영향을 주는 필드의 안정적인 material fingerprint로 계산합니다. memo-only 변경은 새 job을 만들지 않습니다. 시간·고객 연결이 바뀌면 아직 외부 호출 전인 기존 delivery를 `ineligible`로 만들고 새 revision 후보를 생성합니다. 이미 provider가 접수한 뒤의 예약 변경 안내 정책은 별도 승인 gate로 둡니다.

발송 직전 같은 조건을 다시 검사합니다. 취소·완료·시간 변경·고객 병합·익명화·수신 철회가 확인되면 외부 호출 없이 `cancelled` 또는 `ineligible`로 종료합니다.

### 직원 운영 알림
- 대상 profile의 현재 역할이 `owner` 또는 `staff`
- profile과 현재 Push subscription이 활성 상태
- 당일·익일 `confirmed` 예약 집계 또는 운영상 확인할 사건이 존재
- 동일 사용자·기기·알림 종류·KST 대상일에 완료된 delivery가 없음

직원 Push에는 집계와 앱 내부 경로만 포함합니다. 고객 PII는 앱을 연 뒤 현재 권한으로 NetworkOnly API에서 다시 조회합니다.

외부 Push 호출 직전에도 `profiles.role`, subscription 활성 상태, `ownership_verified_until`, subscription `user_id`를 다시 확인합니다. profile 누락·허용 역할 이탈·비활성·소유권 확인 만료 또는 소유자 불일치는 외부 호출 없이 `ineligible`로 종료합니다. lease는 인증된 동일 사용자가 앱에 진입하거나 명시적으로 구독 상태를 확인할 때만 짧게 갱신합니다. 로그아웃 시 server subscription 비활성화를 best-effort로 시도하지만 네트워크 단절·프로세스 종료에 실패할 수 있으므로 lease 만료가 최종 fail-closed 안전장치입니다. 같은 브라우저에서 다른 계정이 확인되면 endpoint fingerprint가 같은 이전 사용자 행을 먼저 비활성화하고, 새 사용자에게 자동 재바인딩하지 않으며 새 사용자의 명시적인 동작으로만 다시 연결합니다.

### 재방문 후보
- 고객 lifecycle이 활성 상태
- 마지막 유효 예약이 `completed`
- 마지막 완료 이후 설정 임계기간이 지남
- 마지막 완료 이후 `confirmed` 또는 `completed` 예약이 없음
- 재방문 마케팅의 해당 채널 사전 동의가 유효함
- frequency cap과 야간 발송 제한을 통과함

현재 스키마에는 `no_show` 상태가 없으므로 노쇼율 자체는 R-11 완료 지표로 사용하지 않습니다. 1차 지표는 대상·발송·실패·수동 확인 건수와 예약 안내 활성화율이며, 노쇼 상태 도입은 별도 roadmap 결정입니다.

## 시간 계약
- 사용자 입력과 업무 기준은 KST입니다.
- 예약 instant는 SQL에서 `(appointment.date + appointment.time) AT TIME ZONE 'Asia/Seoul'`과 동등한 방식으로 계산하고 경계 테스트를 둡니다.
- Vercel Hobby Cron은 job당 하루 1회가 최소 주기이고 지정 hour 안에서 최대 59분 오차가 있을 수 있으므로 "정확히 24시간 전"을 약속하지 않습니다.
- Hobby 1차 계약은 "익일 예약을 설정한 KST 시간대에 일괄 처리"입니다.
- 예약 1시간 전, 짧은 재시도, 정확한 분 단위 SLA가 필요하면 Vercel Pro 또는 별도 승인된 Supabase Cron을 선택합니다.
- Cron expression은 UTC라는 점을 문서와 test fixture에 명시합니다.

참고:
- [Vercel Cron Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel Cron 관리·중복·멱등성](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Supabase Cron](https://supabase.com/docs/guides/cron)

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

## 상태 전이와 멱등성

아래 상태 전이는 개별 `notification_deliveries`에 적용하고 job 상태는 자식 delivery의 집계로 계산합니다.

```text
eligible
  -> queued
     -> simulated (dry-run only)
     -> claimed (live only)
        -> dispatch_started
           -> provider_accepted -> delivered (provider callback이 있을 때)
           -> retry_wait -> claimed
           -> failed_definitive
           -> manual_review
              -> provider_accepted | delivered | failed_definitive
              -> confirmed_not_sent -> retry_wait -> claimed
  -> cancelled | ineligible | expired
```

- `INSERT ... ON CONFLICT DO NOTHING`으로 동일 job과 delivery의 `dedupe_key` 생성을 원자 차단합니다.
- worker는 짧은 transaction에서 `FOR UPDATE SKIP LOCKED` 또는 동등한 claim RPC로 due delivery를 claim합니다.
- 외부 호출 직전에 attempt를 만들고 delivery를 `dispatch_started`로 바꾸는 transaction을 먼저 commit합니다.
- 외부 Push/SMS 호출은 DB transaction 밖에서 수행합니다.
- provider 접수 확인 뒤 `provider_accepted`, 전달 callback이 있으면 `delivered`, 명확한 영구 실패는 `failed_definitive`, 응답 유실·타임아웃은 `manual_review`로 settle합니다.
- delivery callback을 제공하지 않는 채널은 `provider_accepted`를 해당 adapter의 최종 성공 상태로 사용하며 실제 열람·도달을 과장하지 않습니다.
- `manual_review`는 provider 조회 전 자동 재전송하지 않습니다. owner의 추정이나 단순 운영 판단만으로 `confirmed_not_sent` 또는 성공 상태를 지정할 수 없습니다.
- provider의 인증된 조회 API, 서명된 webhook 또는 동등하게 검증 가능한 근거가 `not sent`를 입증하고 현재 예약·고객·동의 자격을 다시 통과한 경우에만 owner가 재시도를 요청할 수 있습니다. 유효 시간이 지났거나 증거가 불충분하면 `retry 없이 종료` 또는 `expired`로 처리합니다.
- owner는 `provider_accepted`·`delivered`를 직접 지정하지 못하며 해당 상태는 provider adapter/reconciler만 기록합니다. owner resolve RPC는 대상 delivery를 잠그고 현재 상태·version을 확인한 뒤 resolution audit과 상태 전이를 한 transaction에 기록합니다.
- `confirmed_not_sent`가 입증된 경우에만 owner 전용 resolve RPC가 같은 delivery를 `retry_wait`로 전환합니다. 이 RPC는 attempt를 만들지 않으며, 새 순번의 attempt는 이후 worker가 `claimed -> dispatch_started`로 전환하는 기존 transaction에서 단 한 번 생성합니다. unknown 원 attempt를 덮어쓰거나 새 delivery로 복제하지 않습니다. provider idempotency key를 재사용할지는 선택 사업자의 조회·재시도 계약을 확인한 뒤 release gate에서 확정합니다.
- retryable 실패만 backoff+jitter와 최대 시도 횟수 안에서 `retry_wait`로 전환합니다.
- `dispatch_started`가 없는 만료 `claimed` delivery만 안전하게 재claim합니다.
- 만료된 `dispatch_started` delivery는 외부 호출이 실제로 일어났을 가능성이 있으므로 `manual_review` 또는 provider reconciliation으로 보내고 자동 재발송하지 않습니다.
- Cron은 특정 분의 job이나 마지막 성공 시각 하나만 보지 않습니다. bounded overlap window의 source를 다시 스캔하고 `scheduled_for <= now()`인 미완료 job을 재조정하며 dedupe key로 반복 스캔을 흡수합니다.

job 상태는 중복 저장해 비동기적으로 갱신하지 않고 기본적으로 자식 delivery의 derived aggregate view/RPC로 계산합니다. 검색 성능 때문에 materialized summary를 도입할 경우 fan-out·settle RPC transaction 안에서만 갱신하고 원본 delivery와의 drift 검사를 둡니다.

외부 서비스와 PostgreSQL 사이에 단일 transaction이 없으므로 exactly-once 발송을 약속하지 않습니다. 목표는 DB에서의 중복 job 방지, provider idempotency 활용, 불명확 결과의 자동 재발송 차단입니다.

provider callback을 사용하는 adapter는 전용 webhook route에서 provider 서명·timestamp·content type·body size를 검증하고 unique event ID로 replay를 차단합니다. callback은 사용자 JWT를 신뢰하지 않으며 상태는 단조롭게만 전이합니다. 늦거나 순서가 뒤바뀐 callback과 owner resolve가 충돌하면 기존 결과를 덮어쓰지 않고 provider event와 resolution을 append-only로 남긴 뒤 승인된 상태 전이표로 판정합니다.

## 권한 매트릭스

| 주체 | 자동화 설정 | 대상 집계 | 발송 이력 집계 | Push 구독 | job/delivery/attempt 원문 | 발송 worker |
| --- | --- | --- | --- | --- | --- | --- |
| Owner | 조회·변경 | 허용, 비식별 집계 | 허용, 마스킹 | 자신의 기기 | 거부 | 거부 |
| Staff | 거부 | 거부 | 거부 | 자신의 기기 | 거부 | 거부 |
| Profileless | 거부 | 거부 | 거부 | 거부 | 거부 | 거부 |
| Anon/PUBLIC | 거부 | 거부 | 거부 | 거부 | 거부 | 거부 |
| Cron/server worker | 설정 읽기 | 내부 처리 | 내부 기록 | 만료 처리 | 최소 필요 범위 | 허용 |

- browser role 숨김은 UX일 뿐 권한 근거로 사용하지 않습니다.
- owner API와 설정 RPC는 호출 시점의 `profiles.role`을 다시 확인합니다.
- staff 구독 API는 caller JWT의 `auth.uid()`와 subscription의 `user_id` 일치를 강제합니다.
- job, delivery, attempt, Push secret material은 private schema 또는 Data API 비노출 영역을 우선합니다.
- private schema를 선택하면 browser와 server route 모두 table `.from()`으로 직접 접근하지 않고 public schema의 최소 SECURITY DEFINER RPC를 통해서만 claim·settle·집계를 수행합니다.
- 현재 앱에 direct PostgreSQL 연결 경로는 없으므로 private table을 supabase-js Data API에서 직접 조회할 수 있다고 가정하지 않습니다.
- public schema를 선택하면 모든 table에 RLS를 활성화하고 anon/authenticated direct grant를 회수한 뒤 최소 RPC만 노출합니다.
- SECURITY DEFINER는 빈 `search_path`, 완전 수식 객체, PUBLIC EXECUTE 회수, 명시적 grant를 사용합니다.

## 개인정보와 메시지 경계
- 고객 전화번호는 발송 직전 server memory에서만 조회하고 job·delivery·attempt·응답·로그에 복제하지 않습니다.
- owner 화면에는 raw phone 대신 마스킹 수신처 또는 집계만 표시합니다.
- Push payload와 lock-screen 문구에는 고객 이름, 전화번호, 서비스, 메모를 포함하지 않습니다.
- Push endpoint, `p256dh`, `auth` key는 secret과 같은 server-only 데이터로 취급합니다.
- SMS provider secret과 VAPID private key는 `NEXT_PUBLIC_` 이름을 사용하지 않습니다.
- recipient fingerprint용 HMAC secret은 provider secret과 분리하고 key version을 저장해 rotation 중 신·구 fingerprint 비교 범위를 통제합니다.
- API, Supabase, 설정 document는 기존 NetworkOnly 정책을 유지합니다.
- 서비스워커 Cache Storage, localStorage, IndexedDB에 고객 목록, 전화번호, 발송 이력, Push private material을 저장하지 않습니다.
- 로그에는 job ID, channel, 정규화 오류 code, 집계만 허용합니다.

### 메시지 목적과 동의 gate
- 브라우저 Notification 권한은 Push 수신을 허용하는 기술적 권한이며 재방문 광고 수신동의를 대신하지 않습니다.
- 순수 예약 확인·변경 안내는 체결된 거래를 확인·완성하기 위한 정보에 해당할 여지가 있지만, 할인·쿠폰·재예약 유도 문구를 섞지 않습니다.
- 재방문 유도는 보수적으로 광고성 정보로 분류하고 명시적인 사전 동의 전에는 발송하지 않습니다.
- 광고성 정보의 수신거부·동의 철회를 즉시 반영하고, 21:00~08:00 발송은 별도 사전 동의 없이는 금지합니다.
- 고객 재방문 SMS에는 광고성 정보 표시, 전송자 식별, 간편한 수신거부, 동의·거부·철회 의사 표시일부터 14일 이내의 처리 결과 고지와 2년 주기 동의 확인을 template·consent 상태·운영 절차에 포함합니다.
- 고객 광고 수신거부에 로그인 같은 복잡한 절차를 강제하지 않습니다. 직원 운영 Push의 기기 구독 해제와 고객 마케팅 수신거부는 서로 다른 UX·법적 목적으로 분리합니다.
- 이 문서는 법률 자문을 대신하지 않습니다. Production 발송 전 실제 메시지 template, 수신동의 문구, 수집 경로, 사업자 위탁 범위를 별도 법률·운영 검토로 확정합니다.

Web Push 참고:
- [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [iOS/iPadOS Home Screen Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

## UI/Pencil 설계 범위

### `/settings` 진입점
- 카드 제목: `알림 자동화`
- 설명: `예약 안내와 직원 알림을 설정합니다.`
- 고객 문자와 직원 앱 알림을 한 채널처럼 보이지 않게 합니다.

### `/settings/notifications` owner 화면
- `고객 예약 안내`: SMS 준비 상태, 대상 기준, dry-run 건수
- `직원 앱 알림`: 활성 기기 수, 자신의 기기 알림 상태
- `재방문 안내`: 별도 동의 필요, 기본 비활성
- `발송 상태`: 최근 처리 시각, provider 접수·전달·실패·확인 필요 집계
- Hobby에서는 `정확한 발송 시각` 대신 `매일 오전 중 처리`처럼 실제 정밀도에 맞는 문구를 사용합니다.

### 직원 Push 활성화
- 미지원 브라우저
- iOS 홈 화면 설치 필요
- 권한 요청 전
- 구독 처리 중
- 활성
- 권한 거부 및 설정 앱 안내
- 구독 만료·오류와 다시 연결

권한 요청은 사용자의 명시적인 `이 기기 알림 켜기` 동작 뒤에만 실행합니다.

owner 전용 `/settings`는 staff가 접근할 수 없으므로 staff의 자기 기기 구독은 `/settings/notifications`에만 두지 않습니다. 다음 별도 route와 권한 경계를 사용합니다.

- owner 설정: `/settings/notifications`
- owner·staff 자기 기기: `/notifications/device`
- owner 진입점: `/settings/notifications`의 `이 기기 앱 알림`
- staff 진입점: R-14 홈과 PR #29 예약 화면이 안정된 뒤 공용 authenticated 화면에서 선택
- staff는 자동화 설정·전체 발송 이력 없이 자신의 subscription 상태만 조회·변경
- `/notifications/device`의 route guard는 `owner`, `staff`만 허용하고 profileless·anon은 fail-closed합니다.

### 발송 상태
- empty: 아직 처리 내역 없음
- loading
- provider 접수·전달 확인 집계
- 일부 실패 및 retry 예정
- `manual_review`: 중복 방지를 위해 자동 재전송하지 않는다는 설명
- Cron 누락 후 catch-up 완료

### 모바일 기준
- 390×844와 360×800
- 모든 상호작용 44×44px 이상
- 핵심 CTA 52~56px 우선
- 하단 safe-area와 긴 한글 문구 고려
- loading, empty, error, disabled, denied, unsupported, expired 상태 구분
- focus-visible, `aria-live`, dialog focus 복원

### Pencil 검증 근거
- 변경 전 파일 SHA-1: `a2019b2e78c386bc589f0003de090e051b0d358b`
- 변경 후 파일 SHA-1: `ab0031613a52c7c2242b6856d2c82da405327f8c`
- 설정 진입점 `edUw4`(390×844), owner 자동화 설정 `J3bas`(390×844), 자기 기기 상태 `S5VGVz`(360×800), owner 발송 상태 `pFmgV`(390×844)를 추가했습니다.
- 네 R-11 frame과 기존 R-10 `v5otbf/ckGvh/CaBNI/PtvkE`, R-12 `rYt9h/mVQYv`, R-14 `U1DsdP/e8e2Nz`의 `snapshot_layout(problemsOnly)`가 모두 0건입니다.
- 신규 frame은 고객 이름·전화번호·예약 상세 대신 합성 집계·채널 상태만 사용합니다.
- before: `output/playwright/r11-notification-design/before/rYt9h.png`
- after: `output/playwright/r11-notification-design/after/edUw4.png`, `J3bas.png`, `S5VGVz.png`, `pFmgV.png`
- 설계 당시 R-11 고유 커밋만 `origin/main@d8e6e8a` 위로 재배치해 공유 SSOT를 동기화했고, 이후 PR #31 merge `main@93c94bb`로 반영했습니다. R-10의 `main` 병합은 충족됐으며 R-11 구현은 현재 보류 상태입니다.

## 구현 예상 범위 — 별도 승인 필요
- `supabase/migrations/<timestamp>_r11_notification_automation.sql`
- `supabase/rollbacks/<timestamp>_r11_notification_automation.down.sql`
- `schema.sql`
- `supabase/tests/r11_notification_automation.sql`
- `supabase/tests/r11_notification_concurrency.sh`
- `app/api/cron/notifications/route.js`
- provider callback을 사용하는 경우 `app/api/webhooks/notifications/[provider]/route.js`
- `app/api/notifications/settings/route.js`
- `app/api/notifications/subscriptions/route.js`
- `app/api/notifications/deliveries/[deliveryId]/resolve/route.js`
- `lib/server/notificationAutomationCore.mjs`
- `lib/server/notificationAutomationSupabase.mjs`
- `lib/server/notificationChannels/dryRun.mjs`
- 선택 채널 adapter
- `app/settings/notifications/page.js` 및 CSS module
- `app/notifications/device/page.js` 및 CSS module
- `components/settings/NotificationAutomationPanel.js` 및 CSS module
- 직원 자기 기기 Push 설정 component
- Push 선택 시 source custom worker, `next.config.mjs`
- `vercel.json`
- `scripts/verify-r11-notification-automation.mjs`
- provider SDK를 선택하는 경우에만 `package.json`, lockfile

R-10 invitation API·ledger와 PR #29의 `app/appointments/page.js`, 예약/date 테스트는 R-11 구현 파일로 재사용하거나 동시에 수정하지 않습니다.

## 검증 계약

### Database
- 전체 forward migration fresh replay와 `schema.sql` 의미 동등성
- owner/staff/profileless/anon/PUBLIC 권한
- 반복 dry-run, dry-run 뒤 live, live 뒤 dry-run의 dedupe·frequency cap 분리
- 한 번·여러 날 Cron 누락, 중복·중첩 run, 실패 뒤 다음 run의 overlap-window catch-up
- material revision: memo-only 변경 무발송, 시간·고객·template 변경 새 후보와 기존 queued 취소
- 같은 job/delivery dedupe key 동시 insert 1건
- 서로 다른 예약 2건이 같은 recipient fingerprint를 사용할 때 각 delivery 1건, 같은 예약 revision의 동시 insert만 1건
- job 생성 직후 crash와 N개 subscription fan-out 중간 crash에서 부분 fan-out commit 0건
- 한 사용자 다중 subscription fan-out과 기기별 delivery 결과
- 다중 worker `SKIP LOCKED` claim 중복 0건
- 외부 호출 전 crash의 stale `claimed`는 재claim, 외부 호출 가능 상태의 stale `dispatch_started`는 manual-review
- retry backoff, max-attempt, manual-review
- 취소·시간 변경·고객 병합·익명화·수신 철회 직전 경합
- 동일 normalized phone 고객 2명, 번호 변경, 고객 병합, 상충 동의·철회와 HMAC key rotation
- queue 뒤 role 이탈, profile 누락, logout 비활성화 실패 뒤 계정 전환, `ownership_verified_until` 만료 전후와 subscription 만료 경합
- manual-review 병렬 해소, `confirmed_not_sent -> retry_wait -> claimed` owner 승인과 동일 승인 replay, resolve 직후 attempt 수 불변·다음 dispatch에서만 1 증가
- KST 자정·월경계·DST 비적용 fixture
- synthetic 고객·예약·job·subscription residue 0건

### Server/API
- Cron secret 누락·오류 401, `no-store`
- owner 설정 조회·변경 허용, staff 403
- staff 자신의 Push 구독만 허용
- provider success, definitive failure, timeout/unknown, idempotent replay mock
- owner-only manual-review resolve 허용, staff/profileless/anon 거부, 같은 resolve 요청의 멱등 replay
- provider webhook 서명·timestamp·body 제한, event replay, out-of-order·late callback 단조 전이
- raw phone, provider payload, endpoint, key, token 로그·응답 0건
- serverless 다중 instance 동시 호출 가정

### Mobile/PWA
- 390×844, 360×800
- owner 설정, staff 구독, profileless/anon 차단
- iOS install-required, permission default/granted/denied, unsupported
- custom worker push/click 및 구독 reconciliation
- Push lock-screen payload PII 0건
- offline에서 stale 설정·발송 이력을 표시하지 않고 재연결 후 최신 조회
- Cache Storage의 고객·전화번호·발송 이력·Push material 0건
- console/page error와 RSC offline 회귀 0건

### Cron/release
- 현재 요금제의 실제 Cron 최소 간격과 정밀도 재확인
- 누락·중복·겹친 호출 reconciliation
- 기존 keepalive Cron 보존
- Preview는 synthetic 데이터와 dry-run만 사용
- 실제 provider secret·발신번호·VAPID key·동의 문구 확인 전 Production 발송 비활성
- migration → secret/config → dry-run → limited enable 순서

## 완료 기준
이번 선행 설계는 다음을 모두 만족하면 `Design Ready`입니다.

- 목적별 채널, 후보 규칙, 상태 전이, 권한, 개인정보 경계가 본 문서에 명시됨
- SMS provider·법적 동의·정확한 발송 SLA가 구현 전 승인 항목으로 남아 있음
- Pencil에 설정 진입점, owner 자동화 설정, 직원 Push 상태, 발송 상태가 존재함
- 390×844와 360×800 신규 Pencil frame의 layout problem이 0건임
- `.pen` 파일 hash가 실제로 변경되고 내보낸 이미지에 민감정보가 없음
- R-10 최종 head와 동기화 후 R-10/R-12/R-14 node가 보존됨
- 구현 파일과 검증 계약이 별도 Implementation Plan에 바로 사용 가능한 수준임

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

## 위험과 완화
- PWA Push가 고객 알림으로 오해될 수 있음: 목적·수신자·채널을 화면과 데이터에서 분리합니다.
- Cron은 누락·중복·동시 실행될 수 있음: lock과 dedupe만으로 끝내지 않고 catch-up reconciliation을 함께 둡니다.
- Dry-run이 live dedupe를 소비할 수 있음: execution mode를 key와 상태에서 분리하고 dry-run은 provider attempt·frequency cap을 만들지 않습니다.
- job commit 뒤 fan-out이 중단될 수 있음: job과 전체 delivery fan-out을 한 RPC transaction으로 원자화하고 불완전 job을 정상 집계하지 않습니다.
- 외부 발송은 exactly-once가 아님: provider idempotency를 사용하고 unknown은 자동 재전송하지 않습니다.
- 고객 상태가 발송 직전 바뀔 수 있음: 외부 호출 바로 전에 자격을 재검사합니다.
- 전화번호와 Push endpoint가 확산될 수 있음: job에는 source ID만 저장하고 수신처는 server-only로 늦게 조회합니다.
- 공유 전화번호와 계정 전환이 잘못된 수신자에게 이어질 수 있음: versioned contact fingerprint와 발송 직전 role·subscription 소유권 재검사를 적용합니다.
- 재방문 메시지가 광고 규정을 위반할 수 있음: 예약 안내와 동의를 분리하고 별도 법적·운영 승인 전 기본 비활성으로 둡니다.
- R-10 계약이 변경 중임: 역할 SSOT만 의존하고 invitation 내부 계약과 결합하지 않습니다.
- PR #29가 예약 화면 동작을 바꿈: R-11은 DB source 계약만 사용하고 구현 전 최신 main의 예약 규칙을 재검증합니다.

## Rollback
- 설계 변경은 `codex/r11-notification-design` 커밋만 revert합니다.
- Pencil은 변경 전 hash와 R-11 신규 node 목록으로 R-11 frame만 되돌립니다.
- R-10 worktree, 원본 main, 기존 미추적 검증 산출물은 변경하지 않습니다.
- 이번 단계는 DB, Auth, Vercel, provider를 변경하지 않으므로 운영 rollback이 없습니다.
- 향후 구현 rollback은 발송 비활성 → worker grant 회수 → 앱 revert → 승인된 down migration 순서로 별도 계획합니다.

## 공식 참고
- [Vercel Cron Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel Cron 관리·중복·멱등성](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Supabase Queues](https://supabase.com/docs/guides/queues/pgmq)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [WebKit iOS/iPadOS Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html)
- [PostgreSQL SELECT locking](https://www.postgresql.org/docs/current/sql-select.html)
- [개인정보 보호법 제21조 개인정보의 파기](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0021&lsiSeq=270351&urlMode=lsScJoRltInfoR)
- [KISA 광고성 정보 예외 FAQ](https://spam.kisa.or.kr/spam/na/ntt/selectNttInfo.do?bbsId=1003&mi=1037&nttSn=1367)
- [KISA 불법스팸 방지 안내서 제7차 개정본](https://spam.kisa.or.kr/spam/na/ntt/selectNttInfo.do?bbsId=1002&mi=1020&nttSn=3001)
- [정보통신망법 제50조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1025057501)
- [정보통신망법 시행령 제62조의2](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=81508)
- [정보통신망법 시행령 제62조의3](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=81509)
