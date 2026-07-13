const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BEARER_PATTERN = /^Bearer ([A-Za-z0-9._~+\/-]+={0,2})$/;
const MAX_JSON_BODY_BYTES = 4096;
const CANONICAL_PRODUCTION_ORIGIN = 'https://hair-cr-mvibes.vercel.app';

const ERROR_SPECS = {
  auth_admin_failed: {
    message: '직원 인증 정보를 처리하지 못했습니다.',
    status: 502,
    retryable: true,
  },
  backend_failure: {
    message: '직원 권한 요청을 처리하지 못했습니다.',
    status: 502,
    retryable: true,
  },
  conflict: {
    message: '다른 권한 요청과 충돌했습니다. 새 요청으로 다시 시도해 주세요.',
    status: 409,
    retryable: true,
  },
  duplicate_invite: {
    message: '이미 등록된 직원입니다.',
    status: 409,
    retryable: false,
  },
  forbidden: {
    message: '직원 권한을 관리할 수 없습니다.',
    status: 403,
    retryable: false,
  },
  invalid_origin: {
    message: '허용되지 않은 요청 출처입니다.',
    status: 403,
    retryable: false,
  },
  last_owner_forbidden: {
    message: '마지막 owner는 staff로 변경할 수 없습니다.',
    status: 409,
    retryable: false,
  },
  not_found: {
    message: '대상 직원을 찾을 수 없습니다.',
    status: 404,
    retryable: false,
  },
  partial_failure: {
    message: '초대는 전송되었지만 직원 권한 등록을 완료하지 못했습니다.',
    status: 502,
    retryable: true,
  },
  self_demotion_forbidden: {
    message: '자신의 owner 권한은 변경할 수 없습니다.',
    status: 409,
    retryable: false,
  },
  supabase_not_configured: {
    message: '직원 권한 관리 서버가 구성되지 않았습니다.',
    status: 503,
    retryable: true,
  },
  unauthorized: {
    message: '로그인이 필요합니다.',
    status: 401,
    retryable: false,
  },
  validation_error: {
    message: '요청 값을 확인해 주세요.',
    status: 422,
    retryable: false,
  },
};

export class StaffManagementError extends Error {
  constructor(code, options = {}) {
    const spec = ERROR_SPECS[code] || ERROR_SPECS.backend_failure;
    super(spec.message);
    this.name = 'StaffManagementError';
    this.code = ERROR_SPECS[code] ? code : 'backend_failure';
    this.status = options.status ?? spec.status;
    this.retryable = options.retryable ?? spec.retryable;
    this.result = options.result;
  }
}

function assertPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new StaffManagementError('validation_error');
  }
}

function assertExactKeys(value, allowedKeys) {
  const allowed = new Set(allowedKeys);

  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new StaffManagementError('validation_error');
  }
}

function normalizeEmail(value) {
  if (typeof value !== 'string') {
    throw new StaffManagementError('validation_error');
  }

  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new StaffManagementError('validation_error');
  }

  return email;
}

function normalizeRequestId(value) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new StaffManagementError('validation_error');
  }

  return value.toLowerCase();
}

export function validateUserId(value) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new StaffManagementError('validation_error');
  }

  return value.toLowerCase();
}

export function validateInvitationPayload(value) {
  assertPlainObject(value);
  assertExactKeys(value, ['email', 'requestId']);

  return {
    email: normalizeEmail(value.email),
    requestId: normalizeRequestId(value.requestId),
  };
}

export function validateRolePayload(value) {
  assertPlainObject(value);
  assertExactKeys(value, ['requestId', 'role']);

  if (value.role !== 'owner' && value.role !== 'staff') {
    throw new StaffManagementError('validation_error');
  }

  return {
    requestId: normalizeRequestId(value.requestId),
    role: value.role,
  };
}

export function requireBearerToken(value) {
  if (typeof value !== 'string' || value.length > 8192) {
    throw new StaffManagementError('unauthorized');
  }

  const match = BEARER_PATTERN.exec(value);
  if (!match) {
    throw new StaffManagementError('unauthorized');
  }

  return match[1];
}

export async function readJsonBody(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw new StaffManagementError('validation_error');
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_JSON_BODY_BYTES) {
    throw new StaffManagementError('validation_error');
  }

  const text = await request.text();
  if (!text || new TextEncoder().encode(text).byteLength > MAX_JSON_BODY_BYTES) {
    throw new StaffManagementError('validation_error');
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new StaffManagementError('validation_error');
  }
}

function isAllowedRequestOrigin(url) {
  if (url.origin === CANONICAL_PRODUCTION_ORIGIN) {
    return true;
  }

  return (
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  );
}

export function resolveInviteRedirect(request) {
  let requestUrl;
  let originUrl;

  try {
    requestUrl = new URL(request.url);
    originUrl = new URL(request.headers.get('origin') || '');
  } catch {
    throw new StaffManagementError('invalid_origin');
  }

  if (
    !isAllowedRequestOrigin(requestUrl) ||
    !isAllowedRequestOrigin(originUrl) ||
    requestUrl.origin !== originUrl.origin
  ) {
    throw new StaffManagementError('invalid_origin');
  }

  const host = request.headers.get('host');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (!host || host.toLowerCase() !== requestUrl.host.toLowerCase()) {
    throw new StaffManagementError('invalid_origin');
  }

  if (
    (forwardedHost && forwardedHost.toLowerCase() !== requestUrl.host.toLowerCase()) ||
    (forwardedProto && `${forwardedProto.toLowerCase()}:` !== requestUrl.protocol)
  ) {
    throw new StaffManagementError('invalid_origin');
  }

  return `${requestUrl.origin}/invite/accept`;
}

export function validateSupabaseConfiguration({ anonKey, secretKey, url }, requireSecret = false) {
  if (!url || !anonKey || (requireSecret && !secretKey)) {
    throw new StaffManagementError('supabase_not_configured');
  }

  return { anonKey, secretKey, url };
}

export function maskEmail(value) {
  if (typeof value !== 'string' || !EMAIL_PATTERN.test(value)) {
    return null;
  }

  const [local, domain] = value.toLowerCase().split('@');
  const domainParts = domain.split('.');
  const domainName = domainParts.shift();
  if (!local || !domainName || domainParts.length === 0) {
    return null;
  }

  return `${local[0]}***@${domainName[0]}***.${domainParts.join('.')}`;
}

function profileUserId(profile) {
  return profile?.user_id || profile?.id || null;
}

function isEmailConfirmed(user) {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at);
}

function toStaffRecord(profile, user) {
  const emailConfirmed = isEmailConfirmed(user);

  return {
    userId: profileUserId(profile),
    role: profile.role,
    emailMasked: maskEmail(user?.email),
    emailConfirmed,
    inviteState: user ? (emailConfirmed ? 'accepted' : 'pending') : 'missing_auth',
    createdAt: profile.created_at || null,
    updatedAt: profile.updated_at || null,
  };
}

function findUserByEmail(users, email) {
  return users.find(
    (user) => typeof user?.email === 'string' && user.email.toLowerCase() === email,
  );
}

function hasProfile(profiles, userId) {
  return profiles.some((profile) => profileUserId(profile) === userId);
}

export async function getStaffDirectory({ authorizeOwner, listAuthUsers }) {
  const profiles = (await authorizeOwner()) || [];
  const users = (await listAuthUsers()) || [];
  const usersById = new Map(users.map((user) => [user.id, user]));

  return profiles
    .filter((profile) => profileUserId(profile))
    .map((profile) => toStaffRecord(profile, usersById.get(profileUserId(profile))))
    .sort((left, right) => {
      const createdComparison = String(left.createdAt).localeCompare(String(right.createdAt));
      return createdComparison || left.userId.localeCompare(right.userId);
    });
}

export async function inviteStaffMember(
  { email, redirectTo, requestId },
  {
    authorizeOwner,
    findRequest = async () => null,
    inviteUser,
    listAuthUsers,
    provisionStaff,
  },
) {
  const profiles = (await authorizeOwner()) || [];
  const users = (await listAuthUsers()) || [];
  const existingUser = findUserByEmail(users, email);
  const existingProfile = existingUser && hasProfile(profiles, existingUser.id);

  if (existingUser && isEmailConfirmed(existingUser) && existingProfile) {
    throw new StaffManagementError('duplicate_invite');
  }

  if (existingUser && !isEmailConfirmed(existingUser)) {
    const provisionResult = await provisionStaff({
      requestId,
      userId: existingUser.id,
    });

    if (provisionResult?.replayed || provisionResult?.applied) {
      const inviteStateUnknown =
        provisionResult?.replayed &&
        provisionResult?.event_type === 'staff_provision_noop';
      return {
        status: inviteStateUnknown
          ? 'invite_state_unknown'
          : provisionResult?.replayed
            ? 'replayed'
            : 'repaired',
        inviteState: inviteStateUnknown ? 'unknown' : 'pending',
        applied: Boolean(provisionResult?.applied),
        replayed: Boolean(provisionResult?.replayed),
        staff: {
          userId: existingUser.id,
          role: provisionResult?.next_role || 'staff',
          emailMasked: maskEmail(existingUser.email || email),
          emailConfirmed: false,
        },
      };
    }

    const reinvitedUser = await inviteUser({ email, redirectTo });
    if (!reinvitedUser?.id || existingUser.id !== reinvitedUser.id) {
      throw new StaffManagementError('conflict');
    }

    return {
      status: 'reinvited',
      inviteState: 'pending',
      applied: false,
      replayed: false,
      staff: {
        userId: reinvitedUser.id,
        role: provisionResult?.next_role || 'staff',
        emailMasked: maskEmail(reinvitedUser.email || email),
        emailConfirmed: false,
      },
    };
  }

  if (existingUser) {
    const provisionResult = await provisionStaff({
      requestId,
      userId: existingUser.id,
    });

    return {
      status: provisionResult?.replayed ? 'replayed' : 'repaired',
      inviteState: 'accepted',
      applied: Boolean(provisionResult?.applied),
      replayed: Boolean(provisionResult?.replayed),
      staff: {
        userId: existingUser.id,
        role: provisionResult?.next_role || 'staff',
        emailMasked: maskEmail(existingUser.email || email),
        emailConfirmed: true,
      },
    };
  }

  if (await findRequest(requestId)) {
    throw new StaffManagementError('conflict');
  }

  const user = await inviteUser({ email, redirectTo });
  if (!user?.id) {
    throw new StaffManagementError('auth_admin_failed');
  }

  try {
    const provisionResult = await provisionStaff({
      requestId,
      userId: user.id,
    });

    return {
      status: 'invited',
      inviteState: 'pending',
      applied: Boolean(provisionResult?.applied),
      replayed: Boolean(provisionResult?.replayed),
      staff: {
        userId: user.id,
        role: provisionResult?.next_role || 'staff',
        emailMasked: maskEmail(user.email || email),
        emailConfirmed: isEmailConfirmed(user),
      },
    };
  } catch {
    throw new StaffManagementError('partial_failure', {
      result: { status: 'pending', inviteState: 'pending' },
    });
  }
}

export async function changeStaffMemberRole(
  { requestId, role, userId },
  { changeRole },
) {
  const result = await changeRole({ requestId, role, userId });
  const changed = Boolean(result?.applied) && result?.event_type === 'role_changed';

  return {
    status: changed ? 'changed' : 'unchanged',
    applied: changed,
    staff: {
      userId: result?.target_user_id || userId,
      role: result?.next_role || role,
    },
  };
}

function includesMessage(error, fragment) {
  return String(error?.message || '').includes(fragment);
}

export function toStaffManagementError(error, fallbackCode = 'backend_failure') {
  if (error instanceof StaffManagementError) {
    return error;
  }

  if (error?.status === 401 || error?.code === 'PGRST301') {
    return new StaffManagementError('unauthorized');
  }

  if (error?.code === '42501') {
    return new StaffManagementError(
      includesMessage(error, '인증이 필요') ? 'unauthorized' : 'forbidden',
    );
  }

  if (error?.code === '55000') {
    if (includesMessage(error, '자기 자신의')) {
      return new StaffManagementError('self_demotion_forbidden');
    }
    if (includesMessage(error, '마지막 owner')) {
      return new StaffManagementError('last_owner_forbidden');
    }
  }

  if (error?.code === '22023') {
    return new StaffManagementError(
      includesMessage(error, '요청 ID') ? 'conflict' : 'validation_error',
    );
  }

  if (error?.code === 'P0002') {
    return new StaffManagementError('not_found');
  }

  if (error?.code === 'user_already_exists') {
    return new StaffManagementError('duplicate_invite');
  }

  if (error?.status === 409 || error?.status === 429) {
    return new StaffManagementError('conflict');
  }

  return new StaffManagementError(fallbackCode);
}

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
  Vary: 'Authorization',
  'X-Content-Type-Options': 'nosniff',
};

export function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: RESPONSE_HEADERS,
  });
}

export function errorResponse(error) {
  const safeError = toStaffManagementError(error);
  const body = {
    ok: false,
    error: {
      code: safeError.code,
      message: safeError.message,
    },
  };

  if (safeError.retryable) {
    body.error.retryable = true;
  }
  if (safeError.result) {
    body.result = safeError.result;
  }

  return jsonResponse(body, safeError.status);
}
