export const APPOINTMENT_STATUS = {
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

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
