'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  Power,
  RotateCcw,
  Save,
  ShieldCheck,
} from 'lucide-react';
import AuthGate from '@/components/AuthGate';
import ClosedDayConflictSheet from '@/components/settings/ClosedDayConflictSheet';
import DataBackupCard from '@/components/settings/DataBackupCard';
import { supabase } from '@/lib/supabase';
import {
  APPOINTMENT_STATUS,
  buildBatchTargetDates,
  DURATION_MINUTE_OPTIONS,
  extractCancellableIds,
  formatDurationMinutes,
} from '@/lib/appointmentRules';
import {
  formatKoreanDate,
  getDateKeyRange,
  getTodayKstDateKey,
  getWeekdayFromDateKey,
} from '@/lib/dateTime';
import styles from './page.module.css';

const CLOSED_DAY_MODE = {
  SINGLE: 'single',
  RANGE: 'range',
  WEEKLY: 'weekly',
};

const WEEKDAY_OPTIONS = [
  { value: 0, label: '일요일' },
  { value: 1, label: '월요일' },
  { value: 2, label: '화요일' },
  { value: 3, label: '수요일' },
  { value: 4, label: '목요일' },
  { value: 5, label: '금요일' },
  { value: 6, label: '토요일' },
];

const SLOT_OPTIONS = [5, 10, 15, 20, 30, 45, 60];
const MAX_KRW_INTEGER = 2_147_483_647;

function parsePriceKrw(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return { value: null, error: '' };
  }

  const price = Number(normalized);
  if (!Number.isInteger(price) || price < 0 || price > MAX_KRW_INTEGER) {
    return { value: null, error: '가격은 0 이상의 정수 원 단위로 입력해주세요.' };
  }

  return { value: price, error: '' };
}

function formatPriceKrw(value) {
  if (value === null || value === undefined || value === '') {
    return '가격 미설정';
  }
  if (Number(value) === 0) {
    return '0원(무료)';
  }
  return `${Number(value).toLocaleString('ko-KR')}원`;
}

function normalizeTimeValue(value, fallback = '') {
  if (!value) return fallback;
  return String(value).slice(0, 5);
}

function buildDefaultBusinessHours() {
  return WEEKDAY_OPTIONS.map((option) => ({
    weekday: option.value,
    is_open: true,
    open_time: '10:00',
    close_time: '19:00',
    break_start: '',
    break_end: '',
  }));
}

function normalizeBusinessHour(row) {
  return {
    weekday: row.weekday,
    is_open: Boolean(row.is_open),
    open_time: normalizeTimeValue(row.open_time, '10:00'),
    close_time: normalizeTimeValue(row.close_time, '19:00'),
    break_start: normalizeTimeValue(row.break_start),
    break_end: normalizeTimeValue(row.break_end),
  };
}

function getBusinessHourPayload(row) {
  return {
    weekday: row.weekday,
    is_open: row.is_open,
    open_time: row.open_time || '10:00',
    close_time: row.close_time || '19:00',
    break_start: row.is_open && row.break_start ? row.break_start : null,
    break_end: row.is_open && row.break_end ? row.break_end : null,
  };
}

function SettingsPageContent() {
  const today = getTodayKstDateKey();

  const [mode, setMode] = useState(CLOSED_DAY_MODE.SINGLE);
  const [singleDate, setSingleDate] = useState(today);
  const [periodStartDate, setPeriodStartDate] = useState(today);
  const [periodEndDate, setPeriodEndDate] = useState(today);
  const [weeklyDay, setWeeklyDay] = useState(2);
  const [note, setNote] = useState('');

  const [removeStartDate, setRemoveStartDate] = useState(today);
  const [removeEndDate, setRemoveEndDate] = useState(today);

  const [operationSettings, setOperationSettings] = useState({
    default_service_id: '',
    default_service_name: '',
    default_duration_minutes: 60,
    appointment_slot_minutes: 30,
  });
  const [businessHours, setBusinessHours] = useState(buildDefaultBusinessHours);
  const [serviceDefaults, setServiceDefaults] = useState([]);
  const [newService, setNewService] = useState({
    name: '',
    price_krw: '',
    default_duration_minutes: 60,
  });

  const [closedDates, setClosedDates] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [selectedConflictIds, setSelectedConflictIds] = useState([]);

  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingClosedDays, setLoadingClosedDays] = useState(true);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [calculatingImpact, setCalculatingImpact] = useState(false);
  const [savingOperation, setSavingOperation] = useState(false);
  const [savingBusinessHours, setSavingBusinessHours] = useState(false);
  const [savingServices, setSavingServices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [impactCount, setImpactCount] = useState(0);
  const [settingsFeedback, setSettingsFeedback] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const fetchSettings = useCallback(async () => {
    try {
      setLoadingSettings(true);

      const [
        operationResult,
        businessHoursResult,
        serviceDefaultsResult,
      ] = await Promise.all([
        supabase
          .from('salon_operation_settings')
          .select('default_service_id, default_service_name, default_duration_minutes, appointment_slot_minutes')
          .eq('id', true)
          .maybeSingle(),
        supabase
          .from('salon_business_hours')
          .select('weekday, is_open, open_time, close_time, break_start, break_end')
          .order('weekday', { ascending: true }),
        supabase
          .from('salon_service_defaults')
          .select('id, name, price_krw, default_duration_minutes, is_active, sort_order')
          .order('is_active', { ascending: false })
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
      ]);

      if (operationResult.error) throw operationResult.error;
      if (businessHoursResult.error) throw businessHoursResult.error;
      if (serviceDefaultsResult.error) throw serviceDefaultsResult.error;

      if (operationResult.data) {
        setOperationSettings({
          default_service_id: operationResult.data.default_service_id || '',
          default_service_name: operationResult.data.default_service_name || '',
          default_duration_minutes: operationResult.data.default_duration_minutes || 60,
          appointment_slot_minutes: operationResult.data.appointment_slot_minutes || 30,
        });
      }

      const defaultsByWeekday = new Map(buildDefaultBusinessHours().map((row) => [row.weekday, row]));
      for (const row of businessHoursResult.data || []) {
        defaultsByWeekday.set(row.weekday, normalizeBusinessHour(row));
      }
      setBusinessHours(Array.from(defaultsByWeekday.values()).sort((a, b) => a.weekday - b.weekday));
      setServiceDefaults(serviceDefaultsResult.data || []);
    } catch (error) {
      console.error('운영 설정 조회 오류:', error);
      setSettingsFeedback('운영 설정을 불러오지 못했습니다.');
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const fetchClosedDates = useCallback(async () => {
    try {
      setLoadingClosedDays(true);
      const { data, error } = await supabase
        .from('salon_closed_dates')
        .select('id, closed_date, note')
        .order('closed_date', { ascending: false });

      if (error) throw error;
      setClosedDates(data || []);
    } catch (error) {
      console.error('휴무일 조회 오류:', error);
      setFeedbackMessage('휴무일 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingClosedDays(false);
    }
  }, []);

  useEffect(() => {
    fetchClosedDates();
  }, [fetchClosedDates]);

  const updateBusinessHour = (weekday, patch) => {
    setBusinessHours((prev) =>
      prev.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row))
    );
  };

  const updateServiceDefault = (id, patch) => {
    setServiceDefaults((prev) =>
      prev.map((service) => (service.id === id ? { ...service, ...patch } : service))
    );
  };

  const handleSaveOperationSettings = async () => {
    const defaultDuration = Number(operationSettings.default_duration_minutes);
    const slotMinutes = Number(operationSettings.appointment_slot_minutes);
    const selectedService = serviceDefaults.find(
      (service) => service.id === operationSettings.default_service_id
    );

    if (!selectedService || !selectedService.is_active) {
      setSettingsFeedback('활성 서비스 중 예약 기본 서비스를 선택해주세요.');
      return;
    }

    if (!selectedService.name.trim()) {
      setSettingsFeedback('선택한 서비스명을 먼저 저장해주세요.');
      return;
    }

    try {
      setSavingOperation(true);
      const { data: persistedService, error: serviceError } = await supabase
        .from('salon_service_defaults')
        .select('id, name, is_active')
        .eq('id', selectedService.id)
        .maybeSingle();

      if (serviceError) throw serviceError;
      if (!persistedService?.is_active) {
        throw new Error('선택한 서비스가 비활성 상태입니다. 다른 서비스를 선택해주세요.');
      }

      const { error } = await supabase
        .from('salon_operation_settings')
        .upsert(
          {
            id: true,
            default_service_id: persistedService.id,
            default_service_name: persistedService.name.trim(),
            default_duration_minutes: defaultDuration,
            appointment_slot_minutes: slotMinutes,
          },
          { onConflict: 'id' }
        );

      if (error) throw error;
      setSettingsFeedback('기본 예약값이 저장되었습니다.');
      await fetchSettings();
    } catch (error) {
      console.error('기본 예약값 저장 오류:', error);
      setSettingsFeedback(error?.message || '기본 예약값 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingOperation(false);
    }
  };

  const handleSaveBusinessHours = async () => {
    for (const row of businessHours) {
      if (row.is_open && (!row.open_time || !row.close_time || row.open_time >= row.close_time)) {
        setSettingsFeedback(`${WEEKDAY_OPTIONS[row.weekday].label} 영업 시작/종료 시간을 확인해주세요.`);
        return;
      }

      if (
        row.is_open &&
        ((row.break_start && !row.break_end) || (!row.break_start && row.break_end))
      ) {
        setSettingsFeedback(`${WEEKDAY_OPTIONS[row.weekday].label} 휴게 시작/종료를 모두 입력해주세요.`);
        return;
      }

      if (
        row.is_open &&
        row.break_start &&
        row.break_end &&
        !(row.open_time < row.break_start && row.break_start < row.break_end && row.break_end < row.close_time)
      ) {
        setSettingsFeedback(`${WEEKDAY_OPTIONS[row.weekday].label} 휴게시간은 영업시간 안에 있어야 합니다.`);
        return;
      }
    }

    try {
      setSavingBusinessHours(true);
      const { error } = await supabase
        .from('salon_business_hours')
        .upsert(businessHours.map(getBusinessHourPayload), { onConflict: 'weekday' });

      if (error) throw error;
      setSettingsFeedback('영업시간이 저장되었습니다.');
      await fetchSettings();
    } catch (error) {
      console.error('영업시간 저장 오류:', error);
      setSettingsFeedback(error?.message || '영업시간 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingBusinessHours(false);
    }
  };

  const handleSaveServiceDefault = async (service) => {
    if (!service.name.trim()) {
      setSettingsFeedback('서비스명을 입력해주세요.');
      return;
    }

    const priceResult = parsePriceKrw(service.price_krw);
    if (priceResult.error) {
      setSettingsFeedback(`${service.name.trim()}: ${priceResult.error}`);
      return;
    }

    try {
      setSavingServices(true);
      const { error } = await supabase
        .from('salon_service_defaults')
        .update({
          name: service.name.trim(),
          price_krw: priceResult.value,
          default_duration_minutes: Number(service.default_duration_minutes),
          is_active: service.is_active,
          sort_order: service.sort_order || 0,
        })
        .eq('id', service.id);

      if (error) throw error;
      setSettingsFeedback(`${service.name.trim()} 서비스가 저장되었습니다.`);
      await fetchSettings();
    } catch (error) {
      console.error('서비스 저장 오류:', error);
      setSettingsFeedback(error?.message || '서비스 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingServices(false);
    }
  };

  const handleAddServiceDefault = async () => {
    if (!newService.name.trim()) {
      setSettingsFeedback('추가할 서비스명을 입력해주세요.');
      return;
    }

    const priceResult = parsePriceKrw(newService.price_krw);
    if (priceResult.error) {
      setSettingsFeedback(priceResult.error);
      return;
    }

    try {
      setSavingServices(true);
      const nextSortOrder = serviceDefaults.reduce(
        (max, service) => Math.max(max, Number(service.sort_order) || 0),
        0
      ) + 10;

      const { error } = await supabase
        .from('salon_service_defaults')
        .insert({
          name: newService.name.trim(),
          price_krw: priceResult.value,
          default_duration_minutes: Number(newService.default_duration_minutes),
          sort_order: nextSortOrder,
          is_active: true,
        });

      if (error) throw error;
      setNewService({ name: '', price_krw: '', default_duration_minutes: 60 });
      setSettingsFeedback('서비스가 추가되었습니다.');
      await fetchSettings();
    } catch (error) {
      console.error('서비스 추가 오류:', error);
      setSettingsFeedback(error?.message || '서비스 추가 중 오류가 발생했습니다.');
    } finally {
      setSavingServices(false);
    }
  };

  const handleToggleServiceDefault = async (service) => {
    if (service.is_active) {
      if (operationSettings.default_service_id === service.id) {
        setSettingsFeedback(
          '예약 기본 서비스를 다른 활성 서비스로 변경해 저장한 뒤 비활성화해주세요.'
        );
        return;
      }

      const shouldDeactivate = window.confirm(
        `${service.name} 서비스를 비활성화할까요?\n기존 예약의 서비스와 가격 기록은 유지됩니다.`
      );
      if (!shouldDeactivate) return;
    }

    try {
      setSavingServices(true);
      const { error } = await supabase
        .from('salon_service_defaults')
        .update({ is_active: !service.is_active })
        .eq('id', service.id);

      if (error) throw error;
      setSettingsFeedback(
        service.is_active ? `${service.name} 서비스가 비활성화되었습니다.` : `${service.name} 서비스가 재활성화되었습니다.`
      );
      await fetchSettings();
    } catch (error) {
      console.error('서비스 활성 상태 변경 오류:', error);
      setSettingsFeedback(error?.message || '서비스 활성 상태 변경 중 오류가 발생했습니다.');
    } finally {
      setSavingServices(false);
    }
  };

  const getTargetDates = useCallback(
    (targetMode = mode) => {
      if (targetMode === CLOSED_DAY_MODE.SINGLE) {
        return [singleDate];
      }

      return buildBatchTargetDates(
        targetMode,
        { startDate: periodStartDate, endDate: periodEndDate },
        weeklyDay,
        getDateKeyRange,
        getWeekdayFromDateKey
      );
    },
    [mode, singleDate, periodStartDate, periodEndDate, weeklyDay]
  );

  const targetDatesPreviewCount = useMemo(() => {
    try {
      return getTargetDates(mode).length;
    } catch {
      return 0;
    }
  }, [getTargetDates, mode]);

  const calculateImpact = useCallback(async () => {
    try {
      setCalculatingImpact(true);
      const targetDates = getTargetDates(mode);

      if (targetDates.length === 0) {
        setImpactCount(0);
        return 0;
      }

      let query = supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('status', APPOINTMENT_STATUS.CONFIRMED);

      if (mode === CLOSED_DAY_MODE.SINGLE) {
        query = query.eq('date', targetDates[0]);
      } else {
        query = query.in('date', targetDates);
      }

      const { count, error } = await query;
      if (error) throw error;

      const nextCount = count || 0;
      setImpactCount(nextCount);
      return nextCount;
    } catch (error) {
      setImpactCount(0);
      return null;
    } finally {
      setCalculatingImpact(false);
    }
  }, [getTargetDates, mode]);

  useEffect(() => {
    calculateImpact();
  }, [calculateImpact]);

  const fetchConflicts = useCallback(async () => {
    if (!singleDate) {
      setFeedbackMessage('휴무일 날짜를 먼저 선택해주세요.');
      return [];
    }

    try {
      setCheckingConflicts(true);
      const { data, error } = await supabase
        .from('appointments')
        .select(
          `
          id,
          date,
          time,
          service,
          status,
          customers(name)
        `
        )
        .eq('date', singleDate)
        .order('time', { ascending: true });

      if (error) throw error;

      const nextConflicts = data || [];
      setConflicts(nextConflicts);
      setSelectedConflictIds(extractCancellableIds(nextConflicts));
      return nextConflicts;
    } catch (error) {
      console.error('충돌 예약 조회 오류:', error);
      setFeedbackMessage('충돌 예약을 불러오지 못했습니다.');
      return [];
    } finally {
      setCheckingConflicts(false);
    }
  }, [singleDate]);

  useEffect(() => {
    setConflicts([]);
    setSelectedConflictIds([]);
  }, [singleDate]);

  const handleOpenConflictSheet = async () => {
    const nextConflicts = await fetchConflicts();
    setSheetOpen(true);

    if (nextConflicts.length === 0) {
      setFeedbackMessage('해당 날짜에는 예약이 없습니다. 바로 휴무일 저장이 가능합니다.');
    } else {
      setFeedbackMessage('');
    }
  };

  const toggleConflict = (id) => {
    setSelectedConflictIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((itemId) => itemId !== id);
      }
      return [...prev, id];
    });
  };

  const handleApplySingleClosedDay = async () => {
    if (!singleDate) {
      setFeedbackMessage('휴무일 날짜를 선택해주세요.');
      return;
    }

    const confirmedCount = conflicts.filter((item) => item.status === APPOINTMENT_STATUS.CONFIRMED).length;

    if (confirmedCount > 0 && selectedConflictIds.length === 0) {
      setFeedbackMessage('confirmed 예약을 최소 1건 이상 선택해야 휴무일 저장이 가능합니다.');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase.rpc('apply_closed_day_with_cancellations', {
        p_closed_date: singleDate,
        p_cancel_ids: selectedConflictIds,
        p_note: note.trim() || null,
      });

      if (error) throw error;

      setFeedbackMessage(`${formatKoreanDate(singleDate)} 휴무일이 저장되었습니다.`);
      setConflicts([]);
      setSelectedConflictIds([]);
      setSheetOpen(false);
      await fetchClosedDates();
      await calculateImpact();
    } catch (error) {
      console.error('휴무일 저장 오류:', error);
      setFeedbackMessage(error?.message || '휴무일 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyBatchClosedDays = async () => {
    try {
      const targetDates = getTargetDates(mode);
      if (targetDates.length === 0) {
        setFeedbackMessage('선택한 조건에 적용할 날짜가 없습니다.');
        return;
      }

      const currentImpact = await calculateImpact();
      if (currentImpact === null) {
        setFeedbackMessage('저장 전 영향도 계산에 실패했습니다. 다시 시도해주세요.');
        return;
      }

      const modeLabel = mode === CLOSED_DAY_MODE.RANGE ? '기간' : '정기';
      const shouldProceed = window.confirm(
        `${modeLabel} 휴무일 ${targetDates.length}일을 저장합니다.\nconfirmed 예약 ${currentImpact}건이 일괄 취소됩니다.\n계속할까요?`
      );

      if (!shouldProceed) {
        return;
      }

      setSaving(true);

      const { data, error } = await supabase.rpc('apply_closed_days_batch_with_cancellations', {
        p_mode: mode,
        p_start_date: periodStartDate,
        p_end_date: periodEndDate,
        p_weekday: mode === CLOSED_DAY_MODE.WEEKLY ? weeklyDay : null,
        p_note: note.trim() || null,
      });

      if (error) throw error;

      const appliedDays = data?.applied_days ?? targetDates.length;
      const cancelledCount = data?.cancelled_count ?? currentImpact;

      setFeedbackMessage(`${modeLabel} 휴무일 ${appliedDays}일 저장, confirmed ${cancelledCount}건 취소 완료.`);
      await fetchClosedDates();
      await calculateImpact();
    } catch (error) {
      console.error('기간/정기 휴무일 저장 오류:', error);
      setFeedbackMessage(error?.message || '기간/정기 휴무일 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveClosedDayRange = async () => {
    try {
      getDateKeyRange(removeStartDate, removeEndDate);

      const { count, error: countError } = await supabase
        .from('salon_closed_dates')
        .select('id', { count: 'exact', head: true })
        .gte('closed_date', removeStartDate)
        .lte('closed_date', removeEndDate);

      if (countError) throw countError;

      const shouldProceed = window.confirm(
        `선택 기간의 모든 휴무일 ${count || 0}건을 해제합니다.\n해제해도 기존 취소 예약은 자동복구되지 않습니다.\n계속할까요?`
      );

      if (!shouldProceed) {
        return;
      }

      setRemoving(true);

      const { data, error } = await supabase.rpc('remove_closed_day_range', {
        p_start_date: removeStartDate,
        p_end_date: removeEndDate,
      });

      if (error) throw error;

      setFeedbackMessage(`휴무일 ${data?.removed_days || 0}일이 해제되었습니다.`);
      await fetchClosedDates();
      await calculateImpact();
    } catch (error) {
      console.error('휴무일 해제 오류:', error);
      setFeedbackMessage(error?.message || '휴무일 해제 중 오류가 발생했습니다.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="page-content" style={{ paddingTop: 12 }}>
      <header className={styles.header}>
        <h1 className="heading-xl">설정</h1>
        <p className="caption">
          직원 권한과 영업시간, 기본 시술, 휴무일, 데이터 백업을 관리합니다.
        </p>
      </header>

      <Link
        href="/settings/team"
        prefetch={false}
        className={`card ${styles.teamEntry}`}
        aria-label="직원 및 권한 관리로 이동"
      >
        <span className={styles.teamEntryIcon} aria-hidden="true">
          <ShieldCheck size={22} />
        </span>
        <span className={styles.teamEntryCopy}>
          <strong>직원 및 권한 관리</strong>
          <span>직원을 초대하고 원장·직원 역할을 관리합니다.</span>
        </span>
        <ChevronRight size={20} className={styles.teamEntryArrow} aria-hidden="true" />
      </Link>

      <section className={`card ${styles.card}`}>
        <div className="section-header">
          <div>
            <h2 className="heading-md">예약 기본 서비스</h2>
            <p className="caption">새 예약에서 먼저 선택할 서비스와 시간 단위입니다.</p>
          </div>
          {loadingSettings ? <Loader2 size={18} className="animate-spin text-tertiary" /> : null}
        </div>

        <div className="form-group">
          <label className="form-label">예약 기본 서비스</label>
          <div className="form-input">
            <select
              value={operationSettings.default_service_id}
              onChange={(e) => {
                const selectedService = serviceDefaults.find(
                  (service) => service.id === e.target.value
                );
                setOperationSettings((prev) => ({
                  ...prev,
                  default_service_id: selectedService?.id || '',
                  default_service_name: selectedService?.name || prev.default_service_name,
                }));
              }}
              disabled={loadingSettings || savingOperation}
              className="w-full h-full bg-transparent appearance-none"
            >
              <option value="">활성 서비스를 선택해주세요</option>
              {serviceDefaults.map((service) => (
                <option key={service.id} value={service.id} disabled={!service.is_active}>
                  {service.name}{service.is_active ? '' : ' (비활성)'}
                </option>
              ))}
            </select>
          </div>
          <p className={styles.policyText}>
            이름으로 자동 연결하지 않습니다. 선택한 서비스 ID와 현재 이름을 함께 저장합니다.
          </p>
        </div>

        <div className={styles.splitRow}>
          <div className="form-group">
            <label className="form-label">기본 소요시간</label>
            <div className="form-input">
              <select
                value={operationSettings.default_duration_minutes}
                onChange={(e) =>
                  setOperationSettings((prev) => ({
                    ...prev,
                    default_duration_minutes: Number(e.target.value),
                  }))
                }
                disabled={loadingSettings || savingOperation}
                className="w-full h-full bg-transparent appearance-none"
              >
                {DURATION_MINUTE_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatDurationMinutes(minutes)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">예약 슬롯 간격</label>
            <div className="form-input">
              <select
                value={operationSettings.appointment_slot_minutes}
                onChange={(e) =>
                  setOperationSettings((prev) => ({
                    ...prev,
                    appointment_slot_minutes: Number(e.target.value),
                  }))
                }
                disabled={loadingSettings || savingOperation}
                className="w-full h-full bg-transparent appearance-none"
              >
                {SLOT_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes}분
                  </option>
                ))}
              </select>
              <Clock size={18} color="var(--text-tertiary)" />
            </div>
          </div>
        </div>

        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleSaveOperationSettings}
          disabled={loadingSettings || savingOperation}
        >
          {savingOperation ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          <span>기본 예약값 저장</span>
        </button>
      </section>

      <section className={`card ${styles.card}`}>
        <div className="section-header">
          <div>
            <h2 className="heading-md">영업시간</h2>
            <p className="caption">confirmed 예약은 이 시간 밖에서 저장되지 않습니다.</p>
          </div>
        </div>

        <div className={styles.businessHoursList}>
          {businessHours.map((row) => {
            const weekday = WEEKDAY_OPTIONS.find((option) => option.value === row.weekday);
            return (
              <div key={row.weekday} className={styles.businessHourRow}>
                <label className={styles.openToggle}>
                  <input
                    type="checkbox"
                    checked={row.is_open}
                    onChange={(e) => updateBusinessHour(row.weekday, { is_open: e.target.checked })}
                    disabled={loadingSettings || savingBusinessHours}
                  />
                  <span>{weekday?.label}</span>
                </label>

                {row.is_open ? (
                  <div className={styles.timeGrid}>
                    <input
                      type="time"
                      aria-label={`${weekday?.label} 영업 시작`}
                      value={row.open_time}
                      onChange={(e) => updateBusinessHour(row.weekday, { open_time: e.target.value })}
                      disabled={loadingSettings || savingBusinessHours}
                    />
                    <input
                      type="time"
                      aria-label={`${weekday?.label} 영업 종료`}
                      value={row.close_time}
                      onChange={(e) => updateBusinessHour(row.weekday, { close_time: e.target.value })}
                      disabled={loadingSettings || savingBusinessHours}
                    />
                    <input
                      type="time"
                      aria-label={`${weekday?.label} 휴게 시작`}
                      value={row.break_start}
                      onChange={(e) => updateBusinessHour(row.weekday, { break_start: e.target.value })}
                      disabled={loadingSettings || savingBusinessHours}
                    />
                    <input
                      type="time"
                      aria-label={`${weekday?.label} 휴게 종료`}
                      value={row.break_end}
                      onChange={(e) => updateBusinessHour(row.weekday, { break_end: e.target.value })}
                      disabled={loadingSettings || savingBusinessHours}
                    />
                  </div>
                ) : (
                  <span className={styles.closedLabel}>휴무</span>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleSaveBusinessHours}
          disabled={loadingSettings || savingBusinessHours}
        >
          {savingBusinessHours ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          <span>영업시간 저장</span>
        </button>
      </section>

      <section className={`card ${styles.card}`}>
        <div className="section-header">
          <div>
            <h2 className="heading-md">서비스 마스터</h2>
            <p className="caption">가격 미설정과 0원은 서로 다르게 저장됩니다.</p>
          </div>
          <span className="badge badge-green">
            {serviceDefaults.filter((service) => service.is_active).length}/{serviceDefaults.length} 활성
          </span>
        </div>

        <div className={styles.serviceList}>
          {loadingSettings ? (
            <div className={styles.empty} role="status">
              <Loader2 size={18} className="animate-spin" />
              <span>서비스를 불러오는 중입니다.</span>
            </div>
          ) : serviceDefaults.length === 0 ? (
            <div className={styles.empty}>등록된 서비스가 없습니다. 아래에서 첫 서비스를 추가해주세요.</div>
          ) : (
            serviceDefaults.map((service) => (
              <div
                key={service.id}
                className={`${styles.serviceRow} ${!service.is_active ? styles.serviceRowInactive : ''}`}
              >
                <div className={styles.serviceSummary}>
                  <div>
                    <strong>{service.name || '이름 없는 서비스'}</strong>
                    <span className={!service.is_active ? styles.inactiveText : undefined}>
                      {service.is_active ? '활성' : '비활성'} · {formatPriceKrw(service.price_krw)}
                    </span>
                  </div>
                  <span className={styles.durationBadge}>
                    {formatDurationMinutes(service.default_duration_minutes)}
                  </span>
                </div>
                <div className={styles.serviceInputs}>
                  <label className={`${styles.serviceField} ${styles.serviceNameField}`}>
                    <span>서비스명</span>
                    <div className="form-input">
                      <input
                        value={service.name}
                        onChange={(e) => updateServiceDefault(service.id, { name: e.target.value })}
                        disabled={loadingSettings || savingServices}
                      />
                    </div>
                  </label>
                  <label className={styles.serviceField}>
                    <span>가격 (원)</span>
                    <div className="form-input">
                      <input
                        type="number"
                        min="0"
                        max={MAX_KRW_INTEGER}
                        step="1"
                        inputMode="numeric"
                        placeholder="미설정"
                        value={service.price_krw ?? ''}
                        onChange={(e) => updateServiceDefault(service.id, { price_krw: e.target.value })}
                        disabled={loadingSettings || savingServices}
                        aria-label={`${service.name} 가격`}
                      />
                    </div>
                  </label>
                  <label className={styles.serviceField}>
                    <span>기본 소요시간</span>
                    <div className="form-input">
                      <select
                        value={service.default_duration_minutes}
                        onChange={(e) =>
                          updateServiceDefault(service.id, {
                            default_duration_minutes: Number(e.target.value),
                          })
                        }
                        disabled={loadingSettings || savingServices}
                        className="w-full h-full bg-transparent appearance-none"
                      >
                        {DURATION_MINUTE_OPTIONS.map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {formatDurationMinutes(minutes)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                </div>
                <div className={styles.serviceActions}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => handleSaveServiceDefault(service)}
                    disabled={savingServices}
                    aria-label={`${service.name} 저장`}
                  >
                    <Save size={16} />
                    <span>저장</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconButton} ${service.is_active ? styles.deactivateButton : styles.reactivateButton}`}
                    onClick={() => handleToggleServiceDefault(service)}
                    disabled={savingServices}
                    aria-label={`${service.name} ${service.is_active ? '비활성화' : '재활성화'}`}
                  >
                    {service.is_active ? <Power size={16} /> : <RotateCcw size={16} />}
                    <span>{service.is_active ? '비활성화' : '재활성화'}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.addServiceRow}>
          <h3>새 서비스 추가</h3>
          <label className={`${styles.serviceField} ${styles.serviceNameField}`}>
            <span>서비스명</span>
            <div className="form-input">
              <input
                placeholder="예: 여성 커트"
                value={newService.name}
                onChange={(e) => setNewService((prev) => ({ ...prev, name: e.target.value }))}
                disabled={savingServices}
              />
            </div>
          </label>
          <label className={styles.serviceField}>
            <span>가격 (원)</span>
            <div className="form-input">
              <input
                type="number"
                min="0"
                max={MAX_KRW_INTEGER}
                step="1"
                inputMode="numeric"
                placeholder="미설정"
                value={newService.price_krw}
                onChange={(e) => setNewService((prev) => ({ ...prev, price_krw: e.target.value }))}
                disabled={savingServices}
              />
            </div>
          </label>
          <label className={styles.serviceField}>
            <span>기본 소요시간</span>
            <div className="form-input">
              <select
                value={newService.default_duration_minutes}
                onChange={(e) =>
                  setNewService((prev) => ({
                    ...prev,
                    default_duration_minutes: Number(e.target.value),
                  }))
                }
                disabled={savingServices}
                className="w-full h-full bg-transparent appearance-none"
              >
                {DURATION_MINUTE_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatDurationMinutes(minutes)}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <button
            type="button"
            className={styles.addButton}
            onClick={handleAddServiceDefault}
            disabled={savingServices}
            aria-label="서비스 추가"
          >
            {savingServices ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            <span>서비스 추가</span>
          </button>
        </div>
        <p className={styles.policyText}>
          사용한 서비스는 삭제하지 않고 비활성화합니다. 기존 예약의 당시 서비스명과 가격은 유지됩니다.
        </p>
      </section>

      {settingsFeedback ? (
        <div className={styles.feedbackBox} role="status" aria-live="polite">
          <AlertCircle size={16} />
          <span>{settingsFeedback}</span>
        </div>
      ) : null}

      <section className={`card ${styles.card}`}>
        <h2 className="heading-md">휴무일 등록</h2>

        <div className={styles.modeTabs}>
          <button
            type="button"
            className={`${styles.modeButton} ${mode === CLOSED_DAY_MODE.SINGLE ? styles.modeButtonActive : ''}`}
            onClick={() => setMode(CLOSED_DAY_MODE.SINGLE)}
            disabled={saving || removing}
          >
            단일
          </button>
          <button
            type="button"
            className={`${styles.modeButton} ${mode === CLOSED_DAY_MODE.RANGE ? styles.modeButtonActive : ''}`}
            onClick={() => setMode(CLOSED_DAY_MODE.RANGE)}
            disabled={saving || removing}
          >
            기간
          </button>
          <button
            type="button"
            className={`${styles.modeButton} ${mode === CLOSED_DAY_MODE.WEEKLY ? styles.modeButtonActive : ''}`}
            onClick={() => setMode(CLOSED_DAY_MODE.WEEKLY)}
            disabled={saving || removing}
          >
            정기
          </button>
        </div>

        {mode === CLOSED_DAY_MODE.SINGLE ? (
          <div className="form-group">
            <label className="form-label">휴무일 날짜</label>
            <div className="form-input">
              <input
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                disabled={saving || removing}
              />
            </div>
          </div>
        ) : (
          <>
            <div className={styles.splitRow}>
              <div className="form-group">
                <label className="form-label">시작일</label>
                <div className="form-input">
                  <input
                    type="date"
                    value={periodStartDate}
                    onChange={(e) => setPeriodStartDate(e.target.value)}
                    disabled={saving || removing}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">종료일</label>
                <div className="form-input">
                  <input
                    type="date"
                    value={periodEndDate}
                    onChange={(e) => setPeriodEndDate(e.target.value)}
                    disabled={saving || removing}
                  />
                </div>
              </div>
            </div>

            {mode === CLOSED_DAY_MODE.WEEKLY ? (
              <div className="form-group">
                <label className="form-label">정기휴무 요일</label>
                <div className="form-input">
                  <select
                    value={weeklyDay}
                    onChange={(e) => setWeeklyDay(Number(e.target.value))}
                    disabled={saving || removing}
                    className="w-full h-full bg-transparent appearance-none"
                  >
                    {WEEKDAY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
          </>
        )}

        <div className="form-group">
          <label className="form-label">메모 (선택)</label>
          <div className="form-input form-textarea">
            <textarea
              placeholder="예: 세미나, 직원교육, 인테리어 공사"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={saving || removing}
            />
          </div>
        </div>

        <div className={styles.impactCard}>
          <p className="caption">저장 전 영향도</p>
          <p className={styles.impactValue}>
            {calculatingImpact ? '계산 중...' : `취소 예정 confirmed 예약: ${impactCount}건`}
          </p>
          {mode === CLOSED_DAY_MODE.SINGLE ? (
            <p className={styles.policyText}>단일 저장은 confirmed 예약을 선택 취소한 뒤 진행합니다.</p>
          ) : (
            <p className={styles.policyText}>대상 휴무일 {targetDatesPreviewCount}일 · 기간/정기 저장 시 confirmed 예약은 일괄 취소됩니다.</p>
          )}
        </div>

        {mode !== CLOSED_DAY_MODE.SINGLE ? (
          <div className={styles.warningBox}>
            <AlertCircle size={16} />
            <span>기간/정기 저장 시 confirmed 예약이 일괄 취소됩니다.</span>
          </div>
        ) : null}

        {feedbackMessage ? (
          <div className={styles.feedbackBox}>
            <AlertCircle size={16} />
            <span>{feedbackMessage}</span>
          </div>
        ) : null}

        <div className={styles.actions}>
          {mode === CLOSED_DAY_MODE.SINGLE ? (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleOpenConflictSheet}
              disabled={checkingConflicts || saving || removing}
            >
              {checkingConflicts ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>확인 중...</span>
                </>
              ) : (
                <span>충돌 예약 확인</span>
              )}
            </button>
          ) : null}

          <button
            type="button"
            className="btn-primary"
            onClick={mode === CLOSED_DAY_MODE.SINGLE ? handleApplySingleClosedDay : handleApplyBatchClosedDays}
            disabled={saving || removing}
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>저장 중...</span>
              </>
            ) : (
              <span>휴무일 저장</span>
            )}
          </button>
        </div>
      </section>

      <section className={`card ${styles.card}`}>
        <h2 className="heading-md">휴무일 해제</h2>
        <div className={styles.splitRow}>
          <div className="form-group">
            <label className="form-label">해제 시작일</label>
            <div className="form-input">
              <input
                type="date"
                value={removeStartDate}
                onChange={(e) => setRemoveStartDate(e.target.value)}
                disabled={saving || removing}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">해제 종료일</label>
            <div className="form-input">
              <input
                type="date"
                value={removeEndDate}
                onChange={(e) => setRemoveEndDate(e.target.value)}
                disabled={saving || removing}
              />
            </div>
          </div>
        </div>

        <div className={styles.warningBox}>
          <AlertCircle size={16} />
          <span>선택 기간의 모든 휴무일이 해제됩니다.</span>
        </div>
        <p className={styles.policyText}>해제해도 기존 취소 예약은 자동복구되지 않습니다.</p>

        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleRemoveClosedDayRange}
          disabled={saving || removing}
        >
          {removing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>해제 중...</span>
            </>
          ) : (
            <span>기간 휴무일 해제</span>
          )}
        </button>
      </section>

      <section className={`card ${styles.card}`}>
        <div className="section-header">
          <h2 className="heading-md">등록된 휴무일 (단일/기간/정기)</h2>
          {!loadingClosedDays && <span className="badge badge-green">{closedDates.length}건</span>}
        </div>

        {loadingClosedDays ? (
          <div className="flex-center" style={{ padding: 28 }}>
            <Loader2 size={20} className="animate-spin text-tertiary" />
          </div>
        ) : closedDates.length === 0 ? (
          <div className={styles.empty}>등록된 휴무일이 없습니다.</div>
        ) : (
          <div className={styles.closedDateList}>
            {closedDates.map((item) => (
              <div key={item.id} className={styles.closedDateItem}>
                <p className="body-sm">{formatKoreanDate(item.closed_date)}</p>
                <p className="caption">{item.note || '메모 없음'}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <DataBackupCard />

      <ClosedDayConflictSheet
        open={sheetOpen}
        dateKey={singleDate}
        conflicts={conflicts}
        selectedIds={selectedConflictIds}
        onToggle={toggleConflict}
        onClose={() => setSheetOpen(false)}
        onConfirm={handleApplySingleClosedDay}
        saving={saving}
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthGate allowedRoles={['owner']}>
      <SettingsPageContent />
    </AuthGate>
  );
}
