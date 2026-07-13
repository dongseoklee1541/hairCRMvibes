'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, ChevronDown, Check, Clock, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AppointmentDatePicker from '@/components/appointments/AppointmentDatePicker';
import { AppointmentCustomerPicker } from '@/components/appointments/AppointmentCustomerPicker';
import { CustomerQuickCreateSheet } from '@/components/customers/CustomerQuickCreateSheet';
import { addDaysToDateKey, getTodayKstDateKey, getWeekdayFromDateKey } from '@/lib/dateTime';
import {
  buildClosedDateSet,
  DURATION_MINUTE_OPTIONS,
  findConflictingAppointment,
  formatDurationMinutes,
  isClosedDate,
  validateAppointmentBusinessHours,
} from '@/lib/appointmentRules';
import styles from './page.module.css';

function formatPriceKrw(value) {
  if (value === null || value === undefined) {
    return '가격 미설정';
  }
  if (Number(value) === 0) {
    return '0원(무료)';
  }
  return `${Number(value).toLocaleString('ko-KR')}원`;
}

function NewAppointmentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerIdFromQuery = searchParams.get('customerId');
  const customerPickerRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [fetchingCustomers, setFetchingCustomers] = useState(true);
  const [fetchingClosedDays, setFetchingClosedDays] = useState(true);
  const [fetchingSettings, setFetchingSettings] = useState(true);
  const [customerError, setCustomerError] = useState('');
  const [closedDaysError, setClosedDaysError] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [customers, setCustomers] = useState([]);
  const [quickCreateName, setQuickCreateName] = useState(null);
  const [customerSuccessMessage, setCustomerSuccessMessage] = useState('');
  const [closedDateSet, setClosedDateSet] = useState(new Set());
  const [serviceDefaults, setServiceDefaults] = useState([]);
  const [businessHours, setBusinessHours] = useState([]);
  const [operationSettings, setOperationSettings] = useState({
    default_service_id: '',
    default_service_name: '',
    default_duration_minutes: 60,
    appointment_slot_minutes: 30,
  });
  
  const [formData, setFormData] = useState({
    customer_id: '',
    date: getTodayKstDateKey(),
    time: '10:00',
    service_id: '',
    service: '',
    duration_minutes: 60,
    memo: '',
  });
  const [submitMessage, setSubmitMessage] = useState('');

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
      setCustomerError('');
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .is('archived_at', null)
        .order('name');
        
      if (error) throw error;
      setCustomers(data || []);
      
      // 쿼리 파라미터로 고객 ID가 넘어온 경우 자동 선택
      const requestedCustomer = data?.find((customer) => customer.id === customerIdFromQuery);
      setFormData((prev) => {
        const currentCustomer = data?.find((customer) => customer.id === prev.customer_id);
        const nextCustomerId = currentCustomer?.id || requestedCustomer?.id || data?.[0]?.id || '';
        return { ...prev, customer_id: nextCustomerId };
      });
    } catch (error) {
      console.error('Error fetching customers:', error);
      setCustomers([]);
      setCustomerError('고객 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setFetchingCustomers(false);
    }
  }, [customerIdFromQuery]);

  const fetchClosedDays = useCallback(async () => {
    try {
      setFetchingClosedDays(true);
      setClosedDaysError('');
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
      setClosedDaysError('휴무일 정보를 불러오지 못해 예약 등록을 중단했습니다.');
    } finally {
      setFetchingClosedDays(false);
    }
  }, [findNextAvailableDate]);

  const fetchAppointmentSettings = useCallback(async () => {
    try {
      setFetchingSettings(true);
      setSettingsError('');

      const [operationResult, serviceResult, businessHoursResult] = await Promise.all([
        supabase
          .from('salon_operation_settings')
          .select('default_service_id, default_service_name, default_duration_minutes, appointment_slot_minutes')
          .eq('id', true)
          .maybeSingle(),
        supabase
          .from('salon_service_defaults')
          .select('id, name, price_krw, default_duration_minutes, sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('salon_business_hours')
          .select('weekday, is_open, open_time, close_time, break_start, break_end')
          .order('weekday', { ascending: true }),
      ]);

      if (operationResult.error) throw operationResult.error;
      if (serviceResult.error) throw serviceResult.error;
      if (businessHoursResult.error) throw businessHoursResult.error;

      const nextOperationSettings = {
        default_service_id: operationResult.data?.default_service_id || '',
        default_service_name: operationResult.data?.default_service_name || '',
        default_duration_minutes: operationResult.data?.default_duration_minutes || 60,
        appointment_slot_minutes: operationResult.data?.appointment_slot_minutes || 30,
      };
      const nextServices = serviceResult.data || [];

      setOperationSettings(nextOperationSettings);
      setServiceDefaults(nextServices);
      setBusinessHours(businessHoursResult.data || []);
      setFormData((prev) => {
        const currentService = nextServices.find((service) => service.id === prev.service_id);
        if (currentService) {
          return prev;
        }

        const matchedService =
          nextServices.find((service) => service.id === nextOperationSettings.default_service_id) ||
          nextServices[0];

        return {
          ...prev,
          service_id: matchedService?.id || '',
          service: matchedService?.name || '',
          duration_minutes:
            matchedService?.default_duration_minutes || nextOperationSettings.default_duration_minutes,
        };
      });
    } catch (error) {
      console.error('Error fetching appointment settings:', error);
      setServiceDefaults([]);
      setFormData((prev) => ({ ...prev, service_id: '', service: '' }));
      setSettingsError('시술 목록을 불러오지 못했습니다. 예약을 등록할 수 없습니다.');
    } finally {
      setFetchingSettings(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
    fetchClosedDays();
    fetchAppointmentSettings();
  }, [fetchCustomers, fetchClosedDays, fetchAppointmentSettings]);

  const handleServiceChange = (serviceId) => {
    const matchedService = serviceDefaults.find((service) => service.id === serviceId);
    setFormData((prev) => ({
      ...prev,
      service_id: matchedService?.id || '',
      service: matchedService?.name || '',
      duration_minutes: matchedService?.default_duration_minutes || prev.duration_minutes,
    }));
  };

  const focusCustomerPicker = useCallback(() => {
    requestAnimationFrame(() => customerPickerRef.current?.focus());
  }, []);

  const addAndSelectCustomer = useCallback((customer, message) => {
    setCustomers((current) => {
      const withoutDuplicate = current.filter((item) => item.id !== customer.id);
      return [...withoutDuplicate, customer].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    });
    setFormData((current) => ({ ...current, customer_id: customer.id }));
    setCustomerSuccessMessage(message);
    setQuickCreateName(null);
    focusCustomerPicker();
  }, [focusCustomerPicker]);

  const selectedService = useMemo(
    () => serviceDefaults.find((service) => service.id === formData.service_id) || null,
    [formData.service_id, serviceDefaults]
  );

  const validateBeforeSubmit = async () => {
    if (isClosedDate(formData.date, closedDateSet)) {
      return '휴무일은 예약할 수 없습니다. 다른 날짜를 선택해주세요.';
    }

    const businessHoursMessage = validateAppointmentBusinessHours({
      dateKey: formData.date,
      time: formData.time,
      durationMinutes: formData.duration_minutes,
      businessHours,
      getWeekdayFromDateKey,
    });

    if (businessHoursMessage) {
      return businessHoursMessage;
    }

    const { data, error } = await supabase
      .from('appointments')
      .select('id, time, duration, duration_minutes, service, status, customers(name)')
      .eq('date', formData.date)
      .eq('status', 'confirmed')
      .order('time', { ascending: true });

    if (error) throw error;

    const conflict = findConflictingAppointment(data || [], {
      time: formData.time,
      durationMinutes: formData.duration_minutes,
    });

    if (conflict) {
      const conflictTime = conflict.time ? conflict.time.slice(0, 5) : '--:--';
      const customerName = conflict.customers?.name || '기존 고객';
      return `${conflictTime} ${customerName} · ${conflict.service || '예약'}과 시간이 겹칩니다.`;
    }

    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitMessage('');
    if (customerError || closedDaysError) {
      setSubmitMessage(customerError || closedDaysError);
      return;
    }
    if (settingsError || serviceDefaults.length === 0) {
      setSubmitMessage('예약 가능한 시술이 없습니다. 설정에서 시술을 준비한 뒤 다시 시도해주세요.');
      return;
    }
    if (!selectedService || !formData.service_id) {
      setSubmitMessage('예약할 시술을 선택해주세요.');
      return;
    }
    if (!formData.customer_id || !formData.date || !formData.time || !formData.service) {
      setSubmitMessage('모든 필수 항목을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      const validationMessage = await validateBeforeSubmit();
      if (validationMessage) {
        setSubmitMessage(validationMessage);
        return;
      }

      const { error } = await supabase
        .from('appointments')
        .insert([
          {
            customer_id: formData.customer_id,
            date: formData.date,
            time: formData.time,
            service_id: formData.service_id,
            service: formData.service,
            duration: formatDurationMinutes(formData.duration_minutes),
            duration_minutes: formData.duration_minutes,
            memo: formData.memo,
            status: 'confirmed'
          },
        ]);

      if (error) throw error;

      router.push('/appointments');
      router.refresh();
    } catch (error) {
      console.error('Error creating appointment:', error);
      setSubmitMessage(error?.message || '예약 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content" style={{ paddingTop: 12 }}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h1 className="heading-xl">새 예약</h1>
          <p>고객과 날짜, 시술을 순서대로 선택하세요.</p>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className={styles.closeButton}
          disabled={loading}
          aria-label="새 예약 닫기"
        >
          <X size={22} color="var(--text-primary)" aria-hidden="true" />
          <span>닫기</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className={styles.formContainer} aria-busy={loading}>
        <div className={`card ${styles.formCard}`}>
          <AppointmentCustomerPicker
            ref={customerPickerRef}
            customers={customers}
            value={formData.customer_id}
            onChange={(customerId) => {
              setFormData((current) => ({ ...current, customer_id: customerId }));
              setCustomerSuccessMessage('');
            }}
            onQuickCreate={(name) => setQuickCreateName(name)}
            onRetry={fetchCustomers}
            loading={fetchingCustomers}
            error={customerError}
            disabled={loading}
            successMessage={customerSuccessMessage}
          />

          {/* Date */}
          <div className="form-group">
            <label className="form-label" htmlFor="appointment-date">예약 날짜 <span className={styles.requiredText}>필수</span></label>
            <AppointmentDatePicker
                id="appointment-date"
                value={formData.date} 
                onChange={(nextDate) => setFormData({ ...formData, date: nextDate })}
                disabled={loading || fetchingClosedDays}
                disabledDates={closedDateSet}
            />
            <p className={styles.dateHelp}>
              {fetchingClosedDays
                ? '휴무일 정보를 불러오는 중입니다...'
                : closedDaysError || '휴무일은 달력에서 선택할 수 없도록 비활성화됩니다.'}
            </p>
          </div>

          {/* Time */}
          <div className="form-group">
            <label className="form-label" htmlFor="appointment-time">예약 시간 <span className={styles.requiredText}>필수</span></label>
            <div className="form-input">
              <input 
                id="appointment-time"
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
            <label className="form-label" htmlFor="appointment-service">시술 선택 <span className={styles.requiredText}>필수</span></label>
            {fetchingSettings ? (
              <div className={styles.serviceState} role="status">
                <Loader2 size={18} className="animate-spin" />
                <span>예약 가능한 시술을 불러오는 중입니다.</span>
              </div>
            ) : settingsError ? (
              <div className={styles.serviceStateError} role="alert">
                {settingsError}
              </div>
            ) : serviceDefaults.length === 0 ? (
              <div className={styles.serviceStateError} role="alert">
                예약 가능한 시술이 없습니다. 설정에서 시술을 추가하거나 다시 활성화한 뒤 예약해주세요.
              </div>
            ) : (
              <>
                <div className="form-input">
                  <select
                    id="appointment-service"
                    value={formData.service_id}
                    onChange={(e) => handleServiceChange(e.target.value)}
                    disabled={loading}
                    className="w-full h-full bg-transparent appearance-none"
                    required
                  >
                    {serviceDefaults.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} · {formatPriceKrw(service.price_krw)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} color="var(--text-tertiary)" />
                </div>
                <div
                  className={`${styles.servicePriceSummary} ${selectedService?.price_krw == null ? styles.servicePriceUnset : ''}`}
                  role="status"
                  aria-live="polite"
                >
                  <span>선택한 예약 금액</span>
                  <strong>{formatPriceKrw(selectedService?.price_krw)}</strong>
                </div>
                <p className={styles.dateHelp}>
                  선택한 시술명과 금액은 이 예약에 그대로 보관됩니다.
                </p>
              </>
            )}
          </div>

          {/* Duration */}
          <div className="form-group">
            <label className="form-label" htmlFor="appointment-duration">시술 시간 <span className={styles.requiredText}>필수</span></label>
            <div className="form-input">
              <select
                id="appointment-duration"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({...formData, duration_minutes: Number(e.target.value)})}
                disabled={loading || fetchingSettings || !selectedService}
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
              기본 시술 시간으로 시작합니다. 필요하면 이 예약에 맞게 바꿀 수 있습니다. (시간 간격 {operationSettings.appointment_slot_minutes}분)
            </p>
          </div>

          {/* Memo */}
          <div className="form-group">
            <label className="form-label" htmlFor="appointment-memo" style={{ color: 'var(--text-tertiary)' }}>메모 (선택)</label>
            <div className="form-input form-textarea">
              <textarea
                id="appointment-memo"
                placeholder="특이사항 입력"
                value={formData.memo}
                onChange={(e) => setFormData({...formData, memo: e.target.value})}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {submitMessage ? (
          <div className={styles.submitMessage} role="alert">
            {submitMessage}
          </div>
        ) : null}

        <button
          type="submit"
          className="btn-primary"
          disabled={
            loading ||
            fetchingCustomers ||
            fetchingClosedDays ||
            fetchingSettings ||
            Boolean(customerError) ||
            Boolean(closedDaysError) ||
            Boolean(settingsError) ||
            customers.length === 0 ||
            !selectedService
          }
        >
          {loading ? (
            <>
              <Loader2 size={20} className="animate-spin" aria-hidden="true" />
              <span>등록 중...</span>
            </>
          ) : (
            <>
              <Check size={20} aria-hidden="true" />
              <span>예약 등록</span>
            </>
          )}
        </button>
      </form>
      {quickCreateName !== null ? (
        <CustomerQuickCreateSheet
          initialName={quickCreateName}
          onClose={() => {
            setQuickCreateName(null);
            focusCustomerPicker();
          }}
          onCreated={(customer) => addAndSelectCustomer(
            customer,
            `${customer.name} 고객을 등록하고 예약 고객으로 선택했습니다.`
          )}
          onSelectExisting={(customer) => addAndSelectCustomer(
            customer,
            `${customer.name} 기존 고객을 예약 고객으로 선택했습니다.`
          )}
        />
      ) : null}
    </div>
  );
}

export default function NewAppointmentPage() {
  return (
    <Suspense fallback={
      <div className="page-content flex-center" style={{ height: '80vh' }}>
        <Loader2 size={32} className="animate-spin text-tertiary" aria-hidden="true" />
        <p className="body-md text-secondary">예약 화면을 준비하는 중입니다.</p>
      </div>
    }>
      <NewAppointmentForm />
    </Suspense>
  );
}
