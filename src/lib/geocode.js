// Free geocoding via OpenStreetMap Nominatim — no API key needed, consistent
// with the Leaflet + OSM map stack already used in this project (see
// HotspotMap.jsx / CaseDetail.jsx). Biased to Pakistan since that's the
// product's target region (PROJECT_SPEC.md §1).
//
// Nominatim's usage policy caps public requests at ~1/second and asks for a
// descriptive referer — fine for this app's traffic, but don't loop this
// over many rows without a delay (see backfillMissingCoordinates below).

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Geocode a free-text location string to { lat, lng }.
 * Returns null (never throws) if the text is too short, nothing matches,
 * or the request fails — callers should treat null as "no pin available"
 * and still let the surrounding form submit succeed.
 */
export async function geocodeLocation(query) {
  const trimmed = query?.trim();
  if (!trimmed || trimmed.length < 3) return null;

  try {
    const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=pk&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
    });

    if (!res.ok) {
      console.error(`Geocoding request failed for "${trimmed}": HTTP ${res.status}`);
      return null;
    }

    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) {
      console.error(`Geocoding found no match for "${trimmed}"`);
      return null;
    }

    const lat = parseFloat(results[0].lat);
    const lng = parseFloat(results[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      console.error(`Geocoding returned an unparsable result for "${trimmed}"`);
      return null;
    }

    return { lat, lng };
  } catch (err) {
    console.error(`Geocoding error for "${trimmed}": ${err.message}`);
    return null;
  }
}
