'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getTodayKstDateKey } from '@/lib/dateTime';
import { getPhoneDigits } from '@/lib/customerPhone';
import styles from './page.module.css';

function getCustomerStatus(customer) {
  if (customer.anonymized_at) return '비식별화';
  if (customer.merged_into_customer_id) return '병합됨';
  if (customer.archived_at) return '보관됨';
  return '활성';
}
export default function HomePage() {
  const { role, isRoleReady } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const isOwner = isRoleReady && role === 'owner';

  useEffect(() => {
    if (isRoleReady && role !== 'owner' && showArchived) {
      setShowArchived(false);
    }
  }, [isRoleReady, role, showArchived]);

  const fetchData = useCallback(async () => {
    setStatus('loading');
    setErrorMessage('');

    try {
      let customerQuery = supabase
        .from('customers')
        .select(
          'id,name,phone,phone_normalized,memo,created_at,archived_at,archive_reason,merged_into_customer_id,anonymized_at'
        )
        .order('name');

      customerQuery = showArchived
        ? customerQuery.not('archived_at', 'is', null)
        : customerQuery.is('archived_at', null);

      const today = getTodayKstDateKey();
      const [customerResult, appointmentResult] = await Promise.all([
        customerQuery,
        supabase
          .from('appointments')
          .select('id,time,service,status,customers(id,name,archived_at)')
          .eq('date', today)
          .order('time'),
      ]);

      if (customerResult.error) throw customerResult.error;
      if (appointmentResult.error) throw appointmentResult.error;

      setCustomers(customerResult.data ?? []);
      setAppointments(appointmentResult.data ?? []);
      setStatus('ready');
    } catch {
      setCustomers([]);
      setAppointments([]);
      setErrorMessage(
        navigator.onLine
          ? '고객 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
          : '오프라인에서는 고객 정보를 불러올 수 없습니다. 연결을 확인해주세요.'
      );
      setStatus('error');
    }
  }, [showArchived]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredCustomers = useMemo(() => {
    const textQuery = searchQuery.trim().toLocaleLowerCase('ko-KR');
    const phoneQuery = getPhoneDigits(searchQuery);

    if (!textQuery) return customers;

    return customers.filter((customer) => {
      const name = customer.name?.toLocaleLowerCase('ko-KR') ?? '';
      const memo = customer.memo?.toLocaleLowerCase('ko-KR') ?? '';
      const normalizedPhone = customer.phone_normalized ?? getPhoneDigits(customer.phone);

      return (
        name.includes(textQuery) ||
        memo.includes(textQuery) ||
        (phoneQuery && normalizedPhone.includes(phoneQuery))
      );
    });
  }, [customers, searchQuery]);

  const isLoading = status === 'loading';

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className="heading-xl">내 고객</h1>
          <p className={styles.countLabel} aria-live="polite">
            {isLoading
              ? '불러오는 중...'
              : `${showArchived ? '보관 고객' : '활성 고객'} ${customers.length}명`}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link
            href="/customers/duplicates"
            prefetch={false}
            className={`${styles.headerButton} min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2`}
            aria-label="중복 고객 확인"
          >
            <Users size={20} aria-hidden="true" />
          </Link>
          <Link
            href="/customers/new"
            prefetch={false}
            className={`${styles.headerButton} ${styles.headerButtonPrimary} min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2`}
            aria-label="새 고객 등록"
          >
            <UserPlus size={20} aria-hidden="true" />
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
              disabled={isLoading}
            />
          </label>

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
            {!isLoading && status === 'ready' && (
              <span className={styles.resultCount}>검색 결과 {filteredCustomers.length}명</span>
            )}
          </div>

          {status === 'error' ? (
            <div className={styles.errorState} role="alert">
              <p>{errorMessage}</p>
              <button
                type="button"
                onClick={fetchData}
                className="min-h-[44px] focus-visible:outline-2 disabled:opacity-70"
              >
                <RefreshCw size={17} aria-hidden="true" /> 다시 시도
              </button>
            </div>
          ) : (
            <div className={styles.customerList} aria-busy={isLoading}>
              {isLoading ? (
                <div className={styles.loadingState}>
                  <Loader2 size={26} className="animate-spin text-tertiary" aria-hidden="true" />
                  <p>고객 정보를 불러오는 중입니다.</p>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className={styles.emptyState}>
                  {showArchived ? <Archive size={30} aria-hidden="true" /> : <User size={30} aria-hidden="true" />}
                  <h3>{searchQuery ? '검색 결과가 없습니다' : showArchived ? '보관 고객이 없습니다' : '등록된 고객이 없습니다'}</h3>
                  <p>
                    {searchQuery
                      ? '검색어를 바꿔 다시 확인해주세요.'
                      : showArchived
                        ? '보관한 고객은 이곳에서 복원할 수 있습니다.'
                        : '첫 고객을 등록해 고객 관리를 시작해보세요.'}
                  </p>
                  {!searchQuery && !showArchived && (
                    <Link href="/customers/new" prefetch={false}>
                      새 고객 등록
                    </Link>
                  )}
                </div>
              ) : (
                filteredCustomers.map((customer) => {
                  const customerStatus = getCustomerStatus(customer);
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
                          <span className={styles.archivedBadge}>{customerStatus}</span>
                        ) : (
                          <span className={styles.activeBadge}>활성</span>
                        )}
                        <ChevronRight size={17} aria-hidden="true" />
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </section>

        <section className={styles.section} aria-labelledby="today-appointments-title">
          <div className={styles.sectionTitleRow}>
            <h2 id="today-appointments-title" className="heading-md">오늘 예약</h2>
            {!isLoading && <span className="badge badge-green">{appointments.length}건</span>}
          </div>
          <div className={styles.appointmentCard}>
            {isLoading ? (
              <div className={styles.appointmentState}>
                <Loader2 size={20} className="animate-spin text-tertiary" aria-hidden="true" />
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
