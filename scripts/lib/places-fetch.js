import { businessSlug } from './slugify.js';

export const TOWN_LAT = 20.6748;
export const TOWN_LNG = -102.5705;
export const RADIUS = 5000;

// Note: 'grocery_or_supermarket' is not supported in Places API New — covered by 'store'.
export const CATEGORIES = [
  'restaurant', 'meal_takeaway', 'meal_delivery',
  'bar', 'cafe',
  'store', 'pharmacy', 'bakery',
  'park', 'campground', 'tourist_attraction',
  'lodging',
];

export const DEFAULT_BLOCKED_PLACE_IDS = new Set([
  'ChIJTSyIjZIzKYQRe3ZylqQUV1w', // PUNTO FIT
]);

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.primaryType',
  'places.types',
  'places.formattedAddress',
  'places.location',
  'places.internationalPhoneNumber',
  'places.regularOpeningHours',
  'places.rating',
  'places.userRatingCount',
].join(',');

export function normalizePlace(raw) {
  const placeId = (raw.id || '').replace(/^places\//, '');
  const displayName = raw.displayName?.text || '';
  return {
    placeId,
    displayName,
    primaryType: raw.primaryType,
    types: raw.types || [],
    formattedAddress: raw.formattedAddress,
    location: raw.location,
    internationalPhoneNumber: raw.internationalPhoneNumber,
    regularOpeningHours: raw.regularOpeningHours,
    rating: raw.rating,
    userRatingCount: raw.userRatingCount,
    slug: businessSlug(displayName, placeId),
  };
}

export function dedupeAndBlock(places, blockedIds) {
  const seen = new Map();
  for (const p of places) {
    if (!p.placeId) continue;
    if (blockedIds.has(p.placeId)) continue;
    if (!seen.has(p.placeId)) seen.set(p.placeId, p);
  }
  return [...seen.values()];
}

async function fetchOneCategory(apiKey, type) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: [type],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: TOWN_LAT, longitude: TOWN_LNG },
          radius: RADIUS,
        },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API ${type} returned ${res.status}: ${text}`);
  }
  const json = await res.json();
  return (json.places || []).map(normalizePlace);
}

export async function fetchAllBusinesses({ apiKey, blockedIds = DEFAULT_BLOCKED_PLACE_IDS, log = () => {} }) {
  const all = [];
  for (const type of CATEGORIES) {
    try {
      const places = await fetchOneCategory(apiKey, type);
      log(`  ${type}: ${places.length} results`);
      all.push(...places);
    } catch (err) {
      log(`  ${type}: FAILED — ${err.message}`);
    }
  }
  const businesses = dedupeAndBlock(all, blockedIds)
    .sort((a, b) => (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0));
  return businesses;
}

export function buildSnapshot(businesses, blockedCount) {
  return {
    fetchedAt: new Date().toISOString(),
    townCenter: { latitude: TOWN_LAT, longitude: TOWN_LNG },
    radius: RADIUS,
    blockedCount,
    count: businesses.length,
    businesses,
  };
}
