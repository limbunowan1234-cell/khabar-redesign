'use client';
import { create } from 'zustand';
import { getCurrentUser, logout } from './appwrite';

interface User { $id: string; name: string; email: string; labels?: string[]; }
interface AuthStore {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  initAuth: () => Promise<void>;
  logOut: () => Promise<void>;
}

// initAuth()/logOut() used to duplicate their own inline Appwrite fetches
// rather than calling lib/appwrite.ts's getCurrentUser()/logout() -- two
// independent copies of the same request. Consolidated now that both
// live in the same migration; behavior is unchanged.
export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  isAuthenticated: false,

  initAuth: async () => {
    const user = await getCurrentUser();
    if (user) {
      set({ user, isAuthenticated: true, loading: false });
    } else {
      set({ user: null, isAuthenticated: false, loading: false });
    }
  },

  logOut: async () => {
    await logout();
    set({ user: null, isAuthenticated: false, loading: false });
  },
}));
