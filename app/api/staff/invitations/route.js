import {
  handleInvitationPost,
} from '../../../../lib/server/staffManagementCore.mjs';
import {
  claimStaffInvitation,
  createUserScopedClient,
  fingerprintStaffInvitationEmail,
  inviteAuthUser,
  listAllAuthUsers,
  listStaffProfiles,
  provisionInvitedStaff,
  reconcileStaffInvitation,
  settleStaffInvitation,
} from '../../../../lib/server/staffManagementSupabase.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  return handleInvitationPost(request, {
    claimStaffInvitation,
    createUserScopedClient,
    fingerprintStaffInvitationEmail,
    inviteAuthUser,
    listAllAuthUsers,
    listStaffProfiles,
    provisionInvitedStaff,
    reconcileStaffInvitation,
    settleStaffInvitation,
  });
}
