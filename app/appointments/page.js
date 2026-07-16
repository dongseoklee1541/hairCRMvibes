'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { formatPriceKrw } from '@/lib/formatPrice';
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
const EMPTY_APPOINTMENTS = [];
const EMPTY_APPOINTMENT_DATES = new Set();

function createEmptyEditForm() {
  return {
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
  };
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

  const [dailyState, setDailyState] = useState({
    dateKey: null,
    loading: true,
    error: '',
    appointments: EMPTY_APPOINTMENTS,
  });
  const [monthState, setMonthState] = useState({
    monthKey: null,
    appointmentDates: EMPTY_APPOINTMENT_DATES,
    error: '',
  });
  const [serviceDefaults, setServiceDefaults] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState('');
  const [actionFeedback, setActionFeedback] = useState({ dateKey: null, message: '' });
  const [statusSavingById, setStatusSavingById] = useState(() => new Map());
  const [editSavingById, setEditSavingById] = useState(() => new Map());
  const [editingAppointment, setEditingAppointment] = useState({ dateKey: null, id: null, sessionId: null });
  const [editForm, setEditForm] = useState(createEmptyEditForm);
  const mountedRef = useRef(false);
  const latestSelectionRef = useRef(null);
  const editingAppointmentRef = useRef({ dateKey: null, id: null, sessionId: null });
  const editSessionIdRef = useRef(0);
  const statusMutationIdRef = useRef(0);
  const editMutationIdRef = useRef(0);
  const monthRequestIdRef = useRef(0);
  const dailyRequestIdRef = useRef(0);
  const serviceRequestIdRef = useRef(0);

  const daysInMonth = getDaysInKstMonth(year, month);
  const firstDay = getFirstWeekdayOfKstMonth(year, month);
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const selectedDateKey = formatDateKey(year, month, selectedDay);

  latestSelectionRef.current = {
    year,
    month,
    selectedDay,
    daysInMonth,
    monthKey,
    dateKey: selectedDateKey,
  };
  editingAppointmentRef.current = editingAppointment;

  const loading = dailyState.dateKey !== selectedDateKey || dailyState.loading;
  const dailyError = dailyState.dateKey === selectedDateKey ? dailyState.error : '';
  const dailyAppts = dailyState.dateKey === selectedDateKey
    ? dailyState.appointments
    : EMPTY_APPOINTMENTS;
  const monthHasAppts = monthState.monthKey === monthKey
    ? monthState.appointmentDates
    : EMPTY_APPOINTMENT_DATES;
  const monthError = monthState.monthKey === monthKey ? monthState.error : '';
  const actionMessage = actionFeedback.dateKey === selectedDateKey
    ? actionFeedback.message
    : '';

  const fetchMonthData = useCallback(async (selection = latestSelectionRef.current) => {
    const target = {
      year: selection.year,
      month: selection.month,
      daysInMonth: selection.daysInMonth,
      monthKey: selection.monthKey,
    };
    const latest = latestSelectionRef.current;

    if (!mountedRef.current || latest.monthKey !== target.monthKey) return;

    const requestId = ++monthRequestIdRef.current;
    const isCurrentRequest = () => (
      mountedRef.current
      && requestId === monthRequestIdRef.current
      && latestSelectionRef.current.monthKey === target.monthKey
    );

    try {
      const startDate = formatDateKey(target.year, target.month, 1);
      const endDate = formatDateKey(target.year, target.month, target.daysInMonth);
      
      const { data, error } = await supabase
        .from('appointments')
        .select('date')
        .gte('date', startDate)
        .lte('date', endDate);
        
      if (error) throw error;
      if (!isCurrentRequest()) return;
      
      const apptDates = new Set(data?.map(a => a.date));
      setMonthState((current) => (
        isCurrentRequest()
          ? { monthKey: target.monthKey, appointmentDates: apptDates, error: '' }
          : current
      ));
    } catch (error) {
      if (!isCurrentRequest()) return;
      console.error('Error fetching month appts:', error);
      setMonthState((current) => (
        isCurrentRequest()
          ? {
              monthKey: target.monthKey,
              appointmentDates: EMPTY_APPOINTMENT_DATES,
              error: navigator.onLine
                ? '달력의 예약 표시를 불러오지 못했습니다. 날짜별 예약 목록은 계속 확인할 수 있습니다.'
                : '인터넷이 연결되지 않아 달력의 예약 표시를 불러올 수 없습니다.',
            }
          : current
      ));
    }
  }, []);

  const fetchDailyData = useCallback(async (selection = latestSelectionRef.current) => {
    const target = {
      dateKey: selection.dateKey,
    };
    const latest = latestSelectionRef.current;

    if (!mountedRef.current || latest.dateKey !== target.dateKey) return;

    const requestId = ++dailyRequestIdRef.current;
    const isCurrentRequest = () => (
      mountedRef.current
      && requestId === dailyRequestIdRef.current
      && latestSelectionRef.current.dateKey === target.dateKey
    );

    try {
      setDailyState((current) => (
        isCurrentRequest()
          ? {
              dateKey: target.dateKey,
              loading: true,
              error: '',
              appointments: current.dateKey === target.dateKey
                ? current.appointments
                : EMPTY_APPOINTMENTS,
            }
          : current
      ));
      setActionFeedback((current) => (
        isCurrentRequest() && current.dateKey !== target.dateKey
          ? { dateKey: target.dateKey, message: '' }
          : current
      ));
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          customers(name)
        `)
        .eq('date', target.dateKey)
        .order('time');
        
      if (error) throw error;
      if (!isCurrentRequest()) return;
      setDailyState((current) => (
        isCurrentRequest()
          ? {
              dateKey: target.dateKey,
              loading: true,
              error: '',
              appointments: data || [],
            }
          : current
      ));
    } catch (error) {
      if (!isCurrentRequest()) return;
      console.error('Error fetching daily appts:', error);
      const errorMessage = navigator.onLine
        ? '예약을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
        : '오프라인에서는 예약을 불러올 수 없습니다. 연결을 확인해주세요.';
      setDailyState((current) => (
        isCurrentRequest()
          ? {
              dateKey: target.dateKey,
              loading: true,
              error: errorMessage,
              appointments: EMPTY_APPOINTMENTS,
            }
          : current
      ));
    } finally {
      if (!isCurrentRequest()) return;
      setDailyState((current) => (
        isCurrentRequest() && current.dateKey === target.dateKey
          ? { ...current, loading: false }
          : current
      ));
    }
  }, []);

  const fetchServiceDefaults = useCallback(async () => {
    if (!mountedRef.current) return;

    const requestId = ++serviceRequestIdRef.current;
    const isCurrentRequest = () => (
      mountedRef.current && requestId === serviceRequestIdRef.current
    );

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
      if (!isCurrentRequest()) return;
      setServiceDefaults(data || []);
    } catch (error) {
      if (!isCurrentRequest()) return;
      console.error('Error fetching active services:', error);
      setServiceDefaults([]);
      setServicesError('사용 중인 시술을 불러오지 못했습니다. 현재 시술 기록은 그대로 저장할 수 있습니다.');
    } finally {
      if (isCurrentRequest()) {
        setServicesLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      monthRequestIdRef.current += 1;
      dailyRequestIdRef.current += 1;
      serviceRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    fetchMonthData(latestSelectionRef.current);

    return () => {
      monthRequestIdRef.current += 1;
    };
  }, [fetchMonthData, monthKey]);

  useEffect(() => {
    fetchDailyData(latestSelectionRef.current);

    return () => {
      dailyRequestIdRef.current += 1;
    };
  }, [fetchDailyData, selectedDateKey]);

  useEffect(() => {
    fetchServiceDefaults();

    return () => {
      serviceRequestIdRef.current += 1;
    };
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

  const refreshAppointments = useCallback(async () => {
    if (!mountedRef.current) return;

    const selection = { ...latestSelectionRef.current };
    await Promise.all([
      fetchMonthData(selection),
      fetchDailyData(selection),
    ]);
  }, [fetchDailyData, fetchMonthData]);

  const publishActionMessage = useCallback((message, targetDateKey = latestSelectionRef.current.dateKey) => {
    if (
      !mountedRef.current
      || latestSelectionRef.current.dateKey !== targetDateKey
    ) return false;

    setActionFeedback((current) => (
      mountedRef.current && latestSelectionRef.current.dateKey === targetDateKey
        ? { dateKey: targetDateKey, message }
        : current
    ));
    return true;
  }, []);

  const startEditingAppointment = (appointment) => {
    if (!mountedRef.current) return;

    const selection = { ...latestSelectionRef.current };
    const originalServiceId = appointment.service_id || LEGACY_SERVICE_VALUE;
    const originalServiceName = appointment.service || '';
    const originalPriceSnapshotKrw = appointment.price_snapshot_krw ?? null;
    const originalDurationMinutes = resolveAppointmentDurationMinutes(appointment, 60);
    const nextEditingAppointment = {
      dateKey: selection.dateKey,
      id: appointment.id,
      sessionId: ++editSessionIdRef.current,
    };

    publishActionMessage('', selection.dateKey);
    editingAppointmentRef.current = nextEditingAppointment;
    setEditingAppointment(nextEditingAppointment);
    setEditForm({
      date: appointment.date || selection.dateKey,
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

  const closeEditingAppointment = useCallback((expected = null) => {
    if (!mountedRef.current) return false;

    const current = editingAppointmentRef.current;
    if (
      expected
      && (
        current.id !== expected.id
        || current.dateKey !== expected.dateKey
        || current.sessionId !== expected.sessionId
      )
    ) return false;

    const emptyEditingAppointment = { dateKey: null, id: null, sessionId: null };
    editingAppointmentRef.current = emptyEditingAppointment;
    setEditingAppointment(emptyEditingAppointment);
    setEditForm(createEmptyEditForm());
    return true;
  }, []);

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

    if (!mountedRef.current) return;
    const mutationSelection = { ...latestSelectionRef.current };
    const mutationId = ++statusMutationIdRef.current;

    try {
      publishActionMessage('', mutationSelection.dateKey);
      setStatusSavingById((current) => {
        const next = new Map(current);
        next.set(appointment.id, mutationId);
        return next;
      });
      const { error } = await supabase.rpc('set_appointment_status', {
        p_appointment_id: appointment.id,
        p_status: nextStatus,
        p_cancel_reason: cancelReason,
      });

      if (error) throw error;
      if (!mountedRef.current) return;

      publishActionMessage(
        `${appointment.customers?.name || '예약'} 상태를 ${label}(으)로 변경했습니다.`,
        mutationSelection.dateKey
      );
      await refreshAppointments();
    } catch (error) {
      if (!mountedRef.current) return;
      console.error('Error updating appointment status:', error);
      publishActionMessage(
        error?.message || '예약 상태 변경 중 오류가 발생했습니다.',
        mutationSelection.dateKey
      );
    } finally {
      if (mountedRef.current) {
        setStatusSavingById((current) => {
          if (current.get(appointment.id) !== mutationId) return current;
          const next = new Map(current);
          next.delete(appointment.id);
          return next;
        });
      }
    }
  };

  const handleEditSubmit = async (event, appointment) => {
    event.preventDefault();
    if (!mountedRef.current) return;

    const mutationSelection = { ...latestSelectionRef.current };
    const editSession = { ...editingAppointmentRef.current };
    if (
      editSession.id !== appointment.id
      || editSession.dateKey !== mutationSelection.dateKey
    ) return;
    const mutationId = ++editMutationIdRef.current;
    if (!editForm.date || !editForm.time || !editForm.service.trim()) {
      publishActionMessage('날짜, 시간, 시술명을 모두 입력해주세요.', mutationSelection.dateKey);
      return;
    }

    if (editForm.service_changed && editForm.selected_service_id === LEGACY_SERVICE_VALUE) {
      publishActionMessage('변경할 사용 중인 시술을 선택해 주세요.', mutationSelection.dateKey);
      return;
    }

    const durationMinutes = Number(editForm.duration_minutes);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      publishActionMessage('소요시간을 확인해주세요.', mutationSelection.dateKey);
      return;
    }

    try {
      publishActionMessage('', mutationSelection.dateKey);
      setEditSavingById((current) => {
        const next = new Map(current);
        next.set(appointment.id, mutationId);
        return next;
      });
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
      if (!mountedRef.current) return;

      publishActionMessage(
        `${appointment.customers?.name || '예약'} 예약을 수정했습니다.`,
        mutationSelection.dateKey
      );
      closeEditingAppointment(editSession);
      await refreshAppointments();
    } catch (error) {
      if (!mountedRef.current) return;
      console.error('Error updating appointment:', error);
      if (error?.code === '55000' && error?.message?.includes('서비스')) {
        publishActionMessage(
          '선택한 시술은 현재 사용하지 않습니다. 다른 시술을 선택해 주세요.',
          mutationSelection.dateKey
        );
        await fetchServiceDefaults();
      } else {
        publishActionMessage(
          error?.message || '예약 수정 중 오류가 발생했습니다.',
          mutationSelection.dateKey
        );
      }
    } finally {
      if (mountedRef.current) {
        setEditSavingById((current) => {
          if (current.get(appointment.id) !== mutationId) return current;
          const next = new Map(current);
          next.delete(appointment.id);
          return next;
        });
      }
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

  const dayOfWeek = getWeekdayFromDateKey(selectedDateKey);
  const dayName = DAYS[dayOfWeek];

  return (
    <>
      <div className="page-content" style={{ paddingTop: 12 }}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <h1 className="heading-xl">예약 관리</h1>
            <p>날짜를 선택해 예약을 확인하고 상태를 변경하세요.</p>
          </div>
          <Link href="/appointments/new" className={styles.newAppointmentButton}>
            <Plus size={20} aria-hidden="true" />
            <span>새 예약</span>
          </Link>
        </div>

        <nav className={styles.monthNavigation} aria-label="예약 달력 월 이동">
          <button type="button" onClick={prevMonth} className={styles.navBtn} aria-label="이전 달">
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <h2 className="heading-lg" aria-live="polite">{year}년 {month + 1}월</h2>
          <button type="button" onClick={nextMonth} className={styles.navBtn} aria-label="다음 달">
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </nav>

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
                    type="button"
                    className={`${styles.dayCell} ${day === selectedDay ? styles.daySelected : ''} ${isToday(day) && day !== selectedDay ? styles.dayToday : ''}`}
                    onClick={() => day && setSelectedDay(day)}
                    disabled={!day}
                    aria-label={day ? `${year}년 ${month + 1}월 ${day}일${hasAppt ? ', 예약 있음' : ''}` : undefined}
                    aria-pressed={day ? day === selectedDay : undefined}
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

        {monthError ? (
          <div className={styles.calendarError} role="alert">
            <p>{monthError}</p>
            <button type="button" onClick={() => fetchMonthData()}>
              <RotateCcw size={17} aria-hidden="true" /> 예약 표시 다시 불러오기
            </button>
          </div>
        ) : null}

        <section className={styles.dailySection}>
          <div className="section-header">
            <h2 className="heading-md">
              {month + 1}월 {selectedDay}일 ({dayName}) 예약
            </h2>
            {!loading && <span className="badge badge-green">{dailyAppts.length}건</span>}
          </div>
          {actionMessage ? (
            <div className={styles.feedbackBox} role="status" aria-live="polite">
              {actionMessage}
            </div>
          ) : null}

          <div className="card" style={{ marginTop: 16, overflow: 'hidden' }}>
            {loading ? (
              <div className={styles.loadingState} role="status">
                <Loader2 size={24} className="animate-spin text-tertiary" aria-hidden="true" />
                <p>선택한 날짜의 예약을 불러오는 중입니다.</p>
              </div>
            ) : dailyError ? (
              <div className={styles.errorState} role="alert">
                <p>{dailyError}</p>
                <button type="button" onClick={() => fetchDailyData()}>
                  다시 시도
                </button>
              </div>
            ) : dailyAppts.length === 0 ? (
              <div className={styles.emptyState}>
                <p>선택한 날짜에 예약이 없습니다.</p>
                <Link href="/appointments/new">새 예약 등록</Link>
              </div>
            ) : (
              dailyAppts.map((appt, i) => {
                const isBusy = statusSavingById.has(appt.id) || editSavingById.has(appt.id);
                const isEditing = editingAppointment.dateKey === selectedDateKey
                  && editingAppointment.id === appt.id;
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
                                ? '사용 중인 시술을 불러오는 중입니다.'
                                : servicesError || (serviceDefaults.length === 0
                                  ? '사용 중인 시술이 없어 현재 시술 기록을 그대로 유지합니다.'
                                  : `${formatPriceKrw(editForm.price_snapshot_krw)} · 시술을 다시 선택할 때만 이 예약의 시술명과 금액이 바뀝니다.`)}
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
                          <button type="button" className={styles.secondaryButton} onClick={() => closeEditingAppointment()} disabled={isBusy}>
                            취소
                          </button>
                          <button type="submit" className={styles.primaryButton} disabled={isBusy}>
                            {editSavingById.has(appt.id) ? (
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
