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
  createUserScopedClient,
  findRoleManagementRequest,
  inviteAuthUser,
  listAllAuthUsers,
  listStaffProfiles,
  provisionInvitedStaff,
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
        findRequest: (requestId) => findRoleManagementRequest(userClient, requestId),
        inviteUser: inviteAuthUser,
        listAuthUsers: listAllAuthUsers,
        provisionStaff: (params) => provisionInvitedStaff(userClient, params),
      },
    );

    return jsonResponse({ ok: true, ...result }, result.status === 'invited' ? 201 : 200);
  } catch (error) {
    return errorResponse(error);
  }
}
