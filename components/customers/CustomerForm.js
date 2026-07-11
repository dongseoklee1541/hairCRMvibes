'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Loader2, Search } from 'lucide-react';
import {
  PHONE_ERROR_TEXT,
  PHONE_EXAMPLE_TEXT,
  PHONE_HELP_TEXT,
  parseKoreanPhone,
} from '@/lib/customerPhone';
import styles from './CustomerForm.module.css';

const EMPTY_VALUES = { name: '', phone: '', memo: '' };

function getInitialValues(initialValues) {
  return {
    name: initialValues?.name ?? '',
    phone: initialValues?.phone ?? '',
    memo: initialValues?.memo ?? '',
  };
}

function getCandidateId(candidate) {
  return candidate.id ?? candidate.customer_id;
}

export function CustomerForm({
  initialValues = EMPTY_VALUES,
  mode = 'create',
  isSubmitting = false,
  submitError = '',
  checkDuplicateCandidates,
  onSubmit,
  onCancel,
  onOpenDuplicates,
  onDirtyChange,
}) {
  const baseline = useMemo(
    () => getInitialValues(initialValues),
    [initialValues?.name, initialValues?.phone, initialValues?.memo]
  );
  const [values, setValues] = useState(baseline);
  const [errors, setErrors] = useState({});
  const [duplicateState, setDuplicateState] = useState({
    status: 'idle',
    checkedDigits: '',
    candidates: [],
    message: '',
  });
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const duplicateRequestRef = useRef(0);

  const isDirty =
    values.name !== baseline.name ||
    values.phone !== baseline.phone ||
    values.memo !== baseline.memo;

  useEffect(() => {
    setValues(baseline);
    setErrors({});
    setDuplicateAcknowledged(false);
    setDuplicateState({ status: 'idle', checkedDigits: '', candidates: [], message: '' });
  }, [baseline]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const updateValue = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));

    if (field === 'phone') {
      duplicateRequestRef.current += 1;
      setDuplicateAcknowledged(false);
      setDuplicateState({ status: 'idle', checkedDigits: '', candidates: [], message: '' });
    }
  };

  const checkPhoneDuplicates = async (phoneResult) => {
    if (!phoneResult.hasValue || typeof checkDuplicateCandidates !== 'function') {
      setDuplicateState({
        status: 'checked',
        checkedDigits: phoneResult.digits,
        candidates: [],
        message: '',
      });
      return { ok: true, candidates: [] };
    }

    const requestId = duplicateRequestRef.current + 1;
    duplicateRequestRef.current = requestId;
    setDuplicateState((current) => ({
      ...current,
      status: 'checking',
      checkedDigits: phoneResult.digits,
      message: '',
    }));

    try {
      const result = await checkDuplicateCandidates(phoneResult.digits);
      const candidates = (Array.isArray(result) ? result : []).filter(getCandidateId);

      if (duplicateRequestRef.current !== requestId) {
        return { ok: false, stale: true, candidates: [] };
      }

      setDuplicateState({
        status: 'checked',
        checkedDigits: phoneResult.digits,
        candidates,
        message: '',
      });
      return { ok: true, candidates };
    } catch {
      if (duplicateRequestRef.current !== requestId) {
        return { ok: false, stale: true, candidates: [] };
      }

      setDuplicateState({
        status: 'error',
        checkedDigits: phoneResult.digits,
        candidates: [],
        message: '중복 고객을 확인하지 못했습니다. 다시 확인한 뒤 저장해주세요.',
      });
      return { ok: false, candidates: [] };
    }
  };

  const handlePhoneBlur = async () => {
    const phoneResult = parseKoreanPhone(values.phone);

    if (phoneResult.hasValue && !phoneResult.isValid) {
      setErrors((current) => ({ ...current, phone: PHONE_ERROR_TEXT }));
      return;
    }

    setErrors((current) => ({ ...current, phone: '' }));
    if (phoneResult.hasValue) {
      setValues((current) => ({ ...current, phone: phoneResult.formatted }));
    }
    await checkPhoneDuplicates(phoneResult);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const name = values.name.trim();
    const memo = values.memo.trim();
    const phoneResult = parseKoreanPhone(values.phone);
    const nextErrors = {};

    if (!name) {
      nextErrors.name = '고객 이름을 입력해주세요.';
    } else if (name.length > 80) {
      nextErrors.name = '고객 이름은 80자 이하로 입력해주세요.';
    }

    if (phoneResult.hasValue && !phoneResult.isValid) {
      nextErrors.phone = PHONE_ERROR_TEXT;
    }

    if (memo.length > 2000) {
      nextErrors.memo = '메모는 2,000자 이하로 입력해주세요.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    let duplicateResult = {
      ok: !phoneResult.hasValue || duplicateState.status === 'checked',
      candidates: duplicateState.candidates,
    };

    if (
      phoneResult.hasValue &&
      (duplicateState.checkedDigits !== phoneResult.digits || duplicateState.status !== 'checked')
    ) {
      duplicateResult = await checkPhoneDuplicates(phoneResult);
    }

    if (!duplicateResult.ok) {
      return;
    }

    if (duplicateResult.candidates.length > 0 && !duplicateAcknowledged) {
      setErrors((current) => ({
        ...current,
        duplicate: '동일한 전화번호를 함께 사용하는 고객인지 확인해주세요.',
      }));
      return;
    }

    setErrors({});
    await onSubmit({
      name,
      phone: phoneResult.hasValue ? phoneResult.formatted : '',
      phoneNormalized: phoneResult.digits || null,
      memo,
    });
  };

  const hasCandidates = duplicateState.candidates.length > 0;
  const saveDisabled =
    isSubmitting ||
    duplicateState.status === 'checking' ||
    !values.name.trim() ||
    (mode === 'edit' && !isDirty);

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.stateRow} aria-live="polite">
        <span className={`${styles.stateBadge} ${isDirty ? styles.stateBadgeDirty : ''}`}>
          {mode === 'edit' ? (isDirty ? '변경사항 있음' : '저장된 상태') : '새 고객'}
        </span>
        {mode === 'edit' && isDirty && (
          <span className={styles.stateHelp}>저장하지 않고 나가면 변경사항이 사라집니다.</span>
        )}
      </div>

      <div className={`card ${styles.formCard}`}>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="customer-name">
            이름 <span aria-hidden="true">*</span>
          </label>
          <input
            id="customer-name"
            className={`${styles.input} ${errors.name ? styles.inputError : ''} focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-70`}
            value={values.name}
            onChange={(event) => updateValue('name', event.target.value)}
            placeholder="고객명 입력"
            autoComplete="name"
            maxLength={80}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'customer-name-error' : undefined}
          />
          {errors.name && (
            <p id="customer-name-error" className={styles.errorText} role="alert">
              {errors.name}
            </p>
          )}
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="customer-phone">
            전화번호 <span className={styles.optional}>(선택)</span>
          </label>
          <div className={styles.phoneInputWrap}>
            <input
              id="customer-phone"
              className={`${styles.input} ${errors.phone ? styles.inputError : ''} focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-70`}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={(event) => updateValue('phone', event.target.value)}
              onBlur={handlePhoneBlur}
              placeholder="010-0000-0000"
              maxLength={20}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby="customer-phone-help customer-phone-status"
            />
            {duplicateState.status === 'checking' && (
              <Loader2 className={`${styles.inputStatusIcon} animate-spin`} size={18} aria-hidden="true" />
            )}
          </div>
          <div id="customer-phone-help" className={styles.helpText}>
            <span>{PHONE_HELP_TEXT}</span>
            <span>{PHONE_EXAMPLE_TEXT}</span>
          </div>
          <div id="customer-phone-status" aria-live="polite">
            {errors.phone && <p className={styles.errorText}>{errors.phone}</p>}
            {duplicateState.status === 'error' && (
              <div className={styles.inlineError} role="alert">
                <AlertTriangle size={18} aria-hidden="true" />
                <div>
                  <p>{duplicateState.message}</p>
                  <button type="button" onClick={handlePhoneBlur} disabled={isSubmitting}>
                    다시 확인
                  </button>
                </div>
              </div>
            )}
            {duplicateState.status === 'checked' && !hasCandidates && values.phone && (
              <p className={styles.successText}>
                <Check size={15} aria-hidden="true" /> 동일 번호의 활성 고객이 없습니다.
              </p>
            )}
          </div>
        </div>

        {hasCandidates && (
          <section className={styles.duplicatePanel} aria-labelledby="duplicate-warning-title">
            <div className={styles.duplicateHeading}>
              <AlertTriangle size={20} aria-hidden="true" />
              <div>
                <h2 id="duplicate-warning-title">같은 전화번호의 고객이 있습니다</h2>
                <p>자동으로 병합하지 않습니다. 기존 고객인지 먼저 확인해주세요.</p>
              </div>
            </div>
            <ul className={styles.candidateList}>
              {duplicateState.candidates.slice(0, 3).map((candidate) => (
                <li key={getCandidateId(candidate)}>
                  <span>{candidate.name || '이름 없는 고객'}</span>
                  <span>예약 {candidate.appointment_count ?? 0}건</span>
                </li>
              ))}
            </ul>
            <Link
              href="/customers/duplicates"
              prefetch={false}
              className={`${styles.compareLink} min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2`}
              onClick={(event) => {
                event.preventDefault();
                onOpenDuplicates();
              }}
            >
              <Search size={18} aria-hidden="true" /> 중복 고객 비교 화면 열기
            </Link>
            <label className={styles.acknowledgeRow}>
              <input
                type="checkbox"
                className="min-h-[22px] focus-visible:outline-2 focus-visible:outline-offset-2"
                checked={duplicateAcknowledged}
                onChange={(event) => {
                  setDuplicateAcknowledged(event.target.checked);
                  setErrors((current) => ({ ...current, duplicate: '' }));
                }}
              />
              <span>동일 번호를 함께 사용하는 별도 고객임을 확인했습니다.</span>
            </label>
            {errors.duplicate && (
              <p className={styles.errorText} role="alert">
                {errors.duplicate}
              </p>
            )}
          </section>
        )}

        <div className={styles.fieldGroup}>
          <div className={styles.labelRow}>
            <label className={styles.label} htmlFor="customer-memo">
              메모 <span className={styles.optional}>(선택)</span>
            </label>
            <span className={styles.counter}>{values.memo.length}/2,000</span>
          </div>
          <textarea
            id="customer-memo"
            className={`${styles.textarea} ${errors.memo ? styles.inputError : ''} focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-70`}
            value={values.memo}
            onChange={(event) => updateValue('memo', event.target.value)}
            placeholder="고객 특이사항, 선호 스타일 등"
            maxLength={2000}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.memo)}
            aria-describedby={errors.memo ? 'customer-memo-error' : undefined}
          />
          {errors.memo && (
            <p id="customer-memo-error" className={styles.errorText} role="alert">
              {errors.memo}
            </p>
          )}
        </div>
      </div>

      {submitError && (
        <div className={styles.submitError} role="alert">
          <AlertTriangle size={19} aria-hidden="true" />
          <span>{submitError}</span>
        </div>
      )}

      <div className={styles.actions}>
        {onCancel && (
          <button
            type="button"
            className={`${styles.secondaryButton} min-h-[56px] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-70`}
            onClick={onCancel}
            disabled={isSubmitting}
          >
            취소
          </button>
        )}
        <button
          type="submit"
          className={`${styles.primaryButton} min-h-[56px] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-70`}
          disabled={saveDisabled}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={20} className="animate-spin" aria-hidden="true" /> 저장 중
            </>
          ) : (
            <>
              <Check size={20} aria-hidden="true" />
              {mode === 'edit' ? '변경사항 저장' : '고객 등록'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
