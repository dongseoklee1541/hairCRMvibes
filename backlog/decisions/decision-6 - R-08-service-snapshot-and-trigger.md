---
id: decision-6
title: R-08-service-snapshot-and-trigger
date: '2026-09-29 14:45'
status: accepted
---

# R-08-service-snapshot-and-trigger

이관일: 2026-09-29 KST; native 생성 날짜는 원래 결정일/구현일을 대신하지 않는다. 상태: `accepted`. 등록은 실행 승인이 아니다.

## 선택·대안·이유·제약

기존 테이블 확장과 nullable KRW/예약 snapshot을 채택한다. 신규 테이블·추정 backfill·전용 RPC 전체 writer 이관 대안과 제약은 원문을 따른다.

원문 결정·비교·제약: [docs/roadmap/R-08-service-master.md](../docs/features/doc-9%20-%20R-08-service-master.md)

<!-- migrated-decision:start -->
## 채택한 모델

### 기존 `salon_service_defaults` 확장
- 신규 `services` 테이블을 만들지 않고 기존 설정 UI·RLS·예약 기본값 연결을 재사용합니다.
- `salon_service_defaults.price_krw`는 nullable integer KRW이며 값이 있으면 `0 이상`입니다.
- `salon_operation_settings.default_service_id`는 nullable FK이며 삭제 정책은 `ON DELETE SET NULL`입니다. 이름으로 추정 backfill하지 않고, non-NULL 값은 활성 서비스만 허용합니다.
- 현재 기본 서비스는 다른 활성 기본 서비스를 먼저 저장하기 전까지 비활성화할 수 없습니다.
- 사용한 서비스는 hard delete하지 않고 `is_active=false`로 비활성화하며 과거 예약 snapshot은 유지합니다.
- 할인, 쿠폰, 부가세 분리, 원가, 다중통화는 R-08 범위 밖입니다.

### 예약 snapshot
- `appointments.service_id`: nullable FK → `salon_service_defaults.id`, `ON DELETE RESTRICT`.
- `appointments.price_snapshot_krw`: nullable integer KRW, 값이 있으면 `0 이상`.
- 기존 `appointments.service`, `appointments.duration_minutes`는 당시 이름·소요시간 snapshot으로 계속 유지합니다.
- 신규 `confirmed` 예약은 활성 `service_id`가 필수입니다. 신규 `cancelled` 자유입력도 허용하지 않으며, 서비스 없는 신규 자유입력은 `completed` 이력에만 허용합니다.
- 기존 `confirmed + service_id NULL` 행의 무관한 수정은 호환을 위해 허용하지만, 완료/취소 상태에서 `confirmed`로 되돌릴 때는 활성 서비스를 요구합니다.
- 한 번 서비스가 연결된 예약은 `service_id`를 NULL로 해제할 수 없습니다.
- 서비스 ID가 바뀌면 DB가 당시 마스터 이름과 가격을 강제합니다. `duration_minutes`가 NULL이면 새 서비스 기본시간을 사용하고, non-NULL 값은 이전 값과 같더라도 예약별 override로 보존합니다.
- 같은 서비스 ID의 메모·상태·소요시간 수정은 과거 이름·가격 snapshot을 현재 마스터 값으로 재평가하지 않습니다.
- 기존 예약과 기존 서비스에는 현재 이름·가격을 추정 backfill하지 않습니다. 새 컬럼은 그대로 NULL로 보존합니다.


## 채택한 저장·권한 경계

### DB trigger
- `BEFORE INSERT/UPDATE` trigger가 서비스 존재·활성 여부, 이름·가격 snapshot, 연결 해제 금지, NULL 자유입력 상태 경계를 강제합니다.
- snapshot trigger가 먼저 실행된 뒤 R-03 영업시간/충돌 guard가 최종 `duration_minutes`로 검사하도록 trigger 이름 순서와 `service_id` 감시 대상을 고정했습니다.
- 기본 서비스 지정과 비활성화의 교차 테이블 invariant도 별도 `BEFORE` trigger 두 개와 공통 transaction advisory lock으로 직렬화해 강제합니다.
- 관련 함수는 `SECURITY INVOKER`, `search_path=public`이며 PUBLIC·anon·authenticated 직접 EXECUTE 권한을 회수했습니다.
- 전용 예약 RPC + direct write 회수 대안은 기존 writer 전체 이관 비용 때문에 이번 단계에서 채택하지 않았습니다.

### RLS와 Data API grant
- owner는 서비스 생성·수정·비활성화·재활성화를 수행합니다.
- owner/staff는 active/inactive 서비스 전체를 읽어 기존 예약 이력을 해석할 수 있습니다.
- staff는 서비스 마스터를 변경할 수 없습니다.
- authenticated에는 `SELECT`, `INSERT`, `UPDATE`만 부여하고 `DELETE`는 grant와 RLS 모두에서 허용하지 않습니다. anon 권한은 없습니다.

### UI writer
- `/settings`: NULL/0원 구분, 생성·수정, 비활성화·재활성화, 활성 기본 서비스 ID 선택을 제공합니다.
- `/appointments/new`: 활성 서비스만 선택하고 `service_id`와 예약별 소요시간을 보내며 가격은 보내지 않습니다.
- `/appointments`: 서비스를 실제로 변경할 때만 `service_id`를 보내고 A→B→A 복귀 시 원래 snapshot을 복원합니다.
- `/customers/[id]`: 완료 이력을 활성 마스터로 기록하거나, 서비스 ID와 가격이 없는 자유입력 이력으로 기록할 수 있습니다.
<!-- migrated-decision:end -->
