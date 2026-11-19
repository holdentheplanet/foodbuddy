import React, { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createAuthOperations } from '../auth/operations';
import { getSupabase } from '../auth/supabase';
import { colors as c } from '../ui/theme';
/** Recovery codes avoid relying on an unconfigured native redirect URL. */
export default function PasswordRecovery({ onDone, onRecoveryMode }: { onDone: () => void; onRecoveryMode: (active: boolean) => void }) {
  const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [password, setPassword] = useState('');
  const [stage, setStage] = useState<'request' | 'code' | 'password'>('request'); const [busy, setBusy] = useState(false);
  async function submit() {
    if (busy) return; setBusy(true);
    try {
      const auth = createAuthOperations(getSupabase());
      if (stage === 'request') { await auth.requestPasswordReset(email); setStage('code'); Alert.alert('Check your email', 'If an account exists, recovery instructions will arrive. Enter the recovery code here.'); }
      else if (stage === 'code') { onRecoveryMode(true); try { await auth.verifyRecoveryCode(email, code); setStage('password'); } catch (e) { onRecoveryMode(false); throw e; } }
      else { await auth.updatePassword(password); await auth.logout(); onRecoveryMode(false); setPassword(''); Alert.alert('Password updated', 'Sign in with your new password.'); onDone(); }
    } catch (e) { Alert.alert('Password recovery', e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 12, marginVertical: 16 }}>
    <Text style={{ color: c.blue, fontWeight: '700' }}>Reset your password</Text>
    {stage === 'request' ? <TextInput accessibilityLabel="Recovery email" placeholderTextColor={c.muted} placeholder="Recovery email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={{ padding: 12, backgroundColor: c.white, minHeight: 48 }} />
      : stage === 'code' ? <TextInput accessibilityLabel="Recovery code" placeholderTextColor={c.muted} placeholder="Recovery code" keyboardType="number-pad" value={code} onChangeText={setCode} style={{ padding: 12, backgroundColor: c.white, minHeight: 48 }} />
      : <TextInput accessibilityLabel="New password" placeholderTextColor={c.muted} placeholder="New password" secureTextEntry value={password} onChangeText={setPassword} style={{ padding: 12, backgroundColor: c.white, minHeight: 48 }} />}
    <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void submit()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: c.green }}>{busy ? 'Working…' : stage === 'request' ? 'Send recovery email' : stage === 'code' ? 'Verify code' : 'Save new password'}</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => { if (stage === 'password') void createAuthOperations(getSupabase()).logout().catch(() => { Alert.alert('Signed out locally', 'Reconnect if server-side revocation could not finish.'); }).finally(() => { onRecoveryMode(false); onDone(); }); else { onRecoveryMode(false); onDone(); } }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.blue }}>Back to sign in</Text></TouchableOpacity>
  </View>;
}
