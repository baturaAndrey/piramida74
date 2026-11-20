import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { roundedNowIso } from "@/lib/content/blog-now";
import { getArticleBySlug } from "@/lib/queries/blog";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Блог клуба «Пирамида»";

/**
 * Литералы токенов DESIGN.md: satori не понимает CSS-переменные.
 * primary / badge / badge-foreground.
 */
const COLOR_PRIMARY = "#2f6c4a";
const COLOR_BADGE = "#fecb17";
const COLOR_BADGE_FOREGROUND = "#352b07";
const COLOR_TEXT = "#ffffff";

const DEFAULT_TITLE = "Блог клуба «Пирамида»";
const MAX_TITLE_LENGTH = 110;
const FONTS_DIR = join(process.cwd(), "src/assets/fonts");

function fontFile(name: string) {
  return readFile(join(FONTS_DIR, name));
}

/** OG-картинка статьи 1200×630; для несуществующей — общий вариант блога. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connection();
  const article = await getArticleBySlug(slug, roundedNowIso());

  // Satori не умеет variable-шрифты и WOFF2 — 4 статических WOFF (кириллица + латиница, 400/700)
  const [cyr400, lat400, cyr700, lat700] = await Promise.all([
    fontFile("onest-cyrillic-400-normal.woff"),
    fontFile("onest-latin-400-normal.woff"),
    fontFile("onest-cyrillic-700-normal.woff"),
    fontFile("onest-latin-700-normal.woff"),
  ]);

  const rawTitle = article?.title ?? DEFAULT_TITLE;
  const title =
    rawTitle.length > MAX_TITLE_LENGTH
      ? `${rawTitle.slice(0, MAX_TITLE_LENGTH).trimEnd()}…`
      : rawTitle;
  const badge = article?.rubric?.name ?? "Блог";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: COLOR_PRIMARY,
        color: COLOR_TEXT,
        fontFamily: "Onest",
      }}
    >
      <div style={{ display: "flex" }}>
        <div
          style={{
            display: "flex",
            padding: "10px 24px",
            borderRadius: 999,
            background: COLOR_BADGE,
            color: COLOR_BADGE_FOREGROUND,
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          {badge}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 64,
          fontWeight: 700,
          lineHeight: 1.15,
          maxHeight: 64 * 1.15 * 3,
          overflow: "hidden",
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", fontSize: 30, fontWeight: 400, opacity: 0.9 }}>
        Бильярдный клуб «Пирамида» · Челябинск
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Onest", data: cyr400, weight: 400, style: "normal" },
        { name: "Onest", data: lat400, weight: 400, style: "normal" },
        { name: "Onest", data: cyr700, weight: 700, style: "normal" },
        { name: "Onest", data: lat700, weight: 700, style: "normal" },
      ],
    }
  );
}
