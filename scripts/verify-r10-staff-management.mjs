import assert from 'node:assert/strict';

import {
  StaffManagementError,
  changeStaffMemberRole,
  errorResponse,
  getStaffDirectory,
  handleInvitationPost,
  inviteStaffMember,
  isInvitationFeatureEnabled,
  maskEmail,
  requireBearerToken,
  resolveInviteRedirect,
  toStaffManagementError,
  validateInvitationPayload,
  validateRolePayload,
  validateSupabaseConfiguration,
  validateUserId,
} from '../lib/server/staffManagementCore.mjs';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const STAFF_ID = '22222222-2222-4222-8222-222222222222';
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REQUEST_ID_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EMAIL = 'new.staff@example.com';
const EMAIL_FINGERPRINT = 'f'.repeat(64);
const CLAIM_TOKEN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

async function expectStaffError(run, code) {
  let caught;

  try {
    await run();
  } catch (error) {
    caught = error;
  }

  assert.equal(caught instanceof StaffManagementError, true);
  assert.equal(caught.code, code);
}

function profile(userId, role = 'staff') {
  return {
    user_id: userId,
    role,
    created_at: '2026-07-13T00:00:00.000Z',
    updated_at: '2026-07-13T00:00:00.000Z',
  };
}

function authUser(id, email = EMAIL, confirmed = false) {
  return {
    id,
    email,
    email_confirmed_at: confirmed ? '2026-07-13T00:00:00.000Z' : null,
  };
}

function createInvitationLedgerHarness() {
  const rows = new Map();

  const claimInvitation = async ({ emailFingerprint, requestId }) => {
    const direct = rows.get(requestId);
    if (direct) {
      if (direct.email_fingerprint !== emailFingerprint) {
        throw new StaffManagementError('conflict');
      }
      return {
        ...direct,
        claim_token: null,
        acquired: false,
        replayed: true,
      };
    }

    const active = [...rows.values()].find(
      (row) =>
        row.email_fingerprint === emailFingerprint &&
        ['claimed', 'auth_succeeded', 'unknown'].includes(row.state),
    );
    if (active) {
      return {
        ...active,
        claim_token: null,
        acquired: false,
        replayed: true,
      };
    }

    const row = {
      request_id: requestId,
      email_fingerprint: emailFingerprint,
      state: 'claimed',
      claim_token: CLAIM_TOKEN,
      auth_user_id: null,
      failure_code: null,
    };
    rows.set(requestId, row);
    return { ...row, acquired: true, replayed: false };
  };

  const settleInvitation = async ({
    authUserId,
    claimToken,
    failureCode,
    nextState,
    requestId,
  }) => {
    const row = rows.get(requestId);
    assert.ok(row);
    assert.equal(claimToken, CLAIM_TOKEN);
    Object.assign(row, {
      state: nextState,
      auth_user_id: authUserId,
      failure_code: failureCode,
    });
    return { ...row };
  };

  const reconcileInvitation = async ({ emailFingerprint, userId }) => {
    const row = [...rows.values()].find(
      (candidate) => candidate.email_fingerprint === emailFingerprint,
    );
    if (!row) {
      throw { code: 'P0002', message: '복구할 초대 요청을 찾을 수 없습니다.' };
    }
    Object.assign(row, {
      state: 'provisioned',
      auth_user_id: userId,
      failure_code: null,
    });
    return { ...row, reconciled: true };
  };

  return { claimInvitation, reconcileInvitation, rows, settleInvitation };
}

function invitationDependencies(overrides = {}) {
  const ledger = overrides.ledger || createInvitationLedgerHarness();
  return {
    authorizeOwner: async () => [profile(OWNER_ID, 'owner')],
    claimInvitation: ledger.claimInvitation,
    fingerprintEmail: async () => EMAIL_FINGERPRINT,
    inviteUser: async ({ email }) => authUser(STAFF_ID, email, false),
    listAuthUsers: async () => [authUser(OWNER_ID, 'owner@example.com', true)],
    provisionStaff: async () => ({
      next_role: 'staff',
      event_type: 'staff_provisioned',
      applied: true,
      replayed: false,
    }),
    reconcileInvitation: ledger.reconcileInvitation,
    settleInvitation: ledger.settleInvitation,
    ...overrides,
  };
}

function localRequest(overrides = {}) {
  return new Request(overrides.url || 'http://localhost:3000/api/staff/invitations', {
    method: 'POST',
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      ...overrides.headers,
    },
  });
}

test('strict bearer and input validation', async () => {
  assert.equal(requireBearerToken('Bearer aaa.bbb.ccc'), 'aaa.bbb.ccc');
  assert.deepEqual(validateInvitationPayload({ email: ` ${EMAIL.toUpperCase()} `, requestId: REQUEST_ID }), {
    email: EMAIL,
    requestId: REQUEST_ID,
  });
  assert.deepEqual(validateRolePayload({ requestId: REQUEST_ID, role: 'owner' }), {
    requestId: REQUEST_ID,
    role: 'owner',
  });
  assert.equal(validateUserId(STAFF_ID), STAFF_ID);

  await expectStaffError(() => requireBearerToken('bearer aaa.bbb.ccc'), 'unauthorized');
  await expectStaffError(
    () => validateInvitationPayload({ email: 'invalid', requestId: REQUEST_ID }),
    'validation_error',
  );
  await expectStaffError(
    () => validateInvitationPayload({ email: EMAIL, requestId: REQUEST_ID, role: 'staff' }),
    'validation_error',
  );
  await expectStaffError(
    () => validateRolePayload({ requestId: REQUEST_ID, role: 'manager' }),
    'validation_error',
  );
});

test('invitation maintenance flag is exact true and fails closed before downstream calls', async () => {
  assert.equal(isInvitationFeatureEnabled({ R10_INVITATIONS_ENABLED: 'true' }), true);
  assert.equal(isInvitationFeatureEnabled({ R10_INVITATIONS_ENABLED: 'TRUE' }), false);
  assert.equal(isInvitationFeatureEnabled({ R10_INVITATIONS_ENABLED: '1' }), false);
  assert.equal(isInvitationFeatureEnabled({ R10_INVITATIONS_ENABLED: true }), false);
  assert.equal(isInvitationFeatureEnabled({}), false);

  let downstreamCalls = 0;
  const downstream = () => {
    downstreamCalls += 1;
    throw new Error('maintenance gate must stop before downstream calls');
  };
  const response = await handleInvitationPost(
    localRequest({ headers: { authorization: 'Bearer synthetic-token' } }),
    {
      claimStaffInvitation: downstream,
      createUserScopedClient: downstream,
      fingerprintStaffInvitationEmail: downstream,
      inviteAuthUser: downstream,
      listAllAuthUsers: downstream,
      listStaffProfiles: downstream,
      provisionInvitedStaff: downstream,
      reconcileStaffInvitation: downstream,
      settleStaffInvitation: downstream,
    },
    { R10_INVITATIONS_ENABLED: 'false' },
  );
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(body, {
    ok: false,
    error: {
      code: 'invitation_maintenance',
      message: '직원 초대 기능을 점검 중입니다. 잠시 후 다시 확인해주세요.',
      retryable: true,
    },
  });
  assert.equal(downstreamCalls, 0);
  assert.equal(JSON.stringify(body).includes(EMAIL), false);
  assert.equal(JSON.stringify(body).includes(CLAIM_TOKEN), false);
  assert.equal(JSON.stringify(body).includes('service-role'), false);
});

test('unauthenticated invitation requests remain 401 before maintenance gate', async () => {
  const response = await handleInvitationPost(
    localRequest(),
    {},
    { R10_INVITATIONS_ENABLED: 'false' },
  );
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.deepEqual(body, {
    ok: false,
    error: {
      code: 'unauthorized',
      message: '로그인이 필요합니다.',
    },
  });
});

test('server configuration requires the secret only for admin work', async () => {
  assert.deepEqual(
    validateSupabaseConfiguration({ url: 'https://project.supabase.co', anonKey: 'public', secretKey: '' }),
    { url: 'https://project.supabase.co', anonKey: 'public', secretKey: '' },
  );
  await expectStaffError(
    () =>
      validateSupabaseConfiguration(
        { url: 'https://project.supabase.co', anonKey: 'public', secretKey: '' },
        true,
      ),
    'supabase_not_configured',
  );

  const response = errorResponse(new StaffManagementError('supabase_not_configured'));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.deepEqual(await response.json(), {
    ok: false,
    error: {
      code: 'supabase_not_configured',
      message: '직원 권한 관리 서버가 구성되지 않았습니다.',
      retryable: true,
    },
  });
});

test('invite redirect accepts only canonical production or matching localhost origins', async () => {
  assert.equal(resolveInviteRedirect(localRequest()), 'http://localhost:3000/invite/accept');
  assert.equal(
    resolveInviteRedirect(
      localRequest({
        url: 'https://hair-cr-mvibes.vercel.app/api/staff/invitations',
        headers: {
          host: 'hair-cr-mvibes.vercel.app',
          origin: 'https://hair-cr-mvibes.vercel.app',
          'x-forwarded-host': 'hair-cr-mvibes.vercel.app',
          'x-forwarded-proto': 'https',
        },
      }),
    ),
    'https://hair-cr-mvibes.vercel.app/invite/accept',
  );

  await expectStaffError(
    () =>
      resolveInviteRedirect(
        localRequest({
          headers: { host: 'localhost:3000', origin: 'https://preview.example.com' },
        }),
      ),
    'invalid_origin',
  );
  await expectStaffError(
    () =>
      resolveInviteRedirect(
        localRequest({ headers: { host: 'spoofed.example.com' } }),
      ),
    'invalid_origin',
  );
});

test('staff directory joins auth users but exposes only masked email', async () => {
  const staff = await getStaffDirectory({
    authorizeOwner: async () => [profile(OWNER_ID, 'owner'), profile(STAFF_ID)],
    listAuthUsers: async () => [
      authUser(OWNER_ID, 'owner@example.com', true),
      authUser(STAFF_ID, EMAIL, false),
    ],
  });

  assert.equal(staff.length, 2);
  assert.equal(staff[1].userId, STAFF_ID);
  assert.equal(staff[1].emailMasked, 'n***@e***.com');
  assert.equal(staff[1].inviteState, 'pending');
  assert.equal(JSON.stringify(staff).includes(EMAIL), false);
  assert.equal(maskEmail(EMAIL), 'n***@e***.com');
});

test('new invitation provisions initial staff after owner authorization', async () => {
  const calls = [];
  const result = await inviteStaffMember(
    { email: EMAIL, requestId: REQUEST_ID, redirectTo: 'http://localhost:3000/invite/accept' },
    invitationDependencies({
      authorizeOwner: async () => {
        calls.push('authorize');
        return [profile(OWNER_ID, 'owner')];
      },
      listAuthUsers: async () => {
        calls.push('list-users');
        return [authUser(OWNER_ID, 'owner@example.com', true)];
      },
      inviteUser: async ({ email, redirectTo }) => {
        calls.push('invite');
        assert.equal(email, EMAIL);
        assert.equal(redirectTo, 'http://localhost:3000/invite/accept');
        return authUser(STAFF_ID, email, false);
      },
      provisionStaff: async ({ requestId, userId }) => {
        calls.push('provision');
        assert.deepEqual({ requestId, userId }, { requestId: REQUEST_ID, userId: STAFF_ID });
        return {
          next_role: 'staff',
          event_type: 'staff_provisioned',
          applied: true,
          replayed: false,
        };
      },
    }),
  );

  assert.deepEqual(calls, ['authorize', 'list-users', 'invite', 'provision']);
  assert.equal(result.status, 'invited');
  assert.equal(result.inviteState, 'pending');
  assert.equal(result.staff.emailMasked, 'n***@e***.com');
  assert.equal(JSON.stringify(result).includes(EMAIL), false);
  assert.equal(JSON.stringify(result).includes(CLAIM_TOKEN), false);
});

test('confirmed member duplicate stops before invite or provision', async () => {
  let changed = false;
  await expectStaffError(
    () =>
      inviteStaffMember(
        { email: EMAIL, requestId: REQUEST_ID, redirectTo: 'http://localhost:3000/invite/accept' },
        invitationDependencies({
          authorizeOwner: async () => [profile(STAFF_ID)],
          listAuthUsers: async () => [authUser(STAFF_ID, EMAIL, true)],
          inviteUser: async () => {
            changed = true;
          },
          provisionStaff: async () => {
            changed = true;
          },
        }),
      ),
    'duplicate_invite',
  );
  assert.equal(changed, false);
});

test('unconfirmed existing user is re-invited with idempotent provisioning', async () => {
  let inviteCount = 0;
  const existing = authUser(STAFF_ID, EMAIL, false);
  const result = await inviteStaffMember(
    { email: EMAIL, requestId: REQUEST_ID, redirectTo: 'http://localhost:3000/invite/accept' },
    invitationDependencies({
      authorizeOwner: async () => [profile(STAFF_ID)],
      listAuthUsers: async () => [existing],
      inviteUser: async () => {
        inviteCount += 1;
        return existing;
      },
      provisionStaff: async () => ({
        next_role: 'staff',
        event_type: 'staff_provision_noop',
        applied: false,
        replayed: false,
      }),
    }),
  );

  assert.equal(inviteCount, 1);
  assert.equal(result.status, 'reinvited');
  assert.equal(result.applied, false);
});

test('failed re-invite replay is reported as unknown instead of false success', async () => {
  let inviteCount = 0;
  let provisionCount = 0;
  const existing = authUser(STAFF_ID, EMAIL, false);
  const ledger = createInvitationLedgerHarness();
  const dependencies = invitationDependencies({
    ledger,
    authorizeOwner: async () => [profile(STAFF_ID)],
    listAuthUsers: async () => [existing],
    inviteUser: async () => {
      inviteCount += 1;
      throw new StaffManagementError('auth_admin_failed');
    },
    provisionStaff: async () => {
      provisionCount += 1;
      return {
        next_role: 'staff',
        event_type: 'staff_provision_noop',
        applied: false,
        replayed: provisionCount > 1,
      };
    },
  });

  await expectStaffError(
    () =>
      inviteStaffMember(
        { email: EMAIL, requestId: REQUEST_ID, redirectTo: 'http://localhost:3000/invite/accept' },
        dependencies,
      ),
    'invitation_outcome_unknown',
  );

  await expectStaffError(
    () =>
      inviteStaffMember(
        { email: EMAIL, requestId: REQUEST_ID, redirectTo: 'http://localhost:3000/invite/accept' },
        dependencies,
      ),
    'invitation_outcome_unknown',
  );
  assert.equal(inviteCount, 1);
  assert.equal(provisionCount, 1);
  assert.equal(ledger.rows.get(REQUEST_ID).state, 'provisioned');
});

test('confirmed profileless user is repaired without another invitation', async () => {
  let invited = false;
  const result = await inviteStaffMember(
    { email: EMAIL, requestId: REQUEST_ID, redirectTo: 'http://localhost:3000/invite/accept' },
    invitationDependencies({
      authorizeOwner: async () => [],
      listAuthUsers: async () => [authUser(STAFF_ID, EMAIL, true)],
      inviteUser: async () => {
        invited = true;
      },
      provisionStaff: async () => ({
        next_role: 'staff',
        event_type: 'staff_provisioned',
        applied: true,
        replayed: false,
      }),
    }),
  );

  assert.equal(invited, false);
  assert.equal(result.status, 'repaired');
  assert.equal(result.inviteState, 'accepted');
});

test('confirmed profileless recovery uses the active canonical ledger request', async () => {
  const ledger = createInvitationLedgerHarness();
  const claim = await ledger.claimInvitation({
    emailFingerprint: EMAIL_FINGERPRINT,
    requestId: REQUEST_ID,
  });
  await ledger.settleInvitation({
    requestId: REQUEST_ID,
    claimToken: claim.claim_token,
    nextState: 'unknown',
    authUserId: null,
    failureCode: 'auth_result_unknown',
  });
  let invited = false;
  let provisionedRequestId = null;

  const result = await inviteStaffMember(
    {
      email: EMAIL,
      requestId: REQUEST_ID_2,
      redirectTo: 'http://localhost:3000/invite/accept',
    },
    invitationDependencies({
      ledger,
      authorizeOwner: async () => [],
      listAuthUsers: async () => [authUser(STAFF_ID, EMAIL, true)],
      inviteUser: async () => {
        invited = true;
      },
      provisionStaff: async ({ requestId }) => {
        provisionedRequestId = requestId;
        return {
          next_role: 'staff',
          event_type: 'staff_provisioned',
          applied: true,
          replayed: false,
        };
      },
    }),
  );

  assert.equal(result.status, 'repaired');
  assert.equal(provisionedRequestId, REQUEST_ID);
  assert.equal(ledger.rows.get(REQUEST_ID).state, 'provisioned');
  assert.equal(invited, false);
});

test('mismatched Admin invite email is quarantined as unknown before provisioning', async () => {
  const ledger = createInvitationLedgerHarness();
  let provisioned = false;

  await expectStaffError(
    () =>
      inviteStaffMember(
        {
          email: EMAIL,
          requestId: REQUEST_ID,
          redirectTo: 'http://localhost:3000/invite/accept',
        },
        invitationDependencies({
          ledger,
          inviteUser: async () => authUser(STAFF_ID, 'different.staff@example.com', false),
          provisionStaff: async () => {
            provisioned = true;
          },
        }),
      ),
    'invitation_outcome_unknown',
  );

  assert.equal(ledger.rows.get(REQUEST_ID).state, 'unknown');
  assert.equal(provisioned, false);
});

test('partial invite failure is repairable and retry remains idempotent', async () => {
  const users = [];
  const profiles = [];
  let provisionAttempts = 0;
  let inviteAttempts = 0;
  const ledger = createInvitationLedgerHarness();
  const dependencies = invitationDependencies({
    ledger,
    authorizeOwner: async () => profiles,
    listAuthUsers: async () => users,
    inviteUser: async ({ email }) => {
      inviteAttempts += 1;
      if (!users[0]) {
        users.push(authUser(STAFF_ID, email, false));
      }
      return users[0];
    },
    provisionStaff: async () => {
      provisionAttempts += 1;
      if (provisionAttempts === 1) {
        throw { code: 'P0002', message: '초대된 Auth 사용자를 찾을 수 없습니다.' };
      }
      profiles.push(profile(STAFF_ID));
      return {
        next_role: 'staff',
        event_type: 'staff_provisioned',
        applied: true,
        replayed: false,
      };
    },
  });

  await assert.rejects(
    () =>
      inviteStaffMember(
        { email: EMAIL, requestId: REQUEST_ID, redirectTo: 'http://localhost:3000/invite/accept' },
        dependencies,
      ),
    (error) => {
      assert.equal(error.code, 'partial_failure');
      assert.deepEqual(error.result, { status: 'pending', inviteState: 'pending' });
      return true;
    },
  );

  const retry = await inviteStaffMember(
    { email: EMAIL, requestId: REQUEST_ID, redirectTo: 'http://localhost:3000/invite/accept' },
    dependencies,
  );
  assert.equal(retry.status, 'repaired');
  assert.equal(retry.applied, true);
  assert.equal(inviteAttempts, 1);
  assert.equal(provisionAttempts, 2);
});

test('successful invite replay does not send another Auth email', async () => {
  const users = [];
  const profiles = [];
  let inviteAttempts = 0;
  let provisionAttempts = 0;
  let provisioned = false;
  const ledger = createInvitationLedgerHarness();
  const dependencies = invitationDependencies({
    ledger,
    authorizeOwner: async () => profiles,
    listAuthUsers: async () => users,
    inviteUser: async ({ email }) => {
      inviteAttempts += 1;
      if (!users[0]) {
        users.push(authUser(STAFF_ID, email, false));
      }
      return users[0];
    },
    provisionStaff: async () => {
      provisionAttempts += 1;
      if (provisioned) {
        return {
          next_role: 'staff',
          event_type: 'staff_provisioned',
          applied: false,
          replayed: true,
        };
      }
      provisioned = true;
      profiles.push(profile(STAFF_ID));
      return {
        next_role: 'staff',
        event_type: 'staff_provisioned',
        applied: true,
        replayed: false,
      };
    },
  });

  const payload = {
    email: EMAIL,
    requestId: REQUEST_ID,
    redirectTo: 'http://localhost:3000/invite/accept',
  };
  const first = await inviteStaffMember(payload, dependencies);
  const retry = await inviteStaffMember(payload, dependencies);

  assert.equal(first.status, 'invited');
  assert.equal(retry.status, 'replayed');
  assert.equal(retry.applied, false);
  assert.equal(retry.replayed, true);
  assert.equal(inviteAttempts, 1);
  assert.equal(provisionAttempts, 1);
});

test('used request id is rejected before inviting a different new email', async () => {
  let invited = false;
  await expectStaffError(
    () =>
      inviteStaffMember(
        { email: EMAIL, requestId: REQUEST_ID, redirectTo: 'http://localhost:3000/invite/accept' },
        invitationDependencies({
          authorizeOwner: async () => [profile(OWNER_ID, 'owner')],
          claimInvitation: async () => {
            throw new StaffManagementError('conflict');
          },
          listAuthUsers: async () => [authUser(OWNER_ID, 'owner@example.com', true)],
          inviteUser: async () => {
            invited = true;
          },
          provisionStaff: async () => {
            throw new Error('provision must not run');
          },
        }),
      ),
    'conflict',
  );
  assert.equal(invited, false);
});

test('concurrent requests for one active fingerprint call Admin invite at most once', async () => {
  const ledger = createInvitationLedgerHarness();
  let inviteAttempts = 0;
  const dependencies = invitationDependencies({
    ledger,
    inviteUser: async ({ email }) => {
      inviteAttempts += 1;
      return authUser(STAFF_ID, email, false);
    },
  });
  const redirectTo = 'http://localhost:3000/invite/accept';

  const results = await Promise.allSettled([
    inviteStaffMember({ email: EMAIL, requestId: REQUEST_ID, redirectTo }, dependencies),
    inviteStaffMember({ email: EMAIL, requestId: REQUEST_ID_2, redirectTo }, dependencies),
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.equal(rejected?.reason?.code, 'invitation_in_progress');
  assert.equal(inviteAttempts, 1);
  assert.equal(ledger.rows.size, 1);
});

test('claimed replay is fail-closed and never exposes a claim token', async () => {
  const ledger = createInvitationLedgerHarness();
  await ledger.claimInvitation({
    emailFingerprint: EMAIL_FINGERPRINT,
    requestId: REQUEST_ID,
  });
  let invited = false;

  await expectStaffError(
    () =>
      inviteStaffMember(
        {
          email: EMAIL,
          requestId: REQUEST_ID_2,
          redirectTo: 'http://localhost:3000/invite/accept',
        },
        invitationDependencies({
          ledger,
          inviteUser: async () => {
            invited = true;
          },
        }),
      ),
    'invitation_in_progress',
  );

  const response = errorResponse(new StaffManagementError('invitation_in_progress'));
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error.retryable, undefined);
  assert.equal(JSON.stringify(body).includes(CLAIM_TOKEN), false);
  assert.equal(invited, false);
});

test('Auth success waits for user visibility without another email attempt', async () => {
  const ledger = createInvitationLedgerHarness();
  const claim = await ledger.claimInvitation({
    emailFingerprint: EMAIL_FINGERPRINT,
    requestId: REQUEST_ID,
  });
  await ledger.settleInvitation({
    requestId: REQUEST_ID,
    claimToken: claim.claim_token,
    nextState: 'auth_succeeded',
    authUserId: STAFF_ID,
    failureCode: null,
  });
  let invited = false;

  await expectStaffError(
    () =>
      inviteStaffMember(
        {
          email: EMAIL,
          requestId: REQUEST_ID,
          redirectTo: 'http://localhost:3000/invite/accept',
        },
        invitationDependencies({
          ledger,
          inviteUser: async () => {
            invited = true;
          },
        }),
      ),
    'invitation_in_progress',
  );
  assert.equal(invited, false);
});

test('unknown public response is non-retryable and contains no email or token', async () => {
  const response = errorResponse(new StaffManagementError('invitation_outcome_unknown'));
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.error.code, 'invitation_outcome_unknown');
  assert.equal(body.error.retryable, undefined);
  assert.equal(JSON.stringify(body).includes(EMAIL), false);
  assert.equal(JSON.stringify(body).includes(CLAIM_TOKEN), false);
});

test('role changes expose only minimal changed or unchanged state', async () => {
  const changed = await changeStaffMemberRole(
    { requestId: REQUEST_ID, role: 'owner', userId: STAFF_ID },
    {
      changeRole: async () => ({
        target_user_id: STAFF_ID,
        next_role: 'owner',
        event_type: 'role_changed',
        applied: true,
      }),
    },
  );
  assert.deepEqual(changed, {
    status: 'changed',
    applied: true,
    staff: { userId: STAFF_ID, role: 'owner' },
  });

  const unchanged = await changeStaffMemberRole(
    { requestId: REQUEST_ID, role: 'owner', userId: STAFF_ID },
    {
      changeRole: async () => ({
        target_user_id: STAFF_ID,
        next_role: 'owner',
        event_type: 'role_change_noop',
        applied: false,
      }),
    },
  );
  assert.equal(unchanged.status, 'unchanged');
  assert.equal(unchanged.applied, false);
});

test('database and Auth errors map to stable public codes without raw details', async () => {
  assert.equal(
    toStaffManagementError({ code: '42501', message: '직원 권한을 조회할 권한이 없습니다.' }).code,
    'forbidden',
  );
  assert.equal(
    toStaffManagementError({ code: '55000', message: '자기 자신의 owner 권한은 변경할 수 없습니다.' }).code,
    'self_demotion_forbidden',
  );
  assert.equal(
    toStaffManagementError({ code: '55000', message: '마지막 owner는 staff로 변경할 수 없습니다.' }).code,
    'last_owner_forbidden',
  );
  assert.equal(
    toStaffManagementError({ code: '22023', message: '요청 ID가 다른 권한 작업에 사용되었습니다.' }).code,
    'conflict',
  );
  assert.equal(
    toStaffManagementError({ code: 'user_already_exists', message: `User ${EMAIL} already exists` }).code,
    'duplicate_invite',
  );

  const response = errorResponse({ code: 'user_already_exists', message: `User ${EMAIL} already exists` });
  const body = await response.json();
  assert.equal(JSON.stringify(body).includes(EMAIL), false);
  assert.equal(body.error.code, 'duplicate_invite');
});

let failures = 0;
for (const { name, run } of tests) {
  try {
    await run();
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    failures += 1;
    process.stderr.write(`FAIL ${name}: ${error?.message || 'unknown error'}\n`);
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  process.stdout.write(`PASS ${tests.length} R-10 server contract checks\n`);
}
