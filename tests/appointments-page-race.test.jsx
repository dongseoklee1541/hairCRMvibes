import React, { StrictMode } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import AppointmentsPage from '@/app/appointments/page';

let mockHarness;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args) => mockHarness.from(...args),
    rpc: (...args) => mockHarness.rpc(...args),
  },
}));

jest.mock('@/lib/dateTime', () => {
  const actual = jest.requireActual('@/lib/dateTime');

  return {
    ...actual,
    getTodayKstCalendarParts: () => ({
      year: 2026,
      month: 7,
      day: 13,
      monthIndex: 6,
    }),
    getTodayKstDateKey: () => '2026-07-13',
  };
});

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function createSupabaseHarness() {
  const requests = [];

  function enqueue(meta) {
    const deferred = createDeferred();
    const request = {
      ...meta,
      ...deferred,
      settled: false,
    };
    requests.push(request);
    return request;
  }

  function from(table) {
    const spec = {
      filters: [],
      operation: 'select',
      orders: [],
      payload: null,
      selectedColumns: null,
      table,
    };
    let dispatchedPromise;

    const builder = {
      eq(column, value) {
        spec.filters.push({ column, operator: 'eq', value });
        return builder;
      },
      gte(column, value) {
        spec.filters.push({ column, operator: 'gte', value });
        return builder;
      },
      lte(column, value) {
        spec.filters.push({ column, operator: 'lte', value });
        return builder;
      },
      order(column, options) {
        spec.orders.push({ column, options });
        return builder;
      },
      select(columns) {
        spec.selectedColumns = columns;
        return builder;
      },
      then(onFulfilled, onRejected) {
        if (!dispatchedPromise) {
          if (table === 'salon_service_defaults') {
            dispatchedPromise = Promise.resolve({ data: [], error: null });
          } else {
            const dateEq = spec.filters.find(
              (filter) => filter.column === 'date' && filter.operator === 'eq'
            );
            const startDate = spec.filters.find(
              (filter) => filter.column === 'date' && filter.operator === 'gte'
            );
            const endDate = spec.filters.find(
              (filter) => filter.column === 'date' && filter.operator === 'lte'
            );
            const idEq = spec.filters.find(
              (filter) => filter.column === 'id' && filter.operator === 'eq'
            );
            const kind = spec.operation === 'update'
              ? 'edit'
              : spec.selectedColumns === 'date'
                ? 'month'
                : 'daily';
            const request = enqueue({
              dateKey: dateEq?.value || null,
              endDate: endDate?.value || null,
              id: idEq?.value || null,
              kind,
              payload: spec.payload,
              startDate: startDate?.value || null,
            });
            dispatchedPromise = request.promise;
          }
        }

        return dispatchedPromise.then(onFulfilled, onRejected);
      },
      update(payload) {
        spec.operation = 'update';
        spec.payload = payload;
        return builder;
      },
    };

    return builder;
  }

  function rpc(name, args) {
    return enqueue({
      args,
      kind: 'status',
      name,
    }).promise;
  }

  return { from, requests, rpc };
}

function createAppointment({
  date,
  id,
  name,
  service = '커트',
  time = '10:00:00',
}) {
  return {
    customers: { name },
    date,
    duration_minutes: 60,
    id,
    memo: null,
    price_snapshot_krw: 30000,
    service,
    status: 'confirmed',
    time,
  };
}

function requestsOfKind(kind) {
  return mockHarness.requests.filter((request) => request.kind === kind);
}

async function waitForRequestCount(kind, count) {
  await waitFor(() => {
    expect(requestsOfKind(kind)).toHaveLength(count);
  });
  return requestsOfKind(kind);
}

async function settleRequest(request, result) {
  await act(async () => {
    request.settled = true;
    request.resolve(result);
    await Promise.resolve();
  });
}

async function renderLoadedDay(appointment) {
  const view = render(<AppointmentsPage />);
  const [monthRequest] = await waitForRequestCount('month', 1);
  const [dailyRequest] = await waitForRequestCount('daily', 1);
  await settleRequest(monthRequest, {
    data: [{ date: appointment.date }],
    error: null,
  });
  await settleRequest(dailyRequest, { data: [appointment], error: null });
  expect(document.body.textContent).toContain(appointment.customers.name);
  return view;
}

beforeEach(() => {
  mockHarness = createSupabaseHarness();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

test.each([
  ['성공', { data: [createAppointment({ date: '2026-07-13', id: 'a-late', name: 'A 늦은 고객' })], error: null }],
  ['실패', { data: null, error: { message: 'A 늦은 실패' } }],
])('느린 A 조회의 늦은 %s가 빠른 B 화면을 덮지 않는다', async (_label, lateResult) => {
  render(<AppointmentsPage />);
  const [monthRequest] = await waitForRequestCount('month', 1);
  const [requestA] = await waitForRequestCount('daily', 1);
  await settleRequest(monthRequest, { data: [], error: null });

  fireEvent.click(screen.getByRole('button', { name: /2026년 7월 14일/ }));
  const dailyRequests = await waitForRequestCount('daily', 2);
  const requestB = dailyRequests[1];
  const appointmentB = createAppointment({
    date: '2026-07-14',
    id: 'b-current',
    name: 'B 현재 고객',
  });
  await settleRequest(requestB, { data: [appointmentB], error: null });

  expect(screen.getByRole('heading', { name: /7월 14일.*예약/ })).not.toBeNull();
  expect(document.body.textContent).toContain('B 현재 고객');
  expect(screen.queryByText('선택한 날짜의 예약을 불러오는 중입니다.')).toBeNull();

  await settleRequest(requestA, lateResult);

  expect(screen.getByRole('heading', { name: /7월 14일.*예약/ })).not.toBeNull();
  expect(document.body.textContent).toContain('B 현재 고객');
  expect(document.body.textContent).not.toContain('A 늦은 고객');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByText('선택한 날짜의 예약을 불러오는 중입니다.')).toBeNull();
});

test('A 상태 변경 완료 후에는 B만 다시 조회하고 B feedback을 보존한다', async () => {
  const appointmentA = createAppointment({
    date: '2026-07-13',
    id: 'appointment-a',
    name: 'A 고객',
  });
  await renderLoadedDay(appointmentA);

  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  const [mutationA] = await waitForRequestCount('status', 1);

  fireEvent.click(screen.getByRole('button', { name: /2026년 7월 14일/ }));
  const initialDailyRequests = await waitForRequestCount('daily', 2);
  const appointmentB = createAppointment({
    date: '2026-07-14',
    id: 'appointment-b',
    name: 'B 고객',
  });
  await settleRequest(initialDailyRequests[1], { data: [appointmentB], error: null });

  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  const statusRequests = await waitForRequestCount('status', 2);
  const mutationB = statusRequests[1];
  await settleRequest(mutationB, { data: null, error: null });

  const monthAfterB = (await waitForRequestCount('month', 2))[1];
  const dailyAfterB = (await waitForRequestCount('daily', 3))[2];
  expect(dailyAfterB.dateKey).toBe('2026-07-14');
  await settleRequest(monthAfterB, { data: [{ date: '2026-07-14' }], error: null });
  await settleRequest(dailyAfterB, { data: [appointmentB], error: null });
  expect(screen.getByText(/B 고객 상태를 완료/)).not.toBeNull();

  await settleRequest(mutationA, { data: null, error: null });

  const monthAfterA = (await waitForRequestCount('month', 3))[2];
  const dailyAfterA = (await waitForRequestCount('daily', 4))[3];
  expect(dailyAfterA.dateKey).toBe('2026-07-14');
  expect(requestsOfKind('daily').slice(2).every((request) => request.dateKey === '2026-07-14')).toBe(true);
  await settleRequest(monthAfterA, { data: [{ date: '2026-07-14' }], error: null });
  await settleRequest(dailyAfterA, { data: [appointmentB], error: null });

  expect(screen.getByText(/B 고객 상태를 완료/)).not.toBeNull();
  expect(screen.queryByText(/A 고객 상태를 완료/)).toBeNull();
  expect(document.body.textContent).toContain('B 고객');
});

test('겹친 상태 변경 중 이전 날짜로 돌아가도 해당 예약의 중복 mutation을 막는다', async () => {
  const appointmentA = createAppointment({
    date: '2026-07-13',
    id: 'status-lock-a',
    name: '상태 잠금 A 고객',
  });
  await renderLoadedDay(appointmentA);

  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  const [mutationA] = await waitForRequestCount('status', 1);

  fireEvent.click(screen.getByRole('button', { name: /2026년 7월 14일/ }));
  const appointmentB = createAppointment({
    date: '2026-07-14',
    id: 'status-lock-b',
    name: '상태 잠금 B 고객',
  });
  const dailyB = (await waitForRequestCount('daily', 2))[1];
  await settleRequest(dailyB, { data: [appointmentB], error: null });

  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  const mutationB = (await waitForRequestCount('status', 2))[1];
  await settleRequest(mutationB, { data: null, error: null });
  const monthAfterB = (await waitForRequestCount('month', 2))[1];
  const dailyAfterB = (await waitForRequestCount('daily', 3))[2];
  await settleRequest(monthAfterB, { data: [{ date: '2026-07-14' }], error: null });
  await settleRequest(dailyAfterB, { data: [appointmentB], error: null });

  fireEvent.click(screen.getByRole('button', { name: /2026년 7월 13일/ }));
  const dailyAReturn = (await waitForRequestCount('daily', 4))[3];
  await settleRequest(dailyAReturn, { data: [appointmentA], error: null });

  const completeButton = screen.getByRole('button', { name: '완료' });
  const editButton = screen.getByRole('button', { name: '수정' });
  expect(completeButton.disabled).toBe(true);
  expect(editButton.disabled).toBe(true);
  fireEvent.click(completeButton);
  expect(requestsOfKind('status')).toHaveLength(2);

  await settleRequest(mutationA, { data: null, error: null });
  const monthAfterA = (await waitForRequestCount('month', 3))[2];
  const dailyAfterA = (await waitForRequestCount('daily', 5))[4];
  await settleRequest(monthAfterA, { data: [{ date: '2026-07-13' }], error: null });
  await settleRequest(dailyAfterA, { data: [appointmentA], error: null });

  await waitFor(() => {
    expect(screen.getByRole('button', { name: '완료' }).disabled).toBe(false);
  });
});

test('A 예약 수정 완료 후에는 이동한 월·날짜 B만 새로고침하고 B 편집기를 닫지 않는다', async () => {
  const appointmentA = createAppointment({
    date: '2026-07-13',
    id: 'edit-a',
    name: '수정 A 고객',
  });
  await renderLoadedDay(appointmentA);

  fireEvent.click(screen.getByRole('button', { name: '수정' }));
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  const [editA] = await waitForRequestCount('edit', 1);

  fireEvent.click(screen.getByRole('button', { name: '다음 달' }));
  const monthRequests = await waitForRequestCount('month', 2);
  const dailyRequests = await waitForRequestCount('daily', 2);
  const appointmentB = createAppointment({
    date: '2026-08-01',
    id: 'edit-b',
    name: '편집 B 고객',
  });
  await settleRequest(monthRequests[1], { data: [{ date: '2026-08-01' }], error: null });
  await settleRequest(dailyRequests[1], { data: [appointmentB], error: null });

  fireEvent.click(screen.getByRole('button', { name: '수정' }));
  expect(screen.getByRole('button', { name: '저장' })).not.toBeNull();

  await settleRequest(editA, { data: null, error: null });

  const latestMonth = (await waitForRequestCount('month', 3))[2];
  const latestDaily = (await waitForRequestCount('daily', 3))[2];
  expect(latestMonth.startDate).toBe('2026-08-01');
  expect(latestMonth.endDate).toBe('2026-08-31');
  expect(latestDaily.dateKey).toBe('2026-08-01');
  await settleRequest(latestMonth, { data: [{ date: '2026-08-01' }], error: null });
  await settleRequest(latestDaily, { data: [appointmentB], error: null });

  expect(screen.getByRole('heading', { name: /8월 1일.*예약/ })).not.toBeNull();
  expect(document.body.textContent).toContain('편집 B 고객');
  expect(screen.getByRole('button', { name: '저장' })).not.toBeNull();
  expect(screen.queryByText(/수정 A 고객 예약을 수정/)).toBeNull();
});

test('겹친 예약 수정 중 이전 날짜로 돌아가도 해당 예약의 편집 세션을 다시 열지 않는다', async () => {
  const appointmentA = createAppointment({
    date: '2026-07-13',
    id: 'edit-lock-a',
    name: '편집 잠금 A 고객',
  });
  await renderLoadedDay(appointmentA);

  fireEvent.click(screen.getByRole('button', { name: '수정' }));
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  const [editA] = await waitForRequestCount('edit', 1);

  fireEvent.click(screen.getByRole('button', { name: /2026년 7월 14일/ }));
  const appointmentB = createAppointment({
    date: '2026-07-14',
    id: 'edit-lock-b',
    name: '편집 잠금 B 고객',
  });
  const dailyB = (await waitForRequestCount('daily', 2))[1];
  await settleRequest(dailyB, { data: [appointmentB], error: null });

  fireEvent.click(screen.getByRole('button', { name: '수정' }));
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  const editB = (await waitForRequestCount('edit', 2))[1];

  fireEvent.click(screen.getByRole('button', { name: /2026년 7월 13일/ }));
  const dailyAReturn = (await waitForRequestCount('daily', 3))[2];
  await settleRequest(dailyAReturn, { data: [appointmentA], error: null });
  expect(screen.getByRole('button', { name: '수정' }).disabled).toBe(true);

  await settleRequest(editB, { data: null, error: null });
  const monthAfterB = (await waitForRequestCount('month', 2))[1];
  const dailyAfterB = (await waitForRequestCount('daily', 4))[3];
  await settleRequest(monthAfterB, { data: [{ date: '2026-07-13' }], error: null });
  await settleRequest(dailyAfterB, { data: [appointmentA], error: null });

  const lockedEditButton = screen.getByRole('button', { name: '수정' });
  expect(lockedEditButton.disabled).toBe(true);
  fireEvent.click(lockedEditButton);
  expect(requestsOfKind('edit')).toHaveLength(2);

  await settleRequest(editA, { data: null, error: null });
  const monthAfterA = (await waitForRequestCount('month', 3))[2];
  const dailyAfterA = (await waitForRequestCount('daily', 5))[4];
  await settleRequest(monthAfterA, { data: [{ date: '2026-07-13' }], error: null });
  await settleRequest(dailyAfterA, { data: [appointmentA], error: null });

  await waitFor(() => {
    expect(screen.getByRole('button', { name: '수정' }).disabled).toBe(false);
  });
});

test('mutation 진행 중 unmount되면 후속 월·일 조회를 시작하지 않는다', async () => {
  const appointmentA = createAppointment({
    date: '2026-07-13',
    id: 'unmount-a',
    name: 'Unmount 고객',
  });
  const { unmount } = await renderLoadedDay(appointmentA);

  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  const [mutation] = await waitForRequestCount('status', 1);
  const readCountBeforeUnmount = requestsOfKind('month').length + requestsOfKind('daily').length;

  unmount();
  await settleRequest(mutation, { data: null, error: null });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(requestsOfKind('month').length + requestsOfKind('daily').length).toBe(readCountBeforeUnmount);
});

test('Strict Mode cleanup은 첫 요청을 폐기하고 두 번째 요청 결과만 반영한다', async () => {
  render(
    <StrictMode>
      <AppointmentsPage />
    </StrictMode>
  );

  const monthRequests = await waitForRequestCount('month', 2);
  const dailyRequests = await waitForRequestCount('daily', 2);
  const currentAppointment = createAppointment({
    date: '2026-07-13',
    id: 'strict-current',
    name: 'Strict 최신 고객',
  });
  const staleAppointment = createAppointment({
    date: '2026-07-13',
    id: 'strict-stale',
    name: 'Strict 과거 고객',
  });

  await settleRequest(monthRequests[1], { data: [{ date: '2026-07-13' }], error: null });
  await settleRequest(dailyRequests[1], { data: [currentAppointment], error: null });
  await settleRequest(monthRequests[0], { data: [], error: null });
  await settleRequest(dailyRequests[0], { data: [staleAppointment], error: null });

  expect(document.body.textContent).toContain('Strict 최신 고객');
  expect(document.body.textContent).not.toContain('Strict 과거 고객');
});

test('현재 날짜의 실패만 오류로 표시하고 다시 시도는 같은 날짜를 조회한다', async () => {
  render(<AppointmentsPage />);
  const [monthRequest] = await waitForRequestCount('month', 1);
  const [dailyRequest] = await waitForRequestCount('daily', 1);
  await settleRequest(monthRequest, { data: [], error: null });
  await settleRequest(dailyRequest, { data: null, error: { message: '현재 날짜 실패' } });

  expect(screen.getByRole('alert').textContent).toContain('예약을 불러오지 못했습니다.');
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

  const retryRequest = (await waitForRequestCount('daily', 2))[1];
  expect(retryRequest.dateKey).toBe('2026-07-13');
  const recoveredAppointment = createAppointment({
    date: '2026-07-13',
    id: 'retry-current',
    name: '재시도 고객',
  });
  await settleRequest(retryRequest, { data: [recoveredAppointment], error: null });

  expect(document.body.textContent).toContain('재시도 고객');
  expect(screen.queryByRole('alert')).toBeNull();
});
