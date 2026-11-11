import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { demoStatusLabel, type DemoStatus } from '../inventory/types';
import { colors } from '../ui/theme';

export default function StockBadge({ status }: { status: DemoStatus | null }) {
  const tone = status === 'in_stock' ? styles.stock : status === 'limited_stock' ? styles.limited
    : status === 'out_of_stock' ? styles.out : styles.unknown;
  return <View style={[styles.badge, tone]}>
    <Text style={[styles.text, { color: status === 'out_of_stock' ? colors.red : status === 'limited_stock' ? colors.amber : colors.green }]}>
      {demoStatusLabel(status)}
    </Text>
  </View>;
}
const styles = StyleSheet.create({
  badge: { borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, alignSelf: 'flex-start', marginVertical: 4 },
  text: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  stock: { backgroundColor: colors.softGreen }, limited: { backgroundColor: colors.softAmber },
  out: { backgroundColor: colors.softRed }, unknown: { backgroundColor: colors.softBlue },
});
