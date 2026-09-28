import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RoleManagementPanel from '@/components/settings/RoleManagementPanel';

let mockPendingRequests;
beforeEach(() => { mockPendingRequests = new Map(); });

jest.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'owner-synthetic' }, session: { access_token: 'synthetic' }, pendingStaffInvitations: mockPendingRequests }),
}));
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, prefetch, ...props }) => <a {...props}>{children}</a> }));

it('reuses the invitation request after response loss, including email edits, and resets after confirmed success', async () => {
  const originalFetch = global.fetch;
  const uuid = jest.spyOn(global.crypto, 'randomUUID').mockReturnValueOnce('request-a').mockReturnValueOnce('request-b');
  const requests = [];
  let fail = true;
  global.fetch = jest.fn(async (path, init) => {
    if (path === '/api/staff') return { ok: true, json: async () => ({ ok: true, staff: [] }) };
    requests.push(JSON.parse(init.body));
    if (fail) { fail = false; throw new TypeError('response lost'); }
    return { ok: true, json: async () => ({ ok: true, status: 'replayed', staff: { userId: 'staff-synthetic', role: 'staff' } }) };
  });
  try {
    const firstMount = render(<RoleManagementPanel />);
    let input = screen.getByLabelText('직원 이메일');
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '초대 보내기' }));
    await screen.findByText('연결을 확인한 뒤 초대 요청 확인을 눌러주세요. 같은 요청을 이어서 확인합니다.');
    firstMount.unmount();
    render(<RoleManagementPanel />);
    input = screen.getByLabelText('직원 이메일');
    fireEvent.change(input, { target: { value: 'other@example.com' } });
    fireEvent.change(input, { target: { value: 'TEST@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '초대 요청 확인' }));
    await waitFor(() => expect(input.value).toBe(''));
    expect(requests.map(r => r.requestId)).toEqual(['request-a', 'request-a']);
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '초대 보내기' }));
    await waitFor(() => expect(requests).toHaveLength(3));
    expect(requests[2].requestId).toBe('request-b');
  } finally {
    global.fetch = originalFetch;
    uuid.mockRestore();
  }
});
