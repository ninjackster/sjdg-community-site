#!/usr/bin/env node
/**
 * Fetches nearby businesses from Google Places API New, dedupes by place_id,
 * applies block list, computes URL slugs, writes content/businesses-snapshot.json.
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=... node scripts/fetch-businesses.js
 *   (or via npm script: npm run fetch-businesses — uses --env-file-if-exists=.env.local)
 */
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { businessSlug } from './lib/slugify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SNAPSHOT_PATH = join(ROOT, 'content/businesses-snapshot.json');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) {
  console.error('ERROR: GOOGLE_PLACES_API_KEY not set.');
  console.error('Set it in your environment or .env.local, then re-run with:');
  console.error('  npm run fetch-businesses');
  process.exit(2);
}

const TOWN_LAT = 20.6748;
const TOWN_LNG = -102.5705;
const RADIUS = 5000; // meters

// Note: 'grocery_or_supermarket' is not supported in Places API New — covered by 'store'.
const CATEGORIES = [
  'restaurant', 'meal_takeaway', 'meal_delivery',
  'bar', 'cafe',
  'store', 'pharmacy', 'bakery',
  'park', 'campground', 'tourist_attraction',
  'lodging',
];

const BLOCKED_PLACE_IDS = new Set([
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

async function fetchCategory(type) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
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
  return json.places || [];
}

function normalize(rawPlace) {
  const placeId = (rawPlace.id || '').replace(/^places\//, '');
  const displayName = rawPlace.displayName?.text || '';
  return {
    placeId,
    displayName,
    primaryType: rawPlace.primaryType,
    types: rawPlace.types || [],
    formattedAddress: rawPlace.formattedAddress,
    location: rawPlace.location,
    internationalPhoneNumber: rawPlace.internationalPhoneNumber,
    regularOpeningHours: rawPlace.regularOpeningHours,
    rating: rawPlace.rating,
    userRatingCount: rawPlace.userRatingCount,
    slug: businessSlug(displayName, placeId),
  };
}

async function main() {
  console.log(`Fetching ${CATEGORIES.length} categories...`);
  const seen = new Map();
  for (const type of CATEGORIES) {
    try {
      const raw = await fetchCategory(type);
      console.log(`  ${type}: ${raw.length} results`);
      for (const place of raw) {
        const b = normalize(place);
        if (!b.placeId) continue;
        if (BLOCKED_PLACE_IDS.has(b.placeId)) continue;
        if (!seen.has(b.placeId)) seen.set(b.placeId, b);
      }
    } catch (err) {
      console.error(`  ${type}: FAILED — ${err.message}`);
    }
  }
  const businesses = [...seen.values()].sort((a, b) =>
    (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0)
  );

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    townCenter: { latitude: TOWN_LAT, longitude: TOWN_LNG },
    radius: RADIUS,
    blockedCount: BLOCKED_PLACE_IDS.size,
    count: businesses.length,
    businesses,
  };

  await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  console.log(`\n✓ Wrote ${businesses.length} businesses to ${SNAPSHOT_PATH}`);
}

main().catch(err => {
  console.error('Fetch failed:', err);
  process.exit(1);
});
