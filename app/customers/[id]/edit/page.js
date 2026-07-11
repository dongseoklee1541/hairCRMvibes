'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, Archive, ChevronLeft, Loader2, RotateCcw } from 'lucide-react';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { useUnsavedChangesGuard } from '@/components/customers/useUnsavedChangesGuard';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

function getUpdateErrorMessage(error) {
  if (!navigator.onLine) {
    return '오프라인에서는 고객 정보를 수정할 수 없습니다. 연결을 확인해주세요.';
  }

  if (error?.code === '42501') {
    return '고객 정보를 수정할 권한이 없습니다.';
  }

  if (error?.code === '55000') {
    return '보관되거나 병합된 고객은 수정할 수 없습니다. 고객 상태를 다시 확인해주세요.';
  }

  return '변경사항을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.';
}

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id;
  const [customer, setCustomer] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const requestNavigation = useUnsavedChangesGuard({
    isDirty,
    message: '변경사항이 저장되지 않았습니다. 나가시겠어요?',
  });

  const fetchCustomer = useCallback(async () => {
    if (!customerId) return;

    setStatus('loading');
    setLoadError('');

    try {
      const { data, error } = await supabase
        .from('customers')
        .select(
          'id,name,phone,memo,archived_at,archive_reason,merged_into_customer_id,anonymized_at'
        )
        .eq('id', customerId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setCustomer(null);
        setStatus('not-found');
        return;
      }

      setCustomer(data);
      setStatus('ready');
    } catch {
      setCustomer(null);
      setLoadError('고객 정보를 불러오지 못했습니다. 연결을 확인하고 다시 시도해주세요.');
      setStatus('error');
    }
  }, [customerId]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  const handleBack = useCallback(() => {
    requestNavigation(() => router.replace(`/customers/${customerId}`));
  }, [customerId, requestNavigation, router]);

  const handleOpenDuplicates = useCallback(() => {
    requestNavigation(() => router.replace('/customers/duplicates'), {
      message: '작성 중인 내용은 저장되지 않습니다. 중복 고객 비교 화면으로 이동할까요?',
    });
  }, [requestNavigation, router]);

  const checkDuplicateCandidates = useCallback(
    async (phoneDigits) => {
      const { data, error } = await supabase.rpc('find_customer_duplicates', {
        p_name: null,
        p_phone: phoneDigits,
        p_exclude_customer_id: customerId,
      });

      if (error) throw error;
      return data ?? [];
    },
    [customerId]
  );

  const handleSubmit = useCallback(
    async ({ name, phone, memo }) => {
      setIsSubmitting(true);
      setSubmitError('');

      try {
        const { data, error } = await supabase
          .from('customers')
          .update({
            name,
            phone: phone || null,
            memo: memo || null,
          })
          .eq('id', customerId)
          .is('archived_at', null)
          .select('id')
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          const lifecycleError = new Error('Customer is no longer editable.');
          lifecycleError.code = '55000';
          throw lifecycleError;
        }

        setIsDirty(false);
        requestNavigation(() => {
          router.replace(`/customers/${customerId}?updated=1`);
          router.refresh();
        }, { prompt: false });
      } catch (error) {
        setSubmitError(getUpdateErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
    },
    [customerId, requestNavigation, router]
  );

  if (status === 'loading') {
    return (
      <main className={`page-content ${styles.centerState}`} aria-busy="true">
        <Loader2 size={30} className="animate-spin text-tertiary" aria-hidden="true" />
        <p>고객 정보를 불러오는 중입니다.</p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className={`page-content ${styles.centerState}`}>
        <AlertTriangle size={30} className={styles.errorIcon} aria-hidden="true" />
        <h1 className="heading-md">고객 정보를 불러오지 못했습니다</h1>
        <p>{loadError}</p>
        <button
          type="button"
          className={`${styles.retryButton} min-h-[44px] focus-visible:outline-2`}
          onClick={fetchCustomer}
        >
          <RotateCcw size={18} aria-hidden="true" /> 다시 시도
        </button>
      </main>
    );
  }

  if (status === 'not-found' || !customer) {
    return (
      <main className={`page-content ${styles.centerState}`}>
        <h1 className="heading-md">고객 정보를 찾을 수 없습니다</h1>
        <p>삭제된 링크이거나 접근할 수 없는 고객입니다.</p>
        <Link href="/" className={`${styles.retryButton} min-h-[44px] focus-visible:outline-2`}>
          고객 목록으로
        </Link>
      </main>
    );
  }

  const isReadOnly = Boolean(customer.archived_at || customer.merged_into_customer_id || customer.anonymized_at);

  return (
    <main className={`page-content ${styles.page}`}>
      <header className={styles.header}>
        <button
          type="button"
          onClick={handleBack}
          className={`${styles.backButton} min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2`}
          disabled={isSubmitting}
          aria-label="고객 상세로 돌아가기"
        >
          <ChevronLeft size={22} aria-hidden="true" />
          <span>뒤로</span>
        </button>
        <div className={styles.headerTitle}>
          <h1 className="heading-md">고객 정보 편집</h1>
          <p>이름, 전화번호, 메모를 수정합니다.</p>
        </div>
        <div className={styles.headerSpacer} aria-hidden="true" />
      </header>

      {isReadOnly ? (
        <section className={styles.readOnlyCard} aria-labelledby="read-only-title">
          <Archive size={24} aria-hidden="true" />
          <div>
            <h2 id="read-only-title">이 고객은 읽기 전용입니다</h2>
            <p>
              {customer.merged_into_customer_id
                ? '다른 고객에게 병합된 원본은 병합 취소 흐름에서만 복구할 수 있습니다.'
                : customer.anonymized_at
                  ? '개인정보가 비식별화되어 다시 편집할 수 없습니다.'
                  : '보관 고객은 상세 화면에서 먼저 복원한 뒤 편집할 수 있습니다.'}
            </p>
            <Link href={`/customers/${customerId}`}>고객 상세로 돌아가기</Link>
          </div>
        </section>
      ) : (
        <CustomerForm
          mode="edit"
          initialValues={customer}
          isSubmitting={isSubmitting}
          submitError={submitError}
          checkDuplicateCandidates={checkDuplicateCandidates}
          onSubmit={handleSubmit}
          onCancel={handleBack}
          onOpenDuplicates={handleOpenDuplicates}
          onDirtyChange={setIsDirty}
        />
      )}
    </main>
  );
}
