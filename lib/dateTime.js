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
