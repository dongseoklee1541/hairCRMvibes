'use client';

import { useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './AppointmentDatePicker.module.css';
import { addDaysToDateKey, formatKoreanDate } from '@/lib/dateTime';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getFirstDay(year, month) {
  return new Date(year, month, 1).getDay();
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function parseDateKey(dateKey) {
  const [year, month] = dateKey.split('-').map(Number);
  return { year, month: month - 1 };
}

export default function AppointmentDatePicker({
  value,
  onChange,
  disabledDates,
  disabled = false,
}) {
  const cursorInitial = parseDateKey(value);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(cursorInitial);

  const weeks = useMemo(() => {
    const daysInMonth = getDaysInMonth(cursor.year, cursor.month);
    const firstDay = getFirstDay(cursor.year, cursor.month);

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
  }, [cursor.month, cursor.year]);

  const isDisabledDate = (dateKey) => disabledDates?.has(dateKey);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
      >
        <span>{formatKoreanDate(value)}</span>
        <Calendar size={18} color="var(--text-tertiary)" />
      </button>

      {open ? (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.picker} onClick={(e) => e.stopPropagation()}>
            <div className={styles.header}>
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => {
                  if (cursor.month === 0) {
                    setCursor({ year: cursor.year - 1, month: 11 });
                    return;
                  }
                  setCursor((prev) => ({ ...prev, month: prev.month - 1 }));
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <h4 className="body-md">{cursor.year}년 {cursor.month + 1}월</h4>
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => {
                  if (cursor.month === 11) {
                    setCursor({ year: cursor.year + 1, month: 0 });
                    return;
                  }
                  setCursor((prev) => ({ ...prev, month: prev.month + 1 }));
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

                const nextDate = formatDateKey(cursor.year, cursor.month, day);
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
          </div>
        </div>
      ) : null}
    </>
  );
}
