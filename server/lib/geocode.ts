import {
  GOOGLE_GEOCODE_BASE,
  GOONG_BASE,
  NOMINATIM_BASE,
  getGoogleKey,
  getGoongKey,
} from "./api-keys";

export type GeocodeResult = {
  lat: number;
  lng: number;
  formattedAddress: string;
};

/**
 * Internal geocoder: Google → Goong → Nominatim
 * Used by generate-itinerary to get accurate coordinates and elsewhere.
 */
export async function internalGeocode(address: string): Promise<GeocodeResult | null> {
  const googleKey = getGoogleKey();
  if (googleKey) {
    try {
      const url = `${GOOGLE_GEOCODE_BASE}?key=${googleKey}&address=${encodeURIComponent(address)}&language=vi`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.status === "OK" && data.results?.length) {
          const r = data.results[0];
          return {
            lat: r.geometry?.location?.lat || 0,
            lng: r.geometry?.location?.lng || 0,
            formattedAddress: r.formatted_address || address,
          };
        }
      }
    } catch {}
  }

  const goongKey = getGoongKey();
  if (goongKey) {
    try {
      const url = `${GOONG_BASE}/Geocode?api_key=${goongKey}&address=${encodeURIComponent(address)}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.results?.length) {
          const r = data.results[0];
          return {
            lat: r.geometry?.location?.lat || 0,
            lng: r.geometry?.location?.lng || 0,
            formattedAddress: r.formatted_address || address,
          };
        }
      }
    } catch {}
  }

  try {
    const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(address)}&limit=1&accept-language=vi`;
    const response = await fetch(url, {
      headers: { "User-Agent": "TravelPlannerPro/1.0" },
    });
    if (response.ok) {
      const data = await response.json();
      if (data.length > 0) {
        return {
          lat: parseFloat(data[0].lat) || 0,
          lng: parseFloat(data[0].lon) || 0,
          formattedAddress: data[0].display_name || address,
        };
      }
    }
  } catch {}

  return null;
}
