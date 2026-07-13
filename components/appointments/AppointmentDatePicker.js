'use client';

import { useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './AppointmentDatePicker.module.css';
import {
  addDaysToDateKey,
  formatDateKey,
  formatKoreanDate,
  getDaysInKstMonth,
  getFirstWeekdayOfKstMonth,
  KOREAN_WEEKDAYS_SHORT,
  parseDateKey,
} from '@/lib/dateTime';

const DAYS = KOREAN_WEEKDAYS_SHORT;

export default function AppointmentDatePicker({
  id,
  value,
  onChange,
  disabledDates,
  disabled = false,
}) {
  const cursorInitial = parseDateKey(value);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(cursorInitial);

  const weeks = useMemo(() => {
    const daysInMonth = getDaysInKstMonth(cursor.year, cursor.monthIndex);
    const firstDay = getFirstWeekdayOfKstMonth(cursor.year, cursor.monthIndex);

    const rows = [];
    let currentWeek = new Array(firstDay).fill(null);

    for (let day = 1; day <= daysInMonth; day += 1) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        rows.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      rows.push(currentWeek);
    }

    return rows;
  }, [cursor.monthIndex, cursor.year]);

  const isDisabledDate = (dateKey) => disabledDates?.has(dateKey);

  return (
    <>
      <button
        id={id}
        type="button"
        className={styles.trigger}
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{formatKoreanDate(value)}</span>
        <Calendar size={18} color="var(--text-tertiary)" />
      </button>

      {open ? (
        <div className={styles.overlay} role="presentation" onClick={() => setOpen(false)}>
          <section
            className={styles.picker}
            role="dialog"
            aria-modal="true"
            aria-label="예약 날짜 선택"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <button
                type="button"
                className={styles.navBtn}
                aria-label="이전 달"
                onClick={() => {
                  if (cursor.monthIndex === 0) {
                    setCursor({ year: cursor.year - 1, month: 12, monthIndex: 11 });
                    return;
                  }
                  setCursor((prev) => ({ ...prev, month: prev.month - 1, monthIndex: prev.monthIndex - 1 }));
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <h4 className="body-md">{cursor.year}년 {cursor.month}월</h4>
              <button
                type="button"
                className={styles.navBtn}
                aria-label="다음 달"
                onClick={() => {
                  if (cursor.monthIndex === 11) {
                    setCursor({ year: cursor.year + 1, month: 1, monthIndex: 0 });
                    return;
                  }
                  setCursor((prev) => ({ ...prev, month: prev.month + 1, monthIndex: prev.monthIndex + 1 }));
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className={styles.grid}>
              {DAYS.map((day) => (
                <div key={day} className={styles.dayLabel}>{day}</div>
              ))}
              {weeks.flat().map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className={styles.emptyCell} />;
                }

                const nextDate = formatDateKey(cursor.year, cursor.monthIndex, day);
                const selected = nextDate === value;
                const blocked = isDisabledDate(nextDate);

                return (
                  <button
                    key={nextDate}
                    type="button"
                    className={`${styles.dateCell} ${selected ? styles.selected : ''} ${blocked ? styles.disabled : ''}`}
                    onClick={() => {
                      if (blocked) return;
                      onChange(nextDate);
                      setOpen(false);
                    }}
                    disabled={blocked}
                    aria-label={`${cursor.year}년 ${cursor.month}월 ${day}일${blocked ? ', 선택할 수 없음' : ''}`}
                    aria-pressed={selected}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className={styles.todayBtn}
              onClick={() => {
                let candidate = addDaysToDateKey(value, 0);
                for (let i = 0; i < 30; i += 1) {
                  if (!isDisabledDate(candidate)) {
                    onChange(candidate);
                    setCursor(parseDateKey(candidate));
                    return;
                  }
                  candidate = addDaysToDateKey(candidate, 1);
                }
              }}
            >
              가능한 가장 빠른 날짜로 이동
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
