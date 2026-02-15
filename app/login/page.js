import LoginPageClient from './LoginPageClient';

export default async function LoginPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const from = resolvedSearchParams?.from;
  const safeFrom = typeof from === 'string' && from.startsWith('/') ? from : '/';

  return <LoginPageClient from={safeFrom} />;
}
