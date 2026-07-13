const UTF8_BOM = '\uFEFF';
const CSV_LINE_ENDING = '\r\n';
const DEFAULT_PAGE_SIZE = 1000;
const MAX_BEARER_TOKEN_LENGTH = 8192;

export const CSV_EXPORT_DATASETS = Object.freeze({
  customers: Object.freeze({
    table: 'customers',
    columns: Object.freeze([
      'id',
      'name',
      'phone',
      'phone_normalized',
      'memo',
      'created_at',
      'updated_at',
      'archived_at',
      'archived_by',
      'archive_reason',
      'merged_into_customer_id',
      'anonymized_at',
      'anonymized_by',
    ]),
    orderBy: Object.freeze(['created_at', 'id']),
  }),
  appointments: Object.freeze({
    table: 'appointments',
    columns: Object.freeze([
      'id',
      'customer_id',
      'date',
      'time',
      'service',
      'service_id',
      'duration',
      'duration_minutes',
      'price_snapshot_krw',
      'memo',
      'status',
      'created_at',
      'updated_at',
      'cancelled_at',
      'cancelled_by',
      'cancelled_reason',
    ]),
    orderBy: Object.freeze(['created_at', 'id']),
  }),
});

class CsvExportError extends Error {
  constructor(code, status) {
    super(code);
    this.name = 'CsvExportError';
    this.code = code;
    this.status = status;
  }
}

function normalizeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

export function neutralizeSpreadsheetFormula(value) {
  const normalized = normalizeCsvValue(value);
  const startsWithControlCharacter = /^[\t\r\n]/.test(normalized);
  const startsWithFormula = /^[ \u00A0]*[=+\-@]/.test(normalized);
  return startsWithControlCharacter || startsWithFormula ? `'${normalized}` : normalized;
}

export function escapeCsvCell(value) {
  const safeValue = neutralizeSpreadsheetFormula(value);
  return `"${safeValue.replaceAll('"', '""')}"`;
}

export function buildCsv(rows, columns) {
  return `${buildCsvHeader(columns)}${buildCsvRows(rows, columns)}`;
}

export function buildCsvHeader(columns) {
  return `${UTF8_BOM}${columns.map(escapeCsvCell).join(',')}${CSV_LINE_ENDING}`;
}

export function buildCsvRows(rows, columns) {
  if (!rows.length) {
    return '';
  }

  return `${rows
    .map((row) => columns.map((column) => escapeCsvCell(row?.[column])).join(','))
    .join(CSV_LINE_ENDING)}${CSV_LINE_ENDING}`;
}

function assertPositivePageSize(pageSize) {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new TypeError('Page size must be a positive integer.');
  }
}

function assertCsvPage(page) {
  if (!Array.isArray(page)) {
    throw new CsvExportError('EXPORT_QUERY_FAILED', 502);
  }
}

export function createCsvReadableStream({
  columns,
  firstPage,
  fetchPage,
  pageSize = DEFAULT_PAGE_SIZE,
  signal,
  logger = console,
  dataset = 'unknown',
}) {
  assertPositivePageSize(pageSize);
  assertCsvPage(firstPage);

  if (typeof fetchPage !== 'function') {
    throw new TypeError('fetchPage must be a function.');
  }

  const encoder = new TextEncoder();
  let headerPending = true;
  let pendingPage = firstPage;
  let nextFrom = firstPage.length === pageSize ? pageSize : null;
  let finished = false;
  let cancelled = false;

  return new ReadableStream({
    async pull(controller) {
      if (finished || cancelled) {
        return;
      }

      if (signal?.aborted) {
        finished = true;
        controller.error(signal.reason || new DOMException('Request aborted.', 'AbortError'));
        return;
      }

      if (headerPending) {
        headerPending = false;
        controller.enqueue(encoder.encode(buildCsvHeader(columns)));
        return;
      }

      try {
        let page;
        let currentFrom = null;

        if (pendingPage !== null) {
          page = pendingPage;
          pendingPage = null;
        } else if (nextFrom !== null) {
          currentFrom = nextFrom;
          page = await fetchPage(currentFrom, currentFrom + pageSize - 1);
          assertCsvPage(page);
        } else {
          finished = true;
          controller.close();
          return;
        }

        if (page.length > 0) {
          controller.enqueue(encoder.encode(buildCsvRows(page, columns)));
        }

        if (page.length < pageSize) {
          nextFrom = null;
          finished = true;
          controller.close();
        } else if (currentFrom !== null) {
          nextFrom = currentFrom + pageSize;
        }
      } catch (error) {
        finished = true;

        if (signal?.aborted || error?.name === 'AbortError') {
          controller.error(error);
          return;
        }

        if (typeof logger?.error === 'function') {
          logger.error('CSV export stream failed.', {
            code: 'EXPORT_QUERY_FAILED',
            dataset,
          });
        }

        controller.error(new Error('EXPORT_STREAM_FAILED'));
      }
    },
    cancel() {
      cancelled = true;
    },
  });
}

function getNoStoreHeaders() {
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
    Vary: 'Authorization',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
  };
}

function jsonError(code, status) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: {
      ...getNoStoreHeaders(),
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function readBearerToken(request) {
  const authorization = request.headers.get('authorization') || '';
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  const token = match?.[1] || '';

  if (!token || token.length > MAX_BEARER_TOKEN_LENGTH) {
    throw new CsvExportError('AUTH_REQUIRED', 401);
  }

  return token;
}

function getDatasetFromRequest(request) {
  let dataset;

  try {
    dataset = new URL(request.url).searchParams.get('dataset');
  } catch {
    throw new CsvExportError('INVALID_DATASET', 400);
  }

  const config = CSV_EXPORT_DATASETS[dataset];
  if (!config) {
    throw new CsvExportError('INVALID_DATASET', 400);
  }

  return { dataset, config };
}

function createDatasetPageFetcher(client, config, signal) {
  return async (from, to) => {
    let query = client.from(config.table).select(config.columns.join(','));

    for (const column of config.orderBy) {
      query = query.order(column, { ascending: true });
    }

    query = query.range(from, to);
    if (signal && typeof query.abortSignal === 'function') {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query;
    if (error) {
      throw new CsvExportError('EXPORT_QUERY_FAILED', 502);
    }

    return data || [];
  };
}

function defaultKstDateKey() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
}

function normalizeDateKey(getDateKey) {
  const dateKey = getDateKey();
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : defaultKstDateKey();
}

export async function handleCsvExportRequest(
  request,
  {
    createClient,
    supabaseUrl,
    supabaseAnonKey,
    getDateKey = defaultKstDateKey,
    logger = console,
    pageSize = DEFAULT_PAGE_SIZE,
  }
) {
  let dataset = 'unknown';

  try {
    const resolvedDataset = getDatasetFromRequest(request);
    dataset = resolvedDataset.dataset;

    if (!supabaseUrl || !supabaseAnonKey || typeof createClient !== 'function') {
      throw new CsvExportError('EXPORT_CONFIG_MISSING', 503);
    }

    const accessToken = readBearerToken(request);
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data: authData, error: authError } = await client.auth.getUser(accessToken);
    const user = authData?.user;
    if (authError || !user?.id) {
      throw new CsvExportError('AUTH_INVALID', 401);
    }

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      throw new CsvExportError('EXPORT_AUTHORIZATION_UNAVAILABLE', 503);
    }

    if (profile?.role !== 'owner') {
      throw new CsvExportError('OWNER_REQUIRED', 403);
    }

    assertPositivePageSize(pageSize);
    const fetchPage = createDatasetPageFetcher(client, resolvedDataset.config, request.signal);
    const firstPage = await fetchPage(0, pageSize - 1);
    const csvStream = createCsvReadableStream({
      columns: resolvedDataset.config.columns,
      firstPage,
      fetchPage,
      pageSize,
      signal: request.signal,
      logger,
      dataset,
    });
    const filename = `haircrm_${dataset}_${normalizeDateKey(getDateKey)}.csv`;

    return new Response(csvStream, {
      status: 200,
      headers: {
        ...getNoStoreHeaders(),
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const code = error instanceof CsvExportError ? error.code : 'EXPORT_FAILED';
    const status = error instanceof CsvExportError ? error.status : 500;

    if (status >= 500 && typeof logger?.error === 'function') {
      logger.error('CSV export failed.', { code, dataset });
    }

    return jsonError(code, status);
  }
}
