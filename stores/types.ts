export type Coordinates = { latitude: number; longitude: number };
export type StoreSource = {
  url: string;
  kind: 'official_directory' | 'openstreetmap' | 'business_directory';
  // Reviewed transcription of the source location metadata, not a runtime geocode.
  evidence: string;
};
export type StoreRecord = {
  id: string; name: string; chain: string; streetAddress: string; city: string;
  state: string; zipCode: string; latitude: number | null; longitude: number | null;
  verificationStatus: 'verified' | 'unverified' | 'unknown'; checkedAt: string;
  dataset?: { osmType: 'node' | 'way' | 'relation'; osmId: string; metro: string; datasetUrl: string; datasetTimestamp: string; snapshotSha256: string; coordinateMethod: 'osm_node' | 'osm_bbox_center'; originalTags: Record<string, string> };
  sources: StoreSource[]; notes: string; attribution?: string;
};
export type StoreCatalog = { formatVersion: 1; catalogId: string; stores: StoreRecord[] };
