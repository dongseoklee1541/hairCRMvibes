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
import {
  formatKoreanShortDate,
  formatKstDateDot,
  getTodayKstDateKey,
  getWeekdayLabelFromDateKey,
  KOREAN_WEEKDAYS_LONG,
} from '@/lib/dateTime';
import styles from './page.module.css';

function formatDate(date) {
  return {
    short: formatKoreanShortDate(date),
    day: getWeekdayLabelFromDateKey(date, KOREAN_WEEKDAYS_LONG),
  };
}
function getLifecycleStatus(customer) {
  if (customer.anonymized_at) return { label: '비식별화', tone: 'danger' };
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
  if (error?.code === '55000' || error?.code === '23514') {
    return '보관되거나 병합된 고객에게는 새 시술 이력을 추가할 수 없습니다.';
  }
  return '시술 이력을 추가하지 못했습니다. 잠시 후 다시 시도해주세요.';
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
  const [historyForm, setHistoryForm] = useState({
    date: getTodayKstDateKey(),
    time: '10:00',
    service: '',
    memo: '',
  });

  const isOwner = isRoleReady && role === 'owner';

  const fetchData = useCallback(async () => {
    if (!customerId) return;

    setStatus('loading');
    setLoadError('');

    try {
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select(
          'id,name,phone,memo,created_at,updated_at,archived_at,archived_by,archive_reason,merged_into_customer_id,anonymized_at,anonymized_by'
        )
        .eq('id', customerId)
        .maybeSingle();

      if (customerError) throw customerError;
      if (!customerData) {
        setCustomer(null);
        setHistory([]);
        setStatus('not-found');
        return;
      }

      const { data: historyData, error: historyQueryError } = await supabase
        .from('appointments')
        .select('id,date,time,service,memo,status')
        .eq('customer_id', customerId)
        .order('date', { ascending: false })
        .order('time', { ascending: false });

      if (historyQueryError) throw historyQueryError;

      setCustomer(customerData);
      setHistory(historyData ?? []);
      setStatus('ready');
    } catch {
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    if (!activeDialog && !showHistorySheet) return undefined;

    const previousOverflow = document.body.style.overflow;
    const trigger = dialogTriggerRef.current;
    document.body.style.overflow = 'hidden';
    closeDialogRef.current?.focus();

    const modal = closeDialogRef.current?.closest('[role="dialog"], [role="alertdialog"]');
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !actionLoadingRef.current && !historySavingRef.current) {
        setActiveDialog(null);
        setShowHistorySheet(false);
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
  }, [activeDialog, showHistorySheet]);

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
          success: '고객 개인정보를 비식별화했습니다. 예약 이력은 유지됩니다.',
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
    setHistoryForm({ date: getTodayKstDateKey(), time: '10:00', service: '', memo: '' });
    setShowHistorySheet(true);
  };

  const handleHistorySubmit = async (event) => {
    event.preventDefault();
    const service = historyForm.service.trim();

    if (!service) {
      setHistoryError('시술명을 입력해주세요.');
      return;
    }

    setHistorySaving(true);
    setHistoryError('');

    try {
      const { error } = await supabase.from('appointments').insert({
        customer_id: customerId,
        date: historyForm.date,
        time: historyForm.time,
        service,
        memo: historyForm.memo.trim() || null,
        status: 'completed',
      });

      if (error) throw error;

      setShowHistorySheet(false);
      setFeedback('시술 이력을 추가했습니다.');
      await fetchData();
    } catch (error) {
      setHistoryError(getAppointmentErrorMessage(error));
    } finally {
      setHistorySaving(false);
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
              {isAnonymized ? '개인정보 비식별화 완료' : isMerged ? '병합된 원본 고객' : '보관 고객'}
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
                    {item.memo && <p>{item.memo}</p>}
                  </div>
                  <span className={`${styles.appointmentBadge} ${styles[`appointment${item.status}`]}`}>
                    {item.status === 'completed' ? '완료' : item.status === 'cancelled' ? '취소' : '예약'}
                  </span>
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
              <p>직원은 기본 정보와 시술 이력을 관리할 수 있지만 보관·병합·비식별화는 실행할 수 없습니다.</p>
            </div>
          </div>
        ) : isAnonymized ? (
          <div className={styles.permissionCard}>
            <ShieldAlert size={20} aria-hidden="true" /> 비식별화된 개인정보는 복구할 수 없습니다.
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
              <Trash2 size={19} aria-hidden="true" /> 개인정보 비식별화
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
                  required
                />
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
                  {activeDialog === 'archive' ? '고객을 보관할까요?' : '개인정보를 비식별화할까요?'}
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
                  <span>계속하려면 ‘비식별화’를 입력해주세요.</span>
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
                  (activeDialog === 'anonymize' && anonymizeConfirmation.trim() !== '비식별화')
                }
              >
                {actionLoading && <Loader2 size={19} className="animate-spin" />}
                {actionLoading ? '처리 중' : activeDialog === 'archive' ? '보관하기' : '영구 비식별화'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
