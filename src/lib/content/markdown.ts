/**
 * Markdown-хелперы для тела статьи и оглавления. Видимые `<h2>…<h6>` (через
 * `ArticleBody`) и пункты TOC строятся одними и теми же функциями
 * (`slugifyHeading` + `uniqueHeadingId` в порядке документа), поэтому якоря
 * всегда совпадают.
 *
 * Изоморфный модуль: без React, `next/*` и БД.
 */

/** Заголовок из тела статьи с уникальным якорем. */
export interface TocHeading {
  /** Уровень 2–6. H1 страницы — заголовок статьи, в теле его нет. */
  level: 2 | 3 | 4 | 5 | 6;
  /** Видимый текст заголовка. */
  text: string;
  /** Уникальный в пределах документа id для `#fragment`. */
  id: string;
}

/**
 * Собственная карта транслитерации (порт остаётся самодостаточным; `src/lib/slug.ts`
 * может поменяться независимо, а якоря уже опубликованных статей — нет).
 */
const CYRILLIC_MAP: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

/** Текст заголовка → ASCII-слаг для `#fragment` (кириллица транслитерируется). */
export function slugifyHeading(text: string): string {
  const transliterated = text.toLowerCase().replace(/[а-яё]/g, (ch) => CYRILLIC_MAP[ch] ?? ch);
  const slug = transliterated.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "section";
}

/** Делает id уникальным суффиксами `-2`, `-3`, …; мутирует `seen`. */
export function uniqueHeadingId(base: string, seen: Set<string>): string {
  let candidate = base;
  let n = 2;
  while (seen.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  seen.add(candidate);
  return candidate;
}

/** Шорткод `{{…}}` внутри строки заголовка: `<RichText>` выносит его в отдельный блок. */
const SHORTCODE_IN_LINE = /\{\{[^{}]*?\}\}/g;

/**
 * H2–H6 из Markdown в порядке документа с уникальными id. Разбираются только
 * ATX-заголовки (`## …`); содержимое fenced-блоков (```/~~~) пропускается.
 * Шорткоды вырезаются из текста до построения слага — так id совпадает с
 * отрендеренным заголовком.
 */
export function extractHeadings(body: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const seen = new Set<string>();
  let inFence = false;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{2,6})\s+(.+?)\s*#*$/.exec(line);
    if (!match || !match[1] || !match[2]) continue;

    const level = match[1].length as TocHeading["level"];
    const text = match[2].replace(SHORTCODE_IN_LINE, "").replace(/\s+/g, " ").trim();
    if (text.length === 0) continue;

    headings.push({ level, text, id: uniqueHeadingId(slugifyHeading(text), seen) });
  }

  return headings;
}

/**
 * Грубое снятие Markdown-разметки для описаний (meta description, превью био):
 * без fenced-кода, шорткодов, директив, картинок, HTML-тегов; ссылки → их текст.
 */
export function stripMarkdown(source: string): string {
  return source
    .replace(/^\s*(```|~~~)[\s\S]*?^\s*\1\s*$/gm, " ")
    .replace(SHORTCODE_IN_LINE, " ")
    .replace(/^\s*:::\w*.*$/gm, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, "")
    .replace(/[*_`~|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Обрезает текст по границе слова до `max` символов с «…». */
export function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** id блока оглавления, к которому ведут ссылки «Перейти к оглавлению» */
export const TOC_ANCHOR = "toc";
