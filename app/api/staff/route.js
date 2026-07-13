import {
  errorResponse,
  getStaffDirectory,
  jsonResponse,
  requireBearerToken,
} from '../../../lib/server/staffManagementCore.mjs';
import {
  createUserScopedClient,
  listAllAuthUsers,
  listStaffProfiles,
} from '../../../lib/server/staffManagementSupabase.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const accessToken = requireBearerToken(request.headers.get('authorization'));
    const userClient = createUserScopedClient(accessToken);
    const staff = await getStaffDirectory({
      authorizeOwner: () => listStaffProfiles(userClient),
      listAuthUsers: listAllAuthUsers,
    });

    return jsonResponse({ ok: true, staff });
  } catch (error) {
    return errorResponse(error);
  }
}
