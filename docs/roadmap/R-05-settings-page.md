# R-05 Settings Page

## 상태
- In Progress
- 브랜치: `feature/r05-settings-business-hours`
- 최종 업데이트: 2026-07-06

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
- DB foundation 완료: `20260706_r05_settings_business_hours.sql`
- `schema.sql` 동기화 완료
- Pencil MCP 연결 실패로 `.pen` 및 UI 구현은 보류

## 남은 작업
- Pencil 연결 복구 후 `pencil-hairshopcrm.pen` 업데이트
- 설정 페이지 owner UI 구현
- 예약 생성 화면에서 service defaults/default duration 사용
- Owner/Staff smoke, 모바일 viewport, build 검증
