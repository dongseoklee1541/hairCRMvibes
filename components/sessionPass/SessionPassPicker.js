'use client';

import { Loader2, RotateCcw, TicketCheck } from 'lucide-react';
import {
  SESSION_PASS_STATUS_LABELS,
  SESSION_PASS_UNAVAILABLE_LABELS,
} from '@/lib/sessionPass';
import styles from './SessionPassPicker.module.css';

function optionLabel(option, currentPassId) {
  const current = option.id === currentPassId;
  const state = option.is_available || current
    ? `${option.remaining_sessions}/${option.total_sessions}회 남음`
    : SESSION_PASS_UNAVAILABLE_LABELS[option.unavailable_reason] || '사용 불가';
  return `${option.name} · ${state}${current ? ' · 현재 연결' : ''}`;
}

export function SessionPassPicker({
  id,
  options,
  value,
  onChange,
  loading = false,
  error = '',
  disabled = false,
  currentPassId = null,
  currentUsageState = null,
  onRetry,
  compact = false,
}) {
  const selected = options.find((option) => option.id === value) || null;
  const availableCount = options.filter((option) => option.is_available).length;

  return (
    <div className={`${styles.wrapper} ${compact ? styles.compact : ''}`}>
      <div className={styles.labelRow}>
        <label htmlFor={id}>횟수권 사용 <span>선택</span></label>
        {currentUsageState ? (
          <span className={styles.usageBadge}>
            {currentUsageState === 'consumed' ? '사용 완료' : '1회 예약 중'}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className={styles.state} role="status">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" /> 횟수권을 확인하는 중입니다.
        </div>
      ) : error ? (
        <div className={styles.error} role="alert">
          <span>{error}</span>
          {onRetry ? (
            <button type="button" onClick={onRetry} disabled={disabled}>
              <RotateCcw size={16} aria-hidden="true" /> 다시 시도
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className={styles.selectShell}>
            <TicketCheck size={19} aria-hidden="true" />
            <select
              id={id}
              value={value || ''}
              onChange={(event) => onChange(event.target.value)}
              disabled={disabled}
            >
              <option value="">횟수권 사용 안 함</option>
              {options.map((option) => (
                <option
                  key={option.id}
                  value={option.id}
                  disabled={!option.is_available && option.id !== currentPassId}
                >
                  {optionLabel(option, currentPassId)}
                </option>
              ))}
            </select>
          </div>
          <p className={styles.help} aria-live="polite">
            {selected
              ? `${selected.name}에서 1회를 ${currentUsageState === 'consumed' ? '사용 완료로 유지' : '예약'}합니다. 실제 시술금액은 별도입니다.`
              : options.length === 0
                ? '이 고객에게 등록된 횟수권이 없습니다.'
                : availableCount === 0
                  ? '현재 선택한 시술에 사용할 수 있는 횟수권이 없습니다.'
                  : '사용하지 않으면 횟수권 잔여는 바뀌지 않습니다.'}
          </p>
        </>
      )}
    </div>
  );
}
