'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import RoleChangeSheet, { getRoleChangeBlockReason } from './RoleChangeSheet';
import styles from './RoleManagementPanel.module.css';

const ERROR_MESSAGES = Object.freeze({
  auth_admin_failed: '직원 인증 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
  backend_failure: '직원 권한 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.',
  conflict: '다른 권한 요청과 충돌했습니다. 새 요청으로 다시 시도해주세요.',
  duplicate_invite: '이미 등록되었거나 초대된 직원입니다.',
  forbidden: '직원 권한은 원장 계정만 관리할 수 있습니다.',
  invalid_origin: '현재 주소에서는 초대 요청을 보낼 수 없습니다.',
  invitation_in_progress: '현재 초대 처리가 진행 중입니다. 잠시 기다린 뒤 직원 목록에서 상태를 확인해주세요.',
  invitation_outcome_unknown: '초대 메일 전송 결과를 확인할 수 없습니다. 운영 확인 전에는 같은 이메일로 다시 보내지 마세요.',
  last_owner_forbidden: '마지막 원장은 직원으로 변경할 수 없습니다.',
  network_error: '네트워크 연결을 확인한 뒤 다시 시도해주세요.',
  not_found: '대상 직원을 찾을 수 없습니다. 목록을 새로고침해주세요.',
  partial_failure: '초대 메일은 전송되었지만 직원 권한 등록이 완료되지 않았습니다. 다시 제출하면 메일 재전송 없이 권한 등록만 복구합니다.',
  profile_repair_failed: '기존 계정의 직원 권한 등록이 완료되지 않았습니다. 다시 제출하면 메일을 보내지 않고 권한 등록만 복구합니다.',
  self_demotion_forbidden: '본인 계정의 원장 권한은 변경할 수 없습니다.',
  supabase_not_configured: '직원 권한 관리 서버가 아직 구성되지 않았습니다.',
  unauthorized: '로그인 세션이 만료되었습니다. 다시 로그인해주세요.',
  validation_error: '입력한 값을 다시 확인해주세요.',
});

const EMPTY_FEEDBACK = Object.freeze({ kind: 'idle', message: '' });
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MEMBER_DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'Asia/Seoul',
});

class StaffApiError extends Error {
  constructor(code, retryable = false) {
    super(code);
    this.name = 'StaffApiError';
    this.code = code;
    this.retryable = retryable;
  }
}

function getErrorCode(error) {
  if (error instanceof StaffApiError && ERROR_MESSAGES[error.code]) {
    return error.code;
  }
  return 'network_error';
}

function getErrorMessage(code) {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.backend_failure;
}

function getInviteState(member) {
  if (member.inviteState === 'missing_auth') {
    return { label: '인증 정보 없음', tone: 'warning' };
  }
  if (member.inviteState === 'pending' || !member.emailConfirmed) {
    return { label: '수락 대기', tone: 'pending' };
  }
  return { label: '사용 중', tone: 'active' };
}

function formatMemberDate(value) {
  if (!value) {
    return '기록 없음';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '기록 없음';
  }

  return MEMBER_DATE_FORMATTER.format(date);
}

async function requestStaffApi(path, accessToken, options = {}) {
  if (!accessToken) {
    throw new StaffApiError('unauthorized');
  }

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(path, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
      signal: options.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error;
    }
    throw new StaffApiError('network_error', true);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new StaffApiError('backend_failure', response.status >= 500);
  }

  if (!response.ok || payload?.ok !== true) {
    const code = ERROR_MESSAGES[payload?.error?.code]
      ? payload.error.code
      : response.status === 401
        ? 'unauthorized'
        : 'backend_failure';
    throw new StaffApiError(code, Boolean(payload?.error?.retryable));
  }

  return payload;
}

function upsertInvitedStaff(currentStaff, payload) {
  const invited = payload?.staff;
  if (!invited?.userId) {
    return currentStaff;
  }

  const existingIndex = currentStaff.findIndex((member) => member.userId === invited.userId);
  const existing = existingIndex >= 0 ? currentStaff[existingIndex] : {};
  const nextMember = {
    ...existing,
    ...invited,
    emailConfirmed: Boolean(invited.emailConfirmed),
    inviteState: payload.inviteState || existing.inviteState || 'pending',
    createdAt: existing.createdAt || null,
    updatedAt: existing.updatedAt || null,
  };

  if (existingIndex < 0) {
    return [...currentStaff, nextMember];
  }

  return currentStaff.map((member, index) => (index === existingIndex ? nextMember : member));
}

export default function RoleManagementPanel() {
  const { session, user } = useAuth();
  const accessToken = session?.access_token || '';
  const [staff, setStaff] = useState([]);
  const [directoryStatus, setDirectoryStatus] = useState('loading');
  const [directoryErrorCode, setDirectoryErrorCode] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState(EMPTY_FEEDBACK);
  const [selectedMember, setSelectedMember] = useState(null);
  const [roleSubmitting, setRoleSubmitting] = useState(false);
  const [roleErrorMessage, setRoleErrorMessage] = useState('');
  const [roleFeedback, setRoleFeedback] = useState('');
  const inviteSubmittingRef = useRef(false);
  const roleSubmittingRef = useRef(false);
  const returnFocusRef = useRef(null);

  const ownerCount = staff.filter((member) => member.role === 'owner').length;

  const loadStaff = useCallback(async (signal) => {
    setDirectoryStatus('loading');
    setDirectoryErrorCode('');

    try {
      const payload = await requestStaffApi('/api/staff', accessToken, { signal });
      setStaff(Array.isArray(payload.staff) ? payload.staff : []);
      setDirectoryStatus('ready');
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }
      setStaff([]);
      setDirectoryErrorCode(getErrorCode(error));
      setDirectoryStatus('error');
    }
  }, [accessToken]);

  useEffect(() => {
    const controller = new AbortController();
    loadStaff(controller.signal);
    return () => controller.abort();
  }, [loadStaff]);

  const handleInvite = async (event) => {
    event.preventDefault();
    if (inviteSubmittingRef.current) {
      return;
    }

    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > 254) {
      setInviteFeedback({ kind: 'error', message: ERROR_MESSAGES.validation_error });
      return;
    }

    if (!globalThis.crypto?.randomUUID) {
      setInviteFeedback({ kind: 'error', message: ERROR_MESSAGES.backend_failure });
      return;
    }

    inviteSubmittingRef.current = true;
    setInviteSubmitting(true);
    setInviteFeedback(EMPTY_FEEDBACK);

    try {
      const payload = await requestStaffApi('/api/staff/invitations', accessToken, {
        method: 'POST',
        body: {
          email: normalizedEmail,
          requestId: globalThis.crypto.randomUUID(),
        },
      });

      setStaff((currentStaff) => upsertInvitedStaff(currentStaff, payload));
      setInviteEmail('');
      setDirectoryStatus('ready');

      if (payload.status === 'repaired') {
        setInviteFeedback({
          kind: 'success',
          message: '직원 권한 등록을 복구했습니다.',
        });
      } else if (payload.status === 'replayed') {
        setInviteFeedback({
          kind: 'success',
          message: '이미 처리된 요청입니다. 현재 초대 상태를 확인해주세요.',
        });
      } else if (payload.status === 'invite_state_unknown') {
        setInviteFeedback({
          kind: 'pending',
          message: '이전 재초대의 이메일 전송 결과를 확인할 수 없습니다. 운영 확인 전에는 같은 이메일로 다시 보내지 마세요.',
        });
      } else {
        setInviteFeedback({
          kind: 'pending',
          message: payload.status === 'reinvited'
            ? '초대 메일을 다시 보냈습니다. 수락을 기다리고 있습니다.'
            : '초대 메일을 보냈습니다. 수락을 기다리고 있습니다.',
        });
      }
    } catch (error) {
      const code = getErrorCode(error);
      setInviteFeedback({
        kind: code === 'duplicate_invite'
          ? 'duplicate'
          : [
              'invitation_in_progress',
              'invitation_outcome_unknown',
              'partial_failure',
              'profile_repair_failed',
            ].includes(code)
            ? 'pending'
            : 'error',
        message: getErrorMessage(code),
      });
    } finally {
      inviteSubmittingRef.current = false;
      setInviteSubmitting(false);
    }
  };

  const openRoleSheet = (member, triggerElement) => {
    returnFocusRef.current = triggerElement;
    setRoleErrorMessage('');
    setRoleFeedback('');
    setSelectedMember(member);
  };

  const closeRoleSheet = () => {
    if (roleSubmittingRef.current) {
      return;
    }
    setSelectedMember(null);
    setRoleErrorMessage('');
  };

  const handleRoleChange = async (nextRole) => {
    if (!selectedMember || roleSubmittingRef.current) {
      return;
    }

    const blockReason = getRoleChangeBlockReason({
      member: selectedMember,
      nextRole,
      currentUserId: user?.id,
      ownerCount,
    });
    if (blockReason) {
      setRoleErrorMessage(blockReason);
      return;
    }

    if (nextRole === selectedMember.role) {
      setRoleErrorMessage('현재 역할과 다른 역할을 선택해주세요.');
      return;
    }

    if (!globalThis.crypto?.randomUUID) {
      setRoleErrorMessage(ERROR_MESSAGES.backend_failure);
      return;
    }

    roleSubmittingRef.current = true;
    setRoleSubmitting(true);
    setRoleErrorMessage('');

    try {
      const payload = await requestStaffApi(
        `/api/staff/${encodeURIComponent(selectedMember.userId)}/role`,
        accessToken,
        {
          method: 'PATCH',
          body: {
            role: nextRole,
            requestId: globalThis.crypto.randomUUID(),
          },
        }
      );
      const appliedRole = payload?.staff?.role || nextRole;
      setStaff((currentStaff) =>
        currentStaff.map((member) =>
          member.userId === selectedMember.userId
            ? { ...member, role: appliedRole, updatedAt: new Date().toISOString() }
            : member
        )
      );
      setRoleFeedback(
        `${selectedMember.emailMasked || '선택한 직원'}의 역할을 ${appliedRole === 'owner' ? '원장' : '직원'}으로 변경했습니다.`
      );
      setSelectedMember(null);
    } catch (error) {
      setRoleErrorMessage(getErrorMessage(getErrorCode(error)));
    } finally {
      roleSubmittingRef.current = false;
      setRoleSubmitting(false);
    }
  };

  return (
    <main className={`page-content ${styles.page}`}>
      <header className={styles.pageHeader}>
        <Link
          href="/settings"
          prefetch={false}
          className={styles.backButton}
          aria-label="설정으로 돌아가기"
        >
          <ArrowLeft size={21} aria-hidden="true" />
        </Link>
        <div>
          <h1 className="heading-xl">직원 및 권한 관리</h1>
          <p className="caption">직원을 초대하고 원장·직원 역할을 안전하게 관리합니다.</p>
        </div>
      </header>

      <section className={`card ${styles.inviteCard}`} aria-labelledby="staff-invite-title">
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon} aria-hidden="true">
            <UserPlus size={20} />
          </span>
          <div>
            <h2 id="staff-invite-title" className="heading-md">직원 초대</h2>
            <p className="caption">초대 메일 수락 전까지 대기 상태로 표시됩니다.</p>
          </div>
        </div>

        <form className={styles.inviteForm} onSubmit={handleInvite} noValidate>
          <label htmlFor="staff-invite-email">직원 이메일</label>
          <div className={styles.emailField}>
            <Mail size={18} aria-hidden="true" />
            <input
              id="staff-invite-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              maxLength={254}
              placeholder="staff@example.com"
              value={inviteEmail}
              aria-describedby="staff-invite-feedback"
              aria-invalid={
                inviteFeedback.kind === 'error' &&
                inviteFeedback.message === ERROR_MESSAGES.validation_error
              }
              onChange={(event) => {
                setInviteEmail(event.target.value);
                if (inviteFeedback.kind !== 'idle') {
                  setInviteFeedback(EMPTY_FEEDBACK);
                }
              }}
              disabled={inviteSubmitting}
              required
            />
          </div>
          <button type="submit" className={styles.inviteButton} disabled={inviteSubmitting}>
            {inviteSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                초대 중
              </>
            ) : (
              <>
                <UserPlus size={18} aria-hidden="true" />
                초대 보내기
              </>
            )}
          </button>
        </form>

        <div
          id="staff-invite-feedback"
          className={styles.feedbackRegion}
          aria-live="polite"
          aria-atomic="true"
        >
          {inviteFeedback.message ? (
            <div
              className={`${styles.feedback} ${styles[`feedback_${inviteFeedback.kind}`]}`}
              role={inviteFeedback.kind === 'error' || inviteFeedback.kind === 'duplicate' ? 'alert' : 'status'}
            >
              {inviteFeedback.kind === 'success' ? (
                <CheckCircle2 size={18} aria-hidden="true" />
              ) : inviteFeedback.kind === 'pending' ? (
                <Clock3 size={18} aria-hidden="true" />
              ) : (
                <AlertCircle size={18} aria-hidden="true" />
              )}
              <span>{inviteFeedback.message}</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className={`card ${styles.staffCard}`} aria-labelledby="staff-list-title">
        <div className={styles.listHeader}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon} aria-hidden="true">
              <Users size={20} />
            </span>
            <div>
              <h2 id="staff-list-title" className="heading-md">직원 목록</h2>
              <p className="caption">
                {directoryStatus === 'ready' ? `등록된 계정 ${staff.length}명` : '권한 정보를 확인합니다.'}
              </p>
            </div>
          </div>
          {directoryStatus === 'ready' ? (
            <span className={styles.ownerCount}>원장 {ownerCount}명</span>
          ) : null}
        </div>

        <div className={styles.roleFeedback} aria-live="polite" aria-atomic="true">
          {roleFeedback ? (
            <p>
              <CheckCircle2 size={17} aria-hidden="true" />
              {roleFeedback}
            </p>
          ) : null}
        </div>

        <div className={styles.directory} aria-busy={directoryStatus === 'loading'}>
          {directoryStatus === 'loading' ? (
            <div className={styles.systemState} role="status">
              <Loader2 size={26} className="animate-spin" aria-hidden="true" />
              <strong>직원 목록을 불러오는 중입니다</strong>
              <span>권한 정보를 안전하게 확인하고 있습니다.</span>
            </div>
          ) : directoryStatus === 'error' ? (
            <div className={styles.systemState} role="alert">
              <AlertCircle size={28} aria-hidden="true" />
              <strong>직원 목록을 불러오지 못했습니다</strong>
              <span>{getErrorMessage(directoryErrorCode)}</span>
              <button type="button" onClick={() => loadStaff()}>
                <RefreshCw size={17} aria-hidden="true" />
                다시 시도
              </button>
            </div>
          ) : staff.length === 0 ? (
            <div className={styles.systemState} role="status">
              <ShieldCheck size={29} aria-hidden="true" />
              <strong>등록된 직원이 없습니다</strong>
              <span>위 입력란에서 첫 직원을 초대해주세요.</span>
            </div>
          ) : (
            <ul className={styles.staffList}>
              {staff.map((member) => {
                const inviteState = getInviteState(member);
                const isCurrentUser = member.userId === user?.id;
                return (
                  <li key={member.userId} className={styles.staffRow}>
                    <div className={styles.memberTopLine}>
                      <div className={styles.memberIdentity}>
                        <strong>{member.emailMasked || '이메일 확인 불가'}</strong>
                        {isCurrentUser ? <span className={styles.meBadge}>내 계정</span> : null}
                      </div>
                      <span className={`${styles.roleBadge} ${member.role === 'owner' ? styles.roleOwner : styles.roleStaff}`}>
                        {member.role === 'owner' ? '원장' : '직원'}
                      </span>
                    </div>

                    <div className={styles.memberMeta}>
                      <span className={styles[`invite_${inviteState.tone}`]}>
                        {inviteState.label}
                      </span>
                      <span>등록 {formatMemberDate(member.createdAt)}</span>
                      <span>변경 {formatMemberDate(member.updatedAt)}</span>
                    </div>

                    {isCurrentUser && member.role === 'owner' ? (
                      <p className={styles.selfGuard}>본인 원장 권한은 변경할 수 없습니다.</p>
                    ) : null}

                    <button
                      type="button"
                      className={styles.roleButton}
                      onClick={(event) => openRoleSheet(member, event.currentTarget)}
                      disabled={roleSubmitting}
                      aria-label={`${member.emailMasked || '선택한 직원'} 역할 변경 확인`}
                    >
                      역할 변경 확인
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <RoleChangeSheet
        open={Boolean(selectedMember)}
        member={selectedMember}
        currentUserId={user?.id}
        ownerCount={ownerCount}
        saving={roleSubmitting}
        errorMessage={roleErrorMessage}
        returnFocusRef={returnFocusRef}
        onClose={closeRoleSheet}
        onConfirm={handleRoleChange}
      />
    </main>
  );
}
