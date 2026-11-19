import type { SQLiteDatabase } from 'expo-sqlite';
import expansionCatalog from './data/us-expansion-01.json';
import reviewedCatalog from './data/us-reviewed-batch-01.json';
import nextReviewedCatalog from './data/us-reviewed-batch-02.json';
import thirdReviewedCatalog from './data/us-reviewed-batch-03.json';
import fourthReviewedCatalog from './data/us-reviewed-batch-04.json';
import fifthReviewedCatalog from './data/us-reviewed-batch-05.json';
import sixthReviewedCatalog from './data/us-reviewed-batch-06.json';
import finalReviewedCatalog from './data/us-reviewed-batch-07.json';
import starterCatalog from './data/us-starter.json';
import { importProductCatalog } from './importer';

export async function importStarterProductCatalog(database: SQLiteDatabase) {
  const starter = await importProductCatalog(database, starterCatalog);
  const expansion = await importProductCatalog(database, expansionCatalog);
  const reviewed = await importProductCatalog(database, reviewedCatalog);
  const nextReviewed = await importProductCatalog(database, nextReviewedCatalog);
  const thirdReviewed = await importProductCatalog(database, thirdReviewedCatalog);
  const fourthReviewed = await importProductCatalog(database, fourthReviewedCatalog);
  const fifthReviewed = await importProductCatalog(database, fifthReviewedCatalog);
  const sixthReviewed = await importProductCatalog(database, sixthReviewedCatalog);
  const finalReviewed = await importProductCatalog(database, finalReviewedCatalog);
  return { inserted: starter.inserted + expansion.inserted + reviewed.inserted + nextReviewed.inserted + thirdReviewed.inserted + fourthReviewed.inserted + fifthReviewed.inserted + sixthReviewed.inserted + finalReviewed.inserted, updated: starter.updated + expansion.updated + reviewed.updated + nextReviewed.updated + thirdReviewed.updated + fourthReviewed.updated + fifthReviewed.updated + sixthReviewed.updated + finalReviewed.updated,
    unchanged: starter.unchanged + expansion.unchanged + reviewed.unchanged + nextReviewed.unchanged + thirdReviewed.unchanged + fourthReviewed.unchanged + fifthReviewed.unchanged + sixthReviewed.unchanged + finalReviewed.unchanged, skipped: [...starter.skipped, ...expansion.skipped, ...reviewed.skipped, ...nextReviewed.skipped, ...thirdReviewed.skipped, ...fourthReviewed.skipped, ...fifthReviewed.skipped, ...sixthReviewed.skipped, ...finalReviewed.skipped] };
}
