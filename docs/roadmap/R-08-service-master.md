# R-08 Service Master

## 상태
- Planned (data contract prepared; implementation not started)
- 구현 브랜치: `codex/r08-service-master` (착수 시 최신 `origin/main`에서 새 clean worktree로 생성)
- 최종 업데이트: 2026-07-12

## 목표
- 자유입력 시술명을 서비스 마스터 데이터로 표준화합니다.
- 서비스별 정수 KRW 가격, 기본 소요시간, 활성 여부, 정렬 순서를 관리합니다.
- 예약 시점의 시술명·소요시간·가격을 snapshot으로 보존해 이후 서비스 변경이 과거 예약과 통계를 바꾸지 않게 합니다.

## 현재 데이터 모델 근거
- `salon_service_defaults`에는 이미 `id`, `name`, `default_duration_minutes`, `is_active`, `sort_order`, 생성·수정 시각이 있습니다.
- `/settings` owner UI가 이 테이블을 관리하고 `/appointments/new`는 활성 서비스의 이름과 기본 소요시간을 예약의 `service`, `duration_minutes`에 저장합니다.
- `appointments`에는 현재 필수 text `service`와 nullable `duration_minutes`가 있지만 서비스 FK와 가격 snapshot은 없습니다.
- 현재 설정 UI의 삭제는 hard delete이므로 예약 FK를 추가하기 전에 비활성화 UX와 DB 경계를 함께 바꿔야 합니다.

## 기본 권장안과 대안

### 권장안: `salon_service_defaults` 확장
- 기존 설정 UI, RLS, 예약 기본값 연결을 재사용하고 `price_krw`를 추가합니다.
- 같은 개념의 테이블을 중복 생성하지 않아 migration과 운영 전환 범위가 작습니다.
- 테이블 이름은 과거의 `defaults`를 포함하지만 현재 이미 서비스 카탈로그 역할을 하므로 이름 변경은 별도 필요성이 입증될 때만 검토합니다.

### 대안: 신규 `services` 테이블
- 다중 지점, 별도 versioning, 독립 권한·생명주기가 필요하다는 구체적 요구가 생길 때만 선택합니다.
- 현재 단계에서 선택하면 기존 `salon_service_defaults`와의 이중화, ID 이관, UI 전환 비용이 생기므로 기본안으로 채택하지 않습니다.

## 데이터 계약

### 서비스 마스터
- `salon_service_defaults.price_krw`: nullable integer KRW, 값이 있으면 `0 이상`. 기존 서비스 가격을 추정하지 않고 owner가 확인할 때까지 `NULL`을 허용합니다.
- 할인, 쿠폰, 부가세 분리, 다중통화는 R-08 범위 밖입니다.
- 참조된 서비스는 hard delete하지 않고 `is_active=false`로 비활성화합니다.
- 비활성 서비스는 신규 예약 선택지에서 제외하되 기존 예약의 snapshot과 조회 이력은 유지합니다.

### 예약 snapshot
- `appointments.service_id`: nullable FK → `salon_service_defaults.id`, 삭제 정책은 `ON DELETE RESTRICT`를 기본안으로 합니다.
- `appointments.price_snapshot_krw`: nullable integer KRW, 값이 있으면 `0 이상`입니다.
- 기존 `appointments.service`, `appointments.duration_minutes`는 당시 시술명·소요시간 snapshot으로 계속 유지합니다.
- 새 예약은 선택한 서비스의 ID·이름·기본 소요시간·가격을 같은 저장 경계에서 snapshot합니다.
- 기존 예약에는 현재 서비스명이나 현재 가격을 추정 backfill하지 않습니다. `service_id`와 `price_snapshot_krw`가 없으면 그대로 `NULL`, 즉 가격 미설정 이력으로 보존합니다.
- 예약 수정 시 서비스 선택을 바꿀 때만 snapshot 전체를 새 서비스 기준으로 갱신하고, 무관한 메모·상태 수정은 기존 snapshot을 유지하는 정책을 기본안으로 합니다.

## 구현 전 필수 결정

### snapshot 강제 위치
- A안: DB trigger가 서비스 선택 변경 시 snapshot을 강제합니다. 모든 writer에 일관되지만 과거 이력 수정과 예외 처리를 trigger에 명확히 설계해야 합니다.
- B안: 전용 예약 create/update RPC에서 snapshot을 강제하고 관련 direct write 권한을 회수합니다. 흐름은 명확하지만 기존 직접 insert/update 호출을 모두 이관해야 합니다.
- 구현 전 현재 writer를 전수 확인하고 하나를 선택합니다. UI에서만 값을 복사하고 DB 우회 경로를 허용하는 방식은 채택하지 않습니다.

### RLS와 write 경계
- owner는 서비스 생성·수정·비활성화를 수행합니다.
- owner/staff는 활성 서비스와 기존 예약이 참조하는 서비스 정보를 읽을 수 있어야 합니다.
- staff의 가격 변경 허용 여부, 비활성 서비스 조회 범위, direct table write 유지 여부를 구현 Plan에서 별도 확정합니다.
- 신규 FK/함수/view는 Data API grant와 RLS를 별개로 검토하고 anon 접근을 허용하지 않습니다.

## Non-Goals
- 기존 예약 가격 추정 또는 매출 backfill
- 할인/쿠폰/부가세/원가/다중통화/결제·정산 기능
- R-09 통계 UI 또는 aggregate RPC 구현
- 새 `services` 테이블의 선제 생성

## 완료 기준
- 위 데이터 계약과 snapshot 강제 방식/RLS 결정이 승인됨
- migration과 `schema.sql`이 동기화됨
- owner 서비스 관리와 staff 활성 서비스 조회 경계가 DB/UI에서 일치함
- 예약 생성·수정에서 ID·시술명·소요시간·가격 snapshot이 원자적으로 저장됨
- 참조 서비스 hard delete가 차단되고 비활성화 후에도 과거 예약이 유지됨
- 기존 예약의 nullable 가격 미설정 상태가 변형 없이 유지됨

## 검증 계획
- 전체 forward migration fresh replay와 `schema.sql` semantic 비교
- owner/staff/anon 서비스 조회·관리 및 예약 저장 RLS/RPC smoke
- snapshot 저장·서비스 가격 변경 후 과거 예약 불변·비활성 서비스·FK RESTRICT 회귀 검증
- 기존 예약 `service_id`/`price_snapshot_krw`가 추정 backfill되지 않았는지 비식별 count 검증
- bundled Node `npm run build`, `git diff --check`
- UI 구현 시 Pencil SSOT 선반영과 390x844·360x800 before/after 검증

## 선행조건과 다음 단계
- R-05는 main에 반영되어 있고 기존 서비스 기본값 모델과 UI가 존재합니다.
- 구현 시작 전에 remote `main` SHA를 재확인하고 최신 `origin/main`에서 `codex/r08-service-master` clean worktree를 만듭니다.
- R-08 완료와 가격 snapshot 검증 전에는 R-09를 구현하지 않습니다.
