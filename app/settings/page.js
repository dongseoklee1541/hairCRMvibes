'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import AuthGate from '@/components/AuthGate';
import ClosedDayConflictSheet from '@/components/settings/ClosedDayConflictSheet';
import { supabase } from '@/lib/supabase';
import { APPOINTMENT_STATUS, extractCancellableIds } from '@/lib/appointmentRules';
import { formatKoreanDate, getTodayKstDateKey } from '@/lib/dateTime';
import styles from './page.module.css';

function SettingsPageContent() {
  const [closedDate, setClosedDate] = useState(getTodayKstDateKey());
  const [note, setNote] = useState('');
  const [closedDates, setClosedDates] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [selectedConflictIds, setSelectedConflictIds] = useState([]);
  const [loadingClosedDays, setLoadingClosedDays] = useState(true);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const confirmedCount = useMemo(
    () => conflicts.filter((item) => item.status === APPOINTMENT_STATUS.CONFIRMED).length,
    [conflicts]
  );

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

  const fetchConflicts = useCallback(async () => {
    if (!closedDate) {
      setFeedbackMessage('휴무일 날짜를 먼저 선택해주세요.');
      return [];
    }

    try {
      setCheckingConflicts(true);
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          date,
          time,
          service,
          status,
          customers(name)
        `)
        .eq('date', closedDate)
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
  }, [closedDate]);

  useEffect(() => {
    fetchClosedDates();
  }, [fetchClosedDates]);

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

  const handleApplyClosedDay = async () => {
    if (!closedDate) {
      setFeedbackMessage('휴무일 날짜를 선택해주세요.');
      return;
    }

    if (confirmedCount > 0 && selectedConflictIds.length === 0) {
      setFeedbackMessage('confirmed 예약을 최소 1건 이상 선택해야 휴무일 저장이 가능합니다.');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase.rpc('apply_closed_day_with_cancellations', {
        p_closed_date: closedDate,
        p_cancel_ids: selectedConflictIds,
        p_note: note.trim() || null,
      });

      if (error) throw error;

      setFeedbackMessage(`${formatKoreanDate(closedDate)} 휴무일이 저장되었습니다.`);
      setConflicts([]);
      setSelectedConflictIds([]);
      setSheetOpen(false);
      await fetchClosedDates();
    } catch (error) {
      console.error('휴무일 저장 오류:', error);
      setFeedbackMessage(error?.message || '휴무일 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content" style={{ paddingTop: 12 }}>
      <header className={styles.header}>
        <h1 className="heading-xl">설정</h1>
        <p className="caption">휴무일과 충돌 예약 처리 정책을 관리합니다.</p>
      </header>

      <section className={`card ${styles.card}`}>
        <h2 className="heading-md">휴무일 추가</h2>

        <div className="form-group">
          <label className="form-label">휴무일 날짜</label>
          <div className="form-input">
            <input
              type="date"
              value={closedDate}
              onChange={(e) => setClosedDate(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">메모 (선택)</label>
          <div className="form-input form-textarea">
            <textarea
              placeholder="예: 세미나, 직원교육, 인테리어 공사"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        {feedbackMessage ? (
          <div className={styles.feedbackBox}>
            <AlertCircle size={16} />
            <span>{feedbackMessage}</span>
          </div>
        ) : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleOpenConflictSheet}
            disabled={checkingConflicts || saving}
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

          <button
            type="button"
            className="btn-primary"
            onClick={handleApplyClosedDay}
            disabled={saving}
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
        <div className="section-header">
          <h2 className="heading-md">등록된 휴무일</h2>
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
        dateKey={closedDate}
        conflicts={conflicts}
        selectedIds={selectedConflictIds}
        onToggle={toggleConflict}
        onClose={() => setSheetOpen(false)}
        onConfirm={handleApplyClosedDay}
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
