'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import {
  buildCustomerListQuery,
  buildCustomerSearchFilter,
} from '@/lib/customerSearch';
import { getTodayKstDateKey } from '@/lib/dateTime';
import styles from './page.module.css';

function getCustomerStatus(customer) {
  if (customer.anonymized_at) return '익명 처리됨';
  if (customer.merged_into_customer_id) return '병합됨';
  if (customer.archived_at) return '보관됨';
  return '활성';
}

export default function HomePage() {
  const { role, isRoleReady } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [customerStatus, setCustomerStatus] = useState('loading');
  const [customerErrorMessage, setCustomerErrorMessage] = useState('');
  const [loadingMoreCustomers, setLoadingMoreCustomers] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [appointmentStatus, setAppointmentStatus] = useState('loading');
  const [appointmentErrorMessage, setAppointmentErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const customerRequestIdRef = useRef(0);
  const appointmentRequestIdRef = useRef(0);
  const isOwner = isRoleReady && role === 'owner';

  useEffect(() => {
    if (isRoleReady && role !== 'owner' && showArchived) {
      setShowArchived(false);
    }
  }, [isRoleReady, role, showArchived]);

  const fetchCustomers = useCallback(async (queryValue, offset = 0) => {
    const requestId = ++customerRequestIdRef.current;
    const isCurrentRequest = () => requestId === customerRequestIdRef.current;
    const isLoadingMore = offset > 0;
    const searchFilter = buildCustomerSearchFilter(queryValue);

    if (queryValue.trim() && !searchFilter) {
      if (isCurrentRequest()) {
        setCustomers([]);
        setCustomerCount(0);
        setCustomerErrorMessage('');
        setCustomerStatus('ready');
        setLoadingMoreCustomers(false);
      }
      return;
    }

    if (isLoadingMore) {
      setLoadingMoreCustomers(true);
    } else {
      setCustomerStatus('loading');
      setCustomerErrorMessage('');
    }

    try {
      const { data, error, count } = await buildCustomerListQuery(supabase, {
        searchFilter,
        showArchived,
        offset,
      });

      if (error) throw error;
      if (!isCurrentRequest()) return;

      const nextCustomers = data ?? [];
      setCustomers((current) => {
        if (!isLoadingMore) return nextCustomers;
        const knownIds = new Set(current.map((customer) => customer.id));
        return [...current, ...nextCustomers.filter((customer) => !knownIds.has(customer.id))];
      });
      setCustomerCount(count ?? offset + nextCustomers.length);
      setCustomerStatus('ready');
    } catch {
      if (!isCurrentRequest()) return;
      if (!isLoadingMore) {
        setCustomers([]);
        setCustomerCount(0);
        setCustomerErrorMessage(
          navigator.onLine
            ? '고객 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
            : '인터넷이 연결되지 않아 고객 정보를 불러올 수 없습니다. 연결을 확인해 주세요.'
        );
        setCustomerStatus('error');
      }
    } finally {
      if (isCurrentRequest()) {
        setLoadingMoreCustomers(false);
      }
    }
  }, [showArchived]);

  const fetchAppointments = useCallback(async () => {
    const requestId = ++appointmentRequestIdRef.current;
    const isCurrentRequest = () => requestId === appointmentRequestIdRef.current;

    setAppointmentStatus('loading');
    setAppointmentErrorMessage('');

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('id,time,service,status,customers(id,name,archived_at)')
        .eq('date', getTodayKstDateKey())
        .order('time');

      if (error) throw error;
      if (!isCurrentRequest()) return;

      setAppointments(data ?? []);
      setAppointmentStatus('ready');
    } catch {
      if (!isCurrentRequest()) return;
      setAppointments([]);
      setAppointmentErrorMessage(
        navigator.onLine
          ? '오늘 예약을 불러오지 못했습니다. 고객 검색은 계속 사용할 수 있습니다.'
          : '인터넷이 연결되지 않아 오늘 예약을 불러올 수 없습니다.'
      );
      setAppointmentStatus('error');
    }
  }, []);

  useEffect(() => {
    customerRequestIdRef.current += 1;
    const timer = window.setTimeout(
      () => fetchCustomers(searchQuery),
      searchQuery.trim() ? 300 : 0
    );

    return () => window.clearTimeout(timer);
  }, [fetchCustomers, searchQuery]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const isCustomerLoading = customerStatus === 'loading';
  const isAppointmentLoading = appointmentStatus === 'loading';
  const hasMoreCustomers = customers.length < customerCount;
  const hasUsableSearchTerm = !searchQuery.trim() || Boolean(buildCustomerSearchFilter(searchQuery));

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className="heading-xl">내 고객</h1>
          <p className={styles.countLabel} aria-live="polite">
            {isCustomerLoading
              ? '불러오는 중...'
              : customerStatus === 'error'
                ? '고객 수를 확인하지 못했습니다'
                : `${showArchived ? '보관 고객' : '활성 고객'} ${customerCount}명`}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link
            href="/customers/duplicates"
            prefetch={false}
            className={`${styles.headerButton} min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2`}
          >
            <Users size={20} aria-hidden="true" />
            <span>중복 고객 확인</span>
          </Link>
          <Link
            href="/customers/new"
            prefetch={false}
            className={`${styles.headerButton} ${styles.headerButtonPrimary} min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2`}
          >
            <UserPlus size={20} aria-hidden="true" />
            <span>새 고객 등록</span>
          </Link>
        </div>
      </header>

      <main className="page-content">
        <section className={styles.customerTools} aria-label="고객 목록 도구">
          <label className={styles.searchBar}>
            <span className="sr-only">고객 검색</span>
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              placeholder="이름, 전화번호, 메모로 검색"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-describedby="customer-search-help"
              maxLength={80}
            />
          </label>
          <p
            id="customer-search-help"
            className={`${styles.searchHelp} ${!hasUsableSearchTerm ? styles.searchHelpError : ''}`}
          >
            {hasUsableSearchTerm
              ? '검색어와 관련된 고객 정보만 안전하게 불러옵니다.'
              : '검색하려면 글자나 숫자를 입력해 주세요.'}
          </p>

          {isOwner ? (
            <label className={styles.archiveToggle}>
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => {
                  setSearchQuery('');
                  setShowArchived(event.target.checked);
                }}
              />
              <span className={styles.toggleTrack} aria-hidden="true">
                <span />
              </span>
              <span>
                <Archive size={17} aria-hidden="true" /> 보관 고객 보기
              </span>
            </label>
          ) : (
            <p className={styles.permissionNote}>보관·병합 작업은 원장만 할 수 있습니다.</p>
          )}
        </section>

        <section className={styles.section} aria-labelledby="customer-list-title">
          <div className={styles.sectionTitleRow}>
            <h2 id="customer-list-title" className="heading-md">
              {showArchived ? '보관 고객' : '고객 목록'}
            </h2>
            {!isCustomerLoading && customerStatus === 'ready' && (
              <span className={styles.resultCount}>검색 결과 {customerCount}명</span>
            )}
          </div>

          {customerStatus === 'error' ? (
            <div className={styles.errorState} role="alert">
              <p>{customerErrorMessage}</p>
              <button
                type="button"
                onClick={() => fetchCustomers(searchQuery)}
                className="min-h-[44px] focus-visible:outline-2 disabled:opacity-70"
              >
                <RefreshCw size={17} aria-hidden="true" /> 다시 시도
              </button>
            </div>
          ) : (
            <div className={styles.customerList} aria-busy={isCustomerLoading}>
              {isCustomerLoading ? (
                <div className={styles.loadingState}>
                  <Loader2 size={26} className="animate-spin text-tertiary" aria-hidden="true" />
                  <p>고객 정보를 불러오는 중입니다.</p>
                </div>
              ) : customers.length === 0 ? (
                <div className={styles.emptyState}>
                  {showArchived ? <Archive size={30} aria-hidden="true" /> : <User size={30} aria-hidden="true" />}
                  <h3>{searchQuery ? '검색 결과가 없습니다' : showArchived ? '보관 고객이 없습니다' : '등록된 고객이 없습니다'}</h3>
                  <p>
                    {searchQuery
                      ? '검색어를 바꿔 다시 확인해 주세요.'
                      : showArchived
                        ? '보관한 고객은 이곳에서 복원할 수 있습니다.'
                        : '첫 고객을 등록해 고객 관리를 시작해 보세요.'}
                  </p>
                  {!searchQuery && !showArchived && (
                    <Link href="/customers/new" prefetch={false}>
                      새 고객 등록
                    </Link>
                  )}
                </div>
              ) : (
                <>
                  {customers.map((customer) => {
                    const customerStatusLabel = getCustomerStatus(customer);
                    return (
                      <Link
                        key={customer.id}
                        href={`/customers/${customer.id}`}
                        className={`${styles.customerCard} min-h-[72px] focus-visible:outline-2 focus-visible:outline-offset-2`}
                        aria-label={`${customer.name}, 고객 상세 보기`}
                      >
                        <div className={styles.avatar} aria-hidden="true">
                          <User size={23} />
                        </div>
                        <div className={styles.customerInfo}>
                          <span className={styles.customerName}>{customer.name}</span>
                          <span className={styles.customerPhone}>{customer.phone || '전화번호 없음'}</span>
                        </div>
                        <div className={styles.customerMeta}>
                          {showArchived ? (
                            <span className={styles.archivedBadge}>{customerStatusLabel}</span>
                          ) : (
                            <span className={styles.activeBadge}>활성</span>
                          )}
                          <ChevronRight size={17} aria-hidden="true" />
                        </div>
                      </Link>
                    );
                  })}
                  {hasMoreCustomers ? (
                    <button
                      type="button"
                      className={styles.loadMoreButton}
                      onClick={() => fetchCustomers(searchQuery, customers.length)}
                      disabled={loadingMoreCustomers}
                    >
                      {loadingMoreCustomers ? (
                        <>
                          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                          더 불러오는 중...
                        </>
                      ) : (
                        `고객 더 보기 (${customerCount - customers.length}명 남음)`
                      )}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          )}
        </section>

        <section className={styles.section} aria-labelledby="today-appointments-title">
          <div className={styles.sectionTitleRow}>
            <h2 id="today-appointments-title" className="heading-md">오늘 예약</h2>
            {appointmentStatus === 'ready' && <span className="badge badge-green">{appointments.length}건</span>}
          </div>
          <div className={styles.appointmentCard} aria-busy={isAppointmentLoading}>
            {isAppointmentLoading ? (
              <div className={styles.appointmentState} role="status">
                <Loader2 size={20} className="animate-spin text-tertiary" aria-hidden="true" />
                <p>오늘 예약을 불러오는 중입니다.</p>
              </div>
            ) : appointmentStatus === 'error' ? (
              <div className={styles.appointmentError} role="alert">
                <p>{appointmentErrorMessage}</p>
                <button type="button" onClick={fetchAppointments}>
                  <RefreshCw size={17} aria-hidden="true" /> 다시 시도
                </button>
              </div>
            ) : appointments.length === 0 ? (
              <div className={styles.appointmentState}>
                <p>오늘 예정된 예약이 없습니다.</p>
              </div>
            ) : (
              appointments.map((appointment, index) => (
                <div key={appointment.id} className={styles.appointmentRow}>
                  <span
                    className={`${styles.accentBar} ${index % 2 === 0 ? styles.accentGreen : styles.accentWarm}`}
                    aria-hidden="true"
                  />
                  <time className={styles.appointmentTime}>
                    {appointment.time ? appointment.time.substring(0, 5) : '--:--'}
                  </time>
                  <span className={styles.rowDivider} aria-hidden="true" />
                  <span className={styles.appointmentInfo}>
                    {appointment.customers?.name || '고객 정보 없음'} · {appointment.service}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </>
  );
}
