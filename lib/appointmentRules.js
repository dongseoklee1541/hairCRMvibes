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

export function timeStringToMinutes(value) {
  if (!value) return null;
  const [hours, minutes] = String(value).slice(0, 5).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export function parseDurationText(duration) {
  if (!duration) return null;
  const text = String(duration);
  const hourMatch = text.match(/(\d+)\s*시간/);
  const minuteMatch = text.match(/(\d+)\s*분/);
  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  const total = hours * 60 + minutes;
  return total > 0 ? total : null;
}

export function resolveAppointmentDurationMinutes(appointment, fallbackMinutes = 60) {
  const explicit = Number(appointment?.duration_minutes);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return parseDurationText(appointment?.duration) || fallbackMinutes;
}

export function doMinuteRangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

export function validateAppointmentBusinessHours({ dateKey, time, durationMinutes, businessHours, getWeekdayFromDateKey }) {
  const weekday = getWeekdayFromDateKey(dateKey);
  const businessHour = businessHours.find((row) => row.weekday === weekday);

  if (!businessHour) return null;
  if (!businessHour.is_open) return '선택한 날짜는 영업일이 아닙니다.';

  const start = timeStringToMinutes(time);
  const end = start === null ? null : start + Number(durationMinutes || 0);
  const open = timeStringToMinutes(businessHour.open_time);
  const close = timeStringToMinutes(businessHour.close_time);

  if (start === null || end === null || open === null || close === null) {
    return '예약 시간을 확인해주세요.';
  }

  if (start < open || end > close) {
    return '예약 시간이 영업시간을 벗어납니다.';
  }

  const breakStart = timeStringToMinutes(businessHour.break_start);
  const breakEnd = timeStringToMinutes(businessHour.break_end);
  if (
    breakStart !== null &&
    breakEnd !== null &&
    doMinuteRangesOverlap(start, end, breakStart, breakEnd)
  ) {
    return '예약 시간이 휴게시간과 겹칩니다.';
  }

  return null;
}

export function findConflictingAppointment(appointments, { time, durationMinutes }) {
  const start = timeStringToMinutes(time);
  if (start === null) return null;
  const end = start + Number(durationMinutes || 0);

  return appointments.find((appointment) => {
    const appointmentStart = timeStringToMinutes(appointment.time);
    if (appointmentStart === null) return false;
    const appointmentEnd =
      appointmentStart + resolveAppointmentDurationMinutes(appointment, durationMinutes || 60);
    return doMinuteRangesOverlap(start, end, appointmentStart, appointmentEnd);
  }) || null;
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
