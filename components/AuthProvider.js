'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

const isObject = (v) => v !== null && typeof v === 'object';

const hasAuthClient =
  isObject(supabase) &&
  isObject(supabase.auth) &&
  typeof supabase.auth.getSession === 'function' &&
  typeof supabase.auth.onAuthStateChange === 'function';

const VALID_ROLES = new Set(['owner', 'staff']);

const AuthContext = createContext({
  user: null,
  session: null,
  role: null,
  loading: true,
  isAuthReady: false,
  isRoleReady: false,
  signIn: async () => {
    throw new Error('Auth provider is not ready.');
  },
  signOut: async () => {},
  refreshAuth: async () => {},
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(hasAuthClient);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isRoleReady, setIsRoleReady] = useState(false);

  const user = session?.user || null;

  const resolveRole = async (currentUser) => {
    if (!currentUser) {
      setRole(null);
      setIsRoleReady(true);
      return;
    }

    if (!hasAuthClient) {
      setRole('staff');
      setIsRoleReady(true);
      return;
    }

    setIsRoleReady(false);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('프로필 조회 오류:', error);
        }
        setRole('staff');
        return;
      }

      const nextRole = VALID_ROLES.has(data?.role) ? data.role : 'staff';
      setRole(nextRole);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('프로필 조회 예외:', error);
      }
      setRole('staff');
    } finally {
      setIsRoleReady(true);
    }
  };

  const syncSession = async (nextSession) => {
    setSession(nextSession ?? null);
    await resolveRole(nextSession?.user || null);
  };

  const refreshAuth = async () => {
    if (!hasAuthClient) {
      return;
    }

    const { data } = await supabase.auth.getSession();
    await syncSession(data?.session ?? null);
  };

  useEffect(() => {
    let cancelled = false;

    if (!hasAuthClient) {
      setSession(null);
      setRole(null);
      setIsAuthReady(true);
      setIsRoleReady(true);
      setLoading(false);
      return;
    }

    const init = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) {
          return;
        }
        await syncSession(data?.session ?? null);
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('세션 초기화 오류:', error);
        }
        if (!cancelled) {
          setSession(null);
          setRole(null);
          setIsRoleReady(true);
        }
      } finally {
        if (!cancelled) {
          setIsAuthReady(true);
          setLoading(false);
        }
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      syncSession(nextSession ?? null);
    });

    return () => {
      cancelled = true;
      setLoading(false);
      if (subscription?.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signIn = async ({ email, password }) => {
    if (!hasAuthClient) {
      throw new Error('Supabase 인증 설정이 없습니다.');
    }

    if (!email || !password) {
      throw new Error('이메일과 비밀번호를 입력해주세요.');
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        throw error;
      }
      await syncSession(data?.session ?? null);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (!hasAuthClient) {
      setSession(null);
      setRole(null);
      setIsRoleReady(true);
      return;
    }

    setLoading(true);
    try {
      await supabase.auth.signOut();
      await syncSession(null);
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(
    () => ({
      user,
      session,
      role,
      loading,
      isAuthReady,
      isRoleReady,
      signIn,
      signOut,
      refreshAuth,
    }),
    [user, session, role, loading, isAuthReady, isRoleReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
