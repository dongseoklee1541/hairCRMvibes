# R-04 KST Date Time Consistency

## 상태
- Done (live verified)
- 브랜치: `feature/r02-appointment-edit-status` (Phase 1 통합 브랜치)
- 최종 업데이트: 2026-07-16

## 목표
- 브라우저 로컬 timezone이나 UTC 변환으로 인해 `YYYY-MM-DD` date key가 하루 밀리는 문제를 방지합니다.
- 오늘/이번 달/달력/상대 날짜/고객 이력 표시를 KST 기준으로 통일합니다.

## 구현 범위
- `lib/dateTime.js`에 KST date key, 달력, 월 범위, 요일, 상대 날짜 포맷 유틸 추가
- 홈 오늘 예약 조회를 KST today key로 변경
- 예약 달력의 현재 월/선택일/요일 계산을 KST date key 기준으로 변경
- 예약 date picker의 월 시작 요일/월 일수 계산을 공통 KST 유틸로 변경
- 통계의 이번 달 범위, 오늘 예약, 최근 방문 정렬을 KST date key 기준으로 변경
- 고객 상세의 이력 날짜/등록일/시술 이력 기본 날짜를 KST 기준으로 변경

## 완료 기준
- 앱/컴포넌트 화면에서 직접 `new Date()`로 date key를 만들지 않음
- 월 범위 조회가 KST 기준 첫날/마지막날을 사용
- date-only 문자열을 브라우저 timezone에 의존하지 않고 표시
- `npm run build` 통과

## 검증
- `rg -n "new Date\\(|toISOString\\(|getFullYear|getMonth|getDate|getDay" app components lib`
  - 앱/컴포넌트의 직접 날짜 생성 제거 확인
  - 남은 `new Date()`는 `lib/dateTime.js` 내부로 집중
- `PATH="/Users/idongseog/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" npm run build` 통과
- KST 정적 검색:
  - app/components는 `formatDateKey`, `getTodayKst`, `getWeekdayFromDateKey`, `getMonthMatrix` 등 공통 유틸 경유 확인
  - `toISOString()` date key 생성은 app/components에서 사용하지 않음 확인
- Phase 1 integration readiness 재검증에서도 동일 정적 검색 기준을 유지
- `npm run test:node`의 `tests/date-time.test.mjs`에서 다음 경계를 자동 검증
  - KST 자정 직전/직후와 월말·연말 date key 전환
  - 윤년 2월, 월 시작 요일, 월 범위와 날짜 범위 상한
  - 상대 날짜 문구와 날짜 차이 계산
- Playwright mobile smoke:
  - `/appointments` authenticated 화면을 390x844에서 확인
  - `/appointments` inline edit panel을 390x844와 360x800에서 확인
  - screenshot 근거는 R-02 문서의 `output/playwright/r02-appointment-edit-status/20260708_*` 파일에 기록

## 남은 리스크
- 날짜 유틸의 자정·월경계 단위 테스트는 자동화했습니다.
- 브라우저 timezone을 바꾸는 전체 화면 time-travel 검증과 실제 기기 장시간 실행 검증은 별도 운영 검증으로 남아 있습니다.
