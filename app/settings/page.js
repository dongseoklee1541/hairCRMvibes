import AuthGate from '@/components/AuthGate';
import PlaceholderPage from '@/components/PlaceholderPage';

export default function SettingsPage() {
  return (
    <AuthGate allowedRoles={['owner']}>
      <PlaceholderPage title="설정" />
    </AuthGate>
  );
}
