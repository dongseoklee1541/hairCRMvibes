'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, UserPlus, ChevronRight, User, Loader2 } from 'lucide-react';
import TabBar from '@/components/TabBar';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

function formatLastVisit(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  return `${Math.floor(diffDays / 30)}개월 전`;
}

export default function HomePage() {
  const [customers, setCustomers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // 1. 고객 목록 가져오기 (마지막 방문일 포함)
      // 실제로는 appointments 테이블과 조인하여 마지막 방문일을 계산해야 하지만,
      // 일단 간단하게 customers 테이블에서 가져옵니다.
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .order('name');
        
      if (customerError) throw customerError;

      // 2. 오늘 예약 가져오기
      const today = new Date().toISOString().split('T')[0];
      const { data: apptData, error: apptError } = await supabase
        .from('appointments')
        .select(`
          *,
          customers(name)
        `)
        .eq('date', today)
        .order('time');

      if (apptError) throw apptError;

      setCustomers(customerData || []);
      setAppointments(apptData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.includes(searchQuery) ||
      (c.phone && c.phone.includes(searchQuery)) ||
      (c.memo && c.memo.includes(searchQuery))
  );

  return (
    <>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1 className="heading-xl">내 고객</h1>
          <p className="caption" style={{ marginTop: 4 }}>
            {loading ? '불러오는 중...' : `총 ${customers.length}명`}
          </p>
        </div>
        <Link href="/customers/new" className="btn-icon btn-icon-primary">
          <UserPlus size={20} />
        </Link>
      </header>

      <div className="page-content">
        {/* Search */}
        <div className="search-bar">
          <Search size={18} />
          <input
            type="text"
            placeholder="이름, 전화번호로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Customer List */}
        <section className={styles.section}>
          <div className={styles.customerList}>
            {loading ? (
              <div className="flex-center" style={{ padding: '40px 0' }}>
                <Loader2 size={24} className="animate-spin text-tertiary" />
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="card card-padded flex-center">
                <p className="body-sm text-tertiary">
                  {searchQuery ? '검색 결과가 없습니다.' : '등록된 고객이 없습니다.'}
                </p>
              </div>
            ) : (
              filteredCustomers.map((customer, i) => (
                <Link
                  key={customer.id}
                  href={`/customers/${customer.id}`}
                  className={`card ${styles.customerCard} animate-fade-in`}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="avatar avatar-md">
                    <User size={24} />
                  </div>
                  <div className={styles.customerInfo}>
                    <span className="body-md">{customer.name}</span>
                    <span className="caption">{customer.phone}</span>
                  </div>
                  <div className={styles.customerMeta}>
                    {customer.last_visit ? (
                      <span className="caption text-tertiary">{formatLastVisit(customer.last_visit)}</span>
                    ) : (
                      <span className="caption text-tertiary">기록 없음</span>
                    )}
                    <ChevronRight size={16} className="text-tertiary" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Today's Appointments */}
        <section className={styles.section}>
          <div className="section-header">
            <h2 className="heading-md">오늘 예약</h2>
            {!loading && <span className="badge badge-green">{appointments.length}건</span>}
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            {loading ? (
              <div className="flex-center" style={{ padding: '32px 0' }}>
                <Loader2 size={20} className="animate-spin text-tertiary" />
              </div>
            ) : appointments.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <p className="body-sm text-tertiary">오늘 예정된 예약이 없습니다.</p>
              </div>
            ) : (
              appointments.map((appt, i) => (
                <div
                  key={appt.id}
                  className={styles.appointmentRow}
                  style={{
                    borderBottom: i < appointments.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <div
                    className={styles.accentBar}
                    style={{
                      background: i % 2 === 0 ? 'var(--accent-primary)' : 'var(--accent-warm)',
                    }}
                  />
                  <div className={styles.apptTime}>
                    <span className="body-md" style={{ fontWeight: 600 }}>
                      {appt.time ? appt.time.substring(0, 5) : '--:--'}
                    </span>
                  </div>
                  <div className="divider" style={{ height: 32 }} />
                  <div className={styles.apptInfo}>
                    <span className="body-md">{appt.customers?.name} · {appt.service}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <TabBar />
    </>
  );
}
