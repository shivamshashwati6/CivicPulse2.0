import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { authService } from '../services/authService';

const AuthContext = createContext({
  user: null,
  session: null,
  isAdmin: false,
  loading: true,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  adminLogin: async () => {},
  adminLogout: () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(() => {
    return (
      localStorage.getItem('civicpulse_is_admin') === 'true' ||
      sessionStorage.getItem('civicpulse_is_admin') === 'true'
    );
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Initialize session directly using supabase.auth.getSession()
    const initAuth = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Error fetching Supabase session:', error);
        }
        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user || null);

          const isStoredAdmin =
            localStorage.getItem('civicpulse_is_admin') === 'true' ||
            sessionStorage.getItem('civicpulse_is_admin') === 'true';

          const isUserAdmin =
            isStoredAdmin ||
            Boolean(currentSession?.user?.email?.includes('admin')) ||
            currentSession?.user?.user_metadata?.role === 'admin';

          if (isUserAdmin) {
            setIsAdmin(true);
            localStorage.setItem('civicpulse_is_admin', 'true');
            sessionStorage.setItem('civicpulse_is_admin', 'true');
          }
        }
      } catch (err) {
        console.error('Error initializing auth session:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen for authentication changes using supabase.auth.onAuthStateChange
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (mounted) {
        setSession(currentSession);
        setUser(currentSession?.user || null);

        const isStoredAdmin =
          localStorage.getItem('civicpulse_is_admin') === 'true' ||
          sessionStorage.getItem('civicpulse_is_admin') === 'true';

        const isUserAdmin =
          isStoredAdmin ||
          Boolean(currentSession?.user?.email?.includes('admin')) ||
          currentSession?.user?.user_metadata?.role === 'admin';

        if (isUserAdmin) {
          setIsAdmin(true);
          localStorage.setItem('civicpulse_is_admin', 'true');
          sessionStorage.setItem('civicpulse_is_admin', 'true');
        }
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const setAdminFlags = () => {
    setIsAdmin(true);
    localStorage.setItem('civicpulse_is_admin', 'true');
    sessionStorage.setItem('civicpulse_is_admin', 'true');
  };

  const clearAdminFlags = () => {
    setIsAdmin(false);
    localStorage.removeItem('civicpulse_is_admin');
    sessionStorage.removeItem('civicpulse_is_admin');
  };

  const login = async (email, password) => {
    const res = await authService.signIn({ email, password });
    if (res.session) {
      setSession(res.session);
      setUser(res.user || res.session.user);
      if (email.toLowerCase().includes('admin')) {
        setAdminFlags();
      }
    }
    return res;
  };

  const signup = async (email, password, fullName) => {
    const res = await authService.signUp({ email, password, fullName });
    if (res.session) {
      setSession(res.session);
      setUser(res.user || res.session.user);
    }
    return res;
  };

  const logout = async () => {
    const res = await authService.signOut();
    setSession(null);
    setUser(null);
    clearAdminFlags();
    return res;
  };

  /**
   * Dedicated Admin Login Authentication
   */
  const adminLogin = async ({ email, password, passcode }) => {
    // 1. Passcode Authentication (Fast Admin Authorization)
    if (passcode && (passcode === 'ADMIN123' || passcode === 'CIVIC_ADMIN_2026')) {
      setAdminFlags();
      return { success: true, error: null };
    }

    // 2. Email & Password Authentication via Supabase
    if (email && password) {
      const res = await authService.signIn({ email, password });
      if (res.error) {
        return { success: false, error: res.error };
      }
      if (res.session) {
        setSession(res.session);
        setUser(res.user || res.session.user);
        setAdminFlags();
        return { success: true, error: null };
      }
    }

    return { success: false, error: new Error('Invalid Admin Credentials or Passcode.') };
  };

  /**
   * Dedicated Admin Logout
   */
  const adminLogout = async () => {
    clearAdminFlags();
    await authService.signOut().catch(() => {});
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAdmin,
        loading,
        login,
        signup,
        logout,
        adminLogin,
        adminLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);
