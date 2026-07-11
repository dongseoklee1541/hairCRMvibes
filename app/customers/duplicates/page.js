'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  GitMerge,
  Loader2,
  Phone,
  RefreshCw,
  RotateCcw,
  SearchX,
  ShieldAlert,
  UserCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

const INTERACTION_CLASSES =
  'min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
const PENDING_EVENT_PAGE_SIZE = 20;

async function fetchPendingEventsPage(offset = 0) {
  const { data, error } = await supabase
    .from('customer_merge_events')
    .select(`
      id,
      source_customer_id,
      target_customer_id,
      merged_at,
      source:customers!customer_merge_events_source_customer_id_fkey(id, name, phone),
      target:customers!customer_merge_events_target_customer_id_fkey(id, name, phone),
      moves:customer_merge_appointment_moves(appointment_id)
    `)
    .is('undone_at', null)
    .order('merged_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + PENDING_EVENT_PAGE_SIZE);

  if (error) throw error;

  const rows = data || [];
  return {
    events: rows
      .slice(0, PENDING_EVENT_PAGE_SIZE)
      .map(normalizePendingEvent)
      .filter(Boolean),
    hasMore: rows.length > PENDING_EVENT_PAGE_SIZE,
    nextOffset: offset + Math.min(rows.length, PENDING_EVENT_PAGE_SIZE),
  };
}

function toCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

function normalizeCandidatePair(row) {
  if (!row?.source_customer_id || !row?.target_customer_id) {
    return null;
  }

  return {
    id: [row.source_customer_id, row.target_customer_id].sort().join(':'),
    matchReason: row.match_reason || 'possible_duplicate',
    source: {
      id: row.source_customer_id,
      name: row.source_name || '이름 없음',
      phone: row.source_phone || '',
      appointmentCount: toCount(row.source_appointment_count),
    },
    target: {
      id: row.target_customer_id,
      name: row.target_name || '이름 없음',
      phone: row.target_phone || '',
      appointmentCount: toCount(row.target_appointment_count),
    },
  };
}

function normalizeResultRow(row, type) {
  if (!row?.event_id) {
    return null;
  }

  return {
    eventId: row.event_id,
    sourceCustomerId: row.source_customer_id,
    targetCustomerId: row.target_customer_id,
    appointmentCount: toCount(
      type === 'undo' ? row.restored_appointment_count : row.moved_appointment_count
    ),
    completedAt: type === 'undo' ? row.undone_at : row.merged_at,
  };
}

function normalizePendingEvent(row) {
  if (!row?.id || !row?.source_customer_id || !row?.target_customer_id) {
    return null;
  }

  const source = Array.isArray(row.source) ? row.source[0] : row.source;
  const target = Array.isArray(row.target) ? row.target[0] : row.target;
  if (!source?.id || !target?.id) {
    return null;
  }

  return {
    eventId: row.id,
    sourceCustomerId: row.source_customer_id,
    targetCustomerId: row.target_customer_id,
    appointmentCount: Array.isArray(row.moves) ? row.moves.length : 0,
    completedAt: row.merged_at,
    source: {
      id: source.id,
      name: source.name || '보관된 고객',
      phone: source.phone || '',
      appointmentCount: null,
    },
    target: {
      id: target.id,
      name: target.name || '대표 고객',
      phone: target.phone || '',
      appointmentCount: null,
    },
  };
}

function formatMergedAt(value) {
  if (!value) return '시각 정보 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '시각 정보 없음';

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getMatchLabel(reason) {
  const value = String(reason || '').toLowerCase();
  if (value.includes('phone')) {
    return '전화번호 일치';
  }
  if (value.includes('name')) {
    return '이름 일치 · 확인 필요';
  }
  return '중복 가능성';
}

function getErrorMessage(error, action) {
  if (error?.code === '42501') {
    return action === 'load'
      ? '중복 후보를 확인할 권한이 없습니다.'
      : '이 작업은 원장 계정에서만 실행할 수 있습니다. 변경된 내용은 없습니다.';
  }
  if (error?.code === '22023') {
    return '서로 다른 두 고객과 대표 고객을 다시 선택해주세요. 변경된 내용은 없습니다.';
  }
  if (error?.code === 'P0002') {
    return '선택한 고객 또는 병합 기록을 찾을 수 없습니다. 목록을 새로고침해주세요.';
  }
  if (error?.code === '55000') {
    return action === 'undo'
      ? '병합 이후 데이터가 변경되어 실행 취소할 수 없습니다. 고객 이력을 직접 확인해주세요.'
      : '이미 보관·병합된 고객이 포함되어 작업할 수 없습니다. 목록을 새로고침해주세요.';
  }
  if (action === 'load') {
    return '중복 후보를 불러오지 못했습니다. 연결을 확인하고 다시 시도해주세요.';
  }
  if (action === 'undo') {
    return '병합 실행 취소에 실패했습니다. 현재 데이터는 바뀌지 않았습니다.';
  }
  return '병합하지 못했습니다. 전체 처리가 취소되어 변경된 내용은 없습니다.';
}

function CustomerSummary({ customer, label, compact = false }) {
  return (
    <div className={`${styles.customerSummary} ${compact ? styles.customerSummaryCompact : ''}`}>
      <div className={styles.avatar} aria-hidden="true">
        <UsersRound size={compact ? 18 : 20} />
      </div>
      <div className={styles.customerText}>
        {label ? <span className={styles.customerLabel}>{label}</span> : null}
        <strong>{customer.name}</strong>
        <span className={styles.customerMeta}>
          <Phone size={14} aria-hidden="true" />
          {customer.phone || '전화번호 없음'}
        </span>
        {Number.isFinite(customer.appointmentCount) ? (
          <span className={styles.customerMeta}>
            <CalendarClock size={14} aria-hidden="true" />
            예약 이력 {customer.appointmentCount}건
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StatusMessage({ tone = 'info', children }) {
  return (
    <div
      className={`${styles.statusMessage} ${styles[`status${tone}`]}`}
      role={tone === 'Error' ? 'alert' : 'status'}
    >
      {tone === 'Error' ? <AlertTriangle size={19} /> : <ShieldAlert size={19} />}
      <p>{children}</p>
    </div>
  );
}

export default function CustomerDuplicatesPage() {
  const router = useRouter();
  const { role, isRoleReady } = useAuth();
  const isOwner = role === 'owner';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pairs, setPairs] = useState([]);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [pendingEventsLoading, setPendingEventsLoading] = useState(false);
  const [pendingEventsError, setPendingEventsError] = useState('');
  const [pendingEventsMoreError, setPendingEventsMoreError] = useState('');
  const [pendingEventsHasMore, setPendingEventsHasMore] = useState(false);
  const [pendingEventsNextOffset, setPendingEventsNextOffset] = useState(0);
  const [stage, setStage] = useState('list');
  const [selectedPair, setSelectedPair] = useState(null);
  const [targetId, setTargetId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [merging, setMerging] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [mergeResult, setMergeResult] = useState(null);
  const [undoResult, setUndoResult] = useState(null);
  const confirmTriggerRef = useRef(null);
  const confirmSheetRef = useRef(null);
  const mergingRef = useRef(false);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const { data, error } = await supabase.rpc('list_customer_duplicate_candidates');
      if (error) throw error;

      const seen = new Set();
      const nextPairs = (data || [])
        .map(normalizeCandidatePair)
        .filter((pair) => {
          if (!pair || pair.source.id === pair.target.id || seen.has(pair.id)) {
            return false;
          }
          seen.add(pair.id);
          return true;
        });

      setPairs(nextPairs);
    } catch (error) {
      setPairs([]);
      setLoadError(getErrorMessage(error, 'load'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPendingEvents = useCallback(async () => {
    if (!isOwner) {
      setPendingEvents([]);
      setPendingEventsError('');
      setPendingEventsMoreError('');
      setPendingEventsHasMore(false);
      setPendingEventsNextOffset(0);
      setPendingEventsLoading(false);
      return;
    }

    setPendingEventsLoading(true);
    setPendingEventsError('');
    setPendingEventsMoreError('');
    try {
      const page = await fetchPendingEventsPage();
      setPendingEvents(page.events);
      setPendingEventsHasMore(page.hasMore);
      setPendingEventsNextOffset(page.nextOffset);
    } catch (_error) {
      setPendingEvents([]);
      setPendingEventsHasMore(false);
      setPendingEventsNextOffset(0);
      setPendingEventsError('최근 병합 기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setPendingEventsLoading(false);
    }
  }, [isOwner]);

  const loadMorePendingEvents = async () => {
    if (!isOwner || pendingEventsLoading || !pendingEventsHasMore) return;

    setPendingEventsLoading(true);
    setPendingEventsMoreError('');
    try {
      const page = await fetchPendingEventsPage(pendingEventsNextOffset);
      setPendingEvents((current) => {
        const eventsById = new Map(current.map((event) => [event.eventId, event]));
        page.events.forEach((event) => eventsById.set(event.eventId, event));
        return Array.from(eventsById.values());
      });
      setPendingEventsHasMore(page.hasMore);
      setPendingEventsNextOffset(page.nextOffset);
    } catch (_error) {
      setPendingEventsMoreError('더 오래된 병합 기록을 불러오지 못했습니다. 다시 시도해주세요.');
    } finally {
      setPendingEventsLoading(false);
    }
  };

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  useEffect(() => {
    if (isRoleReady) {
      loadPendingEvents();
    }
  }, [isRoleReady, loadPendingEvents]);

  useEffect(() => {
    mergingRef.current = merging;
  }, [merging]);

  useEffect(() => {
    if (!confirmOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const trigger = confirmTriggerRef.current;
    const sheet = confirmSheetRef.current;
    document.body.style.overflow = 'hidden';

    const focusableSelector =
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const preferredFocus = sheet?.querySelector('[data-autofocus="true"]');
    const firstFocus = preferredFocus || sheet?.querySelector(focusableSelector);
    firstFocus?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !mergingRef.current) {
        event.preventDefault();
        setConfirmOpen(false);
        return;
      }

      if (event.key !== 'Tab' || !sheet) return;
      const focusable = Array.from(sheet.querySelectorAll(focusableSelector));
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

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [confirmOpen]);

  const targetCustomer = useMemo(() => {
    if (!selectedPair || !targetId) return null;
    return selectedPair.source.id === targetId ? selectedPair.source : selectedPair.target;
  }, [selectedPair, targetId]);

  const sourceCustomer = useMemo(() => {
    if (!selectedPair || !targetId) return null;
    return selectedPair.source.id === targetId ? selectedPair.target : selectedPair.source;
  }, [selectedPair, targetId]);

  const openCompare = (pair) => {
    setSelectedPair(pair);
    setTargetId('');
    setActionError('');
    setStage('compare');
  };

  const openPreview = () => {
    if (!isOwner) {
      setActionError('비교 결과는 확인할 수 있지만 대표 고객 선택과 병합은 원장만 할 수 있습니다.');
      return;
    }
    if (!targetCustomer || !sourceCustomer || targetCustomer.id === sourceCustomer.id) {
      setActionError('대표로 유지할 고객을 선택해주세요.');
      return;
    }
    setActionError('');
    setStage('preview');
  };

  const openPendingMerge = (event) => {
    setSelectedPair({
      id: `${event.sourceCustomerId}:${event.targetCustomerId}`,
      matchReason: 'durable_merge_event',
      source: event.source,
      target: event.target,
    });
    setTargetId(event.targetCustomerId);
    setMergeResult({
      eventId: event.eventId,
      sourceCustomerId: event.sourceCustomerId,
      targetCustomerId: event.targetCustomerId,
      appointmentCount: event.appointmentCount,
      completedAt: event.completedAt,
    });
    setUndoResult(null);
    setActionError('');
    setStage('success');
  };

  const handleMerge = async () => {
    if (!isOwner || !targetCustomer || !sourceCustomer) {
      setConfirmOpen(false);
      setActionError(
        !isOwner
          ? '이 작업은 원장 계정에서만 실행할 수 있습니다. 변경된 내용은 없습니다.'
          : '대표 고객과 보관할 고객을 다시 선택해주세요. 변경된 내용은 없습니다.'
      );
      return;
    }
    if (targetCustomer.id === sourceCustomer.id) {
      setConfirmOpen(false);
      setActionError('같은 고객끼리는 병합할 수 없습니다. 변경된 내용은 없습니다.');
      return;
    }

    setMerging(true);
    setActionError('');
    try {
      const { data, error } = await supabase.rpc('merge_customers', {
        p_source_customer_id: sourceCustomer.id,
        p_target_customer_id: targetCustomer.id,
      });
      if (error) throw error;

      const result = normalizeResultRow(data?.[0], 'merge');
      if (!result) {
        throw new Error('MERGE_RESULT_MISSING');
      }

      setMergeResult(result);
      setUndoResult(null);
      setConfirmOpen(false);
      setStage('success');
    } catch (error) {
      setConfirmOpen(false);
      setActionError(getErrorMessage(error, 'merge'));
    } finally {
      setMerging(false);
    }
  };

  const handleUndo = async () => {
    if (!isOwner || !mergeResult?.eventId) {
      setActionError('병합 실행 취소는 원장 계정에서만 할 수 있습니다.');
      return;
    }

    setUndoing(true);
    setActionError('');
    try {
      const { data, error } = await supabase.rpc('undo_customer_merge', {
        p_event_id: mergeResult.eventId,
      });
      if (error) throw error;

      const result = normalizeResultRow(data?.[0], 'undo');
      if (!result) {
        throw new Error('UNDO_RESULT_MISSING');
      }

      setUndoResult(result);
      await loadPendingEvents();
      setStage('undone');
    } catch (error) {
      setActionError(getErrorMessage(error, 'undo'));
    } finally {
      setUndoing(false);
    }
  };

  const resetToList = async () => {
    setStage('list');
    setSelectedPair(null);
    setTargetId('');
    setActionError('');
    setMergeResult(null);
    setUndoResult(null);
    await Promise.all([loadCandidates(), loadPendingEvents()]);
  };

  const renderHeader = (title, onBack = () => router.back()) => (
    <header className={styles.header}>
      <button
        type="button"
        className={`${styles.backButton} ${INTERACTION_CLASSES}`}
        onClick={onBack}
        aria-label="이전 화면으로 돌아가기"
      >
        <ArrowLeft size={22} />
      </button>
      <h1>{title}</h1>
      <span className={styles.headerSpacer} aria-hidden="true" />
    </header>
  );

  if (!isRoleReady || loading) {
    return (
      <div className={styles.page}>
        {renderHeader('중복 고객 정리')}
        <div className={styles.centerState} role="status" aria-live="polite">
          <Loader2 className="animate-spin" size={30} />
          <strong>중복 후보를 찾고 있어요</strong>
          <p>고객 정보는 기기에 저장하지 않습니다.</p>
        </div>
      </div>
    );
  }

  if (stage === 'compare' && selectedPair) {
    return (
      <div className={styles.page}>
        {renderHeader('고객 비교', () => {
          setActionError('');
          setStage('list');
        })}
        <main className={`${styles.content} ${styles.contentWithActions}`}>
          <section className={styles.introCard}>
            <span className={styles.matchBadge}>{getMatchLabel(selectedPair.matchReason)}</span>
            <h2>두 고객의 정보를 확인해주세요</h2>
            <p>이름만 같은 경우에는 동명이인일 수 있습니다. 자동 병합하지 않습니다.</p>
          </section>

          <div className={styles.compareGrid} role={isOwner ? 'radiogroup' : undefined} aria-label="대표 고객 선택">
            {[selectedPair.source, selectedPair.target].map((customer) => {
              const selected = targetId === customer.id;
              return (
                <button
                  type="button"
                  key={customer.id}
                  className={`${styles.compareCard} ${selected ? styles.compareCardSelected : ''} ${INTERACTION_CLASSES}`}
                  onClick={() => isOwner && setTargetId(customer.id)}
                  role={isOwner ? 'radio' : undefined}
                  aria-checked={isOwner ? selected : undefined}
                  disabled={!isOwner}
                >
                  <span className={styles.radioMark} aria-hidden="true">
                    {selected ? <Check size={16} /> : null}
                  </span>
                  <CustomerSummary
                    customer={customer}
                    label={selected ? '대표 고객으로 유지' : isOwner ? '선택 가능' : '비교 정보'}
                  />
                </button>
              );
            })}
          </div>

          <section className={styles.compareTable} aria-label="고객 정보 비교">
            <div className={styles.compareRow}>
              <span>이름</span>
              <strong>{selectedPair.source.name}</strong>
              <strong>{selectedPair.target.name}</strong>
            </div>
            <div className={styles.compareRow}>
              <span>전화번호</span>
              <strong>{selectedPair.source.phone || '없음'}</strong>
              <strong>{selectedPair.target.phone || '없음'}</strong>
            </div>
            <div className={styles.compareRow}>
              <span>예약 이력</span>
              <strong>{selectedPair.source.appointmentCount}건</strong>
              <strong>{selectedPair.target.appointmentCount}건</strong>
            </div>
          </section>

          {!isOwner ? (
            <StatusMessage>
              직원 계정은 후보 조회와 비교만 가능합니다. 대표 고객 선택과 병합은 원장에게 요청해주세요.
            </StatusMessage>
          ) : (
            <StatusMessage>
              대표 고객의 이름·전화번호는 그대로 유지되고, 다른 고객의 예약만 이동한 뒤 원본 고객은 보관됩니다.
            </StatusMessage>
          )}

          {actionError ? <StatusMessage tone="Error">{actionError}</StatusMessage> : null}
        </main>

        <div className={styles.stickyActions}>
          <button
            type="button"
            className={`${styles.secondaryButton} ${INTERACTION_CLASSES}`}
            onClick={() => setStage('list')}
          >
            후보 목록
          </button>
          {isOwner ? (
            <button
              type="button"
              className={`${styles.primaryButton} ${INTERACTION_CLASSES}`}
              onClick={openPreview}
              disabled={!targetId}
            >
              병합 미리보기
              <ArrowRight size={20} />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (stage === 'preview' && selectedPair && targetCustomer && sourceCustomer) {
    return (
      <div className={styles.page}>
        {renderHeader('병합 미리보기', () => {
          setActionError('');
          setStage('compare');
        })}
        <main className={`${styles.content} ${styles.contentWithActions}`}>
          <section className={`${styles.customerPanel} ${styles.targetPanel}`}>
            <UserCheck size={24} aria-hidden="true" />
            <CustomerSummary customer={targetCustomer} label="대표 고객 · 기본정보 유지" />
          </section>

          <div className={styles.flowArrow} aria-hidden="true">
            <ArrowRight size={22} />
          </div>

          <section className={styles.customerPanel}>
            <GitMerge size={24} aria-hidden="true" />
            <CustomerSummary customer={sourceCustomer} label="원본 고객 · 병합 후 보관" />
          </section>

          <section className={styles.previewCard}>
            <h2>한 번의 transaction으로 처리됩니다</h2>
            <ol>
              <li><span>1</span>원본 고객의 예약 {sourceCustomer.appointmentCount}건을 대표 고객에게 이동</li>
              <li><span>2</span>원본 고객을 신규 예약 선택에서 제외하도록 보관</li>
              <li><span>3</span>event ID와 이동된 예약 ID를 감사 기록에 저장</li>
            </ol>
          </section>

          <StatusMessage>
            어느 단계에서든 실패하면 전체 작업이 취소됩니다. 부분 반영은 없습니다.
          </StatusMessage>
          {actionError ? <StatusMessage tone="Error">{actionError}</StatusMessage> : null}
        </main>

        <div className={styles.stickyActions}>
          <button
            type="button"
            className={`${styles.secondaryButton} ${INTERACTION_CLASSES}`}
            onClick={() => setStage('compare')}
            disabled={merging}
          >
            다시 선택
          </button>
          <button
            type="button"
            ref={confirmTriggerRef}
            className={`${styles.dangerButton} ${INTERACTION_CLASSES}`}
            onClick={() => setConfirmOpen(true)}
            disabled={merging}
          >
            병합 최종 확인
          </button>
        </div>

        {confirmOpen ? (
          <div className={styles.sheetBackdrop} onMouseDown={() => !merging && setConfirmOpen(false)}>
            <section
              ref={confirmSheetRef}
              className={styles.confirmSheet}
              role="dialog"
              aria-modal="true"
              aria-labelledby="merge-confirm-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className={`${styles.sheetClose} ${INTERACTION_CLASSES}`}
                onClick={() => setConfirmOpen(false)}
                disabled={merging}
                aria-label="병합 확인창 닫기"
              >
                <X size={22} />
              </button>
              <div className={styles.sheetIcon} aria-hidden="true">
                <AlertTriangle size={26} />
              </div>
              <h2 id="merge-confirm-title">정말 병합할까요?</h2>
              <p>
                <strong>{sourceCustomer.name}</strong> 고객의 예약 {sourceCustomer.appointmentCount}건을{' '}
                <strong>{targetCustomer.name}</strong> 고객에게 이동하고 원본 고객을 보관합니다.
              </p>
              <div className={styles.sheetActions}>
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${INTERACTION_CLASSES}`}
                  onClick={() => setConfirmOpen(false)}
                  disabled={merging}
                >
                  취소
                </button>
                <button
                  type="button"
                  className={`${styles.dangerButton} ${INTERACTION_CLASSES}`}
                  onClick={handleMerge}
                  disabled={merging}
                  data-autofocus="true"
                >
                  {merging ? <Loader2 className="animate-spin" size={20} /> : <GitMerge size={20} />}
                  {merging ? '병합 중' : '병합 실행'}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    );
  }

  if ((stage === 'success' || stage === 'undone') && mergeResult && targetCustomer && sourceCustomer) {
    const wasUndone = stage === 'undone' && undoResult;
    return (
      <div className={styles.page}>
        {renderHeader(wasUndone ? '병합 실행 취소 완료' : '병합 결과', resetToList)}
        <main className={`${styles.content} ${styles.contentWithActions}`}>
          <section className={styles.resultHero}>
            <CheckCircle2 size={32} aria-hidden="true" />
            <h2>{wasUndone ? '두 고객을 원래 상태로 복원했습니다' : '전체 transaction이 완료됐습니다'}</h2>
            <p>
              {wasUndone
                ? `예약 ${undoResult.appointmentCount}건을 원본 고객에게 되돌렸습니다.`
                : `예약 ${mergeResult.appointmentCount}건을 이동하고 원본 고객을 보관했습니다.`}
            </p>
          </section>

          <section className={styles.resultCard}>
            <CustomerSummary customer={targetCustomer} label={wasUndone ? '복원된 대표 고객' : '대표 고객'} />
            <div className={styles.resultDivider} />
            <CustomerSummary customer={sourceCustomer} label={wasUndone ? '복원된 원본 고객' : '보관된 원본 고객'} />
          </section>

          <section className={styles.eventCard}>
            <span>감사 event ID</span>
            <code>{mergeResult.eventId}</code>
            <p>
              {wasUndone
                ? '동일 event ID에 실행 취소 시각과 복원 결과가 기록됐습니다.'
                : 'actor/source/target과 이동된 예약 ID가 서버에 기록됐습니다.'}
            </p>
          </section>

          {!wasUndone ? (
            <StatusMessage>
              이후 데이터 변경과 충돌하지 않을 때만 이 event를 한 번 실행 취소할 수 있습니다.
            </StatusMessage>
          ) : null}
          {actionError ? <StatusMessage tone="Error">{actionError}</StatusMessage> : null}
        </main>

        <div className={styles.stickyActions}>
          <Link
            href={`/customers/${targetCustomer.id}`}
            className={`${styles.secondaryButton} ${INTERACTION_CLASSES}`}
          >
            고객 보기
          </Link>
          {!wasUndone && isOwner ? (
            <button
              type="button"
              className={`${styles.primaryButton} ${INTERACTION_CLASSES}`}
              onClick={handleUndo}
              disabled={undoing}
            >
              {undoing ? <Loader2 className="animate-spin" size={20} /> : <RotateCcw size={20} />}
              {undoing ? '실행 취소 중' : '병합 실행 취소'}
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.primaryButton} ${INTERACTION_CLASSES}`}
              onClick={resetToList}
            >
              완료
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {renderHeader('중복 고객 정리')}
      <main className={styles.content}>
        <section className={styles.introCard}>
          <div className={styles.introIcon} aria-hidden="true">
            <UsersRound size={24} />
          </div>
          <div>
            <h2>직접 확인한 뒤 정리해요</h2>
            <p>같은 전화번호를 우선 찾고, 이름만 같은 경우는 보조 후보로 표시합니다.</p>
          </div>
        </section>

        {!isOwner ? (
          <StatusMessage>
            직원 계정은 후보 조회와 비교만 가능합니다. 병합과 실행 취소는 원장 권한으로 보호됩니다.
          </StatusMessage>
        ) : null}

        {isOwner ? (
          <section className={styles.pendingSection} aria-labelledby="pending-merge-title">
            <div className={styles.sectionHeading}>
              <div>
                <h2 id="pending-merge-title">미취소 병합</h2>
                <p>감사 event를 최신순으로 불러와 언제든 다시 검토할 수 있습니다.</p>
              </div>
              <button
                type="button"
                className={`${styles.refreshButton} ${INTERACTION_CLASSES}`}
                onClick={loadPendingEvents}
                disabled={pendingEventsLoading}
                aria-label="최근 병합 기록 새로고침"
              >
                {pendingEventsLoading ? (
                  <Loader2 className="animate-spin" size={19} />
                ) : (
                  <RefreshCw size={19} />
                )}
              </button>
            </div>

            {pendingEventsLoading && pendingEvents.length === 0 ? (
              <div className={styles.pendingState} role="status">
                <Loader2 className="animate-spin" size={20} />
                병합 기록을 불러오는 중입니다.
              </div>
            ) : pendingEventsError ? (
              <div className={styles.pendingState} role="alert">
                <AlertTriangle size={20} />
                <span>{pendingEventsError}</span>
                <button type="button" onClick={loadPendingEvents} className={INTERACTION_CLASSES}>
                  다시 시도
                </button>
              </div>
            ) : pendingEvents.length === 0 ? (
              <div className={styles.pendingState}>
                <CheckCircle2 size={20} />
                실행 취소를 검토할 병합이 없습니다.
              </div>
            ) : (
              <div className={styles.pendingList}>
                {pendingEvents.map((event) => (
                  <article className={styles.pendingCard} key={event.eventId}>
                    <div className={styles.pendingCopy}>
                      <span>{formatMergedAt(event.completedAt)} · 예약 {event.appointmentCount}건 이동</span>
                      <strong>{event.source.name} → {event.target.name}</strong>
                      <code>{event.eventId}</code>
                    </div>
                    <button
                      type="button"
                      className={`${styles.pendingAction} ${INTERACTION_CLASSES}`}
                      onClick={() => openPendingMerge(event)}
                    >
                      검토/실행 취소
                      <ArrowRight size={18} />
                    </button>
                  </article>
                ))}
                {pendingEventsMoreError ? (
                  <div className={styles.pendingState} role="alert">
                    <AlertTriangle size={20} />
                    <span>{pendingEventsMoreError}</span>
                    <button
                      type="button"
                      onClick={loadMorePendingEvents}
                      className={INTERACTION_CLASSES}
                    >
                      다시 시도
                    </button>
                  </div>
                ) : null}
                {pendingEventsHasMore && !pendingEventsMoreError ? (
                  <button
                    type="button"
                    className={`${styles.pendingLoadMore} ${INTERACTION_CLASSES}`}
                    onClick={loadMorePendingEvents}
                    disabled={pendingEventsLoading}
                  >
                    {pendingEventsLoading ? (
                      <Loader2 className="animate-spin" size={19} />
                    ) : (
                      <RefreshCw size={19} />
                    )}
                    {pendingEventsLoading ? '불러오는 중' : '더 오래된 기록 보기'}
                  </button>
                ) : null}
              </div>
            )}
          </section>
        ) : null}

        {loadError ? (
          <section className={styles.centerState} role="alert">
            <AlertTriangle size={30} />
            <strong>후보를 불러오지 못했어요</strong>
            <p>{loadError}</p>
            <button
              type="button"
              className={`${styles.retryButton} ${INTERACTION_CLASSES}`}
              onClick={loadCandidates}
            >
              <RefreshCw size={18} />
              다시 시도
            </button>
          </section>
        ) : pairs.length === 0 ? (
          <section className={styles.centerState}>
            <SearchX size={34} />
            <strong>확인할 중복 후보가 없습니다</strong>
            <p>새 고객 저장 시에도 같은 전화번호 후보를 다시 안내합니다.</p>
            <button
              type="button"
              className={`${styles.retryButton} ${INTERACTION_CLASSES}`}
              onClick={loadCandidates}
            >
              <RefreshCw size={18} />
              새로고침
            </button>
          </section>
        ) : (
          <section className={styles.candidateSection}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>확인 필요 {pairs.length}쌍</h2>
                <p>고객은 자동으로 병합되지 않습니다.</p>
              </div>
              <button
                type="button"
                className={`${styles.refreshButton} ${INTERACTION_CLASSES}`}
                onClick={loadCandidates}
                aria-label="중복 후보 새로고침"
              >
                <RefreshCw size={19} />
              </button>
            </div>

            <div className={styles.candidateList}>
              {pairs.map((pair) => (
                <article className={styles.candidateCard} key={pair.id}>
                  <span className={styles.matchBadge}>{getMatchLabel(pair.matchReason)}</span>
                  <CustomerSummary customer={pair.source} compact />
                  <div className={styles.pairDivider} aria-hidden="true">
                    <span />
                    <GitMerge size={17} />
                    <span />
                  </div>
                  <CustomerSummary customer={pair.target} compact />
                  <button
                    type="button"
                    className={`${styles.compareButton} ${INTERACTION_CLASSES}`}
                    onClick={() => openCompare(pair)}
                  >
                    두 고객 비교
                    <ArrowRight size={19} />
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
