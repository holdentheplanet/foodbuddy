export type CatalogSource = {
  id: string;
  url: string;
  kind: 'manufacturer_page' | 'manufacturer_label_photo' | 'manufacturer_linked_spec';
  checkedAt: string;
  reviewStatus: 'label_reviewed' | 'identity_only' | 'unavailable';
  evidence: string | null;
  notes: string;
};

export type CatalogProduct = {
  id: string;
  name: string;
  brand: string;
  variant: string;
  packageSize: string | null;
  category: string;
  market: 'US';
  barcode: string | null;
  imageReference: string | null;
  ingredientLabelText: string | null;
  ingredientVerificationStatus: 'verified' | 'unverified' | 'unknown';
  verifiedAt: string | null;
  allergenStatement: string | null;
  allergenStatus: 'documented' | 'unknown';
  declaredAllergens: string[] | null;
  precautionaryStatement: string | null;
  precautionaryStatus: 'documented' | 'unknown';
  precautionaryAllergens: string[] | null;
  completenessStatus: 'complete' | 'partial' | 'unverified';
  ingredientSourceId: string | null;
  allergenSourceId: string | null;
  precautionarySourceId: string | null;
  barcodeSourceId: string | null;
  sources: CatalogSource[];
  notes: string;
};

export type ProductCatalog = {
  formatVersion: 1;
  catalogId: string;
  products: CatalogProduct[];
};
