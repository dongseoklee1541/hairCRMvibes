'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Pencil, User, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  return {
    date: dateStr,
    day: days[date.getDay()]
  };
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  
  const [customer, setCustomer] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      
      // 1. 고객 정보 가져오기
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();
        
      if (customerError) throw customerError;
      setCustomer(customerData);

      // 2. 시술 이력 가져오기 (완료된 예약 위주로)
      const { data: historyData, error: historyError } = await supabase
        .from('appointments')
        .select('*')
        .eq('customer_id', id)
        .order('date', { ascending: false })
        .order('time', { ascending: false });

      if (historyError) throw historyError;
      setHistory(historyData || []);
    } catch (error) {
      console.error('Error fetching customer detail:', error);
      // router.push('/'); // 에러 시 목록으로 이동 고려
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="page-content flex-center" style={{ height: '80vh' }}>
        <Loader2 size={32} className="animate-spin text-tertiary" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="page-content flex-center">
        <p className="body-md text-tertiary">고객 정보를 찾을 수 없습니다.</p>
        <button onClick={() => router.back()} className="text-accent" style={{ marginTop: 16 }}>뒤로 가기</button>
      </div>
    );
  }

  return (
    <div className="page-content" style={{ paddingTop: 12, paddingBottom: 24 }}>
      {/* Nav Bar */}
      <div className={styles.navBar}>
        <button onClick={() => router.back()} className="flex-row gap-sm">
          <ChevronLeft size={22} />
          <span className="body-md">뒤로</span>
        </button>
        <button className="btn-icon btn-icon-sm" style={{ background: 'var(--bg-surface)', boxShadow: 'var(--shadow-card)' }}>
          <Pencil size={16} className="text-secondary" />
        </button>
      </div>

      {/* Profile Card */}
      <div className={`card ${styles.profileCard} animate-fade-in`}>
        <div className="avatar avatar-lg">
          <User size={32} />
        </div>
        <div className={styles.profileInfo}>
          <h2 className="heading-lg">{customer.name}</h2>
          <p className="body-sm text-secondary">{customer.phone}</p>
        </div>
      </div>

      {/* Memo */}
      <section className={styles.section}>
        <h3 className="heading-md">메모</h3>
        <div className="card card-padded" style={{ marginTop: 12 }}>
          <p className="body-sm text-secondary" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {customer.memo || '메모가 없습니다.'}
          </p>
        </div>
      </section>

      {/* History */}
      <section className={styles.section}>
        <div className="section-header">
          <h3 className="heading-md">시술 이력</h3>
          <div className="flex-row gap-sm">
            <span className="caption">총 {history.length}회</span>
            <Link href={`/appointments/new?customerId=${customer.id}`} className="btn-icon btn-icon-sm btn-icon-primary">
              <Plus size={16} />
            </Link>
          </div>
        </div>
        <div className="card" style={{ marginTop: 16, overflow: 'hidden' }}>
          {history.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <p className="body-sm text-tertiary">시술 이력이 없습니다.</p>
            </div>
          ) : (
            history.map((item, i) => (
              <div
                key={item.id}
                className={styles.historyRow}
                style={{
                  borderBottom: i < history.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div className={styles.historyDate}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{item.date}</span>
                  <span className="caption" style={{ fontSize: 10 }}>{formatDate(item.date).day}</span>
                </div>
                <div className="divider" style={{ height: 32 }} />
                <div className={styles.historyInfo}>
                  <span className="body-md">{item.service}</span>
                  <span className="caption">{item.memo}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
