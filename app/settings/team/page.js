import AuthGate from '@/components/AuthGate';
import RoleManagementPanel from '@/components/settings/RoleManagementPanel';

export default function TeamSettingsPage() {
  return (
    <AuthGate allowedRoles={['owner']}>
      <RoleManagementPanel />
    </AuthGate>
  );
}
