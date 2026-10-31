// No imports: shared with the browser (style words on the design page).

// Qloo tags a place with what its reviews say, complaints too ("stuffy", "overpriced"). Those describe a visit, not a
// style anyone wants, so they never become style words.
const COMPLAINT = /^(stuffy|crowded|overcrowded|noisy|loud|overpriced|pricey|expensive|dirty|cramped|rude|slow|dated|run[_ ]down|smelly|chaotic|pretentious|touristy|uncomfortable|tired|shabby|dingy|grimy)$/;
export const isComplaint = (value: string) => COMPLAINT.test(value.toLowerCase());
