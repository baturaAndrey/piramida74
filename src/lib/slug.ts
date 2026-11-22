/**
 * Shared slug (ЧПУ) and short-code generation. Framework-free — no React /
 * `next/*` / DB imports — so it is safe to call from `"use client"` components,
 * Server Actions, and plain server modules alike.
 *
 * Produces the hyphen-separated, transliterated, lowercase slugs used for
 * tournament / series / article / page URLs. Cyrillic is romanized so the
 * resulting `/path` segment is fully ASCII and portable.
 *
 * @example slugify("Девичник по понедельникам") → "devichnik-po-ponedelnikam"
 * @example slugify("Марафон-Промнефтегаз 1 тур") → "marafon-promneftegaz-1-tur"
 */

import { customAlphabet } from "nanoid";

/**
 * Complete а–я + ё transliteration map (Russian). Keys are LOWERCASE; callers
 * must lowercase the input first (see {@link slugify}) so uppercase Cyrillic is
 * covered without duplicate entries. Soft/hard signs (ъ, ь) drop to "".
 *
 * `х → "h"` (not "kh"), e.g. «хамам» → "hamam".
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

/**
 * Convert an arbitrary title/name into a URL slug: lowercase, transliterate
 * Cyrillic to latin, collapse every run of non-alphanumeric characters to a
 * single hyphen, and trim leading/trailing hyphens.
 *
 * Existing latin letters and digits are preserved as-is. Returns "" for input
 * that contains no slug-able characters — callers decide how to handle empty.
 */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      // Romanize Cyrillic; any non-mapped char passes through to the cleanup pass.
      .replace(/[а-яё]/g, (ch) => CYRILLIC_MAP[ch] ?? ch)
      // Everything that is not a-z/0-9 becomes a hyphen boundary.
      .replace(/[^a-z0-9]+/g, "-")
      // Drop hyphens that ended up at the very start or end.
      .replace(/^-+|-+$/g, "")
  );
}

const codeAlphabet = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 6);

/** Короткий код позиции/сета для URL калькулятора: 6 символов [0-9a-z] */
export function nanoCode(): string {
  return codeAlphabet();
}
