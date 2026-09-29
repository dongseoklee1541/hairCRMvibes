# 이동 안내

2026-09-29 KST부터 이 경로의 편집을 종료했습니다. 작업·문서 관리는 Backlog.md에서 수행합니다.

- 전체 원문·계약·날짜별 근거: [doc-13](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md)
- 현재 작업/후보: [TASK-11](../../backlog/tasks/task-11%20-%20R-11-%EC%95%8C%EB%A6%BC-%EC%9E%90%EB%8F%99%ED%99%94-%EC%84%A4%EA%B3%84-%EC%99%84%EB%A3%8C%C2%B7%EA%B5%AC%ED%98%84-%EB%B3%B4%EB%A5%98.md)
- 탐색: [doc-42](../../backlog/docs/doc-42%20-%20backlog-catalog.md)
- 관리 절차: [doc-41](../../backlog/docs/operations/doc-41%20-%20backlog-workflow.md)
- 이관표: [doc-43](../../backlog/docs/migration/doc-43%20-%20backlog-migration-20260929.md)

기존 경로는 외부 링크 연결용 이동 안내입니다. 본문·현재 상태표·체크리스트를 다시 작성하지 않습니다.

<a id="r-11-알림-자동화-선행-설계"></a>
[R-11 알림 자동화 선행 설계](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#r-11-알림-자동화-선행-설계)

<a id="상태"></a>
[상태](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#상태)

<a id="2026-07-16-결정-기록--구현-보류와-첫-실행-단위"></a>
[2026-07-16 결정 기록 — 구현 보류와 첫 실행 단위](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#2026-07-16-결정-기록--구현-보류와-첫-실행-단위)

<a id="dry-run-전용-foundation의-확정-경계"></a>
[Dry-run 전용 foundation의 확정 경계](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#dry-run-전용-foundation의-확정-경계)

<a id="live-단계에-남기는-결정-게이트"></a>
[Live 단계에 남기는 결정 게이트](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#live-단계에-남기는-결정-게이트)

<a id="문제-정의"></a>
[문제 정의](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#문제-정의)

<a id="목표"></a>
[목표](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#목표)

<a id="비목표"></a>
[비목표](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#비목표)

<a id="확인된-저장소-기준선"></a>
[확인된 저장소 기준선](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#확인된-저장소-기준선)

<a id="채널-대안과-결정"></a>
[채널 대안과 결정](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#채널-대안과-결정)

<a id="a안-직원-pwa-push만-구현"></a>
[A안: 직원 PWA Push만 구현](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#a안-직원-pwa-push만-구현)

<a id="b안-고객-sms만-구현"></a>
[B안: 고객 SMS만 구현](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#b안-고객-sms만-구현)

<a id="c안-채널-공통-기반--목적별-adapter--선택"></a>
[C안: 채널 공통 기반 + 목적별 adapter — 선택](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#c안-채널-공통-기반--목적별-adapter--선택)

<a id="기능-단계"></a>
[기능 단계](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#기능-단계)

<a id="1단계-dry-run-및-대상-검증"></a>
[1단계: Dry-run 및 대상 검증](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#1단계-dry-run-및-대상-검증)

<a id="2단계-고객-예약-안내-sms"></a>
[2단계: 고객 예약 안내 SMS](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#2단계-고객-예약-안내-sms)

<a id="3단계-직원-pwa-push"></a>
[3단계: 직원 PWA Push](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#3단계-직원-pwa-push)

<a id="4단계-재방문-마케팅"></a>
[4단계: 재방문 마케팅](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#4단계-재방문-마케팅)

<a id="후보-선정-규칙"></a>
[후보 선정 규칙](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#후보-선정-규칙)

<a id="고객-예약-안내"></a>
[고객 예약 안내](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#고객-예약-안내)

<a id="직원-운영-알림"></a>
[직원 운영 알림](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#직원-운영-알림)

<a id="재방문-후보"></a>
[재방문 후보](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#재방문-후보)

<a id="시간-계약"></a>
[시간 계약](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#시간-계약)

<a id="제안-데이터-모델"></a>
[제안 데이터 모델](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#제안-데이터-모델)

<a id="notification_automation_settings"></a>
[`notification_automation_settings`](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#notification_automation_settings)

<a id="notification_scheduler_runs"></a>
[`notification_scheduler_runs`](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#notification_scheduler_runs)

<a id="notification_jobs"></a>
[`notification_jobs`](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#notification_jobs)

<a id="notification_deliveries"></a>
[`notification_deliveries`](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#notification_deliveries)

<a id="notification_attempts"></a>
[`notification_attempts`](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#notification_attempts)

<a id="staff_push_subscriptions"></a>
[`staff_push_subscriptions`](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#staff_push_subscriptions)

<a id="customer_contact_preferences--sms-구현-시"></a>
[`customer_contact_preferences` — SMS 구현 시](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#customer_contact_preferences--sms-구현-시)

<a id="상태-전이와-멱등성"></a>
[상태 전이와 멱등성](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#상태-전이와-멱등성)

<a id="권한-매트릭스"></a>
[권한 매트릭스](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#권한-매트릭스)

<a id="개인정보와-메시지-경계"></a>
[개인정보와 메시지 경계](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#개인정보와-메시지-경계)

<a id="메시지-목적과-동의-gate"></a>
[메시지 목적과 동의 gate](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#메시지-목적과-동의-gate)

<a id="uipencil-설계-범위"></a>
[UI/Pencil 설계 범위](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#uipencil-설계-범위)

<a id="settings-진입점"></a>
[`/settings` 진입점](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#settings-진입점)

<a id="settingsnotifications-owner-화면"></a>
[`/settings/notifications` owner 화면](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#settingsnotifications-owner-화면)

<a id="직원-push-활성화"></a>
[직원 Push 활성화](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#직원-push-활성화)

<a id="발송-상태"></a>
[발송 상태](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#발송-상태)

<a id="모바일-기준"></a>
[모바일 기준](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#모바일-기준)

<a id="pencil-검증-근거"></a>
[Pencil 검증 근거](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#pencil-검증-근거)

<a id="구현-예상-범위--별도-승인-필요"></a>
[구현 예상 범위 — 별도 승인 필요](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#구현-예상-범위--별도-승인-필요)

<a id="검증-계약"></a>
[검증 계약](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#검증-계약)

<a id="database"></a>
[Database](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#database)

<a id="serverapi"></a>
[Server/API](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#serverapi)

<a id="mobilepwa"></a>
[Mobile/PWA](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#mobilepwa)

<a id="cronrelease"></a>
[Cron/release](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#cronrelease)

<a id="완료-기준"></a>
[완료 기준](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#완료-기준)

<a id="현재-결정-상태와-구현-전-게이트"></a>
[현재 결정 상태와 구현 전 게이트](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#현재-결정-상태와-구현-전-게이트)

<a id="위험과-완화"></a>
[위험과 완화](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#위험과-완화)

<a id="rollback"></a>
[Rollback](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#rollback)

<a id="공식-참고"></a>
[공식 참고](../../backlog/docs/features/doc-13%20-%20R-11-notification-automation.md#공식-참고)
