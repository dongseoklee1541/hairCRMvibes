export function getCustomerCreateErrorMessage(error, isOnline = true) {
  if (!isOnline) {
    return '오프라인에서는 고객을 등록할 수 없습니다. 연결을 확인한 뒤 다시 시도해주세요.';
  }

  if (error?.code === '42501') {
    return '고객을 등록할 권한이 없습니다. 관리자에게 권한을 확인해주세요.';
  }

  return '고객을 등록하지 못했습니다. 잠시 후 다시 시도해주세요.';
}

export async function createCustomer(supabaseClient, { name, phone, memo }) {
  const { data, error } = await supabaseClient
    .from('customers')
    .insert({ name, phone: phone || null, memo: memo || null })
    .select('id, name')
    .single();

  if (error) throw error;
  return data;
}
