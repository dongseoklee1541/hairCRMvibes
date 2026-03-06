'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, ChevronDown, ChevronRight, Search, Plus, Check, Clock, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AppointmentDatePicker from '@/components/appointments/AppointmentDatePicker';
import { addDaysToDateKey, getTodayKstDateKey } from '@/lib/dateTime';
import { buildClosedDateSet, isClosedDate } from '@/lib/appointmentRules';
import styles from './page.module.css';

const PHONE_HELP_TEXT = '숫자만 넣어도 돼요. 저장할 때 -를 자동으로 넣어드려요.';
const PHONE_ERROR_TEXT = '형식이 맞지 않습니다. 휴대폰은 010/011... 시작, 유선은 02, 031, 032... 형태입니다.';

function toPhoneDigits(raw) {
  return (raw || '').replace(/\D/g, '');
}

function normalizeKoreanPhone(raw) {
  const digits = toPhoneDigits(raw);

  if (!digits) {
    return { normalized: '', isValid: false, hasValue: false };
  }

  if (digits.startsWith('02')) {
    if (digits.length === 9) {
      return { normalized: `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`, isValid: true, hasValue: true };
    }
    if (digits.length === 10) {
      return { normalized: `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`, isValid: true, hasValue: true };
    }
    return { normalized: digits, isValid: false, hasValue: true };
  }

  if (/^01[0-9]{2}\d+$/.test(digits)) {
    if (digits.length === 10) {
      return { normalized: `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`, isValid: true, hasValue: true };
    }
    if (digits.length === 11) {
      return { normalized: `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`, isValid: true, hasValue: true };
    }
    return { normalized: digits, isValid: false, hasValue: true };
  }

  if (/^0[3-6][0-9]\d+$/.test(digits)) {
    if (digits.length === 9) {
      return { normalized: `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`, isValid: true, hasValue: true };
    }
    if (digits.length === 10) {
      return { normalized: `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`, isValid: true, hasValue: true };
    }
    if (digits.length === 11) {
      return { normalized: `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`, isValid: true, hasValue: true };
    }
    return { normalized: digits, isValid: false, hasValue: true };
  }

  return { normalized: digits, isValid: false, hasValue: true };
}

function NewAppointmentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerIdFromQuery = searchParams.get('customerId');

  const [loading, setLoading] = useState(false);
  const [fetchingCustomers, setFetchingCustomers] = useState(true);
  const [fetchingClosedDays, setFetchingClosedDays] = useState(true);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [closedDateSet, setClosedDateSet] = useState(new Set());
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickPhoneError, setQuickPhoneError] = useState('');
  const [quickCreateForm, setQuickCreateForm] = useState({
    name: '',
    phone: '',
  });

  const [formData, setFormData] = useState({
    customer_id: '',
    date: getTodayKstDateKey(),
    time: '10:00',
    service: '',
    duration: '1시간',
    memo: '',
  });

  const filteredCustomers = useMemo(() => {
    const query = customerSearchQuery.trim();
    if (!query) {
      return customers;
    }

    const lowerQuery = query.toLowerCase();
    const queryDigits = toPhoneDigits(query);

    return customers.filter((customer) => {
      const nameMatched = (customer.name || '').toLowerCase().includes(lowerQuery);
      if (nameMatched) {
        return true;
      }

      if (!queryDigits) {
        return false;
      }

      return toPhoneDigits(customer.phone).includes(queryDigits);
    });
  }, [customers, customerSearchQuery]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === formData.customer_id) || null,
    [customers, formData.customer_id]
  );

  const shouldShowQuickCreate =
    customers.length === 0 || showQuickCreate || (customerSearchQuery.trim().length > 0 && filteredCustomers.length === 0);

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

  const fetchCustomers = useCallback(
    async (preferredCustomerId = '') => {
      try {
        setFetchingCustomers(true);
        const { data, error } = await supabase
          .from('customers')
          .select('id, name, phone')
          .order('name');

        if (error) throw error;

        const customerList = data || [];
        setCustomers(customerList);
        setFormData((prev) => {
          const preferred = preferredCustomerId || customerIdFromQuery;
          if (preferred && customerList.some((customer) => customer.id === preferred)) {
            return { ...prev, customer_id: preferred };
          }

          if (prev.customer_id && customerList.some((customer) => customer.id === prev.customer_id)) {
            return prev;
          }

          if (customerList.length === 0) {
            return { ...prev, customer_id: '' };
          }

          return { ...prev, customer_id: customerList[0].id };
        });
      } catch (error) {
        console.error('Error fetching customers:', error);
      } finally {
        setFetchingCustomers(false);
      }
    },
    [customerIdFromQuery]
  );

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

  useEffect(() => {
    fetchCustomers();
    fetchClosedDays();
  }, [fetchCustomers, fetchClosedDays]);

  useEffect(() => {
    if (customers.length === 0) {
      setShowQuickCreate(true);
    }
  }, [customers.length]);

  const preventInnerSubmitOnEnter = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleQuickPhoneChange = (value) => {
    setQuickCreateForm((prev) => ({ ...prev, phone: value }));

    if (!quickPhoneError) {
      return;
    }

    const normalized = normalizeKoreanPhone(value);
    if (!normalized.hasValue || normalized.isValid) {
      setQuickPhoneError('');
      return;
    }
    setQuickPhoneError(PHONE_ERROR_TEXT);
  };

  const handleQuickPhoneBlur = () => {
    const normalized = normalizeKoreanPhone(quickCreateForm.phone);
    if (!normalized.hasValue) {
      setQuickPhoneError('');
      return;
    }
    setQuickPhoneError(normalized.isValid ? '' : PHONE_ERROR_TEXT);
  };

  const handleSelectCustomer = (customerId) => {
    setFormData((prev) => ({ ...prev, customer_id: customerId }));
    setShowQuickCreate(false);
  };

  const handleCreateCustomer = async () => {
    const name = quickCreateForm.name.trim();
    if (!name) {
      alert('이름을 입력해주세요.');
      return;
    }

    const normalized = normalizeKoreanPhone(quickCreateForm.phone);
    if (normalized.hasValue && !normalized.isValid) {
      setQuickPhoneError(PHONE_ERROR_TEXT);
      return;
    }

    try {
      setCreatingCustomer(true);

      if (normalized.hasValue) {
        const { data: existingByPhone, error: existingByPhoneError } = await supabase
          .from('customers')
          .select('id, name, phone')
          .eq('phone', normalized.normalized)
          .order('created_at', { ascending: false })
          .limit(1);

        if (existingByPhoneError) throw existingByPhoneError;

        const matchedCustomer = existingByPhone?.[0];
        if (matchedCustomer) {
          setFormData((prev) => ({ ...prev, customer_id: matchedCustomer.id }));
          setCustomerSearchQuery('');
          setShowQuickCreate(false);
          setQuickPhoneError('');
          setQuickCreateForm({ name: '', phone: '' });
          return;
        }
      }

      const { data: createdCustomer, error: createError } = await supabase
        .from('customers')
        .insert([
          {
            name,
            phone: normalized.hasValue ? normalized.normalized : '',
            memo: '',
          },
        ])
        .select('id, name, phone')
        .single();

      if (createError) throw createError;

      await fetchCustomers(createdCustomer.id);
      setCustomerSearchQuery('');
      setShowQuickCreate(false);
      setQuickPhoneError('');
      setQuickCreateForm({ name: '', phone: '' });
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('고객 등록 중 오류가 발생했습니다.');
    } finally {
      setCreatingCustomer(false);
    }
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
            duration: formData.duration,
            memo: formData.memo,
            status: 'confirmed',
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
      <div className={styles.header}>
        <button onClick={() => router.back()} className="btn-icon btn-icon-sm" disabled={loading}>
          <X size={22} color="var(--text-primary)" />
        </button>
        <h1 className="heading-md">새 예약</h1>
        <div style={{ width: 36 }} />
      </div>

      <form onSubmit={handleSubmit} className={styles.formContainer}>
        <div className={`card ${styles.formCard}`}>
          <div className="form-group">
            <div className={styles.customerHeader}>
              <label className="form-label">고객 선택</label>
              <button
                type="button"
                className={styles.quickCreateTrigger}
                onClick={() => setShowQuickCreate((prev) => !prev)}
                disabled={loading || creatingCustomer || fetchingCustomers}
              >
                원하는 고객이 없어요
              </button>
            </div>

            <div className={styles.customerSearch}>
              <Search size={16} />
              <input
                type="text"
                placeholder="이름 또는 전화번호로 검색"
                value={customerSearchQuery}
                onChange={(event) => setCustomerSearchQuery(event.target.value)}
                disabled={loading || fetchingCustomers || creatingCustomer}
              />
            </div>

            {fetchingCustomers ? (
              <div className={styles.customerLoading}>
                <Loader2 size={16} className="animate-spin text-tertiary" />
                <span className="caption">고객 목록 불러오는 중...</span>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className={styles.customerEmptyState}>
                <p className="caption">검색 결과가 없습니다.</p>
              </div>
            ) : (
              <div className={styles.customerList}>
                {filteredCustomers.map((customer) => {
                  const selected = customer.id === formData.customer_id;
                  return (
                    <button
                      key={customer.id}
                      type="button"
                      className={`${styles.customerRow} ${selected ? styles.customerRowSelected : ''}`}
                      onClick={() => handleSelectCustomer(customer.id)}
                      disabled={loading || creatingCustomer}
                    >
                      <div className={styles.customerRowInfo}>
                        <span className={styles.customerName}>{customer.name}</span>
                        <span className={styles.customerPhone}>{customer.phone || '전화번호 없음'}</span>
                      </div>
                      {selected ? (
                        <Check size={16} color="var(--accent-primary)" />
                      ) : (
                        <ChevronRight size={16} color="var(--text-tertiary)" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedCustomer ? (
              <p className={styles.selectedCustomerHint}>
                선택됨: {selectedCustomer.name}
                {selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ''}
              </p>
            ) : (
              <p className={styles.selectedCustomerHintError}>예약할 고객을 먼저 선택하거나 생성해주세요.</p>
            )}

            {shouldShowQuickCreate ? (
              <div className={styles.quickCreateCard}>
                <p className={styles.quickCreateTitle}>원하는 고객이 없나요? 바로 등록하세요.</p>

                <div className="form-group">
                  <label className="form-label">이름 (필수)</label>
                  <div className="form-input">
                    <input
                      value={quickCreateForm.name}
                      onChange={(event) => setQuickCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                      onKeyDown={preventInnerSubmitOnEnter}
                      placeholder="고객명 입력"
                      disabled={loading || creatingCustomer}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">전화번호 (선택)</label>
                  <div className="form-input">
                    <input
                      type="tel"
                      placeholder="010-0000-0000 또는 02-000-0000"
                      value={quickCreateForm.phone}
                      onChange={(event) => handleQuickPhoneChange(event.target.value)}
                      onBlur={handleQuickPhoneBlur}
                      onKeyDown={preventInnerSubmitOnEnter}
                      disabled={loading || creatingCustomer}
                    />
                  </div>
                  <div className={styles.quickPhoneGuides}>
                    {quickPhoneError ? <p className={styles.quickPhoneError}>{PHONE_ERROR_TEXT}</p> : null}
                    <p>{PHONE_HELP_TEXT}</p>
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.quickCreateButton}
                  onClick={handleCreateCustomer}
                  disabled={loading || creatingCustomer || !quickCreateForm.name.trim()}
                >
                  {creatingCustomer ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Plus size={18} />
                      <span>고객 생성 후 자동 선택</span>
                    </>
                  )}
                </button>
              </div>
            ) : null}
          </div>

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

          <div className="form-group">
            <label className="form-label">예약 시간</label>
            <div className="form-input">
              <input
                type="time"
                value={formData.time}
                onChange={(event) => setFormData({ ...formData, time: event.target.value })}
                disabled={loading}
              />
              <Clock size={18} color="var(--text-tertiary)" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">시술 내용</label>
            <div className="form-input">
              <input
                placeholder="예: 커트, 염색 등"
                value={formData.service}
                onChange={(event) => setFormData({ ...formData, service: event.target.value })}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">예상 소요시간</label>
            <div className="form-input">
              <select
                value={formData.duration}
                onChange={(event) => setFormData({ ...formData, duration: event.target.value })}
                disabled={loading}
                className="w-full h-full bg-transparent appearance-none"
              >
                <option value="30분">30분</option>
                <option value="1시간">1시간</option>
                <option value="1시간 30분">1시간 30분</option>
                <option value="2시간">2시간</option>
                <option value="2시간 30분">2시간 30분</option>
                <option value="3시간">3시간</option>
              </select>
              <ChevronDown size={18} color="var(--text-tertiary)" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ color: 'var(--text-tertiary)' }}>메모 (선택)</label>
            <div className="form-input form-textarea">
              <textarea
                placeholder="특이사항 입력"
                value={formData.memo}
                onChange={(event) => setFormData({ ...formData, memo: event.target.value })}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={loading || fetchingCustomers || fetchingClosedDays || creatingCustomer || !formData.customer_id}
        >
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
    <Suspense
      fallback={(
        <div className="page-content flex-center" style={{ height: '80vh' }}>
          <Loader2 size={32} className="animate-spin text-tertiary" />
        </div>
      )}
    >
      <NewAppointmentForm />
    </Suspense>
  );
}
