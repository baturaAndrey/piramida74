/**
 * Время чтения статьи для колонки `articles.readingMinutes`. Изоморфный модуль.
 * Считаются только слова текста: шорткоды `{{…}}`, блоки кода, URL картинок/ссылок
 * и символы разметки не учитываются.
 */

export const WORDS_PER_MINUTE = 200;

const SHORTCODE = /\{\{[^{}]*\}\}/g;
const FENCED_CODE = /^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm;
/** `![alt](url)` → alt; `[текст](url)` → текст */
const IMAGE = /!\[([^\]]*)\]\([^)]*\)/g;
const LINK = /\[([^\]]*)\]\([^)]*\)/g;
const BARE_URL = /\b(?:https?:\/\/|\/media\/)\S+/g;
/** Маркеры врезок `:::info` / `:::` */
const DIRECTIVE = /^:::\w*\s*$/gm;
const MARKUP = /[#*_>|`~]/g;
const WORD = /[\p{L}\p{N}]+/gu;

export function countWords(body: string): number {
  const text = body
    .replace(FENCED_CODE, " ")
    .replace(SHORTCODE, " ")
    .replace(IMAGE, "$1")
    .replace(LINK, "$1")
    .replace(BARE_URL, " ")
    .replace(DIRECTIVE, " ")
    .replace(MARKUP, " ");
  return text.match(WORD)?.length ?? 0;
}

/** Слова / 200, округление вверх, минимум 1 минута. */
export function computeReadingMinutes(body: string): number {
  return Math.max(1, Math.ceil(countWords(body) / WORDS_PER_MINUTE));
}
