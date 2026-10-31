// What a project is called on cards and in search: its title, or its kind and place ("House in Los Angeles").
export const SPACE: Record<string, string> = { house: "House", apartment: "Apartment", office: "Office", cafe: "Café", hotel: "Hotel", shop: "Shop", studio: "Studio" };

export const projectName = (p: { title: string | null; space_type: string | null; site?: { location?: string } | null }) =>
  p.title ?? [SPACE[p.space_type ?? ""] ?? "Project", p.site?.location && `in ${p.site.location}`].filter(Boolean).join(" ");
