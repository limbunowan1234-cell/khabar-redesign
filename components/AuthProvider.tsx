'use client';
import { useEffect } from 'react';
import { useAuthStore } from '@/lib/authStore';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initAuth, user } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, []);

  // Bridge: if running inside the KhabarDarjeeling RN app WebView, tell the app who's logged in
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isInApp = /KhabarDarjeelingApp/i.test(navigator.userAgent);
    if (!isInApp) return;
    const w = window as any;
    if (!w.ReactNativeWebView) return;
    if (user?.$id) {
      w.ReactNativeWebView.postMessage(JSON.stringify({ type: 'AUTH', userId: user.$id }));
    } else {
      w.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LOGOUT' }));
    }
  }, [user?.$id]);

  return <>{children}</>;
}
