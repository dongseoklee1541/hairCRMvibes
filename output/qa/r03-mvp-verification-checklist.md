# R-03 MVP 검증 체크리스트 (실측 결과)

> 사용 브랜치: `feature/r03-mvp-closed-day-guard`  
> 작성일: `2026-02-20`  
> 작성자: `Codex`

## 0) 환경 정보
- Supabase 프로젝트 URL: `https://skcujebqxjvmzmaiddvb.supabase.co`
- 테스트 계정(Owner): `설정됨 (값 비공개)`
- 테스트 계정(Staff): `설정됨 (값 비공개)`
- 최신 재검증 시각(UTC): `2026-02-20T14:42:05.354Z`

---

## 1) 네트워크/DNS 확인
- [x] `curl -I https://fonts.googleapis.com`
- [x] `curl -I https://skcujebqxjvmzmaiddvb.supabase.co`

통과 기준:
- 둘 다 응답 헤더가 정상 반환된다.

결과 기록:
- 상태: `PASS`
- 메모:
  - 샌드박스 밖 재실행에서 두 도메인 모두 HTTP 응답 확인
  - `fonts.googleapis.com`: `HTTP/2 404` (정상 연결)
  - `skcujebqxjvmzmaiddvb.supabase.co`: `HTTP/2 404` (정상 연결)

---

## 2) 빌드 확인
- [x] `npm run build`

통과 기준:
- `next/font` 관련 에러 없이 빌드 성공.

결과 기록:
- 상태: `PASS`
- 메모:
  - 샌드박스 밖 재실행에서 `npm run build` 성공
  - 페이지 생성/최적화 완료 및 라우트 출력 확인

---

## 3) DB 마이그레이션 반영 확인
- [ ] 아래 SQL 실행

```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='appointments'
and column_name in ('cancelled_by','cancelled_at','cancelled_reason','updated_at');

select * from information_schema.tables
where table_schema='public' and table_name='salon_closed_dates';

select proname from pg_proc
where proname='apply_closed_day_with_cancellations';
```

통과 기준:
- 컬럼/테이블/RPC가 모두 존재한다.

결과 기록:
- 상태: `PASS`
- 메모:
  - `appointments` 신규 컬럼 조회 성공:
    - `cancelled_by`, `cancelled_at`, `cancelled_reason`, `updated_at`
  - `salon_closed_dates` 조회 성공
  - RPC 존재 확인:
    - `apply_closed_day_with_cancellations` 호출 시 필수 파라미터 검증 오류(`P0001`) 반환으로 엔드포인트 동작 확인

---

## 4) 권한 경계 확인 (Owner/Staff)
- [ ] Owner 계정으로 휴무일 RPC 호출
- [ ] Staff 계정으로 동일 RPC 호출

통과 기준:
- Owner: 성공
- Staff: 권한 에러(실패)

결과 기록:
- 상태: `PASS`
- 메모:
  - owner/staff 로그인 및 role 확인:
    - owner role = `owner`
    - staff role = `staff`
  - Owner RPC: 성공
  - Staff RPC: 권한 거부 확인
    - `휴무일 설정 권한이 없습니다. (42501)`

---

## 5) 휴무일 충돌 처리 규칙 확인
사전 준비:
- 대상 날짜에 `confirmed` 예약 2건 생성

검증:
- [ ] 1건만 선택 취소 후 휴무일 저장 시도
- [ ] 2건 모두 선택 취소 후 휴무일 저장 시도

통과 기준:
- confirmed 잔존 시 저장 실패
- confirmed 0건이면 저장 성공

결과 기록:
- 상태: `PASS`
- 메모:
  - `confirmed` 2건 + `completed` 1건 데이터로 실검증 수행
  - 1건만 취소 후 저장 시도: 실패(정상)
    - `해당 날짜에 confirmed 예약이 남아 있어 휴무일로 저장할 수 없습니다. (P0001)`
  - 2건 모두 취소 후 저장 시도: 성공
    - `{\"closed_date\":\"2026-03-22\",\"cancelled_count\":2,\"remaining_confirmed\":0}`

---

## 6) 취소 감사 필드 확인
- [ ] 아래 SQL 실행

```sql
select id, status, cancelled_by, cancelled_at, cancelled_reason
from public.appointments
where date = '<휴무일 날짜>'
order by time;
```

통과 기준:
- 취소된 예약에 `cancelled_by`, `cancelled_at`, `cancelled_reason='closed_day'`가 저장된다.

결과 기록:
- 상태: `PASS`
- 메모:
  - 취소된 2건 모두 아래 감사 필드 저장 확인:
    - `cancelled_by = owner user id`
    - `cancelled_at = not null`
    - `cancelled_reason = 'closed_day'`

---

## 7) completed 예약 보호 확인
사전 준비:
- 동일 날짜에 `completed` 예약 1건 생성

검증:
- [ ] 충돌 목록에 표시 여부 확인
- [ ] 선택 취소 가능 여부 확인
- [ ] 처리 후 DB 상태 확인

통과 기준:
- 목록에는 보이지만 취소 선택 불가
- DB 상태는 `completed` 유지

결과 기록:
- 상태: `PASS`
- 메모:
  - 동일 날짜의 `completed` 예약 1건이 취소되지 않고 유지됨
  - `completed` 행의 감사 필드(`cancelled_*`)는 모두 `null` 유지 확인

---

## 8) 새 예약 화면 사전 차단 확인
대상 파일:
- `app/appointments/new/page.js`

검증:
- [ ] 휴무일 날짜 클릭/선택 시도
- [ ] 휴무일 날짜로 제출 시도

통과 기준:
- 달력에서 휴무일 선택 불가
- 제출 시 클라이언트/서버에서 차단

결과 기록:
- 상태: `PASS`
- 메모:
  - UI 실측(모바일 화면):
    - 휴무일(`2026-02-27`) 날짜 셀 버튼이 `disabled` 상태로 표시됨
    - 클릭 시에도 선택 날짜가 변경되지 않음을 확인
  - 서버 우회 저장 차단:
    - 휴무일에 `confirmed` 예약 insert 시 `P0001` 예외로 차단 확인

---

## 최종 판정
- 최종 결과: `PASS`
- 배포 가능 여부: `가능 (본 체크리스트 기준)`
- 후속 조치:
  - 1. 운영 반영 전 동일 시나리오를 실제 운영 계정으로 1회 재실행 권장
  - 2. 월 단위로 휴무일 대량 등록 시 UX(스크롤/성능) 스모크 테스트 권장

---

## R-03 Lite 확장 검증 (기간/정기/기간 해제)

> 브랜치: `feature/r03-closed-days-lite`  
> 점검 시각(UTC): `2026-02-21T14:46:42.883Z`  

### A) 로컬 빌드
- [x] `npm run build`
- 결과: `PASS`
- 메모:
  - `/settings` 모드 확장(single/range/weekly) 코드 포함 상태로 빌드 통과

### B) UI 동작(모바일 화면 수동 점검)
- [x] `/settings` 진입 후 `단일/기간/정기` 모드 전환
- [x] `휴무일 해제` 섹션 노출 및 경고 문구 확인
- 결과: `PASS`
- 메모:
  - “선택 기간의 모든 휴무일이 해제됩니다.”
  - “해제해도 기존 취소 예약은 자동복구되지 않습니다.”

### C) 신규 DB 함수 접근 확인
- [x] `apply_closed_days_batch_with_cancellations(...)`
- [x] `remove_closed_day_range(...)`
- 결과: `PASS`
- 메모:
  - 신규 함수 2개 호출 성공
  - `PGRST202` 미발생으로 스키마 반영 확인
  - 권한 경계 추가 확인: Owner 성공, Staff `42501` 거부

### D) 확장 기능 최종 판정
- 최종 결과: `PASS`
- 배포 가능 여부: `가능 (Lite 확장 검증 기준)`
- 남은 작업:
  - 1. 운영 계정 기준 동일 시나리오 1회 재실행(권장)
  - 2. PR 후 main 기준 스모크 테스트 1회(권장)
