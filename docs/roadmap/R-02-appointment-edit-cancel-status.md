# R-02 Appointment Edit Cancel Status

## 상태
- In Progress
- 브랜치: `feature/r02-appointment-edit-status`
- 최종 업데이트: 2026-07-06

## 목표
- 예약 상세/리스트에서 예약 수정, 취소, 완료/확정 상태 변경을 할 수 있게 합니다.
- 취소 감사 필드(`cancelled_at`, `cancelled_by`, `cancelled_reason`)를 일관되게 기록합니다.
- R-03 충돌/영업시간 guard와 충돌하지 않는 상태 전이 기반을 마련합니다.

## 현재 구현
- `appointments_status_check`로 상태값을 `confirmed`, `completed`, `cancelled`로 제한
- `set_appointment_status(uuid, text, text)` RPC 추가
- RPC는 인증 사용자와 `owner`/`staff` 역할을 확인하고 상태 변경을 수행
- `cancelled` 전이 시 취소 감사 필드를 기록하고, 다른 상태로 전이 시 취소 감사 필드를 제거

## 완료 기준
- 예약 리스트/상세에서 상태 변경 액션 제공
- 예약 수정 폼에서 날짜/시간/시술/소요시간/메모 수정 가능
- 취소 시 reason 입력 또는 기본값 기록
- `confirmed`로 되돌릴 때 R-03 휴무일/영업시간/더블부킹 guard 적용
- 모바일 390x844, 360x800에서 액션 영역 검증

## 검증
- `npm run build` 통과 필요
- 실제 Supabase 프로젝트 활성화 후 owner/staff RPC smoke 필요

## 남은 작업
- Pencil MCP 연결 복구 후 예약 상세/리스트 액션 UI `.pen` 반영
- UI 구현 및 before/after 모바일 screenshots
- Owner/Staff smoke와 상태 전이 회귀 검증
