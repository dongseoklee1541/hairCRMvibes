import test from 'node:test';
import assert from 'node:assert/strict';

import {
  APPOINTMENT_STATUS,
  buildBatchTargetDates,
  buildClosedDateSet,
  doMinuteRangesOverlap,
  extractCancellableIds,
  findConflictingAppointment,
  formatDurationMinutes,
  isCancellableConflict,
  isClosedDate,
  parseDurationText,
  resolveAppointmentDurationMinutes,
  timeStringToMinutes,
  validateAppointmentBusinessHours,
} from '../lib/appointmentRules.js';
import { getDateKeyRange, getWeekdayFromDateKey } from '../lib/dateTime.js';

const mondayBusinessHours = [
  {
    weekday: 1,
    is_open: true,
    open_time: '09:00:00',
    close_time: '18:00:00',
    break_start: '12:00:00',
    break_end: '13:00:00',
  },
];

function validateMonday(time, durationMinutes) {
  return validateAppointmentBusinessHours({
    dateKey: '2026-07-13',
    time,
    durationMinutes,
    businessHours: mondayBusinessHours,
    getWeekdayFromDateKey,
  });
}

test('소요시간 표시와 legacy 문자열 파싱은 분 단위 값을 보존한다', () => {
  assert.equal(formatDurationMinutes(45), '45분');
  assert.equal(formatDurationMinutes(60), '1시간');
  assert.equal(formatDurationMinutes(150), '2시간 30분');
  assert.equal(formatDurationMinutes(0), '');
  assert.equal(parseDurationText('약 1시간 30분 예상'), 90);
  assert.equal(parseDurationText('45분'), 45);
  assert.equal(parseDurationText('미정'), null);
  assert.equal(resolveAppointmentDurationMinutes({ duration_minutes: 120, duration: '30분' }), 120);
  assert.equal(resolveAppointmentDurationMinutes({ duration: '1시간 15분' }), 75);
  assert.equal(resolveAppointmentDurationMinutes({}, 90), 90);
});

test('시간 문자열과 겹침 판정은 끝점이 맞닿은 예약을 중복으로 보지 않는다', () => {
  assert.equal(timeStringToMinutes('09:30:00'), 570);
  assert.equal(timeStringToMinutes(''), null);
  assert.equal(doMinuteRangesOverlap(600, 660, 630, 690), true);
  assert.equal(doMinuteRangesOverlap(600, 660, 660, 720), false);
  assert.equal(doMinuteRangesOverlap(660, 720, 600, 660), false);
});

test('영업 시작과 종료 경계에 정확히 맞는 예약은 허용한다', () => {
  assert.equal(validateMonday('09:00', 60), null);
  assert.equal(validateMonday('17:00', 60), null);
});

test('영업시간을 벗어나는 예약은 거부한다', () => {
  assert.equal(validateMonday('08:45', 30), '예약 시간이 영업시간을 벗어납니다.');
  assert.equal(validateMonday('17:30', 60), '예약 시간이 영업시간을 벗어납니다.');
});

test('휴게시간과 맞닿는 예약은 허용하고 실제로 겹치는 예약은 거부한다', () => {
  assert.equal(validateMonday('11:30', 30), null);
  assert.equal(validateMonday('11:45', 30), '예약 시간이 휴게시간과 겹칩니다.');
  assert.equal(validateMonday('12:30', 30), '예약 시간이 휴게시간과 겹칩니다.');
  assert.equal(validateMonday('13:00', 30), null);
});

test('휴무일과 잘못된 시간 값은 명확한 오류를 반환한다', () => {
  const closedHours = [{ ...mondayBusinessHours[0], is_open: false }];
  assert.equal(
    validateAppointmentBusinessHours({
      dateKey: '2026-07-13',
      time: '10:00',
      durationMinutes: 60,
      businessHours: closedHours,
      getWeekdayFromDateKey,
    }),
    '선택한 날짜는 영업일이 아닙니다.',
  );
  assert.equal(validateMonday('', 60), '예약 시간을 확인해주세요.');
});

test('예약 충돌 검색은 소요시간과 legacy duration을 함께 고려한다', () => {
  const appointments = [
    { id: 'a', time: '10:00:00', duration_minutes: 60 },
    { id: 'b', time: '13:00:00', duration: '1시간 30분' },
  ];

  assert.equal(findConflictingAppointment(appointments, { time: '09:00', durationMinutes: 60 }), null);
  assert.equal(
    findConflictingAppointment(appointments, { time: '10:30', durationMinutes: 30 })?.id,
    'a',
  );
  assert.equal(findConflictingAppointment(appointments, { time: '11:00', durationMinutes: 60 }), null);
  assert.equal(
    findConflictingAppointment(appointments, { time: '14:00', durationMinutes: 60 })?.id,
    'b',
  );
});

test('휴무일 집합은 빈 값을 제외하고 날짜 키만 유지한다', () => {
  const closedDates = buildClosedDateSet([
    { closed_date: '2026-07-13' },
    { closed_date: null },
    {},
  ]);

  assert.equal(closedDates.size, 1);
  assert.equal(isClosedDate('2026-07-13', closedDates), true);
  assert.equal(isClosedDate('2026-07-14', closedDates), false);
});

test('취소 대상 추출은 확정 예약만 선택한다', () => {
  const appointments = [
    { id: 'confirmed', status: APPOINTMENT_STATUS.CONFIRMED },
    { id: 'completed', status: APPOINTMENT_STATUS.COMPLETED },
    { id: 'cancelled', status: APPOINTMENT_STATUS.CANCELLED },
  ];

  assert.equal(isCancellableConflict(appointments[0]), true);
  assert.equal(isCancellableConflict(appointments[1]), false);
  assert.deepEqual(extractCancellableIds(appointments), ['confirmed']);
});

test('일괄 휴무 대상은 전체 기간 또는 선택 요일만 생성한다', () => {
  const dateRange = { startDate: '2026-07-13', endDate: '2026-07-19' };

  assert.deepEqual(
    buildBatchTargetDates('range', dateRange, null, getDateKeyRange, getWeekdayFromDateKey),
    [
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
      '2026-07-18',
      '2026-07-19',
    ],
  );
  assert.deepEqual(
    buildBatchTargetDates('weekly', dateRange, 1, getDateKeyRange, getWeekdayFromDateKey),
    ['2026-07-13'],
  );
  assert.throws(
    () => buildBatchTargetDates('weekly', dateRange, 7, getDateKeyRange, getWeekdayFromDateKey),
    /정기휴무 요일을 선택해주세요/,
  );
  assert.throws(
    () => buildBatchTargetDates('unknown', dateRange, null, getDateKeyRange, getWeekdayFromDateKey),
    /지원하지 않는 휴무일 모드입니다/,
  );
});
