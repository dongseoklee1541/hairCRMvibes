import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CustomerDetailPage from '@/app/customers/[id]/page';

let mockCustomer;
let mockAppointment;
let mockRole;
let mockWrite;
const mockRouter = { back: jest.fn(), replace: jest.fn() };

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'test-customer' }),
  useRouter: () => mockRouter,
}));
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, prefetch, ...props }) => <a {...props}>{children}</a> }));
jest.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ role: mockRole, isRoleReady: true }) }));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from(table) {
      const query = {
        select: () => query, eq: () => query, order: () => query, maybeSingle: () => query,
        then(resolve, reject) {
          const data = table === 'customers' ? mockCustomer : table === 'appointments' ? [mockAppointment] : [];
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    rpc(name, payload) {
      if (name.startsWith('list_')) return Promise.resolve({ data: [], error: null });
      return mockWrite(name, payload);
    },
  },
}));

beforeEach(() => {
  mockRole = 'owner';
  mockCustomer = { id: 'test-customer', name: '테스트 고객', phone: '', memo: '', created_at: '2026-09-11T00:00:00Z' };
  mockAppointment = {
    id: 'test-appointment', date: '2026-09-11', time: '10:00', service: '테스트 시술',
    status: 'completed', actual_price_krw: 70000, price_snapshot_krw: 80000,
    actual_price_updated_at: '2026-09-11T00:00:00Z', appointment_session_pass_usages: [],
  };
  mockWrite = jest.fn().mockResolvedValue({ data: null, error: null });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
afterEach(cleanup);

async function openPrice() {
  render(<CustomerDetailPage />);
  const trigger = await screen.findByRole('button', { name: '테스트 시술 실제 시술금액 수정' });
  fireEvent.click(trigger);
  return { trigger, amount: screen.getByPlaceholderText('미입력'), reason: screen.queryByPlaceholderText('예: 현장 할인 적용') };
}
function submitPrice(amount) { fireEvent.submit(amount.closest('form')); }
function enter(input, value) { input.focus(); fireEvent.change(input, { target: { value } }); }

it('금액을 한 자리씩 입력하고 지워도 입력칸에 포커스가 유지된다', async () => {
  const { amount } = await openPrice();
  amount.focus();
  for (const value of ['', '7', '70', '700', '7000', '70000', '7000', '']) {
    fireEvent.change(amount, { target: { value } });
    expect(document.activeElement).toBe(amount);
    expect(amount.value).toBe(value);
  }
});
it('금액창을 열면 기존 금액 전체가 선택되고 다시 열 때도 현재 값이 선택된다', async () => {
  const { trigger, amount } = await openPrice();
  expect(document.activeElement).toBe(amount);
  expect(amount.selectionStart).toBe(0);
  expect(amount.selectionEnd).toBe(5);
  fireEvent.click(screen.getByRole('button', { name: '실제 시술금액 수정 닫기' }));
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  expect(screen.getByPlaceholderText('미입력').selectionEnd).toBe(5);
});
it('한글 수정 사유를 조합하는 동안 포커스가 유지된다', async () => {
  const { reason } = await openPrice();
  reason.focus();
  fireEvent.compositionStart(reason);
  for (const value of ['ㅎ', '하', '할', '할인']) {
    fireEvent.change(reason, { target: { value } });
    expect(document.activeElement).toBe(reason);
  }
  fireEvent.compositionEnd(reason, { data: '할인' });
  expect(reason.value).toBe('할인');
});
it('금액 입력은 숫자 키보드를 요청하고 증감 컨트롤을 제공하지 않는다', async () => {
  const { amount } = await openPrice();
  expect(amount.type).toBe('text');
  expect(amount.inputMode).toBe('numeric');
  expect(screen.queryByRole('spinbutton')).toBeNull();
});
it.each([['', null], ['0', 0], ['75000', 75000], ['2147483647', 2147483647]])('입력 %s를 실제 금액 %s로 저장하며 예약 기준금액은 보내지 않는다', async (value, expected) => {
  const { amount, reason } = await openPrice();
  enter(amount, value); enter(reason, '현장 확인'); submitPrice(amount);
  await waitFor(() => expect(mockWrite).toHaveBeenCalledTimes(1));
  expect(mockWrite).toHaveBeenCalledWith('set_appointment_actual_price', {
    p_appointment_id: 'test-appointment', p_actual_price_krw: expected,
    p_expected_actual_price_updated_at: '2026-09-11T00:00:00Z', p_update_reason: '현장 확인',
  });
  await screen.findByText('실제 시술금액을 저장했습니다.');
});
it.each(['-1', '1.5', '1e3', ' ', '12원', '2147483648'])('잘못된 금액 %s는 저장하지 않는다', async (value) => {
  const { amount, reason } = await openPrice();
  enter(amount, value); enter(reason, '확인'); submitPrice(amount);
  expect(mockWrite).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('금액');
});
it('완료 예약은 변경 사유가 없으면 저장하지 않는다', async () => {
  const { amount } = await openPrice(); enter(amount, '75000'); submitPrice(amount);
  expect(mockWrite).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('변경 사유');
});
it('금액이 같으면 RPC 없이 창을 닫고 원래 버튼으로 돌아간다', async () => {
  const { amount, trigger } = await openPrice(); submitPrice(amount);
  expect(mockWrite).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
it('저장 중 Escape로 닫히지 않고 실패하면 입력값이 남아 재시도할 수 있다', async () => {
  let resolve;
  mockWrite.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const { amount, reason } = await openPrice();
  enter(amount, '75000'); enter(reason, '현장 할인'); submitPrice(amount);
  expect(amount.disabled).toBe(true);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeTruthy();
  await act(async () => { resolve({ error: { message: '테스트 저장 오류' } }); });
  expect(amount.value).toBe('75000'); expect(reason.value).toBe('현장 할인');
  expect(amount.disabled).toBe(false);
  submitPrice(amount);
  await screen.findByText('실제 시술금액을 저장했습니다.');
  expect(mockWrite).toHaveBeenCalledTimes(2);
});
it('Tab 순환과 Escape 닫기 후 원래 버튼 복원을 유지한다', async () => {
  const { trigger } = await openPrice();
  const close = screen.getByRole('button', { name: '실제 시술금액 수정 닫기' });
  const save = screen.getByRole('button', { name: '실제 금액 저장' });
  save.focus(); fireEvent.keyDown(save, { key: 'Tab' }); expect(document.activeElement).toBe(close);
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(save);
  fireEvent.keyDown(document, { key: 'Escape' }); expect(document.activeElement).toBe(trigger);
});
it('오프라인에서는 저장하지 않고 입력값을 보존한다', async () => {
  const { amount, reason } = await openPrice(); enter(amount, '75000'); enter(reason, '확인');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  submitPrice(amount); expect(mockWrite).not.toHaveBeenCalled();
  expect(amount.value).toBe('75000'); expect(screen.getByRole('alert').textContent).toContain('오프라인');
});
it('공통 포커스 처리를 쓰는 횟수권 이름도 연속 입력된다', async () => {
  render(<CustomerDetailPage />);
  fireEvent.click(await screen.findByRole('button', { name: '등록', exact: true }));
  const name = screen.getByLabelText('횟수권 이름'); name.focus();
  for (const value of ['테', '테스트', '테스트 횟수권']) {
    fireEvent.change(name, { target: { value } }); expect(document.activeElement).toBe(name);
  }
});
it('읽기 전용 고객에게 금액 수정 버튼을 노출하지 않는다', async () => {
  mockCustomer.archived_at = '2026-09-11T00:00:00Z';
  render(<CustomerDetailPage />); await screen.findByText('테스트 고객');
  expect(screen.queryByRole('button', { name: '테스트 시술 실제 시술금액 수정' })).toBeNull();
});

it('횟수권 저장 중에도 Escape로 창을 닫지 않는다', async () => {
  let resolve;
  mockWrite.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  render(<CustomerDetailPage />);
  fireEvent.click(await screen.findByRole('button', { name: '등록', exact: true }));
  const name = screen.getByLabelText('횟수권 이름'); enter(name, '테스트 횟수권');
  fireEvent.submit(name.closest('form'));
  expect(mockWrite).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeTruthy();
  await act(async () => { resolve({ error: { message: '테스트 오류' } }); });
  expect(name.value).toBe('테스트 횟수권');
});
it('동시 수정 충돌 후 재조회해도 금액창 입력을 이어갈 수 있다', async () => {
  mockWrite.mockResolvedValueOnce({ error: { code: '40001' } });
  const { amount, reason } = await openPrice(); enter(amount, '75000'); enter(reason, '확인');
  await act(async () => { submitPrice(amount); });
  const reopened = screen.getByPlaceholderText('미입력');
  expect(reopened.value).toBe('75000');
  expect(screen.getByRole('alert').textContent).toContain('다른 사용자');
  reopened.focus(); fireEvent.change(reopened, {target:{value:'76000'}});
  expect(document.activeElement).toBe(reopened);
});
