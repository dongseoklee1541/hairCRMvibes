# R-03 Booking Conflict And Business Hours

## 상태
- In Progress
- 브랜치: `feature/r03-booking-conflict-hours`
- 최종 업데이트: 2026-07-06

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

## 정책 결정
- 중복/영업시간 검증 대상은 `confirmed` 예약으로 제한합니다.
- `completed` 이력 입력은 과거 시술 기록으로 간주해 차단하지 않습니다.
- `cancelled` 예약은 슬롯 점유에서 제외합니다.

## 완료 기준
- 겹치는 `confirmed` 예약 insert/update 차단
- 영업시간 외 `confirmed` 예약 차단
- 휴게시간과 겹치는 `confirmed` 예약 차단
- `cancelled`/`completed` 이력은 기존 운영 흐름을 깨지 않음
- `schema.sql`과 migration 동기화

## 현재 진행
- DB trigger/helper foundation 구현 완료
- UI 저장 전 선검증은 아직 미구현
- 실제 Supabase 프로젝트가 `INACTIVE`라 live DB smoke는 미실행

## 남은 작업
- R-05 UI 완료 후 예약 생성 화면에서 기본 시술/소요시간과 저장 전 slot 검증 연결
- 실제 Supabase 프로젝트 활성화 후 double booking/business hours regression 검증
