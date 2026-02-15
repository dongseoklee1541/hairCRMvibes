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
    loading,
    isAuthReady,
    isRoleReady,
  } = useAuth();

  const needsRoleCheck = Array.isArray(allowedRoles) && allowedRoles.length > 0;
  const hasRole = Boolean(role);
  const isAllowed = !needsRoleCheck || (hasRole && allowedRoles.includes(role));
  const waiting = loading || (needsRoleCheck && !isRoleReady);

  useEffect(() => {
    if (!requireAuth || waiting || !isAuthReady || user) {
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
    return null;
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
