/** Approved photos remain the first choice. No cross-product/category substitution. */
export function selectProductImage(photoAvailable: boolean, illustrationAvailable: boolean, photoFailed = false, illustrationFailed = false) {
  if (photoAvailable && !photoFailed) return 'photo';
  if (illustrationAvailable && !illustrationFailed) return 'illustration';
  return 'neutral';
}
