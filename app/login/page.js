'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/';

  const { signIn, user, isAuthReady, isRoleReady, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const redirectTo = useMemo(() => {
    return from.startsWith('/') ? from : '/';
  }, [from]);

  useEffect(() => {
    if (!isAuthReady || !isRoleReady || loading) {
      return;
    }

    if (user) {
      router.replace(redirectTo);
    }
  }, [isAuthReady, isRoleReady, loading, user, router, redirectTo]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setErrorMessage('');
      await signIn({ email: email.trim(), password });
      router.push(redirectTo);
      router.refresh();
    } catch (error) {
      setErrorMessage(error?.message || '로그인 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="page-content" style={{ paddingTop: 64 }}>
      <div className={styles.loginForm}>
        <div className={styles.loginCard}>
          <h1 className={`${styles.loginTitle} heading-xl`}>미용실 CRM 로그인</h1>
          <p className={`${styles.loginDescription} body-sm text-tertiary`}>
            계정 정보를 입력해 시작하세요.
          </p>

          <form onSubmit={handleSubmit} className="flex-col" style={{ gap: 12 }}>
            <div className="form-group">
              <label className="form-label">이메일</label>
              <div className="form-input">
                <input
                  type="email"
                  placeholder="owner@salon.com"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">비밀번호</label>
              <div className="form-input">
                <input
                  type="password"
                  placeholder="********"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {errorMessage ? <p className={styles.loginMessage}>{errorMessage}</p> : null}

            <button type="submit" className="btn-primary" disabled={loading || !email || !password}>
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>로그인 중...</span>
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>로그인</span>
                </>
              )}
            </button>
          </form>
        </div>

        <div className={styles.loginFooter}>앱 사용 권한은 운영자가 사전에 부여합니다.</div>
      </div>
    </div>
  );
}
