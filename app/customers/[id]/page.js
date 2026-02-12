'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Pencil, User, Loader2, Plus,
  X, Check, Calendar, Scissors, FileText
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

// 날짜 포맷 헬퍼
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return {
    short: `${month}.${day}`,
    day: days[date.getDay()],
    full: dateStr,
  };
}

// 등록일 포맷
function formatCreatedAt(dateStr) {
  const date = new Date(dateStr);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

// 상태 뱃지 컴포넌트
function StatusBadge({ status }) {
  const config = {
    completed: { label: '완료', className: styles.badgeCompleted },
    confirmed: { label: '예약', className: styles.badgeConfirmed },
    cancelled: { label: '취소', className: styles.badgeCancelled },
  };
  const { label, className } = config[status] || config.confirmed;
  return <span className={`${styles.badge} ${className}`}>{label}</span>;
}

// 시술 추가 모달
function AddHistoryModal({ customerId, onClose, onAdded }) {
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    date: today,
    time: '10:00',
    service: '',
    memo: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.service) {
      alert('시술명을 입력해주세요.');
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.from('appointments').insert([
        {
          customer_id: customerId,
          date: form.date,
          time: form.time,
          service: form.service,
          memo: form.memo,
          status: 'completed',
        },
      ]);
      if (error) throw error;
      onAdded();
    } catch (error) {
      console.error('Error adding history:', error);
      alert('시술 이력 추가 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className="heading-md">시술 이력 추가</h2>
          <button className={styles.modalCloseBtn} onClick={onClose}>
            <X size={20} className="text-secondary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">
              <Calendar size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              시술 날짜
            </label>
            <div className="form-input">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              <Scissors size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              시술명
            </label>
            <div className="form-input">
              <input
                placeholder="예: 커트, 염색, 펌 등"
                value={form.service}
                onChange={(e) => setForm({ ...form, service: e.target.value })}
                required
                autoFocus
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              <FileText size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              메모 (선택)
            </label>
            <div className="form-input form-textarea">
              <textarea
                placeholder="시술 관련 메모"
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !form.service}
            style={{ marginTop: 4 }}
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <Check size={20} />
                <span>이력 추가</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;

  const [customer, setCustomer] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // 메모 편집 상태
  const [editingMemo, setEditingMemo] = useState(false);
  const [memoText, setMemoText] = useState('');
  const [savingMemo, setSavingMemo] = useState(false);

  // 시술 추가 모달
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);

      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (customerError) throw customerError;
      setCustomer(customerData);
      setMemoText(customerData.memo || '');

      const { data: historyData, error: historyError } = await supabase
        .from('appointments')
        .select('*')
        .eq('customer_id', id)
        .order('date', { ascending: false })
        .order('time', { ascending: false });

      if (historyError) throw historyError;
      setHistory(historyData || []);
    } catch (error) {
      console.error('Error fetching customer detail:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 메모 저장
  const handleSaveMemo = async () => {
    try {
      setSavingMemo(true);
      const { error } = await supabase
        .from('customers')
        .update({ memo: memoText, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setCustomer((prev) => ({ ...prev, memo: memoText }));
      setEditingMemo(false);
    } catch (error) {
      console.error('Error saving memo:', error);
      alert('메모 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingMemo(false);
    }
  };

  // 시술 추가 후 리프레시
  const handleHistoryAdded = () => {
    setShowAddModal(false);
    fetchData();
  };

  if (loading) {
    return (
      <div className="page-content flex-center" style={{ height: '80vh' }}>
        <Loader2 size={32} className="animate-spin text-tertiary" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="page-content flex-center" style={{ height: '60vh', flexDirection: 'column' }}>
        <p className="body-md text-tertiary">고객 정보를 찾을 수 없습니다.</p>
        <button onClick={() => router.back()} className="text-accent" style={{ marginTop: 16 }}>
          뒤로 가기
        </button>
      </div>
    );
  }

  return (
    <div className="page-content" style={{ paddingTop: 12, paddingBottom: 24 }}>
      {/* Nav Bar */}
      <div className={styles.navBar}>
        <button onClick={() => router.back()} className="flex-row gap-sm">
          <ChevronLeft size={22} />
          <span className="body-md">뒤로</span>
        </button>
        <button
          className="btn-icon btn-icon-sm"
          style={{ background: 'var(--bg-surface)', boxShadow: 'var(--shadow-card)' }}
        >
          <Pencil size={16} className="text-secondary" />
        </button>
      </div>

      {/* Profile Card — 가로 배치 */}
      <div className={`card ${styles.profileCard} animate-fade-in`}>
        <div className="avatar avatar-lg">
          <User size={32} />
        </div>
        <div className={styles.profileInfo}>
          <h2 className="heading-lg">{customer.name}</h2>
          <p className="body-sm text-secondary">{customer.phone}</p>
          {customer.created_at && (
            <p className="caption">등록일: {formatCreatedAt(customer.created_at)}</p>
          )}
        </div>
      </div>

      {/* 특이사항 메모 */}
      <section className={styles.section}>
        <div className="section-header">
          <h3 className="heading-md">특이사항</h3>
          {!editingMemo && (
            <button className={styles.editTag} onClick={() => setEditingMemo(true)}>
              <Pencil size={14} />
              <span>편집</span>
            </button>
          )}
        </div>
        <div className="card card-padded" style={{ marginTop: 12 }}>
          {editingMemo ? (
            <>
              <textarea
                className={styles.memoEditArea}
                value={memoText}
                onChange={(e) => setMemoText(e.target.value)}
                placeholder="고객 특이사항을 입력하세요&#10;예: 두피 민감, 선호 스타일, 알레르기 등"
                autoFocus
                disabled={savingMemo}
              />
              <div className={styles.memoActions}>
                <button
                  className={`${styles.memoBtn} ${styles.memoBtnCancel}`}
                  onClick={() => {
                    setMemoText(customer.memo || '');
                    setEditingMemo(false);
                  }}
                  disabled={savingMemo}
                >
                  취소
                </button>
                <button
                  className={`${styles.memoBtn} ${styles.memoBtnSave}`}
                  onClick={handleSaveMemo}
                  disabled={savingMemo}
                >
                  {savingMemo ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>저장</span>
                </button>
              </div>
            </>
          ) : (
            <p
              className="body-sm text-secondary"
              style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}
            >
              {customer.memo || '메모가 없습니다. 편집 버튼을 눌러 추가하세요.'}
            </p>
          )}
        </div>
      </section>

      {/* 시술 이력 */}
      <section className={styles.section}>
        <div className="section-header">
          <h3 className="heading-md">시술 이력</h3>
          <div className="flex-row gap-sm">
            <span className="caption">총 {history.length}회</span>
            <button
              className="btn-icon btn-icon-sm btn-icon-primary"
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div className="card" style={{ marginTop: 16, overflow: 'hidden' }}>
          {history.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <Scissors size={32} className="text-tertiary" style={{ marginBottom: 12, opacity: 0.4 }} />
              <p className="body-sm text-tertiary">시술 이력이 없습니다.</p>
              <button
                className="text-accent body-sm"
                style={{ marginTop: 8 }}
                onClick={() => setShowAddModal(true)}
              >
                + 이력 추가
              </button>
            </div>
          ) : (
            history.map((item, i) => {
              const dateInfo = formatDate(item.date);
              return (
                <div key={item.id}>
                  <div className={styles.historyRow}>
                    <div className={styles.historyDate}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{dateInfo.short}</span>
                      <span className="caption" style={{ fontSize: 10 }}>{dateInfo.day}</span>
                    </div>
                    <div className="divider" style={{ height: 36 }} />
                    <div className={styles.historyInfo}>
                      <span className="body-md">{item.service}</span>
                      {item.memo && <span className="caption">{item.memo}</span>}
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  {i < history.length - 1 && (
                    <div
                      style={{
                        height: 1,
                        background: 'var(--border-subtle)',
                        marginLeft: 18,
                        marginRight: 18,
                      }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 시술 추가 모달 */}
      {showAddModal && (
        <AddHistoryModal
          customerId={id}
          onClose={() => setShowAddModal(false)}
          onAdded={handleHistoryAdded}
        />
      )}
    </div>
  );
}
