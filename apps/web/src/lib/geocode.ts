/**
 * Free address search via Photon (https://photon.komoot.io) — open-source
 * geocoder over OpenStreetMap data. No API key, no billing account.
 *
 * Public instance fair-use ≈ 1 req/s, which our debounced type-ahead respects.
 * Unlike the Google SDK, search results already carry postcode + coordinates,
 * so there's no second "place details" round-trip: pick a suggestion and we
 * have everything needed to match a serviceable area by pincode.
 */

/** Bengaluru center — biases results toward current serviceable coverage. */
export const CITY_BIAS = { lat: 12.9716, lng: 77.5946 };

/** Everything the app needs from a picked suggestion. */
export interface PlaceSelection {
  /** Street-level text for the address-line-1 input (house/street or area name). */
  line1: string;
  /** Full formatted address as OSM sees it. */
  formatted: string;
  pincode: string | null;
  city: string | null;
  lat: number;
  lng: number;
}

export interface Suggestion {
  /** Stable client key (OSM id). */
  id: string;
  /** Main display line, e.g. "Indiranagar" or "12, 100 Feet Road". */
  main: string;
  /** Secondary display line, e.g. "Bengaluru, Karnataka, India". */
  secondary: string;
  selection: PlaceSelection;
}

interface PhotonProps {
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  district?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  osm_id?: number;
  osm_type?: string;
  type?: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: PhotonProps;
}

function dedupeJoin(parts: (string | undefined)[], sep = ", "): string {
  return [...new Set(parts.filter((s): s is string => !!s && s.trim() !== ""))].join(sep);
}

function toSuggestion(f: PhotonFeature, i: number): Suggestion | null {
  const [lng, lat] = f.geometry?.coordinates ?? [];
  const p = f.properties ?? {};
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const streetLine = [p.housenumber, p.street].filter(Boolean).join(" ");
  const main = p.name || streetLine || "Unnamed place";
  // Prefer explicit street detail; fall back to the area/POI name itself.
  const line1 = streetLine || p.name || main;

  return {
    id: `${p.osm_type ?? "x"}${p.osm_id ?? i}`,
    main,
    secondary: dedupeJoin([p.district !== p.city ? p.district : undefined, p.city, p.state, p.country]),
    selection: {
      line1,
      formatted: dedupeJoin([p.name, streetLine, p.district, p.city, p.state, p.postcode, p.country]),
      pincode: /^\d{6}$/.test(p.postcode ?? "") ? p.postcode! : null, // trust Indian pincodes only
      city: p.city ?? p.county ?? p.state ?? null,
      lat,
      lng,
    },
  };
}

/** Type-ahead search against the public Photon instance, biased near `bias`. */
export async function searchPlaces(input: string, bias = CITY_BIAS, signal?: AbortSignal): Promise<Suggestion[]> {
  const qs = new URLSearchParams({
    q: input,
    lang: "en",
    limit: "6",
    lat: String(bias.lat),
    lon: String(bias.lng),
  });
  const res = await fetch(`https://photon.komoot.io/api/?${qs.toString()}`, { signal });
  if (!res.ok) throw new Error(res.status === 429 ? "Lookups too fast — pause a moment" : "Address lookup failed");
  const data = (await res.json()) as { features?: PhotonFeature[] };
  return (data.features ?? []).map(toSuggestion).filter((s): s is Suggestion => s !== null);
}
