'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Archive,
  Calendar,
  Check,
  ChevronLeft,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Scissors,
  ShieldAlert,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { formatPriceKrw } from '@/lib/formatPrice';
import {
  formatKoreanShortDate,
  formatKstDateDot,
  getTodayKstDateKey,
  getWeekdayLabelFromDateKey,
  KOREAN_WEEKDAYS_LONG,
} from '@/lib/dateTime';
import { formatDurationMinutes } from '@/lib/appointmentRules';
import styles from './page.module.css';

function formatDate(date) {
  return {
    short: formatKoreanShortDate(date),
    day: getWeekdayLabelFromDateKey(date, KOREAN_WEEKDAYS_LONG),
  };
}

function getLifecycleStatus(customer) {
  if (customer.anonymized_at) return { label: '익명 처리됨', tone: 'danger' };
  if (customer.merged_into_customer_id) return { label: '병합 원본', tone: 'warning' };
  if (customer.archived_at) return { label: '보관됨', tone: 'warning' };
  return { label: '활성', tone: 'success' };
}

function getLifecycleErrorMessage(error) {
  if (!navigator.onLine) {
    return '오프라인에서는 고객 상태를 변경할 수 없습니다. 연결을 확인해주세요.';
  }

  if (error?.code === '42501') return '원장 권한이 확인되지 않아 작업을 실행하지 못했습니다.';
  if (error?.code === '22023') return '요청 정보가 올바르지 않습니다. 입력값을 다시 확인해주세요.';
  if (error?.code === 'P0002') return '고객을 찾을 수 없습니다. 목록을 새로고침해주세요.';
  if (error?.code === '55000') return '현재 고객 상태에서는 이 작업을 실행할 수 없습니다.';
  return '고객 상태를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.';
}

function getAppointmentErrorMessage(error) {
  if (!navigator.onLine) return '오프라인에서는 시술 이력을 추가할 수 없습니다.';
  if (error?.code === '55000' && error?.message?.includes('서비스')) {
    return '선택한 시술은 현재 사용하지 않습니다. 목록을 새로고침한 뒤 다른 시술을 선택해 주세요.';
  }
  if (error?.code === '55000' || error?.code === '23514') {
    return '보관되거나 병합된 고객에게는 새 시술 이력을 추가할 수 없습니다.';
  }
  if (error?.code === '42501') {
    return '읽기 전용 고객이거나 권한이 없어 시술 이력을 저장할 수 없습니다.';
  }
  if (error?.code === '22023') {
    return error?.message || '입력한 실제 시술금액 또는 사유를 확인해 주세요.';
  }
  return error?.message || '시술 이력을 추가하지 못했습니다. 잠시 후 다시 시도해주세요.';
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { role, isRoleReady } = useAuth();
  const customerId = params.id;
  const closeDialogRef = useRef(null);
  const dialogTriggerRef = useRef(null);
  const pageFocusRef = useRef(null);
  const pendingFocusRestoreRef = useRef(false);
  const statusRef = useRef('loading');
  const actionLoadingRef = useRef(false);
  const historySavingRef = useRef(false);
  const [customer, setCustomer] = useState(null);
  const [history, setHistory] = useState([]);
  const [serviceDefaults, setServiceDefaults] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState('');
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [lifecycleError, setLifecycleError] = useState('');
  const [activeDialog, setActiveDialog] = useState(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [anonymizeConfirmation, setAnonymizeConfirmation] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const [historySaving, setHistorySaving] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [priceEditor, setPriceEditor] = useState(null);
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceError, setPriceError] = useState('');
  const dataRequestIdRef = useRef(0);
  const [historyForm, setHistoryForm] = useState({
    date: getTodayKstDateKey(),
    time: '10:00',
    service_id: '',
    service: '',
    duration_minutes: null,
    actual_price_krw: '',
    actual_price_update_reason: '',
    memo: '',
  });

  const isOwner = isRoleReady && role === 'owner';

  const fetchData = useCallback(async () => {
    if (!customerId) return;

    const requestId = ++dataRequestIdRef.current;
    const isCurrentRequest = () => requestId === dataRequestIdRef.current;

    setStatus('loading');
    setLoadError('');

    try {
      // Completed rows must not INSERT audit columns or actual_price_krw directly:
      // audit is RPC/trigger-owned, and completed actual prices require a reason via RPC.
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select(
          'id,name,phone,memo,created_at,updated_at,archived_at,archived_by,archive_reason,merged_into_customer_id,anonymized_at,anonymized_by'
        )
        .eq('id', customerId)
        .maybeSingle();

      if (customerError) throw customerError;
      if (!isCurrentRequest()) return;
      if (!customerData) {
        setCustomer(null);
        setHistory([]);
        setStatus('not-found');
        return;
      }

      const { data: historyData, error: historyQueryError } = await supabase
        .from('appointments')
        .select('id,date,time,service,memo,status,service_id,duration_minutes,price_snapshot_krw,actual_price_krw,actual_price_updated_at,actual_price_updated_by,actual_price_update_reason')
        .eq('customer_id', customerId)
        .order('date', { ascending: false })
        .order('time', { ascending: false });

      if (historyQueryError) throw historyQueryError;
      if (!isCurrentRequest()) return;

      setCustomer(customerData);
      setHistory(historyData ?? []);
      setStatus('ready');
    } catch {
      if (!isCurrentRequest()) return;
      setCustomer(null);
      setHistory([]);
      setLoadError(
        navigator.onLine
          ? '고객 정보와 시술 이력을 불러오지 못했습니다.'
          : '오프라인에서는 고객 정보를 불러올 수 없습니다.'
      );
      setStatus('error');
    }
  }, [customerId]);

  const fetchServiceDefaults = useCallback(async () => {
    try {
      setServicesLoading(true);
      setServicesError('');
      const { data, error } = await supabase
        .from('salon_service_defaults')
        .select('id,name,default_duration_minutes,price_krw')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setServiceDefaults(data || []);
    } catch (error) {
      console.error('활성 서비스 조회 오류:', error);
      setServiceDefaults([]);
      setServicesError('사용 중인 시술을 불러오지 못했습니다. 시술 이름을 직접 입력해 주세요.');
    } finally {
      setServicesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    return () => {
      dataRequestIdRef.current += 1;
    };
  }, [fetchData]);

  useEffect(() => {
    fetchServiceDefaults();
  }, [fetchServiceDefaults]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const wasCreated = url.searchParams.get('created') === '1';
    const wasUpdated = url.searchParams.get('updated') === '1';
    if (!wasCreated && !wasUpdated) return;

    setFeedback(wasCreated ? '새 고객을 등록했습니다.' : '고객 기본정보를 저장했습니다.');
    url.searchParams.delete('created');
    url.searchParams.delete('updated');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    statusRef.current = status;

    if (status === 'loading' || !pendingFocusRestoreRef.current) return undefined;

    const focusFrame = window.requestAnimationFrame(() => {
      if (!pageFocusRef.current) return;
      pageFocusRef.current.focus();
      pendingFocusRestoreRef.current = false;
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [status]);

  useEffect(() => {
    actionLoadingRef.current = actionLoading;
  }, [actionLoading]);

  useEffect(() => {
    historySavingRef.current = historySaving;
  }, [historySaving]);

  useEffect(() => {
    if (!activeDialog && !showHistorySheet && !priceEditor) return undefined;

    const previousOverflow = document.body.style.overflow;
    const trigger = dialogTriggerRef.current;
    document.body.style.overflow = 'hidden';
    closeDialogRef.current?.focus();

    const modal = closeDialogRef.current?.closest('[role="dialog"], [role="alertdialog"]');
    const handleKeyDown = (event) => {
        if (event.key === 'Escape' && !actionLoadingRef.current && !historySavingRef.current && !priceSaving) {
        setActiveDialog(null);
        setShowHistorySheet(false);
        setPriceEditor(null);
        setPriceError('');
        setArchiveReason('');
        setAnonymizeConfirmation('');
        setLifecycleError('');
        return;
      }

      if (event.key !== 'Tab' || !modal) return;

      const focusableElements = Array.from(
        modal.querySelectorAll(
          'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (trigger?.isConnected) {
        trigger.focus();
        return;
      }

      pendingFocusRestoreRef.current = true;
      window.requestAnimationFrame(() => {
        if (statusRef.current === 'loading' || !pageFocusRef.current) return;
        pageFocusRef.current.focus();
        pendingFocusRestoreRef.current = false;
      });
    };
  }, [activeDialog, showHistorySheet, priceEditor]);

  const closeLifecycleDialog = () => {
    if (actionLoading) return;
    setActiveDialog(null);
    setArchiveReason('');
    setAnonymizeConfirmation('');
    setLifecycleError('');
  };

  const runLifecycleAction = async (action) => {
    setActionLoading(true);
    setLifecycleError('');
    setFeedback('');

    try {
      const rpcConfig = {
        archive: {
          name: 'archive_customer',
          params: { p_customer_id: customerId, p_reason: archiveReason.trim() || null },
          success: '고객을 보관했습니다. 예약 이력은 그대로 유지됩니다.',
        },
        restore: {
          name: 'restore_customer',
          params: { p_customer_id: customerId },
          success: '고객을 활성 목록으로 복원했습니다.',
        },
        anonymize: {
          name: 'anonymize_customer',
          params: { p_customer_id: customerId },
          success: '고객 개인정보를 익명 처리했습니다. 예약 이력은 유지됩니다.',
        },
      }[action];

      const { error } = await supabase.rpc(rpcConfig.name, rpcConfig.params);
      if (error) throw error;

      setFeedback(rpcConfig.success);
      setActiveDialog(null);
      setArchiveReason('');
      setAnonymizeConfirmation('');
      await fetchData();
    } catch (error) {
      setLifecycleError(getLifecycleErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const openHistorySheet = (event) => {
    dialogTriggerRef.current = event.currentTarget;
    setHistoryError('');
    setHistoryForm({
      date: getTodayKstDateKey(),
      time: '10:00',
      service_id: '',
      service: '',
      duration_minutes: null,
      actual_price_krw: '',
      actual_price_update_reason: '',
      memo: '',
    });
    setShowHistorySheet(true);
  };

  const handleHistoryServiceChange = (serviceId) => {
    setHistoryError('');

    if (!serviceId) {
      setHistoryForm((current) => ({
        ...current,
        service_id: '',
        service: '',
        duration_minutes: null,
      }));
      return;
    }

    const service = serviceDefaults.find((item) => item.id === serviceId);
    if (!service) return;

    setHistoryForm((current) => ({
      ...current,
      service_id: service.id,
      service: service.name,
      duration_minutes: service.default_duration_minutes,
    }));
  };

  const handleHistorySubmit = async (event) => {
    event.preventDefault();
    const service = historyForm.service.trim();

    if (!service) {
      setHistoryError('시술명을 입력해주세요.');
      return;
    }

    const actualPriceKrw = historyForm.actual_price_krw === '' ? null : Number(historyForm.actual_price_krw);
    if (actualPriceKrw !== null && (!Number.isInteger(actualPriceKrw) || actualPriceKrw < 0)) {
      setHistoryError('실제 시술금액은 0원 이상의 정수로 입력해주세요.');
      return;
    }
    if (actualPriceKrw !== null && !historyForm.actual_price_update_reason.trim()) {
      setHistoryError('완료 이력의 실제 금액을 기록하려면 수정 사유를 입력해주세요.');
      return;
    }

    setHistorySaving(true);
    setHistoryError('');

    try {
      const payload = {
        customer_id: customerId,
        date: historyForm.date,
        time: historyForm.time,
        service,
        memo: historyForm.memo.trim() || null,
        status: 'completed',
      };

      if (historyForm.service_id) {
        payload.service_id = historyForm.service_id;
        payload.duration_minutes = historyForm.duration_minutes;
        payload.duration = formatDurationMinutes(historyForm.duration_minutes);
      } else {
        payload.service_id = null;
        payload.price_snapshot_krw = null;
      }

      const { data: inserted, error } = await supabase
        .from('appointments')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;

      if (actualPriceKrw !== null) {
        const { error: priceError } = await supabase.rpc('set_appointment_actual_price', {
          p_appointment_id: inserted.id,
          p_actual_price_krw: actualPriceKrw,
          p_expected_actual_price_updated_at: null,
          p_update_reason: historyForm.actual_price_update_reason.trim() || null,
        });

        if (priceError) {
          setShowHistorySheet(false);
          setFeedback(
            '시술 이력은 저장됐지만 실제 시술금액을 기록하지 못했습니다. 이력의 금액 수정으로 다시 입력해 주세요.'
          );
          await fetchData();
          return;
        }
      }

      setShowHistorySheet(false);
      setFeedback(
        actualPriceKrw === null
          ? '시술 이력을 추가했습니다.'
          : '시술 이력과 실제 시술금액을 저장했습니다.'
      );
      await fetchData();
    } catch (error) {
      setHistoryError(getAppointmentErrorMessage(error));
      if (error?.code === '55000' && error?.message?.includes('서비스')) {
        await fetchServiceDefaults();
      }
    } finally {
      setHistorySaving(false);
    }
  };

  const openPriceEditor = (event, item) => {
    if (isReadOnly) return;
    dialogTriggerRef.current = event.currentTarget;
    setPriceError('');
    setPriceEditor({
      id: item.id,
      status: item.status,
      actual_price_krw: item.actual_price_krw == null ? '' : String(item.actual_price_krw),
      original_actual_price_krw: item.actual_price_krw ?? null,
      expected_actual_price_updated_at: item.actual_price_updated_at ?? null,
      update_reason: '',
    });
  };

  const handlePriceSave = async (event) => {
    event.preventDefault();
    if (!priceEditor || priceSaving) return;
    if (!navigator.onLine) {
      setPriceError('오프라인에서는 실제 시술금액을 저장할 수 없습니다. 연결을 확인해주세요.');
      return;
    }

    const actualPriceKrw = priceEditor.actual_price_krw === '' ? null : Number(priceEditor.actual_price_krw);
    if (actualPriceKrw !== null && (!Number.isInteger(actualPriceKrw) || actualPriceKrw < 0)) {
      setPriceError('실제 시술금액은 0원 이상의 정수로 입력해주세요.');
      return;
    }
    if (actualPriceKrw === priceEditor.original_actual_price_krw) {
      setPriceEditor(null);
      setFeedback('변경된 실제 시술금액이 없습니다.');
      return;
    }
    if (priceEditor.status === 'completed' && !priceEditor.update_reason.trim()) {
      setPriceError('완료 예약의 실제 금액 변경 사유를 입력해주세요.');
      return;
    }

    const editingId = priceEditor.id;
    setPriceSaving(true);
    setPriceError('');
    try {
      const { error } = await supabase.rpc('set_appointment_actual_price', {
        p_appointment_id: editingId,
        p_actual_price_krw: actualPriceKrw,
        p_expected_actual_price_updated_at: priceEditor.expected_actual_price_updated_at,
        p_update_reason: priceEditor.update_reason.trim() || null,
      });
      if (error) throw error;
      if (!priceEditor || priceEditor.id !== editingId) return;
      setPriceEditor(null);
      setFeedback('실제 시술금액을 저장했습니다.');
      await fetchData();
    } catch (error) {
      if (error?.code === '40001') {
        setPriceError('다른 사용자가 실제 금액을 먼저 수정했습니다. 최신 이력을 다시 불러온 뒤 확인해주세요.');
        await fetchData();
      } else if (error?.code === '42501') {
        setPriceError('읽기 전용 고객이거나 권한이 없어 실제 금액을 수정할 수 없습니다.');
      } else {
        setPriceError(error?.message || '실제 시술금액을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setPriceSaving(false);
    }
  };

  if (status === 'loading') {
    return (
      <main ref={pageFocusRef} tabIndex={-1} className={`page-content ${styles.centerState}`} aria-busy="true">
        <Loader2 size={30} className="animate-spin text-tertiary" aria-hidden="true" />
        <p>고객 정보를 불러오는 중입니다.</p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main ref={pageFocusRef} tabIndex={-1} className={`page-content ${styles.centerState}`}>
        <AlertTriangle size={30} className={styles.dangerText} aria-hidden="true" />
        <h1 className="heading-md">고객 정보를 불러오지 못했습니다</h1>
        <p>{loadError}</p>
        <button
          type="button"
          className={`${styles.retryButton} min-h-[44px] focus-visible:outline-2`}
          onClick={fetchData}
        >
          <RefreshCw size={18} aria-hidden="true" /> 다시 시도
        </button>
      </main>
    );
  }

  if (status === 'not-found' || !customer) {
    return (
      <main ref={pageFocusRef} tabIndex={-1} className={`page-content ${styles.centerState}`}>
        <User size={32} className="text-tertiary" aria-hidden="true" />
        <h1 className="heading-md">고객 정보를 찾을 수 없습니다</h1>
        <p>삭제된 링크이거나 접근할 수 없는 고객입니다.</p>
        <Link href="/" className={`${styles.retryButton} min-h-[44px] focus-visible:outline-2`}>
          고객 목록으로
        </Link>
      </main>
    );
  }

  const lifecycleStatus = getLifecycleStatus(customer);
  const isArchived = Boolean(customer.archived_at);
  const isMerged = Boolean(customer.merged_into_customer_id);
  const isAnonymized = Boolean(customer.anonymized_at);
  const isReadOnly = isArchived || isMerged || isAnonymized;

  return (
    <main ref={pageFocusRef} tabIndex={-1} className={`page-content ${styles.page}`}>
      <nav className={styles.navBar} aria-label="고객 상세 탐색">
        <button
          type="button"
          onClick={() => router.back()}
          className={`${styles.backButton} min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2`}
        >
          <ChevronLeft size={22} aria-hidden="true" /> 뒤로
        </button>
        {!isReadOnly && (
          <Link
            href={`/customers/${customerId}/edit`}
            className={`${styles.editButton} min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2`}
            aria-label="고객 정보 편집"
          >
            <Pencil size={17} aria-hidden="true" /> 편집
          </Link>
        )}
      </nav>

      {feedback && (
        <div className={styles.feedback} role="status">
          <Check size={19} aria-hidden="true" />
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} aria-label="알림 닫기">
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      )}

      <section className={styles.profileCard} aria-labelledby="customer-name">
        <div className={styles.avatar} aria-hidden="true">
          <User size={30} />
        </div>
        <div className={styles.profileInfo}>
          <div className={styles.nameRow}>
            <h1 id="customer-name" className="heading-lg">{customer.name}</h1>
            <span className={`${styles.statusBadge} ${styles[`status${lifecycleStatus.tone}`]}`}>
              {lifecycleStatus.label}
            </span>
          </div>
          <p className={styles.phone}>{customer.phone || '전화번호 없음'}</p>
          {customer.created_at && (
            <p className={styles.createdAt}>등록일 {formatKstDateDot(customer.created_at)}</p>
          )}
        </div>
      </section>

      {isReadOnly && (
        <section className={styles.readOnlyNotice} aria-labelledby="read-only-title">
          <Archive size={23} aria-hidden="true" />
          <div>
            <h2 id="read-only-title">
              {isAnonymized ? '개인정보 익명 처리 완료' : isMerged ? '병합된 원본 고객' : '보관 고객'}
            </h2>
            <p>
              {isAnonymized
                ? '개인정보는 복구할 수 없으며 고객 키와 예약 이력만 보존됩니다.'
                : isMerged
                  ? '새 예약과 편집이 차단됩니다. 병합 취소는 중복 고객 관리에서 진행해주세요.'
                  : '편집과 새 예약은 차단되지만 기존 시술 이력은 계속 확인할 수 있습니다.'}
            </p>
            {customer.archive_reason && !isAnonymized && (
              <p className={styles.archiveReason}>보관 사유: {customer.archive_reason}</p>
            )}
          </div>
        </section>
      )}

      <section className={styles.section} aria-labelledby="memo-title">
        <div className={styles.sectionHeader}>
          <h2 id="memo-title" className="heading-md">고객 메모</h2>
          {!isReadOnly && (
            <Link href={`/customers/${customerId}/edit`} className={styles.inlineEditLink}>
              <Pencil size={15} aria-hidden="true" /> 편집
            </Link>
          )}
        </div>
        <div className={styles.memoCard}>
          <FileText size={19} aria-hidden="true" />
          <p>{customer.memo || '등록된 메모가 없습니다.'}</p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="history-title">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="history-title" className="heading-md">시술 이력</h2>
            <p>총 {history.length}회</p>
          </div>
          {!isReadOnly && (
            <button
              type="button"
              onClick={openHistorySheet}
              className={`${styles.addHistoryButton} min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2`}
            >
              <Plus size={18} aria-hidden="true" /> 이력 추가
            </button>
          )}
        </div>

        <div className={styles.historyCard}>
          {history.length === 0 ? (
            <div className={styles.emptyHistory}>
              <Scissors size={30} aria-hidden="true" />
              <h3>시술 이력이 없습니다</h3>
              <p>{isReadOnly ? '보관 전에 등록된 이력이 없습니다.' : '첫 시술 이력을 추가해보세요.'}</p>
              {!isReadOnly && <button type="button" onClick={openHistorySheet}>이력 추가</button>}
            </div>
          ) : (
            history.map((item) => {
              const dateInfo = formatDate(item.date);
              return (
                <article key={item.id} className={styles.historyRow}>
                  <div className={styles.historyDate}>
                    <time dateTime={item.date}>{dateInfo.short}</time>
                    <span>{dateInfo.day}</span>
                  </div>
                  <span className={styles.historyDivider} aria-hidden="true" />
                  <div className={styles.historyInfo}>
                    <h3>{item.service}</h3>
                    <p className={styles.historyPrice}>
                      {item.actual_price_krw == null
                        ? `실제 금액 미입력 · 예약 기준 ${formatPriceKrw(item.price_snapshot_krw)}`
                        : `실제 ${formatPriceKrw(item.actual_price_krw)} · 예약 기준 ${formatPriceKrw(item.price_snapshot_krw)}`}
                    </p>
                    {item.memo && <p className={styles.historyMemo}>{item.memo}</p>}
                  </div>
                  <span className={`${styles.appointmentBadge} ${styles[`appointment${item.status}`]}`}>
                    {item.status === 'completed' ? '완료' : item.status === 'cancelled' ? '취소' : '예약'}
                  </span>
                  {!isReadOnly && (
                    <button
                      type="button"
                      className={styles.editPriceButton}
                      onClick={(event) => openPriceEditor(event, item)}
                      aria-label={`${item.service} 실제 시술금액 수정`}
                    >
                      <Pencil size={17} aria-hidden="true" />
                      <span>금액 수정</span>
                    </button>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="duplicate-title">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="duplicate-title" className="heading-md">중복 고객</h2>
            <p>병합은 자동 실행되지 않습니다.</p>
          </div>
        </div>
        <Link
          href="/customers/duplicates"
          prefetch={false}
          className={`${styles.duplicateLink} min-h-[52px] focus-visible:outline-2 focus-visible:outline-offset-2`}
        >
          <Users size={20} aria-hidden="true" />
          <span>
            <strong>중복 후보 비교</strong>
            <small>대표 고객과 예약 이동 내용을 확인한 뒤 실행합니다.</small>
          </span>
          <ChevronLeft size={18} className={styles.chevronRight} aria-hidden="true" />
        </Link>
      </section>

      <section className={styles.section} aria-labelledby="lifecycle-title">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="lifecycle-title" className="heading-md">고객 상태 관리</h2>
            <p>예약 이력은 삭제하지 않습니다.</p>
          </div>
        </div>

        {!isRoleReady ? (
          <div className={styles.permissionCard} aria-busy="true">
            <Loader2 size={19} className="animate-spin" aria-hidden="true" /> 권한을 확인하는 중입니다.
          </div>
        ) : !isOwner ? (
          <div className={styles.permissionCard}>
            <ShieldAlert size={20} aria-hidden="true" />
            <div>
              <strong>원장 전용 기능입니다</strong>
              <p>직원은 기본 정보와 시술 이력을 관리할 수 있지만 보관·병합·개인정보 익명 처리는 실행할 수 없습니다.</p>
            </div>
          </div>
        ) : isAnonymized ? (
          <div className={styles.permissionCard}>
            <ShieldAlert size={20} aria-hidden="true" /> 익명 처리한 개인정보는 되돌릴 수 없습니다.
          </div>
        ) : isMerged ? (
          <div className={styles.permissionCard}>
            <RotateCcw size={20} aria-hidden="true" />
            <div>
              <strong>직접 복원할 수 없습니다</strong>
              <p>중복 고객 관리에서 감사 이벤트를 확인하고 병합 실행 취소를 진행해주세요.</p>
            </div>
          </div>
        ) : (
          <div className={styles.lifecycleActions}>
            {isArchived ? (
              <button
                type="button"
                className={`${styles.restoreButton} min-h-[52px] focus-visible:outline-2 disabled:opacity-70`}
                onClick={() => runLifecycleAction('restore')}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 size={19} className="animate-spin" /> : <RotateCcw size={19} />}
                활성 고객으로 복원
              </button>
            ) : (
              <button
                type="button"
                className={`${styles.archiveButton} min-h-[52px] focus-visible:outline-2 disabled:opacity-70`}
                onClick={(event) => {
                  dialogTriggerRef.current = event.currentTarget;
                  setLifecycleError('');
                  setActiveDialog('archive');
                }}
              >
                <Archive size={19} aria-hidden="true" /> 고객 보관
              </button>
            )}
            <button
              type="button"
              className={`${styles.anonymizeButton} min-h-[52px] focus-visible:outline-2 disabled:opacity-70`}
              onClick={(event) => {
                dialogTriggerRef.current = event.currentTarget;
                setLifecycleError('');
                setActiveDialog('anonymize');
              }}
              disabled={actionLoading}
            >
              <Trash2 size={19} aria-hidden="true" /> 개인정보 익명 처리
            </button>
          </div>
        )}
        {lifecycleError && !activeDialog && (
          <p className={styles.actionError} role="alert">{lifecycleError}</p>
        )}
      </section>

      {showHistorySheet && (
        <div className={styles.overlay} role="presentation" onMouseDown={() => !historySaving && setShowHistorySheet(false)}>
          <section
            className={styles.bottomSheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-sheet-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className={styles.sheetHeader}>
              <div>
                <h2 id="history-sheet-title" className="heading-md">시술 이력 추가</h2>
                <p>활성 고객에게 완료 이력을 기록합니다.</p>
              </div>
              <button
                ref={closeDialogRef}
                type="button"
                className={`${styles.closeButton} min-h-[44px] focus-visible:outline-2`}
                onClick={() => setShowHistorySheet(false)}
                disabled={historySaving}
                aria-label="시술 이력 추가 닫기"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <form className={styles.historyForm} onSubmit={handleHistorySubmit}>
              <div className={styles.twoColumns}>
                <label>
                  <span><Calendar size={15} aria-hidden="true" /> 날짜</span>
                  <input
                    type="date"
                    value={historyForm.date}
                    onChange={(event) => setHistoryForm((current) => ({ ...current, date: event.target.value }))}
                    disabled={historySaving}
                    required
                  />
                </label>
                <label>
                  <span>시간</span>
                  <input
                    type="time"
                    value={historyForm.time}
                    onChange={(event) => setHistoryForm((current) => ({ ...current, time: event.target.value }))}
                    disabled={historySaving}
                    required
                  />
                </label>
              </div>
              <label>
                <span><Scissors size={15} aria-hidden="true" /> 등록된 시술 선택 (선택)</span>
                <select
                  value={historyForm.service_id}
                  onChange={(event) => handleHistoryServiceChange(event.target.value)}
                  disabled={historySaving || servicesLoading}
                >
                  <option value="">시술명 직접 입력 · 가격 미설정</option>
                  {serviceDefaults.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} · {formatPriceKrw(service.price_krw)}
                    </option>
                  ))}
                </select>
                <small className={styles.fieldHint}>
                  {servicesLoading
                    ? '사용 중인 시술을 불러오는 중입니다.'
                    : servicesError || (serviceDefaults.length === 0
                      ? '사용 중인 시술이 없습니다. 시술 이름을 직접 입력해 주세요.'
                      : '시술을 선택하면 현재 가격과 기본 시간을 완료 이력에 기록합니다.')}
                </small>
              </label>
              <label>
                <span><Scissors size={15} aria-hidden="true" /> 시술명</span>
                <input
                  value={historyForm.service}
                  onChange={(event) => {
                    setHistoryError('');
                    setHistoryForm((current) => ({ ...current, service: event.target.value }));
                  }}
                  placeholder="예: 커트, 염색, 펌"
                  maxLength={100}
                  disabled={historySaving}
                  readOnly={Boolean(historyForm.service_id)}
                  required
                />
                {historyForm.service_id && (
                  <small className={styles.fieldHint}>
                    {formatDurationMinutes(historyForm.duration_minutes)} · 선택한 시술명과 금액은 이 이력에 그대로 보관됩니다.
                  </small>
                )}
              </label>
              <label>
                <span><FileText size={15} aria-hidden="true" /> 메모 (선택)</span>
                <textarea
                  value={historyForm.memo}
                  onChange={(event) => setHistoryForm((current) => ({ ...current, memo: event.target.value }))}
                  placeholder="시술 관련 메모"
                  maxLength={1000}
                  disabled={historySaving}
                />
              </label>
              <label>
                <span>실제 시술금액 (선택)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={historyForm.actual_price_krw}
                  onChange={(event) => setHistoryForm((current) => ({ ...current, actual_price_krw: event.target.value }))}
                  placeholder="미입력"
                  disabled={historySaving}
                />
                <small className={styles.fieldHint}>예약 기준금액과 별도로 저장됩니다. 0원은 무료 시술입니다.</small>
              </label>
              {historyForm.actual_price_krw !== '' && (
                <label>
                  <span>실제 금액 기록 사유 (필수)</span>
                  <input
                    value={historyForm.actual_price_update_reason}
                    onChange={(event) => setHistoryForm((current) => ({ ...current, actual_price_update_reason: event.target.value }))}
                    placeholder="예: 현장 할인 적용"
                    maxLength={300}
                    disabled={historySaving}
                  />
                </label>
              )}
              {historyError && <p className={styles.actionError} role="alert">{historyError}</p>}
              <button
                type="submit"
                className={`${styles.sheetPrimaryButton} min-h-[56px] focus-visible:outline-2 disabled:opacity-70`}
                disabled={historySaving || !historyForm.service.trim()}
              >
                {historySaving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                {historySaving ? '저장 중' : '이력 저장'}
              </button>
            </form>
          </section>
        </div>
      )}

      {priceEditor && (
        <div className={styles.overlay} role="presentation" onMouseDown={() => !priceSaving && setPriceEditor(null)}>
          <section
            className={styles.bottomSheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby="actual-price-sheet-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className={styles.sheetHeader}>
              <div>
                <h2 id="actual-price-sheet-title" className="heading-md">실제 시술금액 수정</h2>
                <p>예약 기준금액은 바꾸지 않으며 실제 적용 금액만 기록합니다.</p>
              </div>
              <button
                ref={closeDialogRef}
                type="button"
                className={`${styles.closeButton} min-h-[44px] focus-visible:outline-2`}
                onClick={() => setPriceEditor(null)}
                disabled={priceSaving}
                aria-label="실제 시술금액 수정 닫기"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <form className={styles.historyForm} onSubmit={handlePriceSave}>
              <label>
                <span>실제 시술금액</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={priceEditor.actual_price_krw}
                  onChange={(event) => setPriceEditor((current) => ({ ...current, actual_price_krw: event.target.value }))}
                  placeholder="미입력"
                  disabled={priceSaving}
                  autoFocus
                />
                <small className={styles.fieldHint}>비워 두면 실제 금액 미입력으로 되돌립니다.</small>
              </label>
              {priceEditor.status === 'completed' && (
                <label>
                  <span>실제 금액 수정 사유 (필수)</span>
                  <input
                    value={priceEditor.update_reason}
                    onChange={(event) => setPriceEditor((current) => ({ ...current, update_reason: event.target.value }))}
                    placeholder="예: 현장 할인 적용"
                    maxLength={300}
                    disabled={priceSaving}
                    required
                  />
                </label>
              )}
              {priceError && <p className={styles.actionError} role="alert">{priceError}</p>}
              <button type="submit" className={`${styles.sheetPrimaryButton} min-h-[56px] focus-visible:outline-2`} disabled={priceSaving}>
                {priceSaving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                {priceSaving ? '저장 중' : '실제 금액 저장'}
              </button>
            </form>
          </section>
        </div>
      )}

      {activeDialog && (
        <div className={styles.overlay} role="presentation" onMouseDown={closeLifecycleDialog}>
          <section
            className={styles.bottomSheet}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="lifecycle-dialog-title"
            aria-describedby="lifecycle-dialog-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className={styles.sheetHeader}>
              <div>
                <span className={activeDialog === 'archive' ? styles.dialogIconWarning : styles.dialogIconDanger}>
                  {activeDialog === 'archive' ? <Archive size={23} /> : <ShieldAlert size={23} />}
                </span>
                <h2 id="lifecycle-dialog-title" className="heading-md">
                  {activeDialog === 'archive' ? '고객을 보관할까요?' : '개인정보를 익명 처리할까요?'}
                </h2>
              </div>
              <button
                ref={closeDialogRef}
                type="button"
                className={`${styles.closeButton} min-h-[44px] focus-visible:outline-2`}
                onClick={closeLifecycleDialog}
                disabled={actionLoading}
                aria-label="확인 창 닫기"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            {activeDialog === 'archive' ? (
              <div className={styles.dialogBody}>
                <p id="lifecycle-dialog-description">
                  고객은 활성 목록과 신규 예약 선택에서 숨겨집니다. 고객 키와 기존 예약 이력은 보존되며 원장이 다시 복원할 수 있습니다.
                </p>
                <label>
                  <span>보관 사유 (선택)</span>
                  <textarea
                    value={archiveReason}
                    onChange={(event) => setArchiveReason(event.target.value)}
                    placeholder="운영상 필요한 사유만 입력해주세요."
                    maxLength={300}
                    disabled={actionLoading}
                  />
                </label>
              </div>
            ) : (
              <div className={styles.dialogBody}>
                <p id="lifecycle-dialog-description">
                  이름은 ‘삭제된 고객’으로 바뀌고 전화번호와 메모는 영구 제거됩니다. 예약 이력은 고객 키와 함께 보존되며 개인정보는 복구할 수 없습니다.
                </p>
                <label>
                  <span>되돌릴 수 없습니다. 계속하려면 ‘익명 처리’를 입력해주세요.</span>
                  <input
                    value={anonymizeConfirmation}
                    onChange={(event) => setAnonymizeConfirmation(event.target.value)}
                    autoComplete="off"
                    disabled={actionLoading}
                  />
                </label>
              </div>
            )}

            {lifecycleError && <p className={styles.actionError} role="alert">{lifecycleError}</p>}

            <div className={styles.dialogActions}>
              <button
                type="button"
                className={`${styles.dialogCancelButton} min-h-[52px] focus-visible:outline-2`}
                onClick={closeLifecycleDialog}
                disabled={actionLoading}
              >
                취소
              </button>
              <button
                type="button"
                className={`${activeDialog === 'archive' ? styles.dialogConfirmButton : styles.dialogDangerButton} min-h-[52px] focus-visible:outline-2 disabled:opacity-70`}
                onClick={() => runLifecycleAction(activeDialog)}
                disabled={
                  actionLoading ||
                  (activeDialog === 'anonymize' && anonymizeConfirmation.trim() !== '익명 처리')
                }
              >
                {actionLoading && <Loader2 size={19} className="animate-spin" />}
                {actionLoading ? '처리 중' : activeDialog === 'archive' ? '보관하기' : '영구 익명 처리'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
