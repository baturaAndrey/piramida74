/**
 * Парсер шорткодов в теле статьи. Тело делится на чередующиеся сегменты:
 * обычный Markdown и встраиваемые блоки `{{Тип: url | подпись}}`.
 *
 * Поддерживаются только два типа:
 *   - `{{Видео: url}}` — VK Видео / Rutube / собственный `/media/…` (см. `video-url.ts`);
 *   - `{{Документ: url | подпись}}` — карточка загрузки файла.
 *
 * Всё нераспознанное (неизвестный тип, пустой или небезопасный URL) **отбрасывается**:
 * литеральные `{{…}}` никогда не попадают в текст, а Markdown по обе стороны
 * склеивается в один сегмент.
 *
 * Изоморфный модуль: без React, `next/*` и БД.
 */

import { resolveVideoSource } from "./video-url";

export type EmbedType = "video" | "document";

/** Распознанный шорткод: один URL и необязательная подпись. */
export interface ParsedToken {
  type: EmbedType;
  url: string;
  label?: string;
}

export type RichSegment =
  { kind: "markdown"; text: string } | { kind: "embed"; token: ParsedToken };

/** Ключевое слово (без учёта регистра) → тип. */
const TYPE_ALIASES: Record<string, EmbedType> = {
  видео: "video",
  video: "video",
  документ: "document",
  файл: "document",
  document: "document",
};

/**
 * Токен `{{ … }}`: `[^{}]` запрещает вложенные скобки, ленивый квантификатор держит
 * токен минимальным. Захватывающая группа оставляет тело токена в результате `split`.
 */
const TOKEN_SPLIT = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** `<ключевое слово> (:|-) <остаток>`; разделитель — первый `:`/`-` после слова. */
const TOKEN_BODY = /^(\p{L}+)\s*[:-]\s*(.+)$/u;

/**
 * Безопасный URL встраиваемого контента: собственный `/media/…` (относительный,
 * без `//`, `..` и `\`) или абсолютный `https://`. Всё прочее (`http:`,
 * `javascript:`, `data:`, протокол-относительные `//host`) запрещено.
 */
export function isSafeContentUrl(raw: string): boolean {
  const value = raw.trim();
  if (value.length === 0) return false;
  if (value.startsWith("/")) {
    return value.startsWith("/media/") && !value.includes("..") && !value.includes("\\");
  }
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function classifyToken(inner: string): ParsedToken | null {
  const match = TOKEN_BODY.exec(inner.trim());
  if (!match || !match[1] || !match[2]) return null;

  const type = TYPE_ALIASES[match[1].toLowerCase()];
  if (type === undefined) return null;

  // Остаток делится один раз по первому `|`: URL слева, подпись справа
  const rest = match[2];
  const pipe = rest.indexOf("|");
  const url = (pipe === -1 ? rest : rest.slice(0, pipe)).trim();
  const label = pipe === -1 ? "" : rest.slice(pipe + 1).trim();
  if (url.length === 0) return null;

  // Небезопасный/неподдерживаемый URL отбрасывается ещё на разборе
  if (type === "document" && !isSafeContentUrl(url)) return null;
  if (type === "video" && resolveVideoSource(url) === null) return null;

  return label.length > 0 ? { type, url, label } : { type, url };
}

/**
 * Разбирает тело на сегменты в порядке документа. Пустые (пробельные) Markdown-
 * прогоны опускаются; для пустого источника — `[]`.
 */
export function parseRichText(source: string): RichSegment[] {
  const segments: RichSegment[] = [];
  let pending = "";

  const flushMarkdown = () => {
    if (pending.trim().length > 0) segments.push({ kind: "markdown", text: pending });
    pending = "";
  };

  // split с захватывающей группой: чётные индексы — текст, нечётные — тела токенов
  const parts = source.split(TOKEN_SPLIT);
  parts.forEach((part, i) => {
    if (i % 2 === 0) {
      pending += part;
      return;
    }
    const token = classifyToken(part);
    if (token === null) return;
    flushMarkdown();
    segments.push({ kind: "embed", token });
  });
  flushMarkdown();

  return segments;
}
