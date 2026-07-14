'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
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
  roleError: null,
  loading: true,
  isAuthReady: false,
  isRoleReady: false,
  signIn: async () => {
    throw new Error('Auth provider is not ready.');
  },
  signOut: async (_options) => {},
  refreshAuth: async () => {},
});

export function AuthProvider({ children }) {
  const pathname = usePathname();
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [roleError, setRoleError] = useState(null);
  const [loading, setLoading] = useState(hasAuthClient);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isRoleReady, setIsRoleReady] = useState(false);
  const sessionRef = useRef(null);
  const roleRequestRef = useRef(0);
  const authSyncTimersRef = useRef(new Set());
  const previousPathnameRef = useRef(pathname);

  const user = session?.user || null;

  const resolveRole = useCallback(async (currentUser) => {
    const requestId = roleRequestRef.current + 1;
    roleRequestRef.current = requestId;

    if (!currentUser) {
      setRole(null);
      setRoleError(null);
      setIsRoleReady(true);
      return null;
    }

    if (!hasAuthClient) {
      setRole(null);
      setRoleError('auth_unavailable');
      setIsRoleReady(true);
      return null;
    }

    setRole(null);
    setRoleError(null);
    setIsRoleReady(false);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (roleRequestRef.current !== requestId) {
        return null;
      }

      if (error) {
        setRole(null);
        setRoleError('role_lookup_failed');
        return null;
      }

      if (!data) {
        setRole(null);
        setRoleError('profile_missing');
        return null;
      }

      if (!VALID_ROLES.has(data.role)) {
        setRole(null);
        setRoleError('role_lookup_failed');
        return null;
      }

      const nextRole = data.role;
      setRole(nextRole);
      setRoleError(null);
      return nextRole;
    } catch {
      if (roleRequestRef.current !== requestId) {
        return null;
      }
      setRole(null);
      setRoleError('role_lookup_failed');
      return null;
    } finally {
      if (roleRequestRef.current === requestId) {
        setIsRoleReady(true);
      }
    }
  }, []);

  const syncSession = useCallback(async (nextSession) => {
    const normalizedSession = nextSession ?? null;
    sessionRef.current = normalizedSession;
    setSession(normalizedSession);
    await resolveRole(normalizedSession?.user || null);
  }, [resolveRole]);

  const refreshAuth = useCallback(async () => {
    if (!hasAuthClient) {
      roleRequestRef.current += 1;
      sessionRef.current = null;
      setSession(null);
      setRole(null);
      setRoleError('auth_unavailable');
      setIsAuthReady(true);
      setIsRoleReady(true);
      return null;
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        roleRequestRef.current += 1;
        sessionRef.current = null;
        setSession(null);
        setRole(null);
        setRoleError('auth_unavailable');
        setIsRoleReady(true);
        return null;
      }

      await syncSession(data?.session ?? null);
      return data?.session ?? null;
    } catch {
      roleRequestRef.current += 1;
      sessionRef.current = null;
      setSession(null);
      setRole(null);
      setRoleError('auth_unavailable');
      setIsRoleReady(true);
      return null;
    }
  }, [syncSession]);

  useEffect(() => {
    let cancelled = false;

    if (!hasAuthClient) {
      sessionRef.current = null;
      setSession(null);
      setRole(null);
      setRoleError('auth_unavailable');
      setIsAuthReady(true);
      setIsRoleReady(true);
      setLoading(false);
      return;
    }

    const init = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) {
          return;
        }

        if (error) {
          sessionRef.current = null;
          setSession(null);
          setRole(null);
          setRoleError('auth_unavailable');
          setIsRoleReady(true);
          return;
        }

        await syncSession(data?.session ?? null);
      } catch {
        if (!cancelled) {
          sessionRef.current = null;
          setSession(null);
          setRole(null);
          setRoleError('auth_unavailable');
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
      const timerId = window.setTimeout(() => {
        authSyncTimersRef.current.delete(timerId);
        void syncSession(nextSession ?? null);
      }, 0);
      authSyncTimersRef.current.add(timerId);
    });

    return () => {
      cancelled = true;
      authSyncTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      authSyncTimersRef.current.clear();
      if (subscription?.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, [syncSession]);

  useEffect(() => {
    if (!hasAuthClient) {
      return undefined;
    }

    const refreshCurrentRole = () => {
      const currentUser = sessionRef.current?.user;
      if (!currentUser) {
        return;
      }
      void resolveRole(currentUser);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshCurrentRole();
      }
    };

    window.addEventListener('focus', refreshCurrentRole);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', refreshCurrentRole);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [resolveRole]);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) {
      return;
    }

    previousPathnameRef.current = pathname;
    const currentUser = sessionRef.current?.user;
    if (isAuthReady && currentUser) {
      void resolveRole(currentUser);
    }
  }, [isAuthReady, pathname, resolveRole]);

  const signIn = useCallback(async ({ email, password }) => {
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
  }, [syncSession]);

  const signOut = useCallback(async (options) => {
    if (!hasAuthClient) {
      sessionRef.current = null;
      setSession(null);
      setRole(null);
      setRoleError('auth_unavailable');
      setIsRoleReady(true);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut(options);
      if (error) {
        throw error;
      }
      await syncSession(null);
    } finally {
      setLoading(false);
    }
  }, [syncSession]);

  const value = useMemo(
    () => ({
      user,
      session,
      role,
      roleError,
      loading,
      isAuthReady,
      isRoleReady,
      signIn,
      signOut,
      refreshAuth,
    }),
    [
      user,
      session,
      role,
      roleError,
      loading,
      isAuthReady,
      isRoleReady,
      signIn,
      signOut,
      refreshAuth,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
