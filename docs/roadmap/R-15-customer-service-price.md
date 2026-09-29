# 이동 안내

2026-09-29 KST부터 이 경로의 편집을 종료했습니다. 작업·문서 관리는 Backlog.md에서 수행합니다.

- 전체 원문·계약·날짜별 근거: [doc-19](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md)
- 현재 작업/후보: [TASK-15](../../backlog/tasks/task-15%20-%20R-15-%EA%B3%A0%EA%B0%9D%EB%B3%84-%EC%8B%A4%EC%A0%9C-%EC%8B%9C%EC%88%A0%EA%B8%88%EC%95%A1.md)
- 탐색: [doc-42](../../backlog/docs/doc-42%20-%20backlog-catalog.md)
- 관리 절차: [doc-41](../../backlog/docs/operations/doc-41%20-%20backlog-workflow.md)
- 이관표: [doc-43](../../backlog/docs/migration/doc-43%20-%20backlog-migration-20260929.md)

기존 경로는 외부 링크 연결용 이동 안내입니다. 본문·현재 상태표·체크리스트를 다시 작성하지 않습니다.

<a id="r-15-고객별-실제-시술금액-입력수정"></a>
[R-15 고객별 실제 시술금액 입력·수정](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#r-15-고객별-실제-시술금액-입력수정)

<a id="상태"></a>
[상태](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#상태)

<a id="현재-계약과-남은-범위"></a>
[현재 계약과 남은 범위](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#현재-계약과-남은-범위)

<a id="구현-전-설계-기록"></a>
[구현 전 설계 기록](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#구현-전-설계-기록)

<a id="사용자-요구"></a>
[사용자 요구](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#사용자-요구)

<a id="구현-전-코드-근거"></a>
[구현 전 코드 근거](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#구현-전-코드-근거)

<a id="용어와-가격-의미"></a>
[용어와 가격 의미](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#용어와-가격-의미)

<a id="대안-비교"></a>
[대안 비교](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#대안-비교)

<a id="a안---실제-금액-컬럼-분리-권장"></a>
[A안 - 실제 금액 컬럼 분리 (권장)](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#a안---실제-금액-컬럼-분리-권장)

<a id="b안---price_snapshot_krw를-직접-수정"></a>
[B안 - `price_snapshot_krw`를 직접 수정](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#b안---price_snapshot_krw를-직접-수정)

<a id="c안---가격-변경-원장-테이블"></a>
[C안 - 가격 변경 원장 테이블](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#c안---가격-변경-원장-테이블)

<a id="권장-데이터-모델"></a>
[권장 데이터 모델](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#권장-데이터-모델)

<a id="상태별-규칙"></a>
[상태별 규칙](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#상태별-규칙)

<a id="화면별-ux"></a>
[화면별 UX](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#화면별-ux)

<a id="appointmentsnew"></a>
[`/appointments/new`](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#appointmentsnew)

<a id="appointments"></a>
[`/appointments`](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#appointments)

<a id="customersid"></a>
[`/customers/[id]`](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#customersid)

<a id="권한과-개인정보-경계"></a>
[권한과 개인정보 경계](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#권한과-개인정보-경계)

<a id="r-09-통계-결정-게이트"></a>
[R-09 통계 결정 게이트](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#r-09-통계-결정-게이트)

<a id="a안---실제-금액만-매출로-집계-정확성-우선-권장"></a>
[A안 - 실제 금액만 매출로 집계 (정확성 우선 권장)](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#a안---실제-금액만-매출로-집계-정확성-우선-권장)

<a id="b안---실제-금액-우선-snapshot-fallback"></a>
[B안 - 실제 금액 우선, snapshot fallback](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#b안---실제-금액-우선-snapshot-fallback)

<a id="c안---실제-매출과-예약-기준금액을-별도-지표로-병렬-표시"></a>
[C안 - 실제 매출과 예약 기준금액을 별도 지표로 병렬 표시](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#c안---실제-매출과-예약-기준금액을-별도-지표로-병렬-표시)

<a id="구현-예상-범위"></a>
[구현 예상 범위](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#구현-예상-범위)

<a id="완료-기준"></a>
[완료 기준](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#완료-기준)

<a id="테스트-요구사항"></a>
[테스트 요구사항](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#테스트-요구사항)

<a id="non-goals"></a>
[Non-Goals](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#non-goals)

<a id="위험과-완화"></a>
[위험과 완화](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#위험과-완화)

<a id="구현-전-결정사항"></a>
[구현 전 결정사항](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#구현-전-결정사항)

<a id="rollback"></a>
[Rollback](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#rollback)

<a id="구현release-결과"></a>
[구현·release 결과](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#구현release-결과)

<a id="남은-리스크"></a>
[남은 리스크](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#남은-리스크)

<a id="2026-09-11-금액-입력-사용성-수정--로컬preview-검증-완료"></a>
[2026-09-11 금액 입력 사용성 수정 — 로컬·Preview 검증 완료](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#2026-09-11-금액-입력-사용성-수정--로컬preview-검증-완료)

<a id="범위와-설계-예외"></a>
[범위와 설계 예외](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#범위와-설계-예외)

<a id="원인과-수정"></a>
[원인과 수정](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#원인과-수정)

<a id="검증-결과"></a>
[검증 결과](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#검증-결과)

<a id="검증-자료"></a>
[검증 자료](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#검증-자료)

<a id="preview-배포인증-후-검증"></a>
[Preview 배포·인증 후 검증](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#preview-배포인증-후-검증)

<a id="당시-남은-범위와-롤백-2026-09-11"></a>
[당시 남은 범위와 롤백 (2026-09-11)](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#당시-남은-범위와-롤백-2026-09-11)

<a id="입력-수정-병합배포-확인-2026-09-22"></a>
[입력 수정 병합·배포 확인 (2026-09-22)](../../backlog/docs/features/doc-19%20-%20R-15-customer-service-price.md#입력-수정-병합배포-확인-2026-09-22)
