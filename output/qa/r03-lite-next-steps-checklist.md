# R-03 Lite 후속 작업 체크리스트 (진행용)

> 대상 브랜치: `feature/r03-closed-days-lite`  
> 작성일: `2026-02-21`  
> 작성자: `Codex`

## 0) 환경 정보
- Supabase 프로젝트 URL: `https://skcujebqxjvmzmaiddvb.supabase.co`
- 테스트 계정(Owner): `설정됨 (값 비공개)`
- 테스트 계정(Staff): `설정됨 (값 비공개)`
- 최신 점검 시각(UTC): `2026-02-21`
- 현재 상태 요약:
  - 코드 구현/빌드: 완료
  - DB 신규 RPC 반영: 미완료 (`PGRST202`)

---

## 1) DB 마이그레이션 적용
- [ ] `supabase/migrations/20260221_r03_closed_days_lite.sql` 적용
- [ ] 필요 시 롤백 파일 위치 확인: `supabase/migrations/20260221_r03_closed_days_lite.down.sql`

통과 기준:
- 대상 Supabase 프로젝트에 신규 함수 2개가 생성된다.

결과 기록:
- 상태: `BLOCKED`
- 메모:
  - 현재 환경에는 `service_role` 또는 DB 관리자 연결 정보가 없어 터미널에서 직접 적용 불가
  - 권장 적용 순서:
    - SQL Editor에서 `20260221_r03_closed_days_lite.sql` 실행
    - 오류 없으면 저장

---

## 2) 신규 함수 생성 확인
- [ ] 아래 SQL 실행

```sql
select proname
from pg_proc
where proname in (
  'apply_closed_days_batch_with_cancellations',
  'remove_closed_day_range'
);
```

통과 기준:
- 함수 2개가 모두 조회된다.

결과 기록:
- 상태: `BLOCKED`
- 메모:
  - owner 세션으로 RPC 호출 테스트 시 두 함수 모두 `PGRST202` 확인
  - 신규 마이그레이션 미적용 상태로 판단

---

## 3) 권한 경계 확인 (Owner/Staff)
- [ ] Owner로 `apply_closed_days_batch_with_cancellations` 호출
- [ ] Staff로 `apply_closed_days_batch_with_cancellations` 호출
- [ ] Owner로 `remove_closed_day_range` 호출
- [ ] Staff로 `remove_closed_day_range` 호출

통과 기준:
- Owner: 성공
- Staff: 권한 에러(`42501`)

결과 기록:
- 상태: `BLOCKED`
- 메모:
  - 선행 조건(2번 함수 생성 확인) 미충족으로 실행 불가

---

## 4) 기간 휴무 등록 시나리오 검증
사전 준비:
- 테스트 날짜 범위에 `confirmed` 예약 2건, `completed` 1건 생성

검증:
- [ ] `p_mode='range'`로 저장 실행
- [ ] 범위 내 `confirmed` 일괄 취소 확인
- [ ] `completed` 유지 확인
- [ ] 반환값(`applied_days`, `cancelled_count`, `remaining_confirmed`) 확인

통과 기준:
- `confirmed`는 `cancelled`로 변경되고 감사필드가 채워진다.
- `completed`는 유지된다.
- `remaining_confirmed = 0`

결과 기록:
- 상태: `BLOCKED`
- 메모:
  - 선행 조건(1~2번) 미충족으로 실행 불가

---

## 5) 정기 휴무 등록 시나리오 검증
사전 준비:
- 시작일~종료일 범위 설정, 대상 요일(예: 화요일) 지정

검증:
- [ ] `p_mode='weekly'`, `p_weekday` 설정 후 저장
- [ ] 해당 요일 날짜만 `salon_closed_dates`에 저장되는지 확인
- [ ] 해당 날짜의 `confirmed` 취소/감사필드 기록 확인

통과 기준:
- 요일 매칭 날짜만 적용된다.
- 반환값이 실제 적용 건수와 일치한다.

결과 기록:
- 상태: `BLOCKED`
- 메모:
  - 선행 조건(1~2번) 미충족으로 실행 불가

---

## 6) 기간 휴무 해제 시나리오 검증
검증:
- [ ] `remove_closed_day_range`로 기간 해제 실행
- [ ] 기간 내 `salon_closed_dates` 삭제 확인
- [ ] 해제 후 동일 날짜 `confirmed` 신규 예약 생성 가능 확인
- [ ] 기존 `closed_day` 취소 예약 자동복구 없음 확인

통과 기준:
- `removed_days`가 실제 삭제 건수와 일치한다.
- 취소 예약은 취소 상태로 남는다.

결과 기록:
- 상태: `BLOCKED`
- 메모:
  - 선행 조건(1~2번) 미충족으로 실행 불가

---

## 7) `/settings` UI 점검 (모바일)
검증:
- [x] `단일/기간/정기` 모드 전환 정상
- [x] 저장 전 영향도(취소 예정 건수) 노출 확인
- [x] 해제 섹션 문구 2개 노출 확인
  - “선택 기간의 모든 휴무일이 해제됩니다.”
  - “해제해도 기존 취소 예약은 자동복구되지 않습니다.”

통과 기준:
- 모드별 필드 노출/숨김이 정확하다.
- 경고 문구가 항상 노출된다.

결과 기록:
- 상태: `PASS`
- 메모:
  - Playwright 실측 확인
  - `기간` 모드: 시작일/종료일 및 일괄 취소 경고 노출
  - `정기` 모드: 요일 선택 필드 노출

---

## 8) `/appointments/new` 회귀 점검
검증:
- [x] 등록된 휴무일 날짜 비활성화 유지
- [x] 휴무일 날짜 제출 차단(클라이언트)
- [x] 서버 우회 insert 차단(트리거)

통과 기준:
- 기존 R-03 MVP 차단 로직이 유지된다.

결과 기록:
- 상태: `PASS`
- 메모:
  - 달력에서 `2026-02-24` 셀이 `disabled`로 확인됨
  - 서버 우회 insert 시 `해당 날짜는 휴무일로 설정되어 예약할 수 없습니다. (P0001)` 확인

---

## 9) 최종 빌드/문서/PR 정리
- [x] `npm run build`
- [ ] QA 결과를 `output/qa/r03-mvp-verification-checklist.md`에 반영
- [ ] 변경 파일 최종 점검 후 PR 준비

통과 기준:
- 빌드 성공 + 검증 문서 최신화 + PR 가능한 상태

결과 기록:
- 상태: `PARTIAL`
- 메모:
  - `npm run build` 통과
  - 권장 PR 제목: `feat: r03 lite closed day batch/weekly apply and range removal`

---

## 최종 판정
- 최종 결과: `PARTIAL`
- 배포 가능 여부: `조건부 보류`
- 완료 조건:
  - 1. 1~2 항목 완료(마이그레이션 적용/함수 확인)
  - 2. 3~6 항목 실측 완료
  - 3. 9번의 PR 준비 완료
