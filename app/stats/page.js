'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Loader2,
  RefreshCw,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  differenceInDateKeys,
  formatKoreanShortDate,
  getKstMonthRange,
  getTodayKstCalendarParts,
} from '@/lib/dateTime';
import styles from './page.module.css';

const currencyFormatter = new Intl.NumberFormat('ko-KR');

function getInitialRange() {
  const today = getTodayKstCalendarParts();
  const { startDate, endDate } = getKstMonthRange(today.year, today.monthIndex);
  return { startDate, endDate };
}

function formatCurrency(value) {
  return `${currencyFormatter.format(Number(value) || 0)}원`;
}

function formatNullableCurrency(value) {
  return value === null || value === undefined ? '데이터 없음' : formatCurrency(value);
}

function formatNullableRate(value) {
  return value === null || value === undefined ? '데이터 없음' : `${Number(value).toFixed(1)}%`;
}

function normalizeSummary(data) {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

function validateRange({ startDate, endDate }) {
  if (!startDate || !endDate) return '시작일과 종료일을 모두 선택해 주세요.';
  if (endDate < startDate) return '종료일은 시작일보다 빠를 수 없습니다.';
  if (differenceInDateKeys(endDate, startDate) > 365) {
    return '조회 기간은 시작일과 종료일을 포함해 최대 366일입니다.';
  }
  return '';
}

export default function StatsPage() {
  const initialRangeRef = useRef(getInitialRange());
  const requestSequenceRef = useRef(0);
  const [appliedRange, setAppliedRange] = useState(initialRangeRef.current);
  const [draftRange, setDraftRange] = useState(initialRangeRef.current);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('loading');
  const [requestError, setRequestError] = useState('');
  const [formError, setFormError] = useState('');
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);

  const fetchSummary = useCallback(async (range) => {
    const requestId = ++requestSequenceRef.current;
    setStatus('loading');
    setRequestError('');

    const { data, error } = await supabase.rpc('get_stats_summary', {
      p_start_date: range.startDate,
      p_end_date: range.endDate,
    });

    if (requestId !== requestSequenceRef.current) return;

    if (error) {
      console.error('Error fetching stats summary:', error);
      setSummary(null);
      setRequestError('통계를 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.');
      setStatus('error');
      return;
    }

    const nextSummary = normalizeSummary(data);
    if (!nextSummary) {
      setSummary(null);
      setRequestError('통계 응답을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
      setStatus('error');
      return;
    }

    setSummary(nextSummary);
    setStatus('success');
  }, []);

  useEffect(() => {
    fetchSummary(initialRangeRef.current);
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [fetchSummary]);

  const openPeriodSheet = () => {
    setDraftRange(appliedRange);
    setFormError('');
    setIsPeriodOpen(true);
  };

  const closePeriodSheet = () => {
    setFormError('');
    setIsPeriodOpen(false);
  };

  const applyPeriod = (event) => {
    event.preventDefault();
    const validationError = validateRange(draftRange);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const nextRange = { ...draftRange };
    setAppliedRange(nextRange);
    setIsPeriodOpen(false);
    setFormError('');
    fetchSummary(nextRange);
  };

  const retry = () => fetchSummary(appliedRange);
  const completedCount = Number(summary?.completed_count || 0);
  const missingActualPriceCount = Number(summary?.missing_actual_price_completed_count || 0);
  const zeroActualPriceCount = Number(summary?.zero_actual_price_completed_count || 0);
  const snapshotPricedCount = Number(summary?.booking_snapshot_priced_completed_count || 0);
  const services = Array.isArray(summary?.service_breakdown) ? summary.service_breakdown : [];
  const isEmpty = status === 'success' && completedCount === 0;

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className="heading-xl">통계</h1>
          <p className={styles.headerHint}>완료 예약의 실제 시술금액 기준</p>
        </div>
        <button
          type="button"
          className={styles.periodButton}
          onClick={openPeriodSheet}
          aria-haspopup="dialog"
        >
          <CalendarDays size={17} aria-hidden="true" />
          <span>{formatKoreanShortDate(appliedRange.startDate)}–{formatKoreanShortDate(appliedRange.endDate)}</span>
        </button>
      </header>

      <main className="page-content" aria-busy={status === 'loading'}>
        {status === 'loading' && (
          <section className={styles.stateCard} aria-live="polite">
            <Loader2 size={30} className={styles.spinner} aria-hidden="true" />
            <h2 className="heading-md">통계를 집계하고 있어요</h2>
            <p className="body-sm text-tertiary">선택한 기간의 완료 예약만 안전하게 계산합니다.</p>
          </section>
        )}

        {status === 'error' && (
          <section className={`${styles.stateCard} ${styles.errorCard}`} role="alert">
            <AlertCircle size={34} aria-hidden="true" />
            <h2 className="heading-md">통계를 불러오지 못했어요</h2>
            <p className="body-sm">{requestError}</p>
            <button type="button" className={styles.retryButton} onClick={retry}>
              <RefreshCw size={17} aria-hidden="true" />
              다시 시도
            </button>
          </section>
        )}

        {isEmpty && (
          <section className={styles.stateCard} aria-live="polite">
            <BarChart3 size={36} className={styles.emptyIcon} aria-hidden="true" />
            <h2 className="heading-md">완료된 예약이 없습니다</h2>
            <p className="body-sm text-tertiary">기간을 바꾸거나 예약 상태를 확인해 주세요.</p>
            <button type="button" className={styles.secondaryButton} onClick={openPeriodSheet}>
              <CalendarDays size={17} aria-hidden="true" />
              기간 다시 선택
            </button>
          </section>
        )}

        {status === 'success' && !isEmpty && summary && (
          <>
            <section className={styles.kpiGrid} aria-label="핵심 통계">
              <article className={`${styles.kpiCard} ${styles.kpiPrimary}`}>
                <span className={styles.kpiIcon}><WalletCards size={18} aria-hidden="true" /></span>
                <span className={styles.kpiLabel}>실제 매출</span>
                <strong className={styles.kpiValue}>{formatCurrency(summary.actual_revenue_krw)}</strong>
                <span className={styles.kpiMeta}>실제 금액 입력 완료 건만 합산</span>
              </article>

              <article className={styles.kpiCard}>
                <span className={styles.kpiLabel}>유료 객단가</span>
                <strong className={styles.kpiValue}>{formatNullableCurrency(summary.actual_average_ticket_krw)}</strong>
                <span className={styles.kpiMeta}>유료 실제금액 {Number(summary.paid_actual_completed_count || 0)}건 기준</span>
              </article>

              <article className={styles.kpiCard}>
                <span className={styles.kpiLabel}>완료 예약</span>
                <strong className={styles.kpiValue}>{completedCount}건</strong>
                <span className={styles.kpiMeta}>선택 기간 내 완료 처리</span>
              </article>

              <article className={styles.kpiCard}>
                <span className={styles.kpiLabel}>재방문 고객률</span>
                <strong className={styles.kpiValue}>{formatNullableRate(summary.repeat_rate)}</strong>
                <span className={styles.kpiMeta}>
                  {Number(summary.repeat_customer_count || 0)}명 / {Number(summary.completed_customer_count || 0)}명
                </span>
              </article>
            </section>

            {missingActualPriceCount > 0 ? (
              <section className={styles.qualityWarning} role="status">
                <AlertCircle size={20} aria-hidden="true" />
                <div>
                  <strong>실제 금액 미입력 {missingActualPriceCount}건은 실제 매출에서 제외됐어요</strong>
                  <p>
                    전체 완료의 {formatNullableRate(summary.missing_actual_price_rate)} · 서비스 미연결 {Number(summary.missing_actual_price_without_service_count || 0)}건,
                    연결 서비스 {Number(summary.missing_actual_price_with_service_count || 0)}건
                  </p>
                </div>
              </section>
            ) : (
              <section className={styles.qualityComplete} role="status">
                <CheckCircle2 size={19} aria-hidden="true" />
                <span>완료 예약의 실제 금액이 모두 입력되어 있습니다.</span>
              </section>
            )}

            {zeroActualPriceCount > 0 && (
              <p className={styles.zeroPriceNote}>실제 0원 완료 {zeroActualPriceCount}건은 무료 시술로 포함하며 유료 객단가에서 제외합니다.</p>
            )}

            <section className={styles.snapshotNote} aria-label="예약 기준금액 보조 지표">
              <strong>예약 기준금액 합계 {formatCurrency(summary.booking_snapshot_revenue_krw)}</strong>
              <span>예약 당시 기본가격이 있는 완료 {snapshotPricedCount}건의 보조 지표이며 실제 매출에는 사용하지 않습니다.</span>
            </section>

            <section>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className="heading-md">서비스별 성과</h2>
                  <p className={styles.sectionHint}>완료 건수 상위 5개</p>
                </div>
                <UsersRound size={20} className={styles.sectionIcon} aria-hidden="true" />
              </div>
              <div className={styles.serviceList}>
                {services.map((service, index) => (
                  <article className={styles.serviceItem} key={`${service.service_name}-${index}`}>
                    <span className={styles.serviceRank}>{index + 1}</span>
                    <div className={styles.serviceInfo}>
                      <strong>{service.service_name}</strong>
                      <span>{Number(service.completed_count || 0)}건 · 실제 매출 {formatCurrency(service.actual_revenue_krw)}</span>
                    </div>
                    <div className={styles.serviceMetric}>
                      <span>유료 객단가</span>
                      <strong>{formatNullableCurrency(service.actual_average_ticket_krw)}</strong>
                      {Number(service.missing_actual_price_count || 0) > 0 && (
                        <em>실제 금액 미입력 {Number(service.missing_actual_price_count)}건</em>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {isPeriodOpen && (
        <div className={styles.sheetBackdrop} onMouseDown={closePeriodSheet}>
          <section
            className={styles.periodSheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby="period-sheet-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.sheetHandle} aria-hidden="true" />
            <div className={styles.sheetHeader}>
              <div>
                <h2 id="period-sheet-title" className="heading-md">조회 기간 선택</h2>
                <p className={styles.sheetHint}>한국 표준시 기준 · 최대 366일</p>
              </div>
              <button type="button" className={styles.closeButton} onClick={closePeriodSheet} aria-label="기간 선택 닫기">
                <X size={22} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={applyPeriod} noValidate>
              <div className={styles.dateFields}>
                <label>
                  <span>시작일</span>
                  <input
                    type="date"
                    value={draftRange.startDate}
                    onChange={(event) => setDraftRange((current) => ({ ...current, startDate: event.target.value }))}
                  />
                </label>
                <label>
                  <span>종료일</span>
                  <input
                    type="date"
                    value={draftRange.endDate}
                    onChange={(event) => setDraftRange((current) => ({ ...current, endDate: event.target.value }))}
                  />
                </label>
              </div>
              {formError && <p className={styles.formError} role="alert">{formError}</p>}
              <button type="submit" className={styles.applyButton}>이 기간으로 조회</button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
