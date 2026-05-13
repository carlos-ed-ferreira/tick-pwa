import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tick",
    short_name: "Tick",
    description: "Offline-first daily tasks and goals.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f9faf9",
    theme_color: "#f9faf9",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/icons/tick-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/tick-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}