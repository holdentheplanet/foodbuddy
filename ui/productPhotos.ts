import type { ImageSourcePropType } from 'react-native';
import credits from '../assets/products/manifest.json';
import photoAudit from '../assets/products/audit-2026-11-19.json';
const heldPhotos = new Set(photoAudit.filter(review => review.decision === 'hold').map(review => review.productId));

// Static requires let Metro bundle these files. No remote photo fallback.
const assets: Record<string, ImageSourcePropType> = {
  "batch07-stubbs-sticky-sweet-barbecue-sauce-18-oz": require("../assets/products/batch07-stubbs-sticky-sweet-barbecue-sauce-18-oz.jpg"),
  "batch07-stubbs-spicy-barbecue-sauce-18-oz": require("../assets/products/batch07-stubbs-spicy-barbecue-sauce-18-oz.jpg"),
  "batch07-stubbs-smokey-mesquite-barbecue-sauce-18-oz": require("../assets/products/batch07-stubbs-smokey-mesquite-barbecue-sauce-18-oz.jpg"),
  "batch06-jimmy-fresh-links": require("../assets/products/batch06-jimmy-fresh-links.jpg"),
  "batch01-hershey-kit-kat-milk-chocolate-candy-bar-1-5-oz": require("../assets/products/batch01-hershey-kit-kat-milk-chocolate-candy-bar-1-5-oz.jpg"),
  "batch07-cheerios-chocolate-cheerios": require("../assets/products/batch07-cheerios-chocolate-cheerios.jpg"),
  "batch07-cheerios-frosted-cheerios": require("../assets/products/batch07-cheerios-frosted-cheerios.jpg"),
  "batch07-cheerios-very-berry-cheerios": require("../assets/products/batch07-cheerios-very-berry-cheerios.jpg"),
  "batch05-frenchs-worcestershire-sauce-10-fl-oz": require("../assets/products/batch05-frenchs-worcestershire-sauce-10-fl-oz.jpg"),
  "batch05-frenchs-classic-yellow-mustard-8-oz": require("../assets/products/batch05-frenchs-classic-yellow-mustard-8-oz.jpg"),
  "batch05-frenchs-creamy-honey-chipotle-mustard-spread-12-oz": require("../assets/products/batch05-frenchs-creamy-honey-chipotle-mustard-spread-12-oz.jpg"),
  "quaker-old-fashioned-18oz": require("../assets/products/quaker-old-fashioned-18oz.jpg"),
  "barilla-spaghetti": require("../assets/products/barilla-spaghetti.jpg"),
  "batch07-stubbs-original-barbecue-sauce-18-oz": require("../assets/products/batch07-stubbs-original-barbecue-sauce-18-oz.jpg"),
};
export function getProductPhoto(productId: string) {
  if (heldPhotos.has(productId)) return null;
  const credit = credits.find(item => item.productId === productId);
  return credit && assets[productId] ? { ...credit, source: assets[productId] } : null;
}
