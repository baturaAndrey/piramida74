import { connection } from "next/server";
import { roundedNowIso } from "@/lib/content/blog-now";
import { absoluteUrl } from "@/lib/content/site-url";
import { getRecentArticles, type ArticleCardView } from "@/lib/queries/blog";

/** RSS 2.0: последние индексируемые статьи блога. */

const FEED_SIZE = 50;

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** Экранирование текста и атрибутов XML; управляющие символы (недопустимы в XML 1.0) удаляются. */
function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[&<>"']/g, (ch) => XML_ESCAPES[ch] ?? ch);
}

function itemXml(article: ArticleCardView): string {
  const link = escapeXml(absoluteUrl(`/blog/${article.slug}`));
  const parts = [
    `<title>${escapeXml(article.title)}</title>`,
    `<link>${link}</link>`,
    `<guid isPermaLink="true">${link}</guid>`,
  ];
  if (article.publishedAt)
    parts.push(`<pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>`);
  if (article.excerpt) parts.push(`<description>${escapeXml(article.excerpt)}</description>`);
  if (article.rubric) parts.push(`<category>${escapeXml(article.rubric.name)}</category>`);
  if (article.authorName) parts.push(`<dc:creator>${escapeXml(article.authorName)}</dc:creator>`);
  return `<item>${parts.join("")}</item>`;
}

export async function GET() {
  await connection();
  const now = roundedNowIso();
  // noindex-статьи в ленту не попадают
  const items = (await getRecentArticles(FEED_SIZE, now)).filter((a) => !a.noindex);
  const lastBuild = items[0]?.publishedAt ?? now;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<title>${escapeXml("Блог — Бильярдный клуб «Пирамида»")}</title><link>${escapeXml(absoluteUrl("/blog"))}</link>
<description>Статьи, советы и новости клуба</description><language>ru</language>
<lastBuildDate>${new Date(lastBuild).toUTCString()}</lastBuildDate>
<atom:link href="${escapeXml(absoluteUrl("/blog/rss.xml"))}" rel="self" type="application/rss+xml"/>
${items.map(itemXml).join("\n")}
</channel></rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
