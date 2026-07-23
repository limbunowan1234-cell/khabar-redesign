'use client';
import { create } from 'zustand';

const endpoint = 'https://api.khabardarjeeling.in/v1';
const projectId = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': projectId };

interface User { $id: string; name: string; email: string; }
interface AuthStore {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  initAuth: () => Promise<void>;
  logOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  isAuthenticated: false,

  initAuth: async () => {
    try {
      const res = await fetch(endpoint + '/account', { headers: H, credentials: 'include' });
      if (res.ok) {
        const user = await res.json();
        set({ user, isAuthenticated: true, loading: false });
      } else {
        set({ user: null, isAuthenticated: false, loading: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false, loading: false });
    }
  },

  logOut: async () => {
    try {
      await fetch(endpoint + '/account/sessions/current', { method: 'DELETE', headers: H, credentials: 'include' });
    } catch {}
    set({ user: null, isAuthenticated: false, loading: false });
  },
}));
