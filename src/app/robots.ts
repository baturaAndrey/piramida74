import { absoluteUrl } from "@/lib/seo/metadata";
import type { MetadataRoute } from "next";

/** `/media/` и `/_next/static` открыты: картинки должны индексироваться и рендериться ботами. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/login",
          "/forgot-password",
          "/reset-password",
          "/api/",
          "/spasibo",
          "/blog/preview/",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
