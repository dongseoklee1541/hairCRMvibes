'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus, Loader2 } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function AppointmentsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  
  const [loading, setLoading] = useState(true);
  const [dailyAppts, setDailyAppts] = useState([]);
  const [monthHasAppts, setMonthHasAppts] = useState(new Set());

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const fetchMonthData = useCallback(async () => {
    try {
      const startDate = formatDateKey(year, month, 1);
      const endDate = formatDateKey(year, month, daysInMonth);
      
      const { data, error } = await supabase
        .from('appointments')
        .select('date')
        .gte('date', startDate)
        .lte('date', endDate);
        
      if (error) throw error;
      
      const apptDates = new Set(data?.map(a => a.date));
      setMonthHasAppts(apptDates);
    } catch (error) {
      console.error('Error fetching month appts:', error);
    }
  }, [year, month, daysInMonth]);

  const fetchDailyData = useCallback(async () => {
    try {
      setLoading(true);
      const selectedDateKey = formatDateKey(year, month, selectedDay);
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          customers(name)
        `)
        .eq('date', selectedDateKey)
        .order('time');
        
      if (error) throw error;
      setDailyAppts(data || []);
    } catch (error) {
      console.error('Error fetching daily appts:', error);
    } finally {
      setLoading(false);
    }
  }, [year, month, selectedDay]);

  useEffect(() => {
    fetchMonthData();
  }, [fetchMonthData]);

  useEffect(() => {
    fetchDailyData();
  }, [fetchDailyData]);

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else { setMonth(month - 1); }
    setSelectedDay(1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else { setMonth(month + 1); }
    setSelectedDay(1);
  };

  const isToday = (day) => {
    return year === now.getFullYear() && month === now.getMonth() && day === now.getDate();
  };

  // 캘린더 주 데이터 생성
  const weeks = [];
  let currentWeek = new Array(firstDay).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  const dayOfWeek = new Date(year, month, selectedDay).getDay();
  const dayName = DAYS[dayOfWeek];

  return (
    <>
      <div className="page-content" style={{ paddingTop: 12 }}>
        {/* Header */}
        <div className={styles.header}>
          <div className="flex-row gap-md">
            <button onClick={prevMonth} className={styles.navBtn}>
              <ChevronLeft size={22} />
            </button>
            <h1 className="heading-lg">{year}년 {month + 1}월</h1>
            <button onClick={nextMonth} className={styles.navBtn}>
              <ChevronRight size={22} />
            </button>
          </div>
          <Link href="/appointments/new" className="btn-icon btn-icon-primary">
            <Plus size={20} />
          </Link>
        </div>

        {/* Calendar Card */}
        <div className={`card ${styles.calendarCard}`}>
          {/* Day Headers */}
          <div className={styles.calendarRow}>
            {DAYS.map((d, i) => (
              <div
                key={d}
                className={styles.dayHeader}
                style={{
                  color: i === 0 ? 'var(--status-negative)' : i === 6 ? '#5B8BD4' : 'var(--text-tertiary)',
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className={styles.calendarRow}>
              {week.map((day, di) => {
                const dateKey = day ? formatDateKey(year, month, day) : null;
                const hasAppt = dateKey && monthHasAppts.has(dateKey);
                
                return (
                  <button
                    key={di}
                    className={`${styles.dayCell} ${day === selectedDay ? styles.daySelected : ''} ${isToday(day) && day !== selectedDay ? styles.dayToday : ''}`}
                    onClick={() => day && setSelectedDay(day)}
                    disabled={!day}
                  >
                    <span
                      style={{
                        position: 'relative',
                        color: !day ? 'transparent'
                          : day === selectedDay ? '#FFFFFF'
                          : di === 0 ? 'var(--status-negative)'
                          : di === 6 ? '#5B8BD4'
                          : 'var(--text-primary)',
                      }}
                    >
                      {day || ''}
                      {hasAppt && day !== selectedDay && (
                        <span style={{
                          position: 'absolute',
                          bottom: -6,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          backgroundColor: 'var(--accent-primary)'
                        }} />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Daily Appointments */}
        <section>
          <div className="section-header">
            <h2 className="heading-md">
              {month + 1}월 {selectedDay}일 ({dayName}) 예약
            </h2>
            {!loading && <span className="badge badge-green">{dailyAppts.length}건</span>}
          </div>

          <div className="card" style={{ marginTop: 16, overflow: 'hidden' }}>
            {loading ? (
              <div className="flex-center" style={{ padding: 40 }}>
                <Loader2 size={24} className="animate-spin text-tertiary" />
              </div>
            ) : dailyAppts.length === 0 ? (
              <div className={styles.emptyState}>
                <p className="body-sm text-tertiary">예약이 없습니다</p>
              </div>
            ) : (
              dailyAppts.map((appt, i) => (
                <div
                  key={appt.id}
                  className={styles.apptRow}
                  style={{
                    borderBottom: i < dailyAppts.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <div className={styles.accentBar} style={{ background: i % 2 === 0 ? 'var(--accent-primary)' : 'var(--accent-warm)' }} />
                  <div className={styles.apptTime}>
                    <span className="body-md" style={{ fontWeight: 600 }}>
                      {appt.time ? appt.time.substring(0, 5) : '--:--'}
                    </span>
                  </div>
                  <div className="divider" style={{ height: 36 }} />
                  <div className={styles.apptInfo}>
                    <span className="body-md">{appt.customers?.name} · {appt.service}</span>
                    <span className="caption">약 {appt.duration} 예상</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>


    </>
  );
}
