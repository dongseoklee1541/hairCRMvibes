const KST_TIMEZONE = 'Asia/Seoul';

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

export function toKstDateKey(input = new Date()) {
  const date = normalizeToDate(input);
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: KST_TIMEZONE,
  }).format(date);
}

export function getTodayKstDateKey() {
  return toKstDateKey(new Date());
}

export function formatKoreanDate(dateKey) {
  if (!dateKey) return '';
  const [year, month, day] = dateKey.split('-').map(Number);
  return `${year}년 ${month}월 ${day}일`;
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
