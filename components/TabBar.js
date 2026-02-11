'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Users, Calendar, TrendingUp, Settings } from 'lucide-react';

const tabs = [
  { href: '/', label: '고객', icon: Users },
  { href: '/appointments', label: '예약', icon: Calendar },
  { href: '/stats', label: '통계', icon: TrendingUp },
  { href: '/settings', label: '설정', icon: Settings },
];

export default function TabBar() {
  const pathname = usePathname();

  // 예약 등록 화면이나 고객 상세 화면에서는 탭바 숨기기
  if (pathname.includes('/new') || pathname.match(/\/customers\/.+/)) {
    return null;
  }

  return (
    <nav className="tab-bar">
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
