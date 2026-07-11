const MOBILE_PREFIX_PATTERN = /^01[016789]/;
const AREA_PREFIX_PATTERN = /^0(?:3[1-3]|4[1-4]|5[1-5]|6[1-4])/;

export const PHONE_HELP_TEXT = '전화번호는 선택 사항이며 숫자만 입력해도 됩니다.';
export const PHONE_EXAMPLE_TEXT = '예: 010-1234-5678, 02-123-4567';
export const PHONE_ERROR_TEXT =
  '전화번호 형식을 확인해주세요. 휴대폰은 010/011 등, 유선은 02/031 등 지역번호로 시작해야 합니다.';

export function getPhoneDigits(raw) {
  return String(raw ?? '').replace(/\D/g, '');
}

function formatSeoulPhone(digits) {
  if (digits.length === 9) {
    return `02-${digits.slice(2, 5)}-${digits.slice(5)}`;
  }

  if (digits.length === 10) {
    return `02-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return null;
}

function formatThreeDigitPrefixPhone(digits) {
  if (digits.length === 9) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return null;
}

export function parseKoreanPhone(raw) {
  const digits = getPhoneDigits(raw);

  if (!digits) {
    return {
      digits: '',
      formatted: '',
      normalized: '',
      hasValue: false,
      isValid: true,
    };
  }

  let formatted = null;

  if (digits.startsWith('02')) {
    formatted = formatSeoulPhone(digits);
  } else if (MOBILE_PREFIX_PATTERN.test(digits) || AREA_PREFIX_PATTERN.test(digits)) {
    formatted = formatThreeDigitPrefixPhone(digits);
  }

  return {
    digits,
    formatted: formatted ?? digits,
    normalized: digits,
    hasValue: true,
    isValid: Boolean(formatted),
  };
}

export function formatKoreanPhone(raw) {
  return parseKoreanPhone(raw).formatted;
}
