import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

import {
  buildCustomerListQuery,
  buildCustomerSearchFilter,
  CUSTOMER_LIST_SELECT,
} from '../lib/customerSearch.js';
import { formatPriceKrw } from '../lib/formatPrice.js';

async function captureCustomerQuery({ searchTerm, showArchived = false, offset = 0 }) {
  let request;
  const supabase = createClient('https://synthetic.invalid', 'synthetic-anon-key', {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      fetch: async (input, init) => {
        request = {
          headers: new Headers(init?.headers),
          url: new URL(String(input)),
        };
        return new Response('[]', {
          status: 200,
          headers: {
            'content-range': '0-0/0',
            'content-type': 'application/json',
          },
        });
      },
    },
  });

  await buildCustomerListQuery(supabase, {
    searchFilter: buildCustomerSearchFilter(searchTerm),
    showArchived,
    offset,
  });

  return request;
}

test('가격은 미설정, 무료, 유료를 같은 문구 규칙으로 표시한다', () => {
  assert.equal(formatPriceKrw(null), '가격 미설정');
  assert.equal(formatPriceKrw(''), '가격 미설정');
  assert.equal(formatPriceKrw('잘못된 값'), '가격 미설정');
  assert.equal(formatPriceKrw(0), '무료 (0원)');
  assert.equal(formatPriceKrw(25000), '25,000원');
});

test('고객 검색은 이름과 메모를 데이터베이스 필터로 만든다', () => {
  assert.equal(
    buildCustomerSearchFilter('김하늘'),
    'name.ilike.*김하늘*,memo.ilike.*김하늘*'
  );
});

test('전화번호 검색은 숫자만 추려 정규화 전화번호 필터를 함께 사용한다', () => {
  assert.equal(
    buildCustomerSearchFilter('010-1234'),
    'name.ilike.*010-1234*,memo.ilike.*010-1234*,phone_normalized.like.*0101234*'
  );
});

test('PostgREST 필터 구문만 입력하면 전체 고객 조회로 바뀌지 않는다', () => {
  assert.equal(buildCustomerSearchFilter(',()._*%"\''), '');
  assert.equal(
    buildCustomerSearchFilter('메모,테스트'),
    'name.ilike.*메모테스트*,memo.ilike.*메모테스트*'
  );
});

test('고객 목록 요청은 화면에 필요한 최소 필드만 선택하고 검색 전용 필드를 반환하지 않는다', async () => {
  const request = await captureCustomerQuery({ searchTerm: '김하늘' });

  assert.equal(
    request.url.searchParams.get('select'),
    CUSTOMER_LIST_SELECT
  );
  assert.equal(CUSTOMER_LIST_SELECT.includes('memo'), false);
  assert.equal(CUSTOMER_LIST_SELECT.includes('phone_normalized'), false);
  assert.equal(CUSTOMER_LIST_SELECT.includes('created_at'), false);
  assert.equal(CUSTOMER_LIST_SELECT.includes('archive_reason'), false);
  assert.equal(
    request.url.searchParams.get('or'),
    '(name.ilike.*김하늘*,memo.ilike.*김하늘*)'
  );
});

test('고객 목록 요청은 exact count와 50개 단위 pagination을 사용한다', async () => {
  const firstPage = await captureCustomerQuery({ searchTerm: '', offset: 0 });
  const secondPage = await captureCustomerQuery({ searchTerm: '010-1234', offset: 50 });

  assert.equal(firstPage.headers.get('prefer'), 'count=exact');
  assert.equal(firstPage.url.searchParams.get('offset'), '0');
  assert.equal(firstPage.url.searchParams.get('limit'), '50');
  assert.equal(secondPage.headers.get('prefer'), 'count=exact');
  assert.equal(secondPage.url.searchParams.get('offset'), '50');
  assert.equal(secondPage.url.searchParams.get('limit'), '50');
  assert.equal(
    secondPage.url.searchParams.get('or'),
    '(name.ilike.*010-1234*,memo.ilike.*010-1234*,phone_normalized.like.*0101234*)'
  );
});

test('보관 고객 요청은 활성 고객 요청과 반대 필터를 사용한다', async () => {
  const active = await captureCustomerQuery({ searchTerm: '' });
  const archived = await captureCustomerQuery({ searchTerm: '', showArchived: true });

  assert.equal(active.url.searchParams.get('archived_at'), 'is.null');
  assert.equal(archived.url.searchParams.get('archived_at'), 'not.is.null');
});
