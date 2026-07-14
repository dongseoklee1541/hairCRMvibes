import {
  changeStaffMemberRole,
  errorResponse,
  jsonResponse,
  readJsonBody,
  requireBearerToken,
  validateRolePayload,
  validateUserId,
} from '../../../../../lib/server/staffManagementCore.mjs';
import {
  changeStaffRole,
  createUserScopedClient,
} from '../../../../../lib/server/staffManagementSupabase.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request, context) {
  try {
    const accessToken = requireBearerToken(request.headers.get('authorization'));
    const { userId: rawUserId } = await context.params;
    const userId = validateUserId(rawUserId);
    const input = validateRolePayload(await readJsonBody(request));
    const userClient = createUserScopedClient(accessToken);
    const result = await changeStaffMemberRole(
      { ...input, userId },
      {
        changeRole: (params) => changeStaffRole(userClient, params),
      },
    );

    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
