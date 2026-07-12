# R-02 Appointment Edit Cancel Status

## 상태
- Done (live verified)
- 브랜치: `feature/r02-appointment-edit-status`
- 최종 업데이트: 2026-07-12

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
- Supabase live RPC smoke:
  - owner/staff 계정 sign-in과 profile role 확인
  - `set_appointment_status` staff cancel 동작 확인
  - cancel reason, `cancelled_at`, `cancelled_by` 저장 확인
  - owner reconfirm 시 `cancelled_reason`, `cancelled_at`, `cancelled_by` 초기화 확인
  - anon `set_appointment_status` 실행 차단 확인
- PostgreSQL 17 disposable fresh replay에서 owner RPC cancel/reconfirm, 취소 감사 필드 기록 및 재확정 시 초기화를 재검증
- Playwright authenticated UI smoke:
  - `/appointments` 실제 예약 목록 진입
  - `완료`, `취소`, `확정`, `수정` 버튼 동작 확인
  - inline 수정 패널에서 memo 수정/저장 확인
  - UI 취소 prompt reason 저장을 DB에서 확인
  - 재확정 후 감사 필드 초기화를 DB에서 확인
  - 검증용 `CODEX-P1-*` 고객/예약 데이터 cleanup 확인
- Mobile screenshots:
  - `output/playwright/r02-appointment-edit-status/20260708_appointments_actions_390x844_before.png`
  - `output/playwright/r02-appointment-edit-status/20260708_appointments_edit_panel_390x844.png`
  - `output/playwright/r02-appointment-edit-status/20260708_appointments_completed_390x844.png`
  - `output/playwright/r02-appointment-edit-status/20260708_appointments_cancelled_390x844.png`
  - `output/playwright/r02-appointment-edit-status/20260708_appointments_reconfirmed_390x844.png`
  - `output/playwright/r02-appointment-edit-status/20260708_appointments_edit_panel_360x800.png`
- 이전 login gate baseline:
  - `output/playwright/r02-appointment-edit-status/20260707_appointments_login_gate_390x844.png`
  - `output/playwright/r02-appointment-edit-status/20260707_appointments_login_gate_360x800.png`
- Pencil MCP 최종 재검증:
  - active editor: `pencil-hairshopcrm.pen`
  - node: `TtNfz` (`예약 페이지`)
  - `snapshot_layout(..., problemsOnly: true)` 결과: layout problem 없음
  - export: `output/playwright/r02-appointment-edit-status/TtNfz.png`

## 남은 작업
- 취소 reason 입력은 현재 browser prompt 기반입니다. 기능은 검증됐지만 모바일 UX polish 시 modal/form 컴포넌트로 전환하는 편이 낫습니다.
- R-03 guard와의 결합은 live smoke로 확인했지만, 예약 수정 시 다양한 edge duration/service 조합은 후속 regression suite로 자동화해야 합니다.
- R-06의 offline/cache 구현과 민감 문서 cache 0건 검증은 완료됐습니다. 실제 기기 install prompt/standalone/기존 설치본 SW update는 R-06의 후속 운영 검증으로 남깁니다.
