'use client';

import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/components/AuthProvider';
import AuthGate from '@/components/AuthGate';
import TabBar from '@/components/TabBar';

export default function AppShell({ children }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <AuthProvider>
      <div className="app-container">
        {isLoginPage ? children : <AuthGate>{children}</AuthGate>}
        {!isLoginPage && <TabBar />}
      </div>
    </AuthProvider>
  );
}
