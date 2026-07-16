export function formatPriceKrw(value) {
  if (value === null || value === undefined || value === '') {
    return '가격 미설정';
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return '가격 미설정';
  }
  if (amount === 0) {
    return '무료 (0원)';
  }

  return `${amount.toLocaleString('ko-KR')}원`;
}
