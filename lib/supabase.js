import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 빌드 시 환경변수가 없어도 빌드가 중단되지 않도록 처리
// 실제 사용 시에만 에러가 발생하거나 경고가 표시됨
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : new Proxy({}, {
      get: () => {
        if (typeof window !== 'undefined') {
          console.error('Supabase 환경변수가 설정되지 않았습니다.');
        }
        return () => ({}); // 더미 함수 반환
      }
    });
