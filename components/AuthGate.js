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
    roleLoadError,
    signOut,
    loading,
    isAuthReady,
    isRoleReady,
  } = useAuth();

  const needsRoleCheck = Array.isArray(allowedRoles) && allowedRoles.length > 0;
  const hasRole = Boolean(role) && !roleLoadError;
  const isAllowed = hasRole && (!needsRoleCheck || allowedRoles.includes(role));
  const waiting = loading || !isAuthReady || !isRoleReady;

  const forbiddenTitle = roleLoadError ? '권한 확인 필요' : '권한 없음';
  const forbiddenDescription = roleLoadError
    ? '계정 권한을 확인할 수 없습니다. 다른 계정으로 다시 로그인해주세요.'
    : needsRoleCheck
      ? '이 페이지는 원장 계정만 접근할 수 있습니다.'
      : '현재 계정으로는 이 페이지를 이용할 수 없습니다.';
  const actionKind = roleLoadError ? 'button' : 'link';
  const actionLabel = roleLoadError ? '로그아웃' : '홈으로 이동';
  const handleRoleRecovery = () => {
    void signOut();
  };

  useEffect(() => {
    if (!requireAuth || waiting || user) {
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
    user,
    pathname,
    redirectTo,
    router,
  ]);

  if (!requireAuth) {
    return <>{children}</>;
  }

  if (waiting) {
    return (
      loadingFallback || (
        <div className="page-content flex-center" style={{ minHeight: '70vh' }}>
          <p className="body-sm text-tertiary">인증 상태를 확인하고 있습니다...</p>
        </div>
      )
    );
  }

  if (!user) {
    return null;
  }

  if (!isAllowed) {
    return (
      forbiddenFallback || (
        <ForbiddenView
          title={forbiddenTitle}
          description={forbiddenDescription}
          actionHref="/"
          actionLabel={actionLabel}
          actionKind={actionKind}
          onAction={roleLoadError ? handleRoleRecovery : null}
        />
      )
    );
  }

  return <>{children}</>;
}
