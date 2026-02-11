'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  ChevronRight,
  User,
  Loader2,
  BarChart3,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

function formatRelativeDate(dateStr) {
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

export default function StatsPage() {
  const [appointments, setAppointments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentYear = now.getFullYear();
  const monthLabel = `${currentMonth + 1}월`;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // 이번 달 시작/끝 날짜
      const firstDay = new Date(currentYear, currentMonth, 1)
        .toISOString()
        .split('T')[0];
      const lastDay = new Date(currentYear, currentMonth + 1, 0)
        .toISOString()
        .split('T')[0];

      // 이번 달 예약 가져오기
      const { data: apptData, error: apptError } = await supabase
        .from('appointments')
        .select('*, customers(id, name)')
        .gte('date', firstDay)
        .lte('date', lastDay)
        .order('date', { ascending: false });

      if (apptError) throw apptError;

      // 전체 고객 목록
      const { data: custData, error: custError } = await supabase
        .from('customers')
        .select('*');

      if (custError) throw custError;

      setAppointments(apptData || []);
      setCustomers(custData || []);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── 통계 계산 ──
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayAppts = appointments.filter((a) => a.date === today);
    const completed = appointments.filter((a) => a.status === 'completed');
    const cancelled = appointments.filter((a) => a.status === 'cancelled');

    // 이번 달 고유 고객 수
    const uniqueCustomerIds = new Set(appointments.map((a) => a.customer_id));

    const completionRate =
      appointments.length > 0
        ? Math.round((completed.length / appointments.length) * 100)
        : 0;
    const cancellationRate =
      appointments.length > 0
        ? Math.round((cancelled.length / appointments.length) * 100)
        : 0;

    // 서비스별 통계
    const serviceMap = {};
    appointments.forEach((a) => {
      const svc = a.service || '기타';
      serviceMap[svc] = (serviceMap[svc] || 0) + 1;
    });

    const serviceRanking = Object.entries(serviceMap)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / appointments.length) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // 최근 완료된 예약 (고객 포함)
    const recentVisits = appointments
      .filter((a) => a.status === 'completed' && a.customers)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    return {
      todayCount: todayAppts.length,
      monthlyCustomers: uniqueCustomerIds.size,
      completionRate,
      cancellationRate,
      serviceRanking,
      recentVisits,
      totalAppointments: appointments.length,
    };
  }, [appointments]);

  const rankStyles = [styles.rank1, styles.rank2, styles.rank3];
  const barColors = ['var(--accent-primary)', 'var(--accent-warm)', 'var(--text-tertiary)'];

  if (loading) {
    return (
      <>
        <header className={styles.header}>
          <div>
            <h1 className="heading-xl">통계</h1>
          </div>
        </header>
        <div className="page-content">
          <div className="flex-center" style={{ padding: '80px 0' }}>
            <Loader2 size={28} className="animate-spin text-tertiary" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Header */}
      <header className={styles.header}>
        <h1 className="heading-xl">통계</h1>
        <div className={styles.periodButton}>
          <Calendar size={16} />
          <span>{monthLabel}</span>
        </div>
      </header>

      <div className="page-content">
        {/* KPI Cards */}
        <div className={styles.kpiGrid}>
          <div
            className={styles.kpiCard}
            style={{ animationDelay: '0s' }}
          >
            <span className={styles.kpiLabel}>오늘 예약</span>
            <span className={styles.kpiValue}>{stats.todayCount}건</span>
            <div className={`${styles.kpiChange} ${styles.kpiChangePositive}`}>
              <TrendingUp size={14} />
              <span>오늘</span>
            </div>
          </div>

          <div
            className={styles.kpiCard}
            style={{ animationDelay: '0.05s' }}
          >
            <span className={styles.kpiLabel}>이번달 고객</span>
            <span className={styles.kpiValue}>{stats.monthlyCustomers}명</span>
            <div className={`${styles.kpiChange} ${styles.kpiChangePositive}`}>
              <TrendingUp size={14} />
              <span>{stats.totalAppointments}건 예약</span>
            </div>
          </div>

          <div
            className={styles.kpiCard}
            style={{ animationDelay: '0.1s' }}
          >
            <span className={styles.kpiLabel}>완료율</span>
            <span className={styles.kpiValue}>{stats.completionRate}%</span>
            <div className={styles.progressBar}>
              <div
                className={`${styles.progressFill} ${styles.progressGreen}`}
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
          </div>

          <div
            className={styles.kpiCard}
            style={{ animationDelay: '0.15s' }}
          >
            <span className={styles.kpiLabel}>취소율</span>
            <span className={styles.kpiValue}>{stats.cancellationRate}%</span>
            <div className={styles.progressBar}>
              <div
                className={`${styles.progressFill} ${styles.progressRed}`}
                style={{ width: `${stats.cancellationRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Popular Services */}
        <section>
          <div className={styles.sectionHeader}>
            <h2 className="heading-md">인기 서비스</h2>
          </div>
          <div className={styles.serviceList} style={{ marginTop: 16 }}>
            {stats.serviceRanking.length === 0 ? (
              <div className={styles.emptyState}>
                <BarChart3 size={32} className={styles.emptyIcon} />
                <p className="body-sm text-tertiary">아직 서비스 기록이 없습니다.</p>
              </div>
            ) : (
              stats.serviceRanking.slice(0, 5).map((svc, idx) => (
                <div
                  key={svc.name}
                  className={styles.serviceItem}
                  style={{ animationDelay: `${0.2 + idx * 0.05}s` }}
                >
                  <div className={`${styles.serviceRank} ${rankStyles[idx] || styles.rank3}`}>
                    {idx + 1}
                  </div>
                  <div className={styles.serviceInfo}>
                    <span className={styles.serviceName}>{svc.name}</span>
                    <span className={styles.serviceCount}>
                      {svc.count}건 · 전체의 {svc.percentage}%
                    </span>
                  </div>
                  <div className={styles.serviceMiniBar}>
                    <div
                      className={styles.serviceMiniBarFill}
                      style={{
                        width: `${svc.percentage}%`,
                        background: barColors[idx] || barColors[2],
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Recent Visits */}
        <section>
          <div className={styles.sectionHeader}>
            <h2 className="heading-md">최근 방문 고객</h2>
          </div>
          <div className={styles.customerList} style={{ marginTop: 16 }}>
            {stats.recentVisits.length === 0 ? (
              <div className={styles.emptyState}>
                <User size={32} className={styles.emptyIcon} />
                <p className="body-sm text-tertiary">최근 방문 기록이 없습니다.</p>
              </div>
            ) : (
              stats.recentVisits.map((appt, idx) => (
                <Link
                  key={appt.id}
                  href={`/customers/${appt.customer_id}`}
                  className={styles.customerItem}
                  style={{ animationDelay: `${0.3 + idx * 0.05}s` }}
                >
                  <div
                    className={styles.customerAvatar}
                    style={{
                      background:
                        idx % 2 === 0
                          ? 'var(--accent-light)'
                          : 'var(--accent-warm-light)',
                    }}
                  >
                    <User
                      size={20}
                      color={
                        idx % 2 === 0
                          ? 'var(--accent-primary)'
                          : 'var(--accent-warm)'
                      }
                    />
                  </div>
                  <div className={styles.customerInfo}>
                    <span className={styles.customerName}>
                      {appt.customers?.name}
                    </span>
                    <span className={styles.customerService}>
                      {appt.service} · {formatRelativeDate(appt.date)}
                    </span>
                  </div>
                  <ChevronRight size={16} className="text-tertiary" />
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}
