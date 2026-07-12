# R-09 Stats Advanced

## 상태
- Planned (metric contract prepared; implementation not started)
- 구현 브랜치: `codex/r09-stats-advanced` (최신 `origin/main`에서 별도 clean worktree로 생성)
- 최종 업데이트: 2026-07-12

## 목표
- 기존 예약 건수 중심 통계를 매출, 유상 완료 예약 객단가, 재방문율, 가격 데이터 품질 지표로 확장합니다.
- R-04 KST date key와 R-08 예약 가격 snapshot을 기준으로 기간 경계를 일관화합니다.
- 고객·예약 원본과 고객명을 브라우저로 대량 전송하지 않고 최소 집계 결과만 제공합니다.

## 현재 구현 근거
- `/stats`는 브라우저에서 해당 월 `appointments.*`와 `customers(id, name)`을 조회한 뒤 JavaScript로 건수·완료율·취소율·최근 고객을 계산합니다.
- 현재 `appointments` status는 `confirmed`, `completed`, `cancelled` 세 값뿐이며 `no-show` 상태는 없습니다.
- R-08 가격 snapshot 컬럼과 저장 경계는 `main@01440b6`과 live migration 10개에 반영됐고, live transactional role/snapshot smoke를 통과했습니다.
- 기존 서비스 4건과 예약 7건은 no-backfill 원칙에 따라 가격·서비스 FK가 NULL입니다. R-09는 이를 데이터 품질 상태로 처리하며 현재 가격으로 추정하지 않습니다.
- R-08 Production 선행조건은 충족됐고, 재방문율 세부 사업 정의와 owner/staff 통계 권한 매트릭스가 R-09 구현 전 결정 항목입니다.

## 지표 계약

### 기간 경계
- 사용자가 선택한 KST 시작일·종료일을 기준으로 집계합니다.
- 서버 aggregate 계층이 KST date 범위를 해석하며 브라우저 timezone이나 UTC 자정에 따라 기간이 달라지지 않아야 합니다.
- 월간 지표도 같은 KST 범위 계약의 특수한 경우로 처리합니다.

### 매출
- `status='completed'`이고 `price_snapshot_krw is not null`인 예약만 합산합니다.
- 가격 미설정 완료 예약은 매출을 0원으로 추정하지 않고 합계에서 제외합니다.
- 취소·확정 예약은 매출에 포함하지 않습니다.
- 현재 존재하지 않는 no-show 상태를 임의로 만들거나 취소에 포함하지 않습니다.

### 객단가
- `status='completed'`이고 `price_snapshot_krw > 0`인 유상 완료 예약만 분모와 분자에 사용합니다.
- 계산식은 `유상 완료 예약 매출 합계 / 유상 완료 예약 건수`입니다.
- 0원 완료 예약과 가격 미설정 완료 예약은 객단가에서 제외하고 각각의 건수를 별도 품질/운영 지표로 확인할 수 있게 합니다.

### 가격 데이터 품질
- 가격 미설정 완료 예약 건수와 완료 예약 대비 비율을 별도 지표로 제공합니다.
- 과거 예약에 현재 서비스 가격을 대입하거나 이름으로 추정 매칭하지 않습니다.
- R-08 도입 이후 가격 미설정 완료 예약은 데이터 품질 지표로 분리하고 조사하되, 서비스 가격 자체가 미설정이거나 완료 이력을 마스터 없이 직접 입력한 정상 허용 사례일 수 있으므로 자동으로 snapshot 회귀로 단정하지 않습니다.
- 필요하면 `service_id IS NULL`과 `service_id IS NOT NULL AND price_snapshot_krw IS NULL`을 보조 분류해 자유입력 이력과 마스터 가격 미설정을 구분합니다.

### 재방문율
- 권장 정의: 선택한 KST 기간 내 완료 예약이 1건 이상인 고유 고객을 분모로 하고, 같은 기간 완료 예약이 2건 이상인 고객을 분자로 합니다.
- 계산식은 `기간 내 완료 예약 2건 이상 고객 수 / 기간 내 완료 예약 고객 수`입니다.
- 이 정의는 구현 권장안이지만 첫 방문 제외 여부나 관찰 기간을 별도로 둘지는 사업 결정 사항입니다. 승인 전 확정값으로 간주하지 않습니다.

### 시술별 지표
- 시술별 매출·건수는 예약에 저장된 당시 `service`와 `price_snapshot_krw`를 기준으로 합니다.
- 현재 서비스 마스터 이름이나 가격 변경으로 과거 집계가 재분류·재계산되지 않아야 합니다.
- nullable `service_id`는 표준화 보조 키로 사용하되 기존 text snapshot을 버리지 않습니다.

## 데이터 제공·보안 경계
- 브라우저에 전체 예약 row, 고객 ID 목록, 고객명을 내려 보내 집계하지 않습니다.
- A안(권장): 기간과 권한을 검증하는 aggregate RPC가 필요한 KPI와 제한된 ranking row만 반환합니다.
- B안: `security_invoker` aggregate view와 명시적 grant/RLS를 사용합니다. 조합성은 높지만 노출 column과 임의 기간 조회 경계를 더 엄격히 검토해야 합니다.
- `SECURITY DEFINER` RPC가 필요하면 내부 `auth.uid()`/role 검증, 빈 `search_path`, PUBLIC·anon EXECUTE 회수와 최소 반환 column을 필수로 합니다.
- owner/staff가 동일 지표를 볼지, owner 전용 매출 지표를 둘지는 구현 전 권한 매트릭스로 확정합니다.
- 집계 결과에는 고객 이름·전화번호·메모를 포함하지 않습니다.

## Non-Goals
- no-show 상태 신설 또는 추정
- 할인/쿠폰/부가세/환불/원가/이익 계산
- 가격 미설정 과거 예약의 추정 backfill
- 고객별 원본 목록을 통계 API 응답으로 제공

## 완료 기준
- R-08 서비스/가격 snapshot migration과 회귀 검증 완료
- 매출·객단가·가격 미설정·재방문율의 SQL 계약 및 사업 결정 승인
- KST 기간 경계를 적용한 aggregate RPC 또는 최소 권한 view 구현
- 브라우저 raw appointment/customer-name 대량 조회 제거
- 빈 데이터·로딩·오류·부분 데이터 품질 상태 제공
- owner/staff/anon 조회 권한이 DB와 UI에서 일치함

## 검증 계획
- KST 일/월 경계와 사용자 선택 기간의 포함·제외 회귀 검증
- completed/confirmed/cancelled, 양수/0/NULL 가격 조합별 매출·객단가 검증
- 가격 미설정 완료 예약 count/rate와 기존 예약 무추정 원칙 검증
- 재방문율 분모 0, 1회 고객, 2회 이상 고객 fixture 검증
- anon 차단, owner/staff 권한, 최소 반환 column, raw 고객명 미반환 확인
- aggregate 결과와 제한된 server-side 기준 SQL의 일치 확인
- bundled Node `npm run build`, `git diff --check`
- UI 구현 시 Pencil SSOT 선반영과 390x844·360x800 before/after 검증

## 선행조건과 다음 단계
- R-04 KST 날짜 유틸은 main에 반영됐습니다.
- R-08 Production 완료와 `price_snapshot_krw` live 저장 경계 검증을 마쳤습니다.
- 구현 시작 시 remote `main` SHA를 재확인하고 최신 `origin/main`에서 `codex/r09-stats-advanced` clean worktree를 별도로 만듭니다.
