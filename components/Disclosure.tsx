import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors as c } from '../ui/theme';

/** Supporting label details only; critical warnings belong outside this disclosure. */
export default function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <View style={styles.section}>
    <TouchableOpacity style={styles.trigger} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)}>
      <Text style={styles.title}>{title}</Text><Text style={styles.indicator}>{open ? '−' : '+'}</Text>
    </TouchableOpacity>
    {open && <View style={styles.body}>{children}</View>}
  </View>;
}
const styles = StyleSheet.create({
  section: { borderBottomWidth: 1, borderColor: c.border },
  trigger: { minHeight: 56, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  title: { flex: 1, color: c.blue, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  indicator: { fontSize: 24, color: c.green }, body: { paddingBottom: 20, gap: 10 },
});
