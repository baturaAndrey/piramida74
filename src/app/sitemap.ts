import { connection } from "next/server";
import { absoluteUrl } from "@/lib/seo/metadata";
import { getBlogSitemapEntries } from "@/lib/seo/sitemap-sources";
import type { MetadataRoute } from "next";

type ChangeFrequency = "daily" | "weekly" | "monthly";

const STATIC_PATHS: { path: string; priority: number; changeFrequency: ChangeFrequency }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/tournaments", priority: 0.8, changeFrequency: "weekly" },
  { path: "/menu", priority: 0.8, changeFrequency: "monthly" },
  { path: "/prices", priority: 0.8, changeFrequency: "monthly" },
  { path: "/calculator", priority: 0.7, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.7, changeFrequency: "daily" },
  { path: "/politika", priority: 0.2, changeFrequency: "monthly" },
  { path: "/soglasie", priority: 0.2, changeFrequency: "monthly" },
];

/**
 * Динамическая карта сайта. `connection()` первым действием — чтобы `next build` не ходил в БД.
 * Без try/catch: ошибка БД должна давать 500, а не пустую карту в кэше поисковика.
 * Не входят: /spasibo, /admin/**, auth-страницы, /blog/preview/**, RSS, статьи с noindex.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const blog = await getBlogSitemapEntries(new Date());
  return [
    ...STATIC_PATHS.map((p) => ({
      url: absoluteUrl(p.path),
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    })),
    ...blog.rubrics.map((r) => ({
      url: absoluteUrl(`/blog/${r.slug}`),
      lastModified: r.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...blog.articles.map((a) => ({
      url: absoluteUrl(`/blog/${a.slug}`),
      lastModified: a.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...blog.authors.map((a) => ({
      url: absoluteUrl(`/authors/${a.slug}`),
      lastModified: a.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ];
}
