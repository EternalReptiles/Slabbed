import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { sync } from '../../lib/binder';
import { C } from '../../lib/theme';
import { Button, ErrorText, Muted, Panel, s } from '../../lib/ui';

// Sign in to back up your binder and to use scanning (which runs on the server).
export default function Account() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  async function go(kind: 'in' | 'up') {
    setBusy(true); setErr(''); setMsg('');
    const creds = { email: email.trim(), password };
    const { data, error } = kind === 'in' ? await supabase.auth.signInWithPassword(creds) : await supabase.auth.signUp(creds);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (kind === 'up' && !data.session) setMsg('Check your email and tap the confirmation link, then sign in here.');
  }

  if (session) {
    return (
      <ScrollView contentContainerStyle={s.screen}>
        <Panel>
          <Text style={s.h2}>Signed in</Text>
          <Muted>{session.user.email}</Muted>
          <Muted small>Your binder backs up to your account and syncs between your devices. Scanning and grade checks are switched on.</Muted>
          <Button title="Sync now" onPress={() => sync()} />
          <Button title="Sign out" kind="danger" onPress={() => supabase.auth.signOut()} />
        </Panel>
        <Muted small>Prices: live raw prices come from the Pokémon TCG API (TCGplayer and Cardmarket), converted to AUD with European Central Bank rates. Graded prices and grade checks are estimates from Claude. Always check sold listings before buying or selling.</Muted>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
      <Panel>
        <View style={{ gap: 4 }}>
          <Text style={s.h2}>Sign in</Text>
          <Muted>Sign in to scan cards, check grades and back up your binder. Without an account, your binder stays on this phone.</Muted>
        </View>
        <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={C.muted} style={s.input}
          autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" accessibilityLabel="Email" />
        <TextInput value={password} onChangeText={setPassword} placeholder="Password (8+ characters)" placeholderTextColor={C.muted} style={s.input}
          secureTextEntry autoComplete="password" textContentType="password" accessibilityLabel="Password" />
        {err ? <ErrorText>{err}</ErrorText> : null}
        {msg ? <Text style={{ color: C.good }}>{msg}</Text> : null}
        <Button title="Sign in" kind="primary" onPress={() => go('in')} busy={busy} disabled={!email || password.length < 8} />
        <Button title="Create account" onPress={() => go('up')} disabled={busy || !email || password.length < 8} />
      </Panel>
    </ScrollView>
  );
}
