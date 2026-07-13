'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import styles from './RoleChangeSheet.module.css';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function getRoleChangeBlockReason({
  member,
  nextRole,
  currentUserId,
  ownerCount,
}) {
  if (!member || member.role !== 'owner' || nextRole !== 'staff') {
    return '';
  }

  if (member.userId === currentUserId) {
    return '본인 계정의 원장 권한은 변경할 수 없습니다.';
  }

  if (ownerCount <= 1) {
    return '마지막 원장은 직원으로 변경할 수 없습니다.';
  }

  return '';
}

export default function RoleChangeSheet({
  open,
  member,
  currentUserId,
  ownerCount,
  saving,
  errorMessage,
  returnFocusRef,
  onClose,
  onConfirm,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const sheetRef = useRef(null);
  const initialFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const savingRef = useRef(saving);
  const [nextRole, setNextRole] = useState('staff');

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  useEffect(() => {
    if (open && member) {
      setNextRole(member.role === 'owner' ? 'staff' : 'owner');
    }
  }, [open, member]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => {
      initialFocusRef.current?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!savingRef.current) {
          onCloseRef.current?.();
        }
        return;
      }

      if (event.key !== 'Tab' || !sheetRef.current) {
        return;
      }

      const focusable = Array.from(
        sheetRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
      ).filter((element) => element.getClientRects().length > 0);

      if (focusable.length === 0) {
        event.preventDefault();
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
      window.requestAnimationFrame(() => returnFocusRef?.current?.focus());
    };
  }, [open, returnFocusRef]);

  if (!open || !member || typeof document === 'undefined') {
    return null;
  }

  const blockReason = getRoleChangeBlockReason({
    member,
    nextRole,
    currentUserId,
    ownerCount,
  });
  const unchanged = nextRole === member.role;
  const memberLabel = member.emailMasked || '이메일 확인 불가';

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
      >
        <div className={styles.handle} aria-hidden="true" />

        <header className={styles.header}>
          <div>
            <h2 id={titleId} className="heading-md">역할 변경 확인</h2>
            <p id={descriptionId} className="caption">{memberLabel} 계정의 권한을 변경합니다.</p>
          </div>
          <button
            ref={initialFocusRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            disabled={saving}
            aria-label="역할 변경 창 닫기"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <fieldset className={styles.roleFieldset} disabled={saving}>
          <legend>변경할 역할</legend>
          <div className={styles.roleOptions}>
            <label className={nextRole === 'owner' ? styles.roleOptionActive : undefined}>
              <input
                type="radio"
                name="next-role"
                value="owner"
                checked={nextRole === 'owner'}
                onChange={() => setNextRole('owner')}
              />
              <span>원장</span>
            </label>
            <label className={nextRole === 'staff' ? styles.roleOptionActive : undefined}>
              <input
                type="radio"
                name="next-role"
                value="staff"
                checked={nextRole === 'staff'}
                onChange={() => setNextRole('staff')}
              />
              <span>직원</span>
            </label>
          </div>
        </fieldset>

        <div className={styles.summary}>
          <span>{member.role === 'owner' ? '원장' : '직원'}</span>
          <span aria-hidden="true">→</span>
          <strong>{nextRole === 'owner' ? '원장' : '직원'}</strong>
        </div>

        {blockReason ? (
          <div className={styles.guardMessage} role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <span>{blockReason}</span>
          </div>
        ) : null}

        {errorMessage ? (
          <p className={styles.errorMessage} role="alert" aria-live="assertive">
            {errorMessage}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
            disabled={saving}
          >
            취소
          </button>
          <button
            type="button"
            className={styles.confirmButton}
            onClick={() => onConfirm(nextRole)}
            disabled={saving || unchanged || Boolean(blockReason)}
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                변경 중
              </>
            ) : (
              '역할 변경'
            )}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
