'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import styles from './ClosedDayConflictSheet.module.css';
import { APPOINTMENT_STATUS } from '@/lib/appointmentRules';
import { formatKoreanDate } from '@/lib/dateTime';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getStatusLabel(status) {
  if (status === APPOINTMENT_STATUS.COMPLETED) return '완료';
  if (status === APPOINTMENT_STATUS.CANCELLED) return '취소';
  return '예약 확정';
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
  returnFocusRef,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const sheetRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const savingRef = useRef(saving);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  useEffect(() => {
    if (!open) return undefined;

    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!savingRef.current) {
          onCloseRef.current?.();
        }
        return;
      }

      if (event.key !== 'Tab' || !sheetRef.current) return;

      const focusable = Array.from(
        sheetRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
      ).filter((element) => element.getClientRects().length > 0);

      if (focusable.length === 0) {
        event.preventDefault();
        sheetRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => {
        const returnTarget = returnFocusRef?.current || previousFocusRef.current;
        returnTarget?.focus?.();
      });
    };
  }, [open, returnFocusRef]);

  if (!open || typeof document === 'undefined') return null;

  const confirmedCount = conflicts.filter(
    (item) => item.status === APPOINTMENT_STATUS.CONFIRMED
  ).length;

  return createPortal(
    <div
      className={styles.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <section
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={saving}
        tabIndex={-1}
      >
        <div className={styles.handle} aria-hidden="true" />
        <header className={styles.header}>
          <div>
            <h2 id={titleId} className="heading-md">취소할 예약을 확인해 주세요</h2>
            <p id={descriptionId} className="caption">
              {formatKoreanDate(dateKey)} · 선택한 확정 예약을 취소한 뒤 휴무일을 저장합니다.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            className={styles.closeButton}
            onClick={onClose}
            type="button"
            disabled={saving}
            aria-label="휴무일 예약 확인 창 닫기"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {confirmedCount > 0 ? (
          <div className={styles.warning}>
            <AlertTriangle size={20} aria-hidden="true" />
            <p>확정 예약 {confirmedCount}건 중 취소할 예약을 선택해 주세요. 완료되거나 이미 취소된 예약은 바뀌지 않습니다.</p>
          </div>
        ) : null}

        <div className={styles.list}>
          {conflicts.length === 0 ? (
            <div className={styles.empty}>해당 날짜에는 예약이 없습니다.</div>
          ) : (
            conflicts.map((item) => {
              const disabled = item.status !== APPOINTMENT_STATUS.CONFIRMED;
              const checked = selectedIds.includes(item.id);
              return (
                <label
                  key={item.id}
                  className={`${styles.item} ${disabled ? styles.itemLocked : ''}`}
                >
                  <span className={styles.checkboxTarget}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(item.id)}
                      disabled={disabled || saving}
                    />
                  </span>
                  <span className={styles.itemInfo}>
                    <span className="body-sm">
                      {item.time?.slice(0, 5)} · {item.customers?.name || '이름 없음'} · {item.service}
                    </span>
                    <span className="caption">{getStatusLabel(item.status)}</span>
                  </span>
                </label>
              );
            })
          )}
        </div>

        <button
          className={styles.confirmButton}
          type="button"
          onClick={onConfirm}
          disabled={saving || (confirmedCount > 0 && selectedIds.length === 0)}
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              <span>예약을 취소하고 저장하는 중입니다.</span>
            </>
          ) : (
            <span>
              {selectedIds.length > 0
                ? `예약 ${selectedIds.length}건 취소하고 휴무일 저장`
                : '휴무일 저장'}
            </span>
          )}
        </button>
      </section>
    </div>,
    document.body
  );
}
