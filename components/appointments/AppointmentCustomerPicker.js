'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Check, Loader2, Plus, Search, TriangleAlert } from 'lucide-react';
import styles from './AppointmentCustomerPicker.module.css';

function normalizeSearchTerm(value) {
  return value.trim().toLocaleLowerCase('ko-KR');
}

export const AppointmentCustomerPicker = forwardRef(function AppointmentCustomerPicker(
  {
    customers,
    value,
    onChange,
    onQuickCreate,
    onRetry,
    loading,
    error,
    disabled,
    successMessage,
  },
  ref
) {
  const inputRef = useRef(null);
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === value) || null,
    [customers, value]
  );
  const [query, setQuery] = useState(selectedCustomer?.name || '');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isComposing, setIsComposing] = useState(false);
  const normalizedQuery = normalizeSearchTerm(query);
  const filteredCustomers = useMemo(() => {
    const matches = normalizedQuery
      ? customers.filter((customer) =>
          normalizeSearchTerm(customer.name || '').includes(normalizedQuery)
        )
      : customers;
    return matches.slice(0, 50);
  }, [customers, normalizedQuery]);

  useImperativeHandle(ref, () => ({
    focus() {
      inputRef.current?.focus();
    },
  }));

  useEffect(() => {
    if (selectedCustomer && !isOpen) {
      setQuery(selectedCustomer.name);
    }
  }, [isOpen, selectedCustomer]);

  useEffect(() => {
    setActiveIndex(0);
  }, [normalizedQuery]);

  const selectCustomer = (customer) => {
    onChange(customer.id);
    setQuery(customer.name);
    setIsOpen(false);
  };

  const handleKeyDown = (event) => {
    if (isComposing || event.nativeEvent.isComposing) return;

    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(event.key === 'ArrowDown' ? 0 : Math.max(filteredCustomers.length - 1, 0));
        return;
      }
      setIsOpen(true);
      if (filteredCustomers.length === 0) return;
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) =>
        (current + delta + filteredCustomers.length) % filteredCustomers.length
      );
      return;
    }

    if (event.key === 'Enter' && isOpen && filteredCustomers[activeIndex]) {
      event.preventDefault();
      selectCustomer(filteredCustomers[activeIndex]);
    }
  };

  const listboxId = 'appointment-customer-listbox';
  const activeOptionId = filteredCustomers[activeIndex]
    ? `appointment-customer-option-${filteredCustomers[activeIndex].id}`
    : undefined;

  return (
    <div
      className={styles.picker}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <label className={styles.label} htmlFor="appointment-customer-search">
        고객 검색 <span>필수</span>
      </label>
      <div className={styles.inputWrap}>
        <Search size={19} aria-hidden="true" />
        <input
          ref={inputRef}
          id="appointment-customer-search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={isOpen ? activeOptionId : undefined}
          aria-describedby="appointment-customer-help"
          autoComplete="off"
          value={query}
          placeholder="고객 이름을 검색하세요"
          disabled={disabled || loading || Boolean(error)}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={(event) => {
            setIsComposing(false);
            setQuery(event.currentTarget.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        {loading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : null}
      </div>

      <p id="appointment-customer-help" className={styles.helpText}>
        예약할 고객의 이름을 입력하세요. 전화번호는 검색하지 않습니다.
      </p>

      {selectedCustomer ? (
        <div className={styles.selectedCustomer} aria-live="polite">
          <Check size={17} aria-hidden="true" />
          <span><strong>{selectedCustomer.name}</strong> 고객이 선택됐습니다.</span>
        </div>
      ) : null}

      {successMessage ? (
        <p className={styles.successMessage} role="status" aria-live="polite">
          {successMessage}
        </p>
      ) : null}

      {loading ? (
        <div className={styles.statePanel} role="status">
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
          고객 목록을 불러오는 중입니다.
        </div>
      ) : error ? (
        <div className={styles.errorPanel} role="alert">
          <TriangleAlert size={19} aria-hidden="true" />
          <div>
            <p>{error}</p>
            <button type="button" onClick={onRetry}>다시 불러오기</button>
          </div>
        </div>
      ) : isOpen ? (
        <div className={styles.popover}>
          <p className={styles.resultSummary} aria-live="polite">
            {normalizedQuery
              ? `‘${query.trim()}’ 검색 결과 ${filteredCustomers.length}명`
              : `활성 고객 ${customers.length}명`}
          </p>
          {filteredCustomers.length > 0 ? (
            <ul id={listboxId} role="listbox" className={styles.listbox}>
              {filteredCustomers.map((customer, index) => (
                <li
                  key={customer.id}
                  id={`appointment-customer-option-${customer.id}`}
                  role="option"
                  aria-selected={customer.id === value}
                  className={index === activeIndex ? styles.activeOption : ''}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectCustomer(customer)}
                >
                  <span>{customer.name}</span>
                  {customer.id === value ? <Check size={18} aria-hidden="true" /> : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.emptyState}>
              <p>일치하는 활성 고객이 없습니다.</p>
              <button type="button" onClick={() => onQuickCreate(query.trim())}>
                <Plus size={18} aria-hidden="true" />
                {query.trim() ? `‘${query.trim()}’ 고객 빠르게 등록` : '새 고객 빠르게 등록'}
              </button>
            </div>
          )}
          {filteredCustomers.length > 0 ? (
            <button type="button" className={styles.quickCreateButton} onClick={() => onQuickCreate(query.trim())}>
              <Plus size={18} aria-hidden="true" /> 새 고객 빠르게 등록
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
