import {
  errorResponse,
  inviteStaffMember,
  jsonResponse,
  readJsonBody,
  requireBearerToken,
  resolveInviteRedirect,
  validateInvitationPayload,
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
  try {
    const accessToken = requireBearerToken(request.headers.get('authorization'));
    const input = validateInvitationPayload(await readJsonBody(request));
    const redirectTo = resolveInviteRedirect(request);
    const userClient = createUserScopedClient(accessToken);
    const result = await inviteStaffMember(
      { ...input, redirectTo },
      {
        authorizeOwner: () => listStaffProfiles(userClient),
        claimInvitation: (params) => claimStaffInvitation(userClient, params),
        fingerprintEmail: fingerprintStaffInvitationEmail,
        inviteUser: inviteAuthUser,
        listAuthUsers: listAllAuthUsers,
        provisionStaff: (params) => provisionInvitedStaff(userClient, params),
        reconcileInvitation: (params) => reconcileStaffInvitation(userClient, params),
        settleInvitation: (params) => settleStaffInvitation(userClient, params),
      },
    );

    return jsonResponse({ ok: true, ...result }, result.status === 'invited' ? 201 : 200);
  } catch (error) {
    return errorResponse(error);
  }
}
