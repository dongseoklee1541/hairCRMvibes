'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { createCustomer, getCustomerCreateErrorMessage } from '@/lib/customerCreate';
import { supabase } from '@/lib/supabase';
import styles from './CustomerQuickCreateSheet.module.css';

export function CustomerQuickCreateSheet({ initialName, onClose, onCreated, onSelectExisting }) {
  const dialogRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]'
      );
      if (focusable.length === 0) return;
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
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSubmitting, onClose]);

  const checkDuplicateCandidates = useCallback(async (phoneDigits) => {
    const { data, error } = await supabase.rpc('find_customer_duplicates', {
      p_name: null,
      p_phone: phoneDigits,
      p_exclude_customer_id: null,
    });
    if (error) throw error;
    return data ?? [];
  }, []);

  const handleSubmit = useCallback(async (values) => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const customer = await createCustomer(supabase, values);
      onCreated(customer);
    } catch (error) {
      setSubmitError(getCustomerCreateErrorMessage(error, navigator.onLine));
    } finally {
      setIsSubmitting(false);
    }
  }, [onCreated]);

  if (!isMounted) return null;

  return createPortal(
    <div className={styles.overlay} role="presentation">
      <section
        ref={dialogRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-create-title"
      >
        <div className={styles.grabber} aria-hidden="true" />
        <header className={styles.header}>
          <div>
            <h2 id="quick-create-title">새 고객 빠른 등록</h2>
            <p>입력 중인 예약 내용은 그대로 유지됩니다.</p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="고객 빠른 등록 닫기"
          >
            <X size={21} aria-hidden="true" />
          </button>
        </header>
        <div className={styles.scrollArea}>
          <CustomerForm
            initialValues={{ name: initialName, phone: '', memo: '' }}
            mode="create"
            isSubmitting={isSubmitting}
            submitError={submitError}
            checkDuplicateCandidates={checkDuplicateCandidates}
            onSubmit={handleSubmit}
            onCancel={onClose}
            onSelectDuplicateCandidate={onSelectExisting}
            autoFocusName
          />
        </div>
      </section>
    </div>,
    document.body
  );
}
