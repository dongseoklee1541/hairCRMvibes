# R-05 Settings Page

## 상태
- Done (live verified)
- 브랜치: `feature/r02-appointment-edit-status` (Phase 1 통합 브랜치)
- 최종 업데이트: 2026-07-12

## 목표
- 설정 페이지에서 영업시간, 기본 시술, 기본 소요시간을 관리합니다.
- R-03 더블부킹/영업시간 충돌 방지가 SQL에서 조회할 수 있도록 정규화된 설정 데이터를 제공합니다.

## 데이터 모델 결정
- 선택한 방식: 정규화 테이블
- 대안 A: `salon_business_hours`, `salon_operation_settings`, `salon_service_defaults`로 분리
- 대안 B: 단일 JSON 설정 row
- 결정 사유: R-03에서 요일별 영업시간을 SQL 제약/트리거/RPC가 직접 조회해야 하므로 정규화 테이블이 안전합니다.

## 구현 범위
- `salon_business_hours`: 요일별 영업 여부, 시작/종료 시간, 휴게 시간
- `salon_operation_settings`: 기본 시술명, 기본 소요시간, 예약 슬롯 간격
- `salon_service_defaults`: 설정 페이지와 예약 등록에서 사용할 기본 시술 목록
- RLS: owner/staff 읽기, owner 관리, anon 차단

## 완료 기준
- `.pen`에 설정 화면의 영업시간/기본 시술/기본 소요시간 UI 반영
- 설정 페이지에서 owner가 영업시간과 기본 시술을 조회/저장할 수 있음
- staff는 설정 페이지 접근이 차단되고, 예약 생성 화면에서는 기본 시술/소요시간을 조회해 사용할 수 있음
- `schema.sql`과 migration이 동기화됨
- 모바일 390x844, 360x800에서 설정 페이지 UI 검증

## 현재 진행
- DB foundation 완료: `20260707160023_r05_settings_business_hours.sql`
- `schema.sql` 동기화 완료
- Pencil MCP 직접 연결로 `pencil-hairshopcrm.pen` 설정 화면에 영업시간/기본 예약값/기본 시술 SSOT 반영
- `/settings` owner UI에서 `salon_operation_settings`, `salon_business_hours`, `salon_service_defaults` 조회/저장 구현
- `/appointments/new`에서 staff/owner가 읽을 수 있는 기본 시술 목록과 기본 소요시간을 예약 생성 기본값으로 사용
- R-05 브랜치에서는 R-03의 `appointments.duration_minutes` 컬럼에 의존하지 않고 기존 `duration` 텍스트 저장만 유지

## 검증
- `git diff --check` 통과
- `npm run build` 통과
- Pencil `snapshot_layout`에서 설정 화면 layout problem 없음
- Pencil export: `output/playwright/r05-settings-business-hours/rYt9h.png`
- live schema 확인:
  - `salon_operation_settings`, `salon_business_hours`, `salon_service_defaults` 생성 확인
  - `salon_business_hours` 7개 요일 row 존재 확인
  - RLS policy와 owner/staff read, owner manage 정책 존재 확인
- live RLS smoke:
  - owner 설정 read/write 허용 확인
  - staff 설정 write 차단 확인(`0 rows affected`, 값 변경 없음)
  - anon 설정 read 차단 확인
  - owner 검증 후 설정값 restore 확인
- Playwright 이전 baseline:
  - 인증 세션 없이 `/settings`와 `/appointments/new` 접근 시 login redirect 확인
  - 390x844, 360x800 login gate smoke 완료
- R-03 live smoke에서 설정 테이블 기반 영업시간/휴게시간 guard가 동작함을 간접 확인
- PostgreSQL 17 disposable fresh replay에서 owner/staff read 경계, staff 설정 write 차단, 영업시간/휴게시간 guard를 재검증

## 남은 리스크
- staff의 `/settings` UI 접근 차단 화면은 이번 세션에서 별도 browser session으로 재검증하지 않았습니다. DB RLS write 차단은 live로 확인했습니다.
- settings 관련 select 정책은 Supabase advisor에서 multiple permissive policy 경고가 남습니다. 동작 문제는 아니지만 정책 수를 줄이는 후속 정리가 가능합니다.
- R-06에서 설정 문서를 NetworkOnly로 고정하고 Cache Storage의 설정 문서 0건을 확인했습니다. 실제 설치본의 service worker update와 고정 URL precache 갱신은 R-06 후속 검증으로 유지합니다.
