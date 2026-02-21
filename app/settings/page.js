'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import AuthGate from '@/components/AuthGate';
import ClosedDayConflictSheet from '@/components/settings/ClosedDayConflictSheet';
import { supabase } from '@/lib/supabase';
import {
  APPOINTMENT_STATUS,
  buildBatchTargetDates,
  extractCancellableIds,
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

  const [closedDates, setClosedDates] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [selectedConflictIds, setSelectedConflictIds] = useState([]);

  const [loadingClosedDays, setLoadingClosedDays] = useState(true);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [calculatingImpact, setCalculatingImpact] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [impactCount, setImpactCount] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState('');

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
        <p className="caption">휴무일 등록/해제와 충돌 예약 정리를 설정합니다.</p>
      </header>

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
