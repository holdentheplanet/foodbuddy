import { duplicateProduct, identityText } from './identity';
import type { CatalogProduct, ProductCatalog } from './types';
import { canonicalRecord, validateProductCatalog } from './validation';

export type ProductCandidate = {
  product: CatalogProduct;
  review: {
    decision: 'approved' | 'needs_review' | 'rejected';
    reviewedAt: string | null;
    identitySourceId: string | null;
    identityEvidence: string | null;
    brandEvidence: string | null;
    ingredientTextCorroborated: boolean;
    rationale: string;
    sourceCaptureSha256: string | null;
  };
};
export type CandidateBatch = { formatVersion: 1; catalogId: string; candidates: ProductCandidate[] };

/** Offline editorial gate, not automatic source verification. Dataset text alone is insufficient.
 * Reviewers must inspect the manufacturer/packaging evidence before approving a candidate.
 */
export function reviewCandidateBatch(input: CandidateBatch, existing: CatalogProduct[] = [], today?: string) {
  const batch = JSON.parse(canonicalRecord(input)) as CandidateBatch;
  if (batch.formatVersion !== 1 || !batch.catalogId || !Array.isArray(batch.candidates)) throw new Error('Invalid candidate batch');
  const products: CatalogProduct[] = [];
  const held: { id: string; decision: 'needs_review' | 'rejected'; reason: string }[] = [];
  for (const candidate of batch.candidates) {
    const { product, review } = candidate;
    try {
      if (!review || review.decision !== 'approved') {
        held.push({ id: product.id, decision: review?.decision === 'rejected' ? 'rejected' : 'needs_review', reason: review?.rationale || 'Review required' });
        continue;
      }
      validateProductCatalog({ formatVersion: 1, catalogId: batch.catalogId, products: [product] }, today);
      const identitySource = product.sources.find(s => s.id === review.identitySourceId);
      if (product.ingredientVerificationStatus !== 'verified' || !review.ingredientTextCorroborated
        || review.reviewedAt !== product.verifiedAt || !review.rationale?.trim()
        || !review.sourceCaptureSha256 || !/^[a-f0-9]{64}$/.test(review.sourceCaptureSha256)
        || !review.identityEvidence?.trim() || !identitySource?.evidence?.includes(review.identityEvidence)
        || identitySource.reviewStatus !== 'label_reviewed' || identitySource.checkedAt !== review.reviewedAt
        || !review.brandEvidence?.trim() || !identitySource.evidence.includes(review.brandEvidence)
        || !identityText(review.brandEvidence).includes(identityText(product.brand))
        || !review.identityEvidence.includes(product.name) || !review.identityEvidence.includes(product.variant)
        || (product.packageSize !== null && !review.identityEvidence.includes(product.packageSize))) {
        throw new Error('Corroborated ingredient and exact identity review required');
      }
      const duplicate = [...existing, ...products].find(p => duplicateProduct(p, product));
      if (duplicate) throw new Error(`Duplicate barcode or product identity: ${duplicate.id}`);
      products.push(product);
    } catch (error) {
      held.push({ id: product.id, decision: 'needs_review', reason: error instanceof Error ? error.message : 'Invalid candidate' });
    }
  }
  return { catalog: { formatVersion: 1, catalogId: batch.catalogId, products } as ProductCatalog, held };
}
