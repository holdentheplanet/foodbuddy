import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import StockBadge from './StockBadge';
import { colors as c } from '../ui/theme';
import { db } from '../database/db';
import { createLocalInventoryService, type DemoAvailability } from '../services/localInventoryService';
import { DEMO_DISCLAIMER } from '../inventory/types';

const service = createLocalInventoryService(db);
export default function ProductDemoAvailability({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<DemoAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return;
    let current = true;
    setLoading(true); setError(false); setRows([]);
    void service.getProductAvailability(productId).then(value => { if (current) setRows(value); })
      .catch(() => { if (current) setError(true); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [open, productId]);
  return <View style={{ marginTop: 20, gap: 8 }}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Toggle demo store availability" accessibilityState={{ expanded: open }} style={{ minHeight: 48, justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 12 }} onPress={() => setOpen(value => !value)}>
      <Text style={{ color: '#183D32', fontWeight: 'bold' }}>{open ? 'Hide demo store availability' : 'View demo store availability'}</Text>
    </TouchableOpacity>
    {open && <>
      <Text style={{ color: '#172B4D', fontWeight: 'bold' }}>{DEMO_DISCLAIMER}</Text>
      {loading && <ActivityIndicator color="#183D32" />}
      {error && <Text>Demo availability could not be loaded. Ingredient information is separate.</Text>}
      {!loading && !error && rows.length === 0 && <Text>No demo inventory assignments for this product. Actual availability is unknown.</Text>}
      {rows.map(row => <View key={row.storeId} style={{ padding: 12, borderRadius: 12, backgroundColor: c.cream, gap: 4 }}>
        <Text style={{ color: '#172B4D', fontWeight: 'bold' }}>{row.name}</Text>
        <StockBadge status={row.status} />
      </View>)}
    </>}
  </View>;
}
