import { Outfit } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/AppShell';

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#F5F4F1',
};

export const metadata = {
  title: '미용실 CRM',
  description: '고객관리 & 예약관리 미용실 CRM 모바일 앱',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '미용실 CRM',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={outfit.variable}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
