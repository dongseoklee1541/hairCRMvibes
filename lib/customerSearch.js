const CUSTOMER_SEARCH_MAX_LENGTH = 80;
const POSTGREST_FILTER_SYNTAX = /[,%*()."'\\_]/g;

export const CUSTOMER_PAGE_SIZE = 50;
export const CUSTOMER_LIST_SELECT = [
  'id',
  'name',
  'phone',
  'archived_at',
  'merged_into_customer_id',
  'anonymized_at',
].join(',');

export function buildCustomerSearchFilter(value) {
  const normalized = String(value ?? '')
    .normalize('NFKC')
    .trim()
    .slice(0, CUSTOMER_SEARCH_MAX_LENGTH);

  if (!normalized) return '';

  const textTerm = normalized
    .replace(POSTGREST_FILTER_SYNTAX, '')
    .replace(/\s+/g, ' ')
    .trim();
  const phoneTerm = normalized.replace(/\D/g, '');
  const filters = [];

  if (textTerm) {
    filters.push(`name.ilike.*${textTerm}*`, `memo.ilike.*${textTerm}*`);
  }
  if (phoneTerm) {
    filters.push(`phone_normalized.like.*${phoneTerm}*`);
  }

  return filters.join(',');
}

export function buildCustomerListQuery(
  supabase,
  {
    searchFilter = '',
    showArchived = false,
    offset = 0,
  } = {}
) {
  let query = supabase
    .from('customers')
    .select(CUSTOMER_LIST_SELECT, { count: 'exact' });

  query = showArchived
    ? query.not('archived_at', 'is', null)
    : query.is('archived_at', null);

  if (searchFilter) {
    query = query.or(searchFilter);
  }

  return query
    .order('name', { ascending: true })
    .range(offset, offset + CUSTOMER_PAGE_SIZE - 1);
}
