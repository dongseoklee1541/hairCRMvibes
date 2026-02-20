'use client';

import { Loader2, X } from 'lucide-react';
import styles from './ClosedDayConflictSheet.module.css';
import { APPOINTMENT_STATUS } from '@/lib/appointmentRules';
import { formatKoreanDate } from '@/lib/dateTime';

function getStatusLabel(status) {
  if (status === APPOINTMENT_STATUS.COMPLETED) return '완료';
  if (status === APPOINTMENT_STATUS.CANCELLED) return '취소';
  return '예약';
}

export default function ClosedDayConflictSheet({
  open,
  dateKey,
  conflicts,
  selectedIds,
  onToggle,
  onClose,
  onConfirm,
  saving,
}) {
  if (!open) return null;

  const confirmedCount = conflicts.filter((item) => item.status === APPOINTMENT_STATUS.CONFIRMED).length;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h3 className="heading-md">충돌 예약 확인</h3>
            <p className="caption">{formatKoreanDate(dateKey)}</p>
          </div>
          <button className="btn-icon btn-icon-sm" onClick={onClose} type="button" disabled={saving}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.list}>
          {conflicts.length === 0 ? (
            <div className={styles.empty}>해당 날짜 예약이 없습니다.</div>
          ) : (
            conflicts.map((item) => {
              const disabled = item.status !== APPOINTMENT_STATUS.CONFIRMED;
              const checked = selectedIds.includes(item.id);
              return (
                <label
                  key={item.id}
                  className={`${styles.item} ${disabled ? styles.itemLocked : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(item.id)}
                    disabled={disabled || saving}
                  />
                  <div className={styles.itemInfo}>
                    <p className="body-sm">{item.time?.slice(0, 5)} · {item.customers?.name || '이름 없음'} · {item.service}</p>
                    <p className="caption">{getStatusLabel(item.status)}</p>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <button
          className="btn-primary"
          type="button"
          onClick={onConfirm}
          disabled={saving || (confirmedCount > 0 && selectedIds.length === 0)}
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>저장 중...</span>
            </>
          ) : (
            <span>선택 예약 취소 후 휴무일 저장</span>
          )}
        </button>
      </div>
    </div>
  );
}
