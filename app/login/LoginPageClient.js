'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import styles from './page.module.css';

export default function LoginPageClient({ from = '/' }) {
  const router = useRouter();
  const { signIn, user, isAuthReady, isRoleReady, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
      const messages = {
        invalid_credentials: '이메일 또는 비밀번호를 확인해 주세요.',
        email_not_confirmed: '이메일의 초대 링크를 먼저 확인해 주세요.',
        over_request_rate_limit: '잠시 기다린 뒤 다시 로그인해 주세요.',
        over_email_send_rate_limit: '잠시 기다린 뒤 다시 로그인해 주세요.',
      };
      setErrorMessage(!navigator.onLine || error?.name === 'AuthRetryableFetchError'
        ? '인터넷 연결을 확인한 뒤 다시 로그인해 주세요.'
        : messages[error?.code] || '로그인하지 못했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.');
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
              <label className="form-label" htmlFor="login-email">이메일</label>
              <div className="form-input">
                <input
                  id="login-email"
                  aria-describedby={errorMessage ? "login-error" : undefined}
                  type="email"
                  placeholder="이메일을 입력하세요"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">비밀번호</label>
              <div className="form-input">
                <input
                  id="login-password"
                  aria-describedby={errorMessage ? "login-error" : undefined}
                  type={showPassword ? "text" : "password"}
                  placeholder="********"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button type="button" className={styles.passwordToggle} aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>
                  {showPassword ? '숨기기' : '보기'}
                </button>
              </div>
            </div>

            {errorMessage ? <p id="login-error" role="alert" className={styles.loginMessage}>{errorMessage}</p> : null}

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
