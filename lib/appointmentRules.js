export const APPOINTMENT_STATUS = {
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const DURATION_MINUTE_OPTIONS = [15, 30, 45, 60, 90, 120, 150, 180, 240];

export function formatDurationMinutes(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 60) return `${value}분`;

  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`;
}

export function buildClosedDateSet(rows = []) {
  return new Set(
    rows
      .map((row) => row?.closed_date)
      .filter(Boolean)
  );
}

export function isClosedDate(dateKey, closedDateSet) {
  if (!dateKey || !closedDateSet) return false;
  return closedDateSet.has(dateKey);
}

export function isCancellableConflict(appointment) {
  return appointment?.status === APPOINTMENT_STATUS.CONFIRMED;
}

export function extractCancellableIds(appointments = []) {
  return appointments
    .filter(isCancellableConflict)
    .map((appointment) => appointment.id);
}

export function buildBatchTargetDates(mode, dateRange, weekday, getDateKeyRange, getWeekdayFromDateKey) {
  const { startDate, endDate } = dateRange;
  const dateKeys = getDateKeyRange(startDate, endDate);

  if (mode === 'range') {
    return dateKeys;
  }

  if (mode === 'weekly') {
    if (typeof weekday !== 'number' || weekday < 0 || weekday > 6) {
      throw new Error('정기휴무 요일을 선택해주세요.');
    }
    return dateKeys.filter((dateKey) => getWeekdayFromDateKey(dateKey) === weekday);
  }

  throw new Error('지원하지 않는 휴무일 모드입니다.');
}
