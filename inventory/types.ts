export const DEMO_DISCLAIMER = 'Demo inventory — simulated, not live availability.';
export type DemoStatus = 'in_stock' | 'limited_stock' | 'out_of_stock' | 'unknown';
export type InventorySeed = { version: 1; seedId: string; storeIds: string[]; productIds: string[] };
export type InventoryAssignment = { storeId: string; productId: string; status: Exclude<DemoStatus, 'unknown'> };
export const demoStatusLabel = (status: DemoStatus | null) => status === 'in_stock' ? 'In stock (demo)'
  : status === 'limited_stock' ? 'Limited stock (demo)' : status === 'out_of_stock' ? 'Out of stock (demo)' : 'Demo stock unknown';
