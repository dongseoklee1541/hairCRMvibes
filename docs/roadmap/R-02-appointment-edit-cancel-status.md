# R-02 Appointment Edit Cancel Status

## 상태
- Done (local)
- 브랜치: `feature/r02-appointment-edit-status`
- 최종 업데이트: 2026-07-07

## 목표
- 예약 상세/리스트에서 예약 수정, 취소, 완료/확정 상태 변경을 할 수 있게 합니다.
- 취소 감사 필드(`cancelled_at`, `cancelled_by`, `cancelled_reason`)를 일관되게 기록합니다.
- R-03 충돌/영업시간 guard와 충돌하지 않는 상태 전이 기반을 마련합니다.

## 현재 구현
- `appointments_status_check`로 상태값을 `confirmed`, `completed`, `cancelled`로 제한
- `set_appointment_status(uuid, text, text)` RPC 추가
- RPC는 인증 사용자와 `owner`/`staff` 역할을 확인하고 상태 변경을 수행
- `cancelled` 전이 시 취소 감사 필드를 기록하고, 다른 상태로 전이 시 취소 감사 필드를 제거
- 예약 목록에서 상태 배지와 완료/취소/확정 액션 제공
- 취소 액션에서 사유 입력 후 RPC로 감사 필드 기록
- 예약 목록 inline 수정 패널에서 날짜/시간/시술/소요시간/메모 수정 제공
- 예약 수정과 `confirmed` 복귀는 `appointments` update/RPC 경로를 사용해 R-03 DB guard를 그대로 적용

## 완료 기준
- 예약 리스트에서 상태 변경 액션 제공
- 예약 수정 폼에서 날짜/시간/시술/소요시간/메모 수정 가능
- 취소 시 reason 입력 또는 기본값 기록
- `confirmed`로 되돌릴 때 R-03 휴무일/영업시간/더블부킹 guard 적용
- 모바일 액션 영역은 최소 44px 터치 타깃으로 구현

## 검증
- `PATH="/Users/idongseog/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" npm run build` 통과
- 기본 Homebrew `node`는 ICU dylib mismatch로 실패하므로 bundled Node로 검증
- Pencil MCP wrapper/direct stdio가 `Transport closed`/응답 없음 상태라 R-02 최종 `snapshot_layout`/export는 미실행
- Playwright 모바일 viewport 390x844, 360x800 접근 확인: 인증 세션이 없어 `/appointments`는 `/login?from=%2Fappointments`로 리다이렉트됨
- Screenshot: `output/playwright/r02-appointment-edit-status/20260707_appointments_login_gate_390x844.png`
- Screenshot: `output/playwright/r02-appointment-edit-status/20260707_appointments_login_gate_360x800.png`
- 실제 Supabase 프로젝트 활성화 후 owner/staff RPC smoke 필요

## 남은 작업
- 실제 Supabase 프로젝트가 `INACTIVE`라 live DB smoke는 미실행입니다.
- owner/staff 계정으로 완료/취소/확정 복귀, 취소 감사 필드, 예약 수정 시 R-03 충돌/영업시간 차단 회귀 검증이 필요합니다.
- Pencil MCP 연결 복구 후 R-02 예약 목록 액션 UI의 `snapshot_layout`/export 재검증이 필요합니다.
