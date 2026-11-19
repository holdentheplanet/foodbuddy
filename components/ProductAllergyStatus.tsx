import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LocalAllergyResult } from '../services/localAllergyMatching';
import { productAllergyStatus } from '../ui/productAllergyStatus';
const palette = { red: '#9A2924', yellow: '#775109', green: '#225C40' };
export default function ProductAllergyStatus({ result, evidenceComplete, detail = false }: { result?: LocalAllergyResult | null; evidenceComplete: boolean; detail?: boolean }) {
  const status = productAllergyStatus(result, evidenceComplete);
  return <View accessibilityLiveRegion="polite" style={styles.container}>
    <Text style={[styles.label, { color: palette[status.tone] }]}>{status.tone === 'red' ? '!' : status.tone === 'yellow' ? '△' : '✓'} {status.label}</Text>
    {(detail ? !result?.matches.length : status.tone === 'red' || !!result?.matches.length) && <Text style={styles.reason}>{status.reason}</Text>}
  </View>;
}
const styles = StyleSheet.create({ container: { gap: 4, paddingVertical: 8 }, label: { fontSize: 13, lineHeight: 19, fontWeight: '700' }, reason: { color: '#48594F', fontSize: 12, lineHeight: 18 } });
