# R-03 Booking Conflict And Business Hours

## 상태
- Done (local)
- 브랜치: `feature/r03-booking-conflict-hours`
- 최종 업데이트: 2026-07-07

## 목표
- 같은 시간대의 확정 예약 중복 저장을 DB 레벨에서 차단합니다.
- R-05 영업시간 설정을 기준으로 영업시간 외 예약과 휴게시간 겹침을 DB 레벨에서 차단합니다.
- 기존 R-03 Lite 휴무일 guard와 함께 예약 운영 중단 리스크를 줄입니다.

## 범위
- `appointments.duration_minutes` 추가
- 기존 `duration` 텍스트를 분 단위로 해석하는 `parse_duration_minutes`
- 기본 소요시간 fallback을 적용하는 `resolve_appointment_duration_minutes`
- `confirmed` 예약에만 적용되는 `guard_appointment_conflict_and_business_hours` trigger
- 중복 조회용 `appointments_confirmed_slot_idx`
- 같은 날짜의 충돌 검증을 직렬화하는 transaction advisory lock

## 정책 결정
- 중복/영업시간 검증 대상은 `confirmed` 예약으로 제한합니다.
- `completed` 이력 입력은 과거 시술 기록으로 간주해 차단하지 않습니다.
- `cancelled` 예약은 슬롯 점유에서 제외합니다.
- 같은 날짜 confirmed 예약 저장은 `pg_advisory_xact_lock`으로 직렬화해 동시 요청 TOCTOU 위험을 줄입니다.

## 완료 기준
- 겹치는 `confirmed` 예약 insert/update 차단
- 영업시간 외 `confirmed` 예약 차단
- 휴게시간과 겹치는 `confirmed` 예약 차단
- `cancelled`/`completed` 이력은 기존 운영 흐름을 깨지 않음
- `schema.sql`과 migration 동기화

## 현재 진행
- DB trigger/helper foundation 구현 완료
- DB trigger에 날짜 단위 transaction advisory lock 추가
- 예약 생성 화면에서 `duration_minutes` 저장 연결
- 예약 생성 화면에서 R-05 영업시간/휴게시간을 읽어 저장 전 사전 검증
- 예약 생성 화면에서 같은 날짜의 `confirmed` 예약을 조회해 더블부킹 사전 검증
- DB trigger 오류 메시지를 alert 대신 화면 내 피드백으로 표시
- Pencil SSOT에 새 예약 화면의 저장 전 검증 안내 영역 반영

## 검증
- `git diff --check` 통과
- `npm run build` 통과
- Pencil `snapshot_layout`에서 새 예약 화면 layout problem 없음
- Pencil export: `output/playwright/r03-booking-conflict-hours/NwNq2.png`
- Claude Opus 리뷰 지적 후 DB guard 동시성 위험을 advisory lock으로 보강

## 남은 리스크
- 실제 Supabase 프로젝트가 `INACTIVE`라 live DB smoke는 미실행입니다.
- owner/staff 계정으로 더블부킹, 영업시간 외, 휴게시간 겹침, cancelled/completed 비점유 회귀 검증이 필요합니다.
- migration 파일명 순서는 R-03이 R-05보다 앞서지만, R-03 guard가 참조하는 설정 테이블은 R-05에서 생성됩니다. 현재 `schema.sql` 순서는 올바르며 fresh migration stack 적용 시 중간에 예약 쓰기가 없다는 전제에서는 동작하지만, migration 리네이밍 또는 후속 정리 검토가 필요합니다.
