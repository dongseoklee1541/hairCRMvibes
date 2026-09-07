export const SESSION_PASS_STATUS_LABELS = {
  active: '사용 가능',
  paused: '일시중지',
  cancelled: '해지',
  expired: '만료',
  exhausted: '소진',
};

export const SESSION_PASS_UNAVAILABLE_LABELS = {
  paused: '일시중지 중',
  cancelled: '해지됨',
  expired: '만료됨',
  exhausted: '잔여 0회',
  service_required: '등록 시술 필요',
  service_mismatch: '다른 시술 전용',
  customer_inactive: '읽기 전용 고객',
};

export function createRequestFingerprint(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

export function getOrCreateRequestId(requestRef, fingerprint) {
  if (requestRef.current?.fingerprint === fingerprint && requestRef.current?.id) {
    return requestRef.current.id;
  }

  const id = globalThis.crypto?.randomUUID?.();
  if (!id) {
    throw new Error('안전한 요청 ID를 만들 수 없습니다. 브라우저를 새로고침해주세요.');
  }

  requestRef.current = { fingerprint, id };
  return id;
}

export function clearRequestId(requestRef) {
  requestRef.current = null;
}

export function getAppointmentPassUsage(appointment) {
  const usages = appointment?.appointment_session_pass_usages;
  if (!Array.isArray(usages)) return null;

  return usages.find((usage) => usage.state === 'reserved' || usage.state === 'consumed') || null;
}

export function getMostRecentPassUsage(appointment) {
  const usages = appointment?.appointment_session_pass_usages;
  if (!Array.isArray(usages) || usages.length === 0) return null;
  return getAppointmentPassUsage(appointment) || [...usages].sort((left, right) => (
    String(right.reserved_at || '').localeCompare(String(left.reserved_at || ''))
  ))[0];
}

export function normalizeSessionPassRpcRows(data) {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}
