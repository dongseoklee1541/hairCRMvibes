'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

const PHONE_HELP_TEXT = '숫자만 넣어도 돼요. 저장할 때 -를 자동으로 넣어드려요.';
const PHONE_EXAMPLE_TEXT = '예: 010-1234-5678, 02-123-4567';
const PHONE_ERROR_TEXT = '형식이 맞지 않습니다. 휴대폰은 010/011... 시작, 유선은 02, 031, 032... 형태입니다.';

// 1단계: 사용자가 입력한 문자열에서 숫자만 추출
// 2단계: 한국 휴대폰/유선 패턴으로 분기
// 3단계: 저장 직전 하이픈을 붙인 표준 형식으로 반환
function normalizeKoreanPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');

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

export default function NewCustomerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    memo: '',
  });
  const [phoneError, setPhoneError] = useState('');

  // 오입력 시 실시간으로만 에러를 갱신.
  // 정상값이 보이면 자동으로 빨간 에러 텍스트를 제거해 안내를 깔끔하게 유지한다.
  const handlePhoneChange = (value) => {
    setFormData({ ...formData, phone: value });
    if (phoneError) {
      const normalized = normalizeKoreanPhone(value);
      if (!normalized.hasValue || normalized.isValid) {
        setPhoneError('');
      } else {
        setPhoneError(PHONE_ERROR_TEXT);
      }
    }
  };

  // blur 시점 검증은 "입력 끝났을 때만" 에러를 보여줄 목적으로 사용.
  // 기본 가이드(도움말)는 별도 유지되며, 에러 텍스트는 실패 시에만 표시.
  const handlePhoneBlur = () => {
    const normalized = normalizeKoreanPhone(formData.phone);
    if (!normalized.hasValue) {
      setPhoneError('');
      return;
    }
    setPhoneError(normalized.isValid ? '' : PHONE_ERROR_TEXT);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      alert('이름을 입력해주세요.');
      return;
    }

    // 제출 전 마지막 정규화/검증 통과 뒤, `phone`만 하이픈 포맷으로 저장.
    const normalized = normalizeKoreanPhone(formData.phone);
    if (normalized.hasValue && !normalized.isValid) {
      setPhoneError(PHONE_ERROR_TEXT);
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('customers')
        .insert([
          {
            name: formData.name,
            phone: normalized.hasValue ? normalized.normalized : '',
            memo: formData.memo,
          },
        ]);

      if (error) throw error;

      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('고객 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content" style={{ paddingTop: 12 }}>
      {/* Header */}
      <div className={styles.header}>
        <button onClick={() => router.back()} className="flex-row gap-sm" disabled={loading}>
          <ChevronLeft size={22} />
          <span className="body-md">뒤로</span>
        </button>
        <h1 className="heading-md">새 고객 등록</h1>
        <div style={{ width: 40 }} />
      </div>

      <form onSubmit={handleSubmit} className={styles.formContainer}>
        <div className={`card ${styles.formCard}`}>
          <div className="form-group">
            <label className="form-label">이름</label>
            <div className="form-input">
              <input
                placeholder="고객명 입력"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                autoFocus
                required
                disabled={loading}
              />
            </div>
          </div>

            <div className="form-group">
              <label className="form-label">전화번호</label>
              <div className="form-input">
                <input
                  type="tel"
                  placeholder="010-0000-0000 또는 02-000-0000"
                  value={formData.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onBlur={handlePhoneBlur}
                  disabled={loading}
                />
              </div>
              <div className="caption text-tertiary" style={{ marginTop: 6, lineHeight: 1.35 }}>
                {phoneError ? (
                  <p style={{ margin: 0, color: '#D85B5B' }}>{PHONE_ERROR_TEXT}</p>
                ) : null}
                <p style={{ margin: 0 }}>{PHONE_HELP_TEXT}</p>
                <p style={{ margin: 0 }}>{PHONE_EXAMPLE_TEXT}</p>
              </div>
            </div>

          <div className="form-group">
            <label className="form-label">메모</label>
            <div className="form-input form-textarea">
              <textarea
                placeholder="고객 특이사항, 선호 스타일 등"
                value={formData.memo}
                onChange={(e) => setFormData({...formData, memo: e.target.value})}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={loading || !formData.name}>
          {loading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <>
              <Check size={20} />
              <span>등록 완료</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
