import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  disable: process.env.NODE_ENV === 'development',
  cacheStartUrl: false,
  dynamicStartUrl: false,
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  fallbacks: {
    document: '/offline.html',
  },
  workboxOptions: {
    additionalManifestEntries: [
      { url: '/favicon.ico', revision: null },
      { url: '/manifest.json', revision: null },
      { url: '/icons/icon-192.png', revision: null },
      { url: '/icons/icon-512.png', revision: null },
    ],
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/[^/]+\.supabase\.co\/(?:auth|rest|realtime|storage)\//,
        handler: 'NetworkOnly',
        options: {
          cacheName: 'supabase-network-only',
        },
      },
      {
        urlPattern: /\/api\//,
        handler: 'NetworkOnly',
        options: {
          cacheName: 'api-network-only',
        },
      },
      {
        urlPattern: ({ request }) => request.destination === 'document',
        handler: 'NetworkOnly',
        options: {
          cacheName: 'documents-network-only',
        },
      },
      {
        urlPattern: /.*/,
        handler: 'NetworkOnly',
        options: {
          cacheName: 'uncached-network-only',
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withPWA(nextConfig);
