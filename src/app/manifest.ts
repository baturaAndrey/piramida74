import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Бильярдный клуб «Пирамида»",
    short_name: "Пирамида",
    description:
      "Бильярдный клуб в Челябинске: русская пирамида, американский пул, VIP-комнаты, бар и кухня.",
    lang: "ru",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f6f6",
    theme_color: "#2f6c4a",
    icons: [
      { src: "/icons/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
