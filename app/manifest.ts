import type { MetadataRoute } from "next";

// Amorphix as a phone app: installed from the browser to the home screen, opening full screen. Icons are made from the
// logo by scripts/app-icons.ts.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Amorphix, the AI architect",
    short_name: "Amorphix",
    description: "Spaces designed around what you love: a plan, a 3D walkthrough, a budget and the site, on your phone.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4f7fb",
    theme_color: "#0e1a2b",
    categories: ["lifestyle", "productivity", "design"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Design a space", url: "/start", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My projects", url: "/home", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
