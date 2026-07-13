import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addDaysToDateKey,
  differenceInDateKeys,
  formatDateKey,
  getDateKeyRange,
  getDaysInKstMonth,
  getFirstWeekdayOfKstMonth,
  getKstMonthRange,
  getRelativeKstDateLabel,
  getWeekdayFromDateKey,
  parseDateKey,
  toKstDateKey,
} from '../lib/dateTime.js';

test('KST 자정 경계에서 날짜 키가 정확히 다음 날로 바뀐다', () => {
  assert.equal(toKstDateKey(new Date('2026-01-31T14:59:59.999Z')), '2026-01-31');
  assert.equal(toKstDateKey(new Date('2026-01-31T15:00:00.000Z')), '2026-02-01');
  assert.equal(toKstDateKey(new Date('2026-12-31T15:00:00.000Z')), '2027-01-01');
});

test('날짜 키 생성과 파싱은 월 인덱스 계약을 유지한다', () => {
  assert.equal(formatDateKey(2026, 0, 5), '2026-01-05');
  assert.deepEqual(parseDateKey('2026-12-31'), {
    year: 2026,
    month: 12,
    day: 31,
    monthIndex: 11,
  });
});

test('날짜 덧셈은 월말, 윤년, 연말을 넘어서도 KST 날짜 키를 유지한다', () => {
  assert.equal(addDaysToDateKey('2026-01-31', 1), '2026-02-01');
  assert.equal(addDaysToDateKey('2024-02-28', 1), '2024-02-29');
  assert.equal(addDaysToDateKey('2024-02-29', 1), '2024-03-01');
  assert.equal(addDaysToDateKey('2026-01-01', -1), '2025-12-31');
});

test('월 달력 메타데이터는 윤년과 요일을 정확히 계산한다', () => {
  assert.equal(getDaysInKstMonth(2024, 1), 29);
  assert.equal(getDaysInKstMonth(2025, 1), 28);
  assert.equal(getFirstWeekdayOfKstMonth(2026, 6), 3);
  assert.equal(getWeekdayFromDateKey('2026-07-13'), 1);
  assert.deepEqual(getKstMonthRange(2026, 1), {
    startDate: '2026-02-01',
    endDate: '2026-02-28',
    daysInMonth: 28,
  });
});

test('날짜 차이와 상대 날짜 문구는 KST 날짜 키 단위로 계산된다', () => {
  assert.equal(differenceInDateKeys('2026-07-13', '2026-07-12'), 1);
  assert.equal(differenceInDateKeys('2026-07-13', '2026-07-14'), -1);
  assert.equal(getRelativeKstDateLabel('2026-07-13', '2026-07-13'), '오늘');
  assert.equal(getRelativeKstDateLabel('2026-07-12', '2026-07-13'), '어제');
  assert.equal(getRelativeKstDateLabel('2026-07-06', '2026-07-13'), '1주 전');
  assert.equal(getRelativeKstDateLabel('2026-06-13', '2026-07-13'), '1개월 전');
  assert.equal(getRelativeKstDateLabel('2026-07-14', '2026-07-13'), '내일');
});

test('날짜 범위는 양끝을 포함하고 역방향과 상한 초과를 거부한다', () => {
  assert.deepEqual(getDateKeyRange('2026-07-30', '2026-08-02'), [
    '2026-07-30',
    '2026-07-31',
    '2026-08-01',
    '2026-08-02',
  ]);
  assert.throws(
    () => getDateKeyRange('2026-07-14', '2026-07-13'),
    /종료일은 시작일보다 빠를 수 없습니다/,
  );
  assert.throws(
    () => getDateKeyRange('2026-07-01', '2026-07-03', 2),
    /기간은 최대 2일까지 선택할 수 있습니다/,
  );
});
