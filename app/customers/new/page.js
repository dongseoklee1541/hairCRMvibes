'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

export default function NewCustomerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    memo: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      alert('이름을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('customers')
        .insert([
          {
            name: formData.name,
            phone: formData.phone,
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
                placeholder="010-0000-0000"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                disabled={loading}
              />
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
