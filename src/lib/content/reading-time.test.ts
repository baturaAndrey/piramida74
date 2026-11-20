import { describe, expect, it } from "vitest";
import { computeReadingMinutes, countWords } from "./reading-time";

const words = (n: number) => Array.from({ length: n }, (_, i) => `слово${i}`).join(" ");

describe("computeReadingMinutes", () => {
  it("returns 1 for an empty body", () => {
    expect(computeReadingMinutes("")).toBe(1);
    expect(computeReadingMinutes("   \n\n")).toBe(1);
  });

  it("returns 1 for exactly 200 words and 2 for 201", () => {
    expect(computeReadingMinutes(words(200))).toBe(1);
    expect(computeReadingMinutes(words(201))).toBe(2);
  });

  it("does not count shortcodes", () => {
    const body = `${words(200)}\n\n{{Видео: https://rutube.ru/video/abcdefabcdefabcdef/}}\n{{Документ: https://example.ru/a.pdf | Регламент турнира 2026}}`;
    expect(countWords(body)).toBe(200);
    expect(computeReadingMinutes(body)).toBe(1);
  });

  it("ignores markup, image urls and fenced code", () => {
    const body = [
      "## Заголовок раздела",
      "**Жирный** и _курсив_ > цитата",
      "![Стол клуба](/media/2026/01/stol-1280.webp)",
      "[ссылка](https://example.ru/very/long/path)",
      "```",
      "const ignored = 1",
      "```",
      ":::info",
      "Врезка",
      ":::",
    ].join("\n");
    // Заголовок раздела Жирный и курсив цитата Стол клуба ссылка Врезка
    expect(countWords(body)).toBe(10);
  });
});
