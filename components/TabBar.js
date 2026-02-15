'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Users, Calendar, TrendingUp, Settings } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

const baseTabs = [
  { href: '/', label: '고객', icon: Users },
  { href: '/appointments', label: '예약', icon: Calendar },
  { href: '/stats', label: '통계', icon: TrendingUp },
  { href: '/settings', label: '설정', icon: Settings },
];

function shouldHideByPath(pathname) {
  return pathname.includes('/new') || pathname.match(/\/customers\/.+/);
}

export default function TabBar() {
  const pathname = usePathname();
  const { isAuthReady, isRoleReady, role, user, loading } = useAuth();

  const isLoginPage = pathname === '/login';

  const tabs = useMemo(() => {
    if (!isAuthReady || loading) {
      return [];
    }

    if (!user || !isRoleReady) {
      return [];
    }

    if (role === 'owner') {
      return baseTabs;
    }

    return baseTabs.filter((tab) => tab.href !== '/settings');
  }, [isAuthReady, isRoleReady, role, user, loading]);

  if (!tabs.length) {
    return null;
  }

  if (isLoginPage || shouldHideByPath(pathname)) {
    return null;
  }

  return (
    <nav className="tab-bar" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
      {tabs.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === '/'
            ? pathname === '/' || pathname.startsWith('/customers')
            : pathname.startsWith(href);

        return (
          <Link key={href} href={href} className={`tab-item ${isActive ? 'active' : ''}`}>
            <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
