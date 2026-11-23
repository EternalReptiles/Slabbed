import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase, useRecovering } from '../lib/supabase';
import { setUser } from '../lib/binder';
import { C } from '../lib/theme';

export default function Root() {
  // Keep the binder's cloud sync pointed at whoever is signed in.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  // Opened a password-reset link: go to Account to set a new password.
  const recovering = useRecovering();
  useEffect(() => { if (recovering) setTimeout(() => router.navigate('/account'), 0); }, [recovering]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.ink,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="card/[id]" options={{ title: 'Card' }} />
        <Stack.Screen name="item/[id]" options={{ title: 'In your binder' }} />
      </Stack>
    </>
  );
}
