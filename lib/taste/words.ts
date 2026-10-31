// No imports: shared with the browser (style words on the design page).

// Words that describe a bad visit rather than a look ("stuffy", "overpriced"). Nobody wants them as a style, so they
// never become style words.
const COMPLAINT = /^(stuffy|crowded|overcrowded|noisy|loud|overpriced|pricey|expensive|dirty|cramped|rude|slow|dated|run[_ ]down|smelly|chaotic|pretentious|touristy|uncomfortable|tired|shabby|dingy|grimy)$/;
export const isComplaint = (value: string) => COMPLAINT.test(value.toLowerCase());
