import { supabase } from './supabaseClient';

export const authService = {
  /**
   * Register a new user with Email and Password using Supabase auth
   */
  async signUp({ email, password, fullName }) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || '',
          },
        },
      });

      return { data, user: data?.user || null, session: data?.session || null, error };
    } catch (err) {
      console.error('Exception during signUp:', err);
      return { data: null, user: null, session: null, error: err };
    }
  },

  /**
   * Log in an existing user with Email and Password using Supabase auth
   */
  async signIn({ email, password }) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      return { data, user: data?.user || null, session: data?.session || null, error };
    } catch (err) {
      console.error('Exception during signIn:', err);
      return { data: null, user: null, session: null, error: err };
    }
  },

  /**
   * Log out the current user session using Supabase auth
   */
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      return { error: error || null };
    } catch (err) {
      console.error('Exception during signOut:', err);
      return { error: err };
    }
  },

  /**
   * Fetch current active session directly from Supabase auth
   */
  async getCurrentSession() {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data?.session) {
        return { session: data.session, user: data.session.user, error: null };
      }
      return { session: null, user: null, error: error || null };
    } catch (e) {
      console.warn('Supabase getSession network error:', e);
      return { session: null, user: null, error: e };
    }
  },

  /**
   * Subscribe to Supabase auth state changes
   */
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

