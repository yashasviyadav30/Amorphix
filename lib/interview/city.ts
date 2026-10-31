// A city as the map knows it: "Los Angeles, California, United States". Pure, so the interview and its tests agree.

export type Place = { name?: string; address?: Record<string, string | undefined> };

const US = "United States";
const STATE_CODE: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

/** "Austin, TX" for the US (how Americans write it, and how the budget reads regions), "Pune, India" elsewhere. */
export function cityLabel(p: Place): string | null {
  const a = p.address ?? {};
  // the place itself first: Brooklyn, not the city it sits in (New York)
  const city = p.name ?? a.city ?? a.town ?? a.village ?? a.suburb ?? a.municipality;
  const country = a.country;
  if (!city || !country) return null;
  if (country === US) {
    const code = a.state ? STATE_CODE[a.state] : undefined;
    return code ? `${city}, ${code}` : `${city}, USA`;
  }
  return `${city}, ${country}`;
}
