export const KST_TIMEZONE = 'Asia/Seoul';
export const KOREAN_WEEKDAYS_SHORT = ['일', '월', '화', '수', '목', '금', '토'];
export const KOREAN_WEEKDAYS_LONG = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

function normalizeToDate(input) {
  if (input instanceof Date) {
    return input;
  }

  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [year, month, day] = input.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  return new Date(input);
}

function toUtcDateFromKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year, month, day, monthIndex: month - 1 };
}

export function formatDateKey(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function toKstDateKey(input = new Date()) {
  const date = normalizeToDate(input);
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: KST_TIMEZONE,
  }).format(date);
}

export function getTodayKstDateKey() {
  return toKstDateKey(new Date());
}

export function getCurrentKstTimestampIso() {
  return new Date().toISOString();
}

export function getTodayKstCalendarParts() {
  return parseDateKey(getTodayKstDateKey());
}

export function formatKoreanDate(dateKey) {
  if (!dateKey) return '';
  const [year, month, day] = dateKey.split('-').map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

export function formatKoreanShortDate(dateKey) {
  if (!dateKey) return '';
  const { month, day } = parseDateKey(dateKey);
  return `${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
}

export function formatKstDateDot(input) {
  const dateKey = toKstDateKey(input);
  return dateKey.replaceAll('-', '.');
}

export function getRelativeKstDateLabel(dateKey, baseDateKey = getTodayKstDateKey()) {
  if (!dateKey) return '';

  const diffDays = differenceInDateKeys(baseDateKey, dateKey);
  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays > 1 && diffDays < 7) return `${diffDays}일 전`;
  if (diffDays >= 7 && diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  if (diffDays >= 30) return `${Math.floor(diffDays / 30)}개월 전`;
  if (diffDays === -1) return '내일';
  if (diffDays < -1 && diffDays > -7) return `${Math.abs(diffDays)}일 후`;

  return formatKoreanDate(dateKey);
}

export function addDaysToDateKey(dateKey, daysToAdd) {
  const base = normalizeToDate(dateKey);
  base.setUTCDate(base.getUTCDate() + daysToAdd);
  return toKstDateKey(base);
}

export function getWeekdayFromDateKey(dateKey) {
  if (!dateKey) return null;
  return toUtcDateFromKey(dateKey).getUTCDay();
}

export function getWeekdayLabelFromDateKey(dateKey, labels = KOREAN_WEEKDAYS_SHORT) {
  const weekday = getWeekdayFromDateKey(dateKey);
  return weekday === null ? '' : labels[weekday];
}

export function getDaysInKstMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function getFirstWeekdayOfKstMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
}

export function getKstMonthRange(year, monthIndex) {
  const daysInMonth = getDaysInKstMonth(year, monthIndex);
  return {
    startDate: formatDateKey(year, monthIndex, 1),
    endDate: formatDateKey(year, monthIndex, daysInMonth),
    daysInMonth,
  };
}

export function differenceInDateKeys(laterDateKey, earlierDateKey) {
  const later = toUtcDateFromKey(laterDateKey);
  const earlier = toUtcDateFromKey(earlierDateKey);
  return Math.round((later - earlier) / (1000 * 60 * 60 * 24));
}

export function getDateKeyRange(startDateKey, endDateKey, maxDays = 366) {
  if (!startDateKey || !endDateKey) {
    throw new Error('시작일과 종료일은 필수입니다.');
  }

  if (endDateKey < startDateKey) {
    throw new Error('종료일은 시작일보다 빠를 수 없습니다.');
  }

  const keys = [];
  let cursor = startDateKey;

  while (cursor <= endDateKey) {
    keys.push(cursor);
    if (keys.length > maxDays) {
      throw new Error(`기간은 최대 ${maxDays}일까지 선택할 수 있습니다.`);
    }
    cursor = addDaysToDateKey(cursor, 1);
  }

  return keys;
}
