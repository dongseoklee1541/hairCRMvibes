'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  XCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import {
  formatDateKey,
  getDaysInKstMonth,
  getFirstWeekdayOfKstMonth,
  getTodayKstCalendarParts,
  getTodayKstDateKey,
  getWeekdayFromDateKey,
  KOREAN_WEEKDAYS_SHORT,
} from '@/lib/dateTime';
import {
  DURATION_MINUTE_OPTIONS,
  formatDurationMinutes,
  resolveAppointmentDurationMinutes,
} from '@/lib/appointmentRules';
import styles from './page.module.css';

const DAYS = KOREAN_WEEKDAYS_SHORT;

const STATUS_LABELS = {
  confirmed: '확정',
  completed: '완료',
  cancelled: '취소',
};

function getStatusClassName(status) {
  if (status === 'completed') return styles.statusCompleted;
  if (status === 'cancelled') return styles.statusCancelled;
  return styles.statusConfirmed;
}

function normalizeTimeValue(value, fallback = '10:00') {
  if (!value) return fallback;
  return String(value).slice(0, 5);
}

export default function AppointmentsPage() {
  const today = getTodayKstCalendarParts();
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.monthIndex);
  const [selectedDay, setSelectedDay] = useState(today.day);
  
  const [loading, setLoading] = useState(true);
  const [dailyAppts, setDailyAppts] = useState([]);
  const [monthHasAppts, setMonthHasAppts] = useState(new Set());
  const [actionMessage, setActionMessage] = useState('');
  const [statusSavingId, setStatusSavingId] = useState(null);
  const [editSavingId, setEditSavingId] = useState(null);
  const [editingAppointmentId, setEditingAppointmentId] = useState(null);
  const [editForm, setEditForm] = useState({
    date: '',
    time: '',
    service: '',
    duration_minutes: 60,
    memo: '',
  });

  const daysInMonth = getDaysInKstMonth(year, month);
  const firstDay = getFirstWeekdayOfKstMonth(year, month);

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

  const refreshAppointments = async () => {
    await Promise.all([fetchMonthData(), fetchDailyData()]);
  };

  const startEditingAppointment = (appointment) => {
    setActionMessage('');
    setEditingAppointmentId(appointment.id);
    setEditForm({
      date: appointment.date || formatDateKey(year, month, selectedDay),
      time: normalizeTimeValue(appointment.time),
      service: appointment.service || '',
      duration_minutes: resolveAppointmentDurationMinutes(appointment, 60),
      memo: appointment.memo || '',
    });
  };

  const closeEditingAppointment = () => {
    setEditingAppointmentId(null);
    setEditForm({
      date: '',
      time: '',
      service: '',
      duration_minutes: 60,
      memo: '',
    });
  };

  const handleStatusChange = async (appointment, nextStatus) => {
    const label = STATUS_LABELS[nextStatus] || nextStatus;
    let cancelReason = null;

    if (nextStatus === 'cancelled') {
      cancelReason = window.prompt('취소 사유를 입력하세요.', '고객 요청');
      if (cancelReason === null) return;
    }

    try {
      setActionMessage('');
      setStatusSavingId(appointment.id);
      const { error } = await supabase.rpc('set_appointment_status', {
        p_appointment_id: appointment.id,
        p_status: nextStatus,
        p_cancel_reason: cancelReason,
      });

      if (error) throw error;

      setActionMessage(`${appointment.customers?.name || '예약'} 상태를 ${label}(으)로 변경했습니다.`);
      await refreshAppointments();
    } catch (error) {
      console.error('Error updating appointment status:', error);
      setActionMessage(error?.message || '예약 상태 변경 중 오류가 발생했습니다.');
    } finally {
      setStatusSavingId(null);
    }
  };

  const handleEditSubmit = async (event, appointment) => {
    event.preventDefault();
    if (!editForm.date || !editForm.time || !editForm.service.trim()) {
      setActionMessage('날짜, 시간, 시술명을 모두 입력해주세요.');
      return;
    }

    const durationMinutes = Number(editForm.duration_minutes);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setActionMessage('소요시간을 확인해주세요.');
      return;
    }

    try {
      setActionMessage('');
      setEditSavingId(appointment.id);
      const { error } = await supabase
        .from('appointments')
        .update({
          date: editForm.date,
          time: editForm.time,
          service: editForm.service.trim(),
          duration: formatDurationMinutes(durationMinutes),
          duration_minutes: durationMinutes,
          memo: editForm.memo.trim() || null,
        })
        .eq('id', appointment.id);

      if (error) throw error;

      setActionMessage(`${appointment.customers?.name || '예약'} 예약을 수정했습니다.`);
      closeEditingAppointment();
      await refreshAppointments();
    } catch (error) {
      console.error('Error updating appointment:', error);
      setActionMessage(error?.message || '예약 수정 중 오류가 발생했습니다.');
    } finally {
      setEditSavingId(null);
    }
  };

  const isToday = (day) => {
    return day ? formatDateKey(year, month, day) === getTodayKstDateKey() : false;
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

  const dayOfWeek = getWeekdayFromDateKey(formatDateKey(year, month, selectedDay));
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
          {actionMessage ? (
            <div className={styles.feedbackBox}>
              {actionMessage}
            </div>
          ) : null}

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
              dailyAppts.map((appt, i) => {
                const isBusy = statusSavingId === appt.id || editSavingId === appt.id;
                const isEditing = editingAppointmentId === appt.id;
                const durationMinutes = resolveAppointmentDurationMinutes(appt, 60);
                const status = appt.status || 'confirmed';

                return (
                  <div
                    key={appt.id}
                    className={styles.apptItem}
                    style={{
                      borderBottom: i < dailyAppts.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    <div className={styles.apptRow}>
                      <div className={styles.accentBar} style={{ background: i % 2 === 0 ? 'var(--accent-primary)' : 'var(--accent-warm)' }} />
                      <div className={styles.apptTime}>
                        <span className="body-md" style={{ fontWeight: 600 }}>
                          {appt.time ? appt.time.substring(0, 5) : '--:--'}
                        </span>
                      </div>
                      <div className="divider" style={{ height: 36 }} />
                      <div className={styles.apptInfo}>
                        <div className={styles.apptTitleLine}>
                          <span className="body-md">{appt.customers?.name} · {appt.service}</span>
                          <span className={`${styles.statusBadge} ${getStatusClassName(status)}`}>
                            {STATUS_LABELS[status] || status}
                          </span>
                        </div>
                        <span className="caption">약 {formatDurationMinutes(durationMinutes) || appt.duration || '미정'} 예상</span>
                        {appt.memo ? <span className="caption">{appt.memo}</span> : null}
                        <div className={styles.apptActions}>
                          {status !== 'completed' ? (
                            <button
                              type="button"
                              className={styles.actionButton}
                              onClick={() => handleStatusChange(appt, 'completed')}
                              disabled={isBusy}
                            >
                              <CheckCircle2 size={16} />
                              <span>완료</span>
                            </button>
                          ) : null}
                          {status !== 'cancelled' ? (
                            <button
                              type="button"
                              className={styles.actionButton}
                              onClick={() => handleStatusChange(appt, 'cancelled')}
                              disabled={isBusy}
                            >
                              <XCircle size={16} />
                              <span>취소</span>
                            </button>
                          ) : null}
                          {status !== 'confirmed' ? (
                            <button
                              type="button"
                              className={styles.actionButton}
                              onClick={() => handleStatusChange(appt, 'confirmed')}
                              disabled={isBusy}
                            >
                              <RotateCcw size={16} />
                              <span>확정</span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={styles.actionButton}
                            onClick={() => (isEditing ? closeEditingAppointment() : startEditingAppointment(appt))}
                            disabled={isBusy}
                          >
                            <Pencil size={16} />
                            <span>{isEditing ? '닫기' : '수정'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {isEditing ? (
                      <form className={styles.editPanel} onSubmit={(event) => handleEditSubmit(event, appt)}>
                        <div className={styles.editGrid}>
                          <label className={styles.editField}>
                            <span>날짜</span>
                            <input
                              type="date"
                              value={editForm.date}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, date: event.target.value }))}
                              disabled={isBusy}
                            />
                          </label>
                          <label className={styles.editField}>
                            <span>시간</span>
                            <input
                              type="time"
                              value={editForm.time}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, time: event.target.value }))}
                              disabled={isBusy}
                            />
                          </label>
                          <label className={styles.editField}>
                            <span>시술</span>
                            <input
                              value={editForm.service}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, service: event.target.value }))}
                              disabled={isBusy}
                            />
                          </label>
                          <label className={styles.editField}>
                            <span>소요시간</span>
                            <select
                              value={editForm.duration_minutes}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, duration_minutes: Number(event.target.value) }))}
                              disabled={isBusy}
                            >
                              {DURATION_MINUTE_OPTIONS.map((minutes) => (
                                <option key={minutes} value={minutes}>
                                  {formatDurationMinutes(minutes)}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <label className={styles.editField}>
                          <span>메모</span>
                          <textarea
                            value={editForm.memo}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, memo: event.target.value }))}
                            disabled={isBusy}
                            rows={3}
                          />
                        </label>
                        <div className={styles.editActions}>
                          <button type="button" className={styles.secondaryButton} onClick={closeEditingAppointment} disabled={isBusy}>
                            취소
                          </button>
                          <button type="submit" className={styles.primaryButton} disabled={isBusy}>
                            {editSavingId === appt.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Save size={16} />
                            )}
                            <span>저장</span>
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>


    </>
  );
}
