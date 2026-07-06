'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, ChevronDown, Check, Clock, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AppointmentDatePicker from '@/components/appointments/AppointmentDatePicker';
import { addDaysToDateKey, getTodayKstDateKey } from '@/lib/dateTime';
import {
  buildClosedDateSet,
  DURATION_MINUTE_OPTIONS,
  formatDurationMinutes,
  isClosedDate,
} from '@/lib/appointmentRules';
import styles from './page.module.css';

function NewAppointmentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerIdFromQuery = searchParams.get('customerId');
  
  const [loading, setLoading] = useState(false);
  const [fetchingCustomers, setFetchingCustomers] = useState(true);
  const [fetchingClosedDays, setFetchingClosedDays] = useState(true);
  const [fetchingSettings, setFetchingSettings] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [closedDateSet, setClosedDateSet] = useState(new Set());
  const [serviceDefaults, setServiceDefaults] = useState([]);
  const [operationSettings, setOperationSettings] = useState({
    default_service_name: '커트',
    default_duration_minutes: 60,
    appointment_slot_minutes: 30,
  });
  
  const [formData, setFormData] = useState({
    customer_id: '',
    date: getTodayKstDateKey(),
    time: '10:00',
    service: '',
    duration_minutes: 60,
    memo: '',
  });

  const findNextAvailableDate = useCallback((startDate, blockedSet) => {
    let candidate = startDate;
    for (let i = 0; i < 365; i += 1) {
      if (!blockedSet.has(candidate)) {
        return candidate;
      }
      candidate = addDaysToDateKey(candidate, 1);
    }
    return startDate;
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      setFetchingCustomers(true);
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .order('name');
        
      if (error) throw error;
      setCustomers(data || []);
      
      // 쿼리 파라미터로 고객 ID가 넘어온 경우 자동 선택
      if (customerIdFromQuery) {
        setFormData(prev => ({ ...prev, customer_id: customerIdFromQuery }));
      } else if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, customer_id: data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setFetchingCustomers(false);
    }
  }, [customerIdFromQuery]);

  const fetchClosedDays = useCallback(async () => {
    try {
      setFetchingClosedDays(true);
      const { data, error } = await supabase
        .from('salon_closed_dates')
        .select('closed_date');

      if (error) throw error;

      const nextClosedSet = buildClosedDateSet(data || []);
      setClosedDateSet(nextClosedSet);
      setFormData((prev) => {
        if (!nextClosedSet.has(prev.date)) {
          return prev;
        }
        return {
          ...prev,
          date: findNextAvailableDate(prev.date, nextClosedSet),
        };
      });
    } catch (error) {
      console.error('Error fetching closed days:', error);
    } finally {
      setFetchingClosedDays(false);
    }
  }, [findNextAvailableDate]);

  const fetchAppointmentSettings = useCallback(async () => {
    try {
      setFetchingSettings(true);

      const [operationResult, serviceResult] = await Promise.all([
        supabase
          .from('salon_operation_settings')
          .select('default_service_name, default_duration_minutes, appointment_slot_minutes')
          .eq('id', true)
          .maybeSingle(),
        supabase
          .from('salon_service_defaults')
          .select('id, name, default_duration_minutes, sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
      ]);

      if (operationResult.error) throw operationResult.error;
      if (serviceResult.error) throw serviceResult.error;

      const nextOperationSettings = {
        default_service_name: operationResult.data?.default_service_name || '커트',
        default_duration_minutes: operationResult.data?.default_duration_minutes || 60,
        appointment_slot_minutes: operationResult.data?.appointment_slot_minutes || 30,
      };
      const nextServices = serviceResult.data || [];

      setOperationSettings(nextOperationSettings);
      setServiceDefaults(nextServices);
      setFormData((prev) => {
        if (prev.service) {
          return prev;
        }

        const matchedService =
          nextServices.find((service) => service.name === nextOperationSettings.default_service_name) ||
          nextServices[0];

        return {
          ...prev,
          service: matchedService?.name || nextOperationSettings.default_service_name,
          duration_minutes:
            matchedService?.default_duration_minutes || nextOperationSettings.default_duration_minutes,
        };
      });
    } catch (error) {
      console.error('Error fetching appointment settings:', error);
    } finally {
      setFetchingSettings(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
    fetchClosedDays();
    fetchAppointmentSettings();
  }, [fetchCustomers, fetchClosedDays, fetchAppointmentSettings]);

  const handleServiceChange = (serviceName) => {
    const matchedService = serviceDefaults.find((service) => service.name === serviceName);
    setFormData((prev) => ({
      ...prev,
      service: serviceName,
      duration_minutes: matchedService?.default_duration_minutes || prev.duration_minutes,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer_id || !formData.date || !formData.time || !formData.service) {
      alert('모든 필수 항목을 입력해주세요.');
      return;
    }
    if (isClosedDate(formData.date, closedDateSet)) {
      alert('휴무일은 예약할 수 없습니다. 다른 날짜를 선택해주세요.');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('appointments')
        .insert([
          {
            customer_id: formData.customer_id,
            date: formData.date,
            time: formData.time,
            service: formData.service,
            duration: formatDurationMinutes(formData.duration_minutes),
            memo: formData.memo,
            status: 'confirmed'
          },
        ]);

      if (error) throw error;

      router.push('/appointments');
      router.refresh();
    } catch (error) {
      console.error('Error creating appointment:', error);
      alert('예약 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content" style={{ paddingTop: 12 }}>
      {/* Header */}
      <div className={styles.header}>
        <button onClick={() => router.back()} className="btn-icon btn-icon-sm" disabled={loading}>
          <X size={22} color="var(--text-primary)" />
        </button>
        <h1 className="heading-md">새 예약</h1>
        <div style={{ width: 36 }} />
      </div>

      <form onSubmit={handleSubmit} className={styles.formContainer}>
        <div className={`card ${styles.formCard}`}>
          {/* Customer */}
          <div className="form-group">
            <label className="form-label">고객 선택</label>
            <div className="form-input">
              <select 
                value={formData.customer_id} 
                onChange={(e) => setFormData({...formData, customer_id: e.target.value})}
                disabled={loading || fetchingCustomers}
                className="w-full h-full bg-transparent appearance-none"
                style={{ border: 'none', background: 'none' }}
              >
                {fetchingCustomers ? (
                  <option>로딩 중...</option>
                ) : (
                  customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))
                )}
              </select>
              <ChevronDown size={18} color="var(--text-tertiary)" />
            </div>
          </div>

          {/* Date */}
          <div className="form-group">
            <label className="form-label">예약 날짜</label>
            <AppointmentDatePicker
                value={formData.date} 
                onChange={(nextDate) => setFormData({ ...formData, date: nextDate })}
                disabled={loading || fetchingClosedDays}
                disabledDates={closedDateSet}
            />
            <p className={styles.dateHelp}>
              {fetchingClosedDays
                ? '휴무일 정보를 불러오는 중입니다...'
                : '휴무일은 달력에서 선택할 수 없도록 비활성화됩니다.'}
            </p>
          </div>

          {/* Time */}
          <div className="form-group">
            <label className="form-label">예약 시간</label>
            <div className="form-input">
              <input 
                type="time" 
                value={formData.time} 
                onChange={(e) => setFormData({...formData, time: e.target.value})} 
                disabled={loading}
              />
              <Clock size={18} color="var(--text-tertiary)" />
            </div>
          </div>

          {/* Service */}
          <div className="form-group">
            <label className="form-label">시술 내용</label>
            <div className="form-input">
              {serviceDefaults.length > 0 ? (
                <>
                  <select
                    value={formData.service}
                    onChange={(e) => handleServiceChange(e.target.value)}
                    disabled={loading || fetchingSettings}
                    className="w-full h-full bg-transparent appearance-none"
                    required
                  >
                    {serviceDefaults.map((service) => (
                      <option key={service.id} value={service.name}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} color="var(--text-tertiary)" />
                </>
              ) : (
                <input
                  placeholder={operationSettings.default_service_name || '예: 커트, 염색 등'}
                  value={formData.service}
                  onChange={(e) => setFormData({...formData, service: e.target.value})}
                  disabled={loading || fetchingSettings}
                  required
                />
              )}
            </div>
            <p className={styles.dateHelp}>
              {fetchingSettings
                ? '기본 시술을 불러오는 중입니다...'
                : '설정 페이지의 기본 시술 목록을 사용합니다.'}
            </p>
          </div>

          {/* Duration */}
          <div className="form-group">
            <label className="form-label">예상 소요시간</label>
            <div className="form-input">
              <select
                value={formData.duration_minutes}
                onChange={(e) => setFormData({...formData, duration_minutes: Number(e.target.value)})}
                disabled={loading || fetchingSettings}
                className="w-full h-full bg-transparent appearance-none"
              >
                {DURATION_MINUTE_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatDurationMinutes(minutes)}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} color="var(--text-tertiary)" />
            </div>
            <p className={styles.dateHelp}>
              기본값: {formatDurationMinutes(operationSettings.default_duration_minutes)} · 슬롯 {operationSettings.appointment_slot_minutes}분
            </p>
          </div>

          {/* Memo */}
          <div className="form-group">
            <label className="form-label" style={{ color: 'var(--text-tertiary)' }}>메모 (선택)</label>
            <div className="form-input form-textarea">
              <textarea
                placeholder="특이사항 입력"
                value={formData.memo}
                onChange={(e) => setFormData({...formData, memo: e.target.value})}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={loading || fetchingCustomers || fetchingClosedDays || fetchingSettings}>
          {loading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <>
              <Check size={20} />
              <span>예약 등록</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default function NewAppointmentPage() {
  return (
    <Suspense fallback={
      <div className="page-content flex-center" style={{ height: '80vh' }}>
        <Loader2 size={32} className="animate-spin text-tertiary" />
      </div>
    }>
      <NewAppointmentForm />
    </Suspense>
  );
}
