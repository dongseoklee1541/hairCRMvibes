'use client';

import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/components/AuthProvider';
import AuthGate from '@/components/AuthGate';
import TabBar from '@/components/TabBar';

export default function AppShell({ children }) {
  const pathname = usePathname();
  const isPublicAuthPage = pathname === '/login' || pathname === '/invite/accept';

  return (
    <AuthProvider>
      <div className="app-container">
        {isPublicAuthPage ? children : <AuthGate>{children}</AuthGate>}
        {!isPublicAuthPage && <TabBar />}
      </div>
    </AuthProvider>
  );
}
