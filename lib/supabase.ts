import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  // On the web, pick up the session from a password-reset link (#access_token=...&type=recovery).
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: isWeb },
});

// Only refresh the session while the app is in the foreground (Supabase's recommended React Native setup).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', s => (s === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh()));
}

// Where password-reset emails send you: the web app (it works on phones too).
export const WEB_URL = isWeb
  ? window.location.origin + '/' + (window.location.pathname.split('/')[1] || '') + '/'
  : 'https://eternalreptiles.github.io/Slabbed/';

// Password recovery: true after opening a reset link, until a new password is saved.
let recovering = isWeb && /type=recovery/.test(window.location.hash);
const listeners = new Set<(v: boolean) => void>();
const setRecovering = (v: boolean) => { recovering = v; listeners.forEach(l => l(v)); };
supabase.auth.onAuthStateChange(e => { if (e === 'PASSWORD_RECOVERY') setRecovering(true); });
export const endRecovery = () => setRecovering(false);
export function useRecovering() {
  const [v, setV] = useState(recovering);
  useEffect(() => { listeners.add(setV); setV(recovering); return () => { listeners.delete(setV); }; }, []);
  return v;
}
