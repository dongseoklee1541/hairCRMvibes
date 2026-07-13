import 'server-only';

import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import {
  StaffManagementError,
  toStaffManagementError,
  validateSupabaseConfiguration,
} from './staffManagementCore.mjs';

let adminClient;
let adminClientSignature;

function environment() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    secretKey: process.env.SUPABASE_SECRET_KEY || '',
  };
}

const AUTH_OPTIONS = {
  autoRefreshToken: false,
  detectSessionInUrl: false,
  persistSession: false,
};

export function createUserScopedClient(accessToken) {
  const config = validateSupabaseConfiguration(environment());

  return createClient(config.url, config.anonKey, {
    auth: AUTH_OPTIONS,
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function getAdminClient() {
  const config = validateSupabaseConfiguration(environment(), true);
  const signature = `${config.url}:${config.secretKey}`;

  if (!adminClient || adminClientSignature !== signature) {
    adminClient = createClient(config.url, config.secretKey, {
      auth: AUTH_OPTIONS,
    });
    adminClientSignature = signature;
  }

  return adminClient;
}

function rowFromRpc(data) {
  return Array.isArray(data) ? data[0] || null : data || null;
}

export function fingerprintStaffInvitationEmail(email) {
  const { secretKey } = validateSupabaseConfiguration(environment(), true);

  return createHmac('sha256', secretKey)
    .update('haircrm:r10:staff-invite:v1\0', 'utf8')
    .update(email, 'utf8')
    .digest('hex');
}

export async function listStaffProfiles(userClient) {
  const { data, error } = await userClient.rpc('list_staff_profiles');
  if (error) {
    throw toStaffManagementError(error);
  }

  return data || [];
}

export async function claimStaffInvitation(
  userClient,
  { emailFingerprint, requestId },
) {
  const { data, error } = await userClient.rpc('claim_staff_invitation', {
    p_email_fingerprint: emailFingerprint,
    p_request_id: requestId,
  });
  if (error) {
    throw toStaffManagementError(error);
  }

  const row = rowFromRpc(data);
  if (!row) {
    throw new StaffManagementError('backend_failure');
  }

  return row;
}

export async function settleStaffInvitation(
  userClient,
  { authUserId, claimToken, failureCode, nextState, requestId },
) {
  const { data, error } = await userClient.rpc('settle_staff_invitation', {
    p_auth_user_id: authUserId,
    p_claim_token: claimToken,
    p_failure_code: failureCode,
    p_next_state: nextState,
    p_request_id: requestId,
  });
  if (error) {
    throw toStaffManagementError(error);
  }

  const row = rowFromRpc(data);
  if (!row) {
    throw new StaffManagementError('backend_failure');
  }

  return row;
}

export async function reconcileStaffInvitation(
  userClient,
  { emailFingerprint, userId },
) {
  const { data, error } = await userClient.rpc('reconcile_staff_invitation', {
    p_auth_user_id: userId,
    p_email_fingerprint: emailFingerprint,
  });
  if (error) {
    throw toStaffManagementError(error);
  }

  const row = rowFromRpc(data);
  if (!row) {
    throw new StaffManagementError('backend_failure');
  }

  return row;
}

export async function provisionInvitedStaff(userClient, { requestId, userId }) {
  const { data, error } = await userClient.rpc('provision_invited_staff', {
    p_request_id: requestId,
    p_user_id: userId,
  });
  if (error) {
    throw toStaffManagementError(error);
  }

  const row = rowFromRpc(data);
  if (!row) {
    throw new StaffManagementError('backend_failure');
  }

  return row;
}

export async function changeStaffRole(userClient, { requestId, role, userId }) {
  const { data, error } = await userClient.rpc('change_staff_role', {
    p_next_role: role,
    p_request_id: requestId,
    p_target_user_id: userId,
  });
  if (error) {
    throw toStaffManagementError(error);
  }

  const row = rowFromRpc(data);
  if (!row) {
    throw new StaffManagementError('backend_failure');
  }

  return row;
}

export async function listAllAuthUsers() {
  const client = getAdminClient();
  const perPage = 1000;
  const users = [];

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw toStaffManagementError(error, 'auth_admin_failed');
    }

    const pageUsers = data?.users || [];
    users.push(...pageUsers);
    if (pageUsers.length < perPage) {
      return users;
    }
  }

  throw new StaffManagementError('auth_admin_failed');
}

export async function inviteAuthUser({ email, redirectTo }) {
  const client = getAdminClient();
  const { data, error } = await client.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });
  if (error) {
    throw toStaffManagementError(error, 'auth_admin_failed');
  }

  if (!data?.user?.id) {
    throw new StaffManagementError('auth_admin_failed');
  }

  return data.user;
}
