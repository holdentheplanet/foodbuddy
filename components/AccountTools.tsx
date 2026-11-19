import React, { useEffect, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { User } from '../database/auth';
import { syncCloudProfile } from '../auth/cloudProfile';
import { importLegacyAllergySelections } from '../auth/migrateLegacy';
import { colors as c } from '../ui/theme';
export default function AccountTools({ user }: { user: User }) {
  const [status, setStatus] = useState('Allergy selections sync online; derivative preferences and photos stay on this device.');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { let alive = true; void syncCloudProfile(user).then(() => { if (alive) setStatus('Allergy selections synced. Derivative preferences and photos stay on this device.'); }).catch(() => { if (alive) setStatus('Cloud sync unavailable. Local data is preserved. Retry after setup or reconnection.'); }); return () => { alive = false; }; }, [user]);
  async function run(legacy: boolean) {
    if (busy) return;
    setBusy(true);
    try { if (legacy) await importLegacyAllergySelections(user, password); await syncCloudProfile(user); setStatus('Allergy selections synced.'); setPassword(''); }
    catch (e) { Alert.alert('Account sync', e instanceof Error ? e.message : 'Could not sync. Local data is preserved.'); }
    finally { setBusy(false); }
  }
  return <View style={{ backgroundColor: c.white, borderRadius: 16, padding: 16, marginBottom: 18, gap: 12 }}>
    <Text style={{ color: c.blue, fontWeight: '700' }}>Cloud account</Text><Text style={{ color: c.muted }}>{status}</Text>
    <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void run(false)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.green, fontWeight: '700' }}>{busy ? 'Working…' : 'Sync allergy selections'}</Text></TouchableOpacity>
    <Text style={{ color: c.blue }}>Have an older account on this device? Verify its password to copy built-in allergy selections. Original data stays intact; private custom terms require a separate reviewed migration.</Text>
    <TextInput accessibilityLabel="Old local account password" placeholderTextColor={c.muted} placeholder="Old local account password" secureTextEntry value={password} onChangeText={setPassword} style={{ minHeight: 48, borderColor: c.border, borderWidth: 1, padding: 10, borderRadius: 10 }} />
    <TouchableOpacity accessibilityRole="button" disabled={busy || !password} onPress={() => void run(true)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: c.green }}>Verify and copy legacy selections</Text></TouchableOpacity>
  </View>;
}
