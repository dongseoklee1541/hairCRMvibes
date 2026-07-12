'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { useUnsavedChangesGuard } from '@/components/customers/useUnsavedChangesGuard';
import { createCustomer, getCustomerCreateErrorMessage } from '@/lib/customerCreate';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

export default function NewCustomerPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const requestNavigation = useUnsavedChangesGuard({
    isDirty,
    message: '입력한 내용이 저장되지 않았습니다. 나가시겠어요?',
  });

  const handleCancel = useCallback(() => {
    requestNavigation(() => router.back(), { traverse: true });
  }, [requestNavigation, router]);

  const handleOpenDuplicates = useCallback(() => {
    requestNavigation(() => router.replace('/customers/duplicates'), {
      message: '작성 중인 내용은 저장되지 않습니다. 중복 고객 비교 화면으로 이동할까요?',
    });
  }, [requestNavigation, router]);

  const checkDuplicateCandidates = useCallback(async (phoneDigits) => {
    const { data, error } = await supabase.rpc('find_customer_duplicates', {
      p_name: null,
      p_phone: phoneDigits,
      p_exclude_customer_id: null,
    });

    if (error) throw error;
    return data ?? [];
  }, []);

  const handleSubmit = useCallback(
    async ({ name, phone, memo }) => {
      setIsSubmitting(true);
      setSubmitError('');

      try {
        const data = await createCustomer(supabase, { name, phone, memo });

        setIsDirty(false);
        requestNavigation(() => {
          router.replace(data?.id ? `/customers/${data.id}?created=1` : '/');
          router.refresh();
        }, { prompt: false });
      } catch (error) {
        setSubmitError(getCustomerCreateErrorMessage(error, navigator.onLine));
      } finally {
        setIsSubmitting(false);
      }
    },
    [requestNavigation, router]
  );

  return (
    <main className={`page-content ${styles.page}`}>
      <header className={styles.header}>
        <button
          type="button"
          onClick={handleCancel}
          className={`${styles.backButton} min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2`}
          disabled={isSubmitting}
          aria-label="고객 목록으로 돌아가기"
        >
          <ChevronLeft size={22} aria-hidden="true" />
          <span>뒤로</span>
        </button>
        <div className={styles.headerTitle}>
          <h1 className="heading-md">새 고객 등록</h1>
          <p>저장 전 동일 전화번호를 확인합니다.</p>
        </div>
        <div className={styles.headerSpacer} aria-hidden="true" />
      </header>

      <CustomerForm
        mode="create"
        isSubmitting={isSubmitting}
        submitError={submitError}
        checkDuplicateCandidates={checkDuplicateCandidates}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onOpenDuplicates={handleOpenDuplicates}
        onDirtyChange={setIsDirty}
      />
    </main>
  );
}
