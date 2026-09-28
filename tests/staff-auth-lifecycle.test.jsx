import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import AuthGate from '@/components/AuthGate';
import RoleManagementPanel from '@/components/settings/RoleManagementPanel';

let mockAuthEvent;
let mockSession;
let mockLatestContext;
const mockRoleLookup = jest.fn();
const mockRouter = { replace: jest.fn() };
jest.mock('next/navigation', () => ({ usePathname: () => '/settings/team', useRouter: () => mockRouter }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, prefetch, ...props }) => <a {...props}>{children}</a> }));
jest.mock('@/lib/supabase', () => ({ supabase: {
  auth: {
    getSession: async () => ({ data: { session: mockSession }, error: null }),
    onAuthStateChange: callback => { mockAuthEvent = callback; return { data: { subscription: { unsubscribe: jest.fn() } } }; },
  },
  from: () => { const q = { select: () => q, eq: () => q, maybeSingle: () => mockRoleLookup() }; return q; },
} }));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const success = () => ({ ok: true, json: async () => ({ ok: true, status: 'replayed', staff: { userId: 'synthetic-staff', role: 'staff' } }) });
function Observe() { mockLatestContext = useAuth(); return null; }
function App() { return <AuthProvider><Observe /><AuthGate allowedRoles={['owner']}><RoleManagementPanel /></AuthGate></AuthProvider>; }
let previousFetch;
beforeEach(() => {
  previousFetch = global.fetch;
  mockSession = { user: { id: 'owner-a' }, access_token: 'synthetic' };
  mockRoleLookup.mockReset().mockResolvedValue({ data: { role: 'owner' }, error: null });
});
afterEach(() => { global.fetch = previousFetch; jest.restoreAllMocks(); });

it.each([false, true])('preserves request identity across AuthGate remount (late success: %s)', async lateSuccess => {
  const requests = [];
  const response = deferred();
  global.fetch = jest.fn(async (path, options) => {
    if (path === '/api/staff') return { ok: true, json: async () => ({ ok: true, staff: [] }) };
    requests.push(JSON.parse(options.body));
    if (requests.length === 1) {
      if (lateSuccess) return response.promise;
      throw new TypeError('synthetic response loss');
    }
    return success();
  });
  jest.spyOn(global.crypto, 'randomUUID').mockReturnValue('stable-request-id');
  render(<App />);
  const email = await screen.findByLabelText('직원 이메일');
  fireEvent.change(email, { target: { value: 'synthetic@example.invalid' } });
  fireEvent.click(screen.getByRole('button', { name: '초대 보내기' }));
  await waitFor(() => expect(requests).toHaveLength(1));
  if (!lateSuccess) await screen.findByText(/연결을 확인한 뒤 초대 요청 확인/);
  const roleCheck = deferred();
  mockRoleLookup.mockImplementationOnce(() => roleCheck.promise);
  act(() => window.dispatchEvent(new Event('focus')));
  await screen.findByText('인증 상태를 확인하고 있습니다...');
  expect(screen.queryByLabelText('직원 이메일')).toBeNull();
  if (lateSuccess) await act(async () => response.resolve(success()));
  await act(async () => roleCheck.resolve({ data: { role: 'owner' }, error: null }));
  fireEvent.change(await screen.findByLabelText('직원 이메일'), { target: { value: 'synthetic@example.invalid' } });
  fireEvent.click(screen.getByRole('button', { name: '초대 요청 확인' }));
  await screen.findByText('이미 처리된 요청입니다. 현재 초대 상태를 확인해주세요.');
  expect(requests.map(r => r.requestId)).toEqual(['stable-request-id', 'stable-request-id']);
  expect(mockLatestContext.pendingStaffInvitations.size).toBe(0);
});

it('does not share pending identities with another signed-in user', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ ok: true, staff: [] }) }));
  render(<App />);
  await screen.findByLabelText('직원 이메일');
  const first = mockLatestContext.pendingStaffInvitations;
  first.set('synthetic@example.invalid', 'owner-a-request');
  await act(async () => { mockAuthEvent('SIGNED_IN', { user: { id: 'owner-b' }, access_token: 'synthetic-b' }); });
  await waitFor(() => expect(mockLatestContext.user.id).toBe('owner-b'));
  expect(mockLatestContext.pendingStaffInvitations).not.toBe(first);
  expect(mockLatestContext.pendingStaffInvitations.size).toBe(0);
});
