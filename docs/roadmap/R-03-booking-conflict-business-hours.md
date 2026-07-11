# R-03 Booking Conflict And Business Hours

## 상태
- Done (live verified)
- 브랜치: `feature/r02-appointment-edit-status` (Phase 1 통합 브랜치)
- 최종 업데이트: 2026-07-11

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
- Supabase live regression smoke:
  - 같은 시간대 `confirmed` double booking 차단 확인
  - 영업시간 외 예약 차단 확인
  - 휴게시간 겹침 차단 확인
  - 휴무일 예약 차단 확인
  - `cancelled` 예약은 슬롯을 점유하지 않음 확인
  - `completed` 예약은 슬롯을 점유하지 않음 확인
  - 같은 날짜/시간 동시 insert 시도에서 하나만 성공하고 하나는 guard로 실패함을 확인
  - 검증용 `CODEX-P1-*` 고객/예약 데이터 cleanup 확인
- 하드닝 후 재확인:
  - anon RPC execute 차단 유지
  - owner insert, double booking 차단, staff cancel RPC, owner reconfirm 감사 필드 초기화가 계속 동작
- PostgreSQL 17 disposable fresh replay:
  - `20260219000000_phase1_genesis_baseline.sql`부터 forward migration 8개 전체 적용 성공
  - 더블부킹, 영업시간 외, 휴게시간, 휴무일 차단과 상태 RPC 재확인
  - `*.down.sql`은 replay 대상에서 제외되도록 `supabase/rollbacks/`로 분리

## 남은 리스크
- advisory lock은 같은 날짜의 confirmed 예약 저장을 직렬화해 TOCTOU 리스크를 실측 smoke 수준에서 줄였습니다. 다만 DB isolation/lock 경합을 장시간 부하로 검증한 것은 아니므로 대량 동시 예약 부하는 별도 테스트가 필요합니다.
- 현재 모델은 stylist/resource 차원을 구분하지 않습니다. 여러 디자이너 동시 예약을 허용하려면 충돌 키에 resource dimension을 추가해야 합니다.
- 승인된 A안으로 `20260219000000_phase1_genesis_baseline.sql`을 추가해 `customers`, `appointments`, `profiles` 선행 객체를 만들고 전체 빈 DB replay를 지원합니다.
- R-05/R-03는 live 적용 이력과 같은 `20260707160023`/`20260707160103` 순서로 정규화했습니다.
- vanilla PostgreSQL 17 + Supabase role/auth stub replay는 통과했습니다. 전체 Supabase local stack의 `supabase db reset`은 이 저장소에 `supabase/config.toml`이 없고 Docker가 설치되지 않아 아직 실행하지 않았습니다.
