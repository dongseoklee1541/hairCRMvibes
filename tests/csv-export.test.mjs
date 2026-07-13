import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCsv,
  createCsvReadableStream,
  handleCsvExportRequest,
  neutralizeSpreadsheetFormula,
} from '../lib/csvExport.mjs';

function createRequest(dataset = 'customers', accessToken) {
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
  return new Request(`https://haircrm.example/api/export?dataset=${dataset}`, { headers });
}

function createFakeClient({
  role = 'owner',
  rows = {},
  authError = null,
  profileError = null,
  queryError = null,
  capture,
} = {}) {
  return {
    auth: {
      async getUser(token) {
        capture.authToken = token;
        return authError
          ? { data: { user: null }, error: authError }
          : { data: { user: { id: 'owner-1' } }, error: null };
      },
    },
    from(table) {
      if (table === 'profiles') {
        const profileQuery = {
          select(columns) {
            capture.profileSelect = columns;
            return profileQuery;
          },
          eq(column, value) {
            capture.profileFilter = { column, value };
            return profileQuery;
          },
          async maybeSingle() {
            return profileError
              ? { data: null, error: profileError }
              : { data: { role }, error: null };
          },
        };
        return profileQuery;
      }

      const query = {
        select(columns) {
          capture.datasetSelect = { table, columns };
          return query;
        },
        order(column, options) {
          capture.orders.push({ column, options });
          return query;
        },
        range(from, to) {
          capture.ranges.push({ from, to });
          capture.currentRange = { from, to };
          return query;
        },
        abortSignal(signal) {
          capture.abortSignals.push(signal);
          return query;
        },
        then(resolve) {
          const { from, to } = capture.currentRange;
          const resolvedQueryError =
            typeof queryError === 'function' ? queryError({ table, from, to }) : queryError;
          if (resolvedQueryError) {
            return Promise.resolve({ data: null, error: resolvedQueryError }).then(resolve);
          }
          return Promise.resolve({
            data: (rows[table] || []).slice(from, to + 1),
            error: null,
          }).then(resolve);
        },
      };
      return query;
    },
  };
}

function createDependencies(options = {}) {
  const capture = {
    createClientArgs: null,
    authToken: null,
    orders: [],
    ranges: [],
    abortSignals: [],
    logs: [],
  };
  const client = createFakeClient({ ...options, capture });

  return {
    capture,
    dependencies: {
      createClient(url, key, clientOptions) {
        capture.createClientArgs = { url, key, clientOptions };
        return client;
      },
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'public-anon-key',
      getDateKey: () => '2026-07-13',
      logger: {
        error(...args) {
          capture.logs.push(args);
        },
      },
      ...options.dependencies,
    },
  };
}

test('CSV는 UTF-8 BOM과 CRLF를 사용하고 모든 셀을 인용하며 수식을 무력화한다', () => {
  const csv = buildCsv(
    [
      {
        name: '=HYPERLINK("https://evil.example")',
        memo: '쉼표, 따옴표 "와\n줄바꿈',
        amount: -100,
        empty: null,
      },
    ],
    ['name', 'memo', 'amount', 'empty']
  );

  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.startsWith('\uFEFF"name","memo","amount","empty"\r\n'));
  assert.ok(csv.includes('"\'=HYPERLINK(""https://evil.example"")"'));
  assert.ok(csv.includes('"쉼표, 따옴표 ""와\n줄바꿈"'));
  assert.ok(csv.includes('"\'-100",""\r\n'));
  assert.equal(neutralizeSpreadsheetFormula('@SUM(A1:A2)'), "'@SUM(A1:A2)");
  assert.equal(neutralizeSpreadsheetFormula('  =SUM(A1:A2)'), "'  =SUM(A1:A2)");
  assert.equal(neutralizeSpreadsheetFormula('\tSUM(A1:A2)'), "'\tSUM(A1:A2)");
  assert.equal(neutralizeSpreadsheetFormula('일반 텍스트'), '일반 텍스트');
});

test('CSV 스트림은 첫 페이지 이후 데이터를 순서대로 요청하고 청크로 내보낸다', async () => {
  const source = Array.from({ length: 2505 }, (_, index) => ({ id: index + 1 }));
  const calls = [];
  const stream = createCsvReadableStream({
    columns: ['id'],
    firstPage: source.slice(0, 1000),
    fetchPage: async (from, to) => {
      calls.push({ from, to });
      return source.slice(from, to + 1);
    },
    pageSize: 1000,
    logger: { error() {} },
    dataset: 'customers',
  });
  const responseBytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const csv = new TextDecoder().decode(responseBytes.slice(3));

  assert.deepEqual([...responseBytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.ok(csv.startsWith('"id"\r\n"1"\r\n'));
  assert.ok(csv.endsWith('"2505"\r\n'));
  assert.deepEqual(calls, [
    { from: 1000, to: 1999 },
    { from: 2000, to: 2999 },
  ]);
});

test('CSV 스트림은 기존 100페이지 상한을 넘어서도 계속 내보낸다', async () => {
  const pageSize = 1000;
  const totalRows = 100_005;
  const stream = createCsvReadableStream({
    columns: ['id'],
    firstPage: Array.from({ length: pageSize }, (_, index) => ({ id: index + 1 })),
    fetchPage: async (from, to) =>
      Array.from(
        { length: Math.max(0, Math.min(to + 1, totalRows) - from) },
        (_, index) => ({ id: from + index + 1 })
      ),
    pageSize,
    logger: { error() {} },
    dataset: 'customers',
  });
  const csv = await new Response(stream).text();

  assert.ok(csv.includes('"100001"\r\n'));
  assert.ok(csv.endsWith('"100005"\r\n'));
});

test('인증 헤더가 없으면 Supabase 클라이언트를 만들기 전에 401을 반환한다', async () => {
  let createClientCalled = false;
  const response = await handleCsvExportRequest(createRequest(), {
    createClient() {
      createClientCalled = true;
      throw new Error('호출되면 안 됩니다.');
    },
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'public-anon-key',
    logger: { error() {} },
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'AUTH_REQUIRED' });
  assert.equal(createClientCalled, false);
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('staff 사용자는 서버의 명시적 owner 검사에서 403을 받는다', async () => {
  const { dependencies, capture } = createDependencies({ role: 'staff' });
  const response = await handleCsvExportRequest(createRequest('customers', 'staff-token'), dependencies);

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'OWNER_REQUIRED' });
  assert.equal(capture.ranges.length, 0);
});

test('owner는 사용자 JWT와 anon key로 페이지 조회 후 CSV를 받는다', async () => {
  const customers = [
    {
      id: 'customer-1',
      name: '=위험한 이름',
      phone: 'PHONE_SENTINEL',
      phone_normalized: 'PHONE_NORMALIZED_SENTINEL',
      memo: '첫 고객',
      created_at: '2026-07-01T00:00:00Z',
    },
    { id: 'customer-2', name: '두 번째 고객' },
    { id: 'customer-3', name: '세 번째 고객' },
  ];
  const { dependencies, capture } = createDependencies({
    rows: { customers },
    dependencies: { pageSize: 2 },
  });

  const request = createRequest('customers', 'owner-user-token');
  const response = await handleCsvExportRequest(request, dependencies);
  const responseBytes = new Uint8Array(await response.arrayBuffer());
  const csv = new TextDecoder().decode(responseBytes.slice(3));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/csv; charset=utf-8');
  assert.equal(
    response.headers.get('content-disposition'),
    'attachment; filename="haircrm_customers_2026-07-13.csv"'
  );
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(capture.createClientArgs.url, 'https://project.supabase.co');
  assert.equal(capture.createClientArgs.key, 'public-anon-key');
  assert.equal(
    capture.createClientArgs.clientOptions.global.headers.Authorization,
    'Bearer owner-user-token'
  );
  assert.equal(capture.createClientArgs.clientOptions.auth.persistSession, false);
  assert.equal(capture.authToken, 'owner-user-token');
  assert.deepEqual(capture.profileFilter, { column: 'id', value: 'owner-1' });
  assert.deepEqual(capture.ranges, [
    { from: 0, to: 1 },
    { from: 2, to: 3 },
  ]);
  assert.equal(capture.abortSignals.length, 2);
  assert.equal(capture.abortSignals.every((signal) => signal === request.signal), true);
  assert.deepEqual(
    capture.orders.map(({ column }) => column),
    ['created_at', 'id', 'created_at', 'id']
  );
  assert.deepEqual([...responseBytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.ok(csv.startsWith('"id","name","phone"'));
  assert.ok(csv.includes('"\'=위험한 이름"'));
  assert.ok(csv.includes('"customer-3"'));
  assert.equal(capture.logs.length, 0);
});

test('조회 오류 응답과 로그에는 Supabase 상세정보가 노출되지 않는다', async () => {
  const sensitiveDetail = 'PRIVATE_SENTINEL_MUST_NOT_LEAK';
  const { dependencies, capture } = createDependencies({
    queryError: { message: sensitiveDetail },
  });
  const response = await handleCsvExportRequest(
    createRequest('appointments', 'owner-user-token'),
    dependencies
  );
  const body = await response.text();

  assert.equal(response.status, 502);
  assert.equal(body, '{"error":"EXPORT_QUERY_FAILED"}');
  assert.equal(body.includes(sensitiveDetail), false);
  assert.equal(JSON.stringify(capture.logs).includes(sensitiveDetail), false);
  assert.deepEqual(capture.logs, [
    ['CSV export failed.', { code: 'EXPORT_QUERY_FAILED', dataset: 'appointments' }],
  ]);
});

test('후속 페이지 조회 오류는 스트림을 중단하고 상세정보를 노출하지 않는다', async () => {
  const sensitiveDetail = 'LATE_PRIVATE_SENTINEL_MUST_NOT_LEAK';
  const { dependencies, capture } = createDependencies({
    rows: {
      customers: [{ id: 'customer-1' }, { id: 'customer-2' }],
    },
    queryError: ({ from }) => (from >= 1 ? { message: sensitiveDetail } : null),
    dependencies: { pageSize: 1 },
  });
  const response = await handleCsvExportRequest(
    createRequest('customers', 'owner-user-token'),
    dependencies
  );

  assert.equal(response.status, 200);
  await assert.rejects(response.text(), /EXPORT_STREAM_FAILED/);
  assert.equal(JSON.stringify(capture.logs).includes(sensitiveDetail), false);
  assert.deepEqual(capture.logs, [
    ['CSV export stream failed.', { code: 'EXPORT_QUERY_FAILED', dataset: 'customers' }],
  ]);
});

test('예약 데이터셋도 고정된 백업 헤더로 CSV를 생성한다', async () => {
  const { dependencies, capture } = createDependencies({
    rows: {
      appointments: [
        {
          id: 'appointment-1',
          customer_id: 'customer-1',
          date: '2026-07-13',
          time: '10:00:00',
          service: '커트',
          memo: '@위험한 메모',
          status: 'confirmed',
        },
      ],
    },
  });
  const response = await handleCsvExportRequest(
    createRequest('appointments', 'owner-user-token'),
    dependencies
  );
  const responseBytes = new Uint8Array(await response.arrayBuffer());
  const csv = new TextDecoder().decode(responseBytes.slice(3));

  assert.equal(response.status, 200);
  assert.equal(capture.datasetSelect.table, 'appointments');
  assert.ok(csv.startsWith('"id","customer_id","date","time","service","service_id"'));
  assert.ok(csv.includes('"\'@위험한 메모"'));
});

test('허용하지 않은 데이터셋은 인증 전에 400으로 거부한다', async () => {
  const { dependencies, capture } = createDependencies();
  const response = await handleCsvExportRequest(
    createRequest('profiles', 'owner-user-token'),
    dependencies
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'INVALID_DATASET' });
  assert.equal(capture.createClientArgs, null);
});
