import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { handleCsvExportRequest } from '../lib/csvExport.mjs';

const requiredEnvironment = [
  'R12_PREVIEW_SUPABASE_URL',
  'R12_PREVIEW_SUPABASE_KEY',
  'R12_PREVIEW_OWNER_TOKEN',
  'R12_PREVIEW_STAFF_TOKEN',
];

for (const name of requiredEnvironment) {
  assert.ok(process.env[name], `${name} is required.`);
}

const dependencies = {
  createClient,
  supabaseUrl: process.env.R12_PREVIEW_SUPABASE_URL,
  supabaseAnonKey: process.env.R12_PREVIEW_SUPABASE_KEY,
  getDateKey: () => '2026-07-13',
  logger: { error() {} },
};

function createRequest(dataset, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  return new Request(`https://preview.local/api/export?dataset=${dataset}`, { headers });
}

async function callExport(dataset, token) {
  return handleCsvExportRequest(createRequest(dataset, token), dependencies);
}

async function inspectCsvResponse(response, requiredValues) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const csv = new TextDecoder().decode(bytes.slice(3));

  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    disposition: response.headers.get('content-disposition'),
    cacheControl: response.headers.get('cache-control'),
    bom: bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf,
    crlf: csv.includes('\r\n') && csv.endsWith('\r\n'),
    requiredValues: requiredValues.every((value) => csv.includes(value)),
    formulaNeutralized: csv.includes('"\'=R12') || csv.includes('"\'@R12'),
  };
}

const anonymousResponse = await callExport('customers');
const anonymousBody = await anonymousResponse.json();
const staffResponse = await callExport('customers', process.env.R12_PREVIEW_STAFF_TOKEN);
const staffBody = await staffResponse.json();
const customerResponse = await callExport(
  'customers',
  process.env.R12_PREVIEW_OWNER_TOKEN
);
const customerResult = await inspectCsvResponse(customerResponse, [
  'R12 합성 고객',
  '010-0000-0012',
]);
const appointmentResponse = await callExport(
  'appointments',
  process.env.R12_PREVIEW_OWNER_TOKEN
);
const appointmentResult = await inspectCsvResponse(appointmentResponse, [
  '커트',
  '2030-01-07',
]);

assert.equal(anonymousResponse.status, 401);
assert.deepEqual(anonymousBody, { error: 'AUTH_REQUIRED' });
assert.equal(staffResponse.status, 403);
assert.deepEqual(staffBody, { error: 'OWNER_REQUIRED' });

for (const result of [customerResult, appointmentResult]) {
  assert.equal(result.status, 200);
  assert.equal(result.contentType, 'text/csv; charset=utf-8');
  assert.match(result.cacheControl, /no-store/);
  assert.equal(result.bom, true);
  assert.equal(result.crlf, true);
  assert.equal(result.requiredValues, true);
  assert.equal(result.formulaNeutralized, true);
}

console.log(
  JSON.stringify({
    anonymous: { status: anonymousResponse.status, error: anonymousBody.error },
    staff: { status: staffResponse.status, error: staffBody.error },
    customers: customerResult,
    appointments: appointmentResult,
  })
);
