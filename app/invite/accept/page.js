'use client';

import Link from 'next/link';
import { AlertTriangle, CircleCheck, Loader2, LockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

const MIN_PASSWORD_LENGTH = 8;

function readInviteLinkState() {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const queryParams = new URLSearchParams(window.location.search);
  const errorCode = hashParams.get('error_code') || queryParams.get('error_code');
  const hasError = Boolean(errorCode || hashParams.get('error') || queryParams.get('error'));
  const hasTokens = Boolean(
    hashParams.get('access_token') && hashParams.get('refresh_token')
  );

  return {
    hasError,
    hasInviteFragment: hasTokens && hashParams.get('type') === 'invite',
  };
}

export default function InviteAcceptPage() {
  const { user, isAuthReady, roleError, signOut } = useAuth();
  const [linkState, setLinkState] = useState({
    checked: false,
    hasError: false,
    hasInviteFragment: false,
    settleComplete: false,
  });
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const nextLinkState = readInviteLinkState();
    setLinkState({
      checked: true,
      ...nextLinkState,
      settleComplete: !nextLinkState.hasInviteFragment,
    });

    if (!nextLinkState.hasInviteFragment) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setLinkState((current) => ({ ...current, settleComplete: true }));
    }, 1500);

    return () => window.clearTimeout(timer);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    if (!user) {
      setErrorMessage('초대 링크를 다시 확인해주세요.');
      return;
    }

    if (!passwordUpdated && password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상 입력해주세요.`);
      return;
    }

    if (!passwordUpdated && password !== passwordConfirm) {
      setErrorMessage('비밀번호가 서로 일치하지 않습니다.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      if (!passwordUpdated) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          setErrorMessage('비밀번호를 설정하지 못했습니다. 잠시 후 다시 시도해주세요.');
          return;
        }

        setPasswordUpdated(true);
        setPassword('');
        setPasswordConfirm('');
      }

      setEndingSession(true);
      try {
        await signOut({ scope: 'local' });
      } catch {
        setEndingSession(false);
        setErrorMessage('비밀번호는 설정됐지만 로그아웃하지 못했습니다. 다시 시도해주세요.');
        return;
      }

      setCompleted(true);
      setEndingSession(false);
    } catch {
      setErrorMessage('처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!linkState.checked || !isAuthReady) {
    return (
      <main className={styles.page} aria-live="polite" aria-busy="true">
        <section className={styles.card}>
          <Loader2 className={styles.spinner} size={32} aria-hidden="true" />
          <h1 className={styles.title}>초대 링크 확인 중</h1>
          <p className={styles.description}>안전한 계정 설정을 준비하고 있습니다.</p>
        </section>
      </main>
    );
  }

  if (completed) {
    return (
      <main className={styles.page} aria-live="polite">
        <section className={styles.card}>
          <span className={`${styles.iconWrap} ${styles.successIcon}`} aria-hidden="true">
            <CircleCheck size={30} />
          </span>
          <h1 className={styles.title}>계정 설정 완료</h1>
          <p className={styles.description}>
            비밀번호가 설정되고 초대 세션이 안전하게 종료되었습니다.
          </p>
          <Link href="/login" className={styles.primaryAction}>
            로그인 화면으로 이동
          </Link>
        </section>
      </main>
    );
  }

  if (endingSession) {
    return (
      <main className={styles.page} aria-live="polite" aria-busy="true">
        <section className={styles.card}>
          <Loader2 className={styles.spinner} size={32} aria-hidden="true" />
          <h1 className={styles.title}>초대 세션 종료 중</h1>
          <p className={styles.description}>비밀번호 설정을 안전하게 마무리하고 있습니다.</p>
        </section>
      </main>
    );
  }

  const waitingForSession =
    !user && linkState.hasInviteFragment && !linkState.settleComplete && !linkState.hasError;

  if (waitingForSession) {
    return (
      <main className={styles.page} aria-live="polite" aria-busy="true">
        <section className={styles.card}>
          <Loader2 className={styles.spinner} size={32} aria-hidden="true" />
          <h1 className={styles.title}>초대 세션 연결 중</h1>
          <p className={styles.description}>잠시만 기다려주세요.</p>
        </section>
      </main>
    );
  }

  const lastSignInAt = Date.parse(user?.last_sign_in_at || '');
  const signInAge = Date.now() - lastSignInAt;
  const hasRecentInvitedSession = Boolean(
    user?.invited_at &&
    Number.isFinite(lastSignInAt) &&
    signInAge > -2 * 60 * 1000 &&
    signInAge < 5 * 60 * 1000
  );
  const hasInviteEvidence = linkState.hasInviteFragment || hasRecentInvitedSession;

  if (linkState.hasError || !user || !hasInviteEvidence) {
    const authUnavailable = roleError === 'auth_unavailable';
    return (
      <main className={styles.page}>
        <section className={styles.card} role="alert">
          <span className={`${styles.iconWrap} ${styles.errorIcon}`} aria-hidden="true">
            <AlertTriangle size={28} />
          </span>
          <h1 className={styles.title}>
            {authUnavailable ? '인증 서비스를 확인할 수 없습니다' : '초대 링크를 사용할 수 없습니다'}
          </h1>
          <p className={styles.description}>
            {authUnavailable
              ? '연결 상태와 앱 설정을 확인한 뒤 다시 열어주세요.'
              : '링크가 만료됐거나 이미 사용됐습니다. 원장에게 새 초대를 요청해주세요.'}
          </p>
          <Link href="/login" className={styles.secondaryAction}>
            로그인 화면으로 이동
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span className={styles.iconWrap} aria-hidden="true">
          <LockKeyhole size={28} />
        </span>
        <h1 className={styles.title}>직원 초대 수락</h1>
        <p className={styles.description}>
          계정에서 사용할 새 비밀번호를 설정해주세요.
        </p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {!passwordUpdated ? (
            <>
              <div className={styles.field}>
                <label htmlFor="invite-password">새 비밀번호</label>
                <input
                  id="invite-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-describedby="invite-password-hint"
                  disabled={submitting}
                  required
                />
                <p id="invite-password-hint" className={styles.hint}>
                  {MIN_PASSWORD_LENGTH}자 이상 입력해주세요.
                </p>
              </div>

              <div className={styles.field}>
                <label htmlFor="invite-password-confirm">비밀번호 확인</label>
                <input
                  id="invite-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
            </>
          ) : (
            <p className={styles.notice}>
              비밀번호 설정은 완료되었습니다. 초대 세션 종료를 다시 시도합니다.
            </p>
          )}

          <p className={styles.message} role="alert" aria-live="assertive">
            {errorMessage}
          </p>

          <button
            type="submit"
            className={styles.primaryAction}
            disabled={
              submitting ||
              (!passwordUpdated && (!password || !passwordConfirm))
            }
          >
            {submitting ? (
              <>
                <Loader2 className={styles.buttonSpinner} size={20} aria-hidden="true" />
                처리 중...
              </>
            ) : passwordUpdated ? (
              '로그아웃 다시 시도'
            ) : (
              '비밀번호 설정'
            )}
          </button>
        </form>
      </section>
    </main>
  );
}
