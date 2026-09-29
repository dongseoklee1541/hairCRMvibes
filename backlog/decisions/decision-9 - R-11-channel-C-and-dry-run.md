---
id: decision-9
title: R-11-channel-C-and-dry-run
date: '2026-09-29 14:45'
status: accepted
---

# R-11-channel-C-and-dry-run

이관일: 2026-09-29 KST; native 생성 날짜는 원래 결정일/구현일을 대신하지 않는다. 상태: `accepted`. 등록은 실행 승인이 아니다.

## 선택·대안·이유·제약

채널 A/B/C 비교에서 C안 선택 및 첫 실행 단위 dry-run의 확정 경계만 채택했다. 설계 결정일은 2026-07-16이며 구현 보류가 유지된다. native decision 날짜는 이관 생성일이다.

원문 결정·비교·제약: [docs/roadmap/R-11-notification-automation.md](../docs/features/doc-13%20-%20R-11-notification-automation.md)

<!-- migrated-decision:start -->
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
<!-- migrated-decision:end -->
