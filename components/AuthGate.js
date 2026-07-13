'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ForbiddenView from '@/components/ForbiddenView';
import { useAuth } from '@/components/AuthProvider';

function isSameOrChild(path, target) {
  if (!path) return false;
  return path === target;
}

export default function AuthGate({
  children,
  requireAuth = true,
  allowedRoles = null,
  redirectTo = '/login',
  loadingFallback = null,
  forbiddenFallback = null,
}) {
  const router = useRouter();
  const pathname = usePathname();

  const {
    user,
    role,
    roleError,
    loading,
    isAuthReady,
    isRoleReady,
    refreshAuth,
  } = useAuth();

  const needsRoleCheck = Array.isArray(allowedRoles) && allowedRoles.length > 0;
  const hasRole = Boolean(role);
  const isAllowed = !needsRoleCheck || (hasRole && allowedRoles.includes(role));
  const waiting = loading || (needsRoleCheck && !isRoleReady);

  useEffect(() => {
    if (
      !requireAuth ||
      waiting ||
      !isAuthReady ||
      user ||
      (needsRoleCheck && roleError === 'auth_unavailable')
    ) {
      return;
    }

    if (pathname === redirectTo || isSameOrChild(pathname, redirectTo)) {
      return;
    }

    const next = new URLSearchParams();
    if (pathname) {
      next.set('from', pathname);
    }
    router.replace(next.toString() ? `${redirectTo}?${next.toString()}` : redirectTo);
  }, [
    requireAuth,
    waiting,
    isAuthReady,
    user,
    pathname,
    redirectTo,
    router,
    needsRoleCheck,
    roleError,
  ]);

  if (!requireAuth) {
    return <>{children}</>;
  }

  if (!isAuthReady || waiting) {
    return (
      loadingFallback || (
        <div className="page-content flex-center" style={{ minHeight: '70vh' }}>
          <p className="body-sm text-tertiary">인증 상태를 확인하고 있습니다...</p>
        </div>
      )
    );
  }

  if (!user) {
    if (needsRoleCheck && roleError === 'auth_unavailable') {
      return (
        <div
          className="page-content flex-center"
          style={{ minHeight: '70vh', textAlign: 'center', gap: 14 }}
        >
          <h1 className="heading-md">인증 서비스를 확인할 수 없습니다</h1>
          <p className="body-sm text-tertiary">
            연결 상태를 확인한 뒤 다시 시도해주세요.
          </p>
          <button
            type="button"
            className="btn-primary"
            style={{ maxWidth: 220, minHeight: 44 }}
            onClick={() => void refreshAuth()}
          >
            다시 시도
          </button>
        </div>
      );
    }
    return null;
  }

  if (needsRoleCheck && roleError === 'profile_missing') {
    return (
      <ForbiddenView
        title="직원 프로필 확인 필요"
        description="로그인은 완료됐지만 권한 프로필이 없습니다. 원장에게 계정 등록을 요청해주세요."
        actionHref="/"
        actionLabel="홈으로 이동"
      />
    );
  }

  if (needsRoleCheck && roleError) {
    return (
      <div
        className="page-content flex-center"
        style={{ minHeight: '70vh', textAlign: 'center', gap: 14 }}
      >
        <h1 className="heading-md">권한 정보를 불러오지 못했습니다</h1>
        <p className="body-sm text-tertiary">
          연결 상태를 확인한 뒤 다시 시도해주세요.
        </p>
        <button
          type="button"
          className="btn-primary"
          style={{ maxWidth: 220, minHeight: 44 }}
          onClick={() => void refreshAuth()}
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      forbiddenFallback || (
        <ForbiddenView
          title="권한 없음"
          description="이 페이지는 원장 계정만 접근할 수 있습니다."
          actionHref="/"
          actionLabel="홈으로 이동"
        />
      )
    );
  }

  return <>{children}</>;
}
