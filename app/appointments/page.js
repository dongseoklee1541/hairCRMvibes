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

const LEGACY_SERVICE_VALUE = '__current_service_snapshot__';

function formatPriceKrw(value) {
  if (value === null || value === undefined) return '가격 미설정';
  return `${new Intl.NumberFormat('ko-KR').format(Number(value))}원`;
}

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
  const [serviceDefaults, setServiceDefaults] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [statusSavingId, setStatusSavingId] = useState(null);
  const [editSavingId, setEditSavingId] = useState(null);
  const [editingAppointmentId, setEditingAppointmentId] = useState(null);
  const [editForm, setEditForm] = useState({
    date: '',
    time: '',
    service: '',
    selected_service_id: LEGACY_SERVICE_VALUE,
    service_changed: false,
    price_snapshot_krw: null,
    duration_minutes: 60,
    original_service_id: LEGACY_SERVICE_VALUE,
    original_service_name: '',
    original_price_snapshot_krw: null,
    original_duration_minutes: 60,
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

  const fetchServiceDefaults = useCallback(async () => {
    try {
      setServicesLoading(true);
      setServicesError('');
      const { data, error } = await supabase
        .from('salon_service_defaults')
        .select('id, name, default_duration_minutes, price_krw')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setServiceDefaults(data || []);
    } catch (error) {
      console.error('Error fetching active services:', error);
      setServiceDefaults([]);
      setServicesError('활성 서비스를 불러오지 못했습니다. 현재 시술 기록은 그대로 저장할 수 있습니다.');
    } finally {
      setServicesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonthData();
  }, [fetchMonthData]);

  useEffect(() => {
    fetchDailyData();
  }, [fetchDailyData]);

  useEffect(() => {
    fetchServiceDefaults();
  }, [fetchServiceDefaults]);

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
    const originalServiceId = appointment.service_id || LEGACY_SERVICE_VALUE;
    const originalServiceName = appointment.service || '';
    const originalPriceSnapshotKrw = appointment.price_snapshot_krw ?? null;
    const originalDurationMinutes = resolveAppointmentDurationMinutes(appointment, 60);

    setActionMessage('');
    setEditingAppointmentId(appointment.id);
    setEditForm({
      date: appointment.date || formatDateKey(year, month, selectedDay),
      time: normalizeTimeValue(appointment.time),
      service: originalServiceName,
      selected_service_id: originalServiceId,
      service_changed: false,
      price_snapshot_krw: originalPriceSnapshotKrw,
      duration_minutes: originalDurationMinutes,
      original_service_id: originalServiceId,
      original_service_name: originalServiceName,
      original_price_snapshot_krw: originalPriceSnapshotKrw,
      original_duration_minutes: originalDurationMinutes,
      memo: appointment.memo || '',
    });
  };

  const closeEditingAppointment = () => {
    setEditingAppointmentId(null);
    setEditForm({
      date: '',
      time: '',
      service: '',
      selected_service_id: LEGACY_SERVICE_VALUE,
      service_changed: false,
      price_snapshot_krw: null,
      duration_minutes: 60,
      original_service_id: LEGACY_SERVICE_VALUE,
      original_service_name: '',
      original_price_snapshot_krw: null,
      original_duration_minutes: 60,
      memo: '',
    });
  };

  const handleEditServiceChange = (serviceId) => {
    setEditForm((prev) => {
      if (serviceId === prev.original_service_id) {
        return {
          ...prev,
          selected_service_id: prev.original_service_id,
          service: prev.original_service_name,
          service_changed: false,
          price_snapshot_krw: prev.original_price_snapshot_krw,
          duration_minutes: prev.original_duration_minutes,
        };
      }

      const service = serviceDefaults.find((item) => item.id === serviceId);
      if (!service) return prev;

      return {
        ...prev,
        selected_service_id: service.id,
        service: service.name,
        service_changed: true,
        price_snapshot_krw: service.price_krw ?? null,
        duration_minutes: service.default_duration_minutes || prev.duration_minutes,
      };
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

    if (editForm.service_changed && editForm.selected_service_id === LEGACY_SERVICE_VALUE) {
      setActionMessage('변경할 활성 서비스를 선택해주세요.');
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
      const updatePayload = {
        date: editForm.date,
        time: editForm.time,
        duration: formatDurationMinutes(durationMinutes),
        duration_minutes: durationMinutes,
        memo: editForm.memo.trim() || null,
      };

      if (editForm.service_changed) {
        updatePayload.service_id = editForm.selected_service_id;
        updatePayload.service = editForm.service.trim();
      }

      const { error } = await supabase
        .from('appointments')
        .update(updatePayload)
        .eq('id', appointment.id);

      if (error) throw error;

      setActionMessage(`${appointment.customers?.name || '예약'} 예약을 수정했습니다.`);
      closeEditingAppointment();
      await refreshAppointments();
    } catch (error) {
      console.error('Error updating appointment:', error);
      if (error?.code === '55000' && error?.message?.includes('서비스')) {
        setActionMessage('선택한 서비스가 비활성화되었습니다. 다시 선택해주세요.');
        await fetchServiceDefaults();
      } else {
        setActionMessage(error?.message || '예약 수정 중 오류가 발생했습니다.');
      }
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
                        <span className={styles.priceText}>{formatPriceKrw(appt.price_snapshot_krw)}</span>
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
                            <select
                              value={editForm.selected_service_id}
                              onChange={(event) => handleEditServiceChange(event.target.value)}
                              disabled={isBusy || servicesLoading}
                            >
                              {!serviceDefaults.some((service) => service.id === editForm.original_service_id) ? (
                                <option value={editForm.original_service_id}>
                                  {editForm.original_service_name || '기존 시술'} · 현재 기록 유지
                                </option>
                              ) : null}
                              {serviceDefaults.map((service) => (
                                <option key={service.id} value={service.id}>
                                  {service.name} · {formatPriceKrw(service.price_krw)}
                                </option>
                              ))}
                            </select>
                            <small className={styles.fieldHint}>
                              {servicesLoading
                                ? '활성 서비스를 불러오는 중입니다.'
                                : servicesError || (serviceDefaults.length === 0
                                  ? '활성 서비스가 없어 현재 시술 기록을 그대로 유지합니다.'
                                  : `${formatPriceKrw(editForm.price_snapshot_krw)} · 재선택할 때만 예약 snapshot이 변경됩니다.`)}
                            </small>
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
