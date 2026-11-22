import { describe, expect, it } from "vitest";
import {
  extractHeadings,
  slugifyHeading,
  stripMarkdown,
  truncateText,
  uniqueHeadingId,
} from "./markdown";

describe("slugifyHeading", () => {
  it("транслитерирует кириллицу", () => {
    expect(slugifyHeading("Как держать кий")).toBe("kak-derzhat-kiy");
    expect(slugifyHeading("Ёлка, щётка!")).toBe("elka-schetka");
  });

  it("пустой результат → section", () => {
    expect(slugifyHeading("???")).toBe("section");
  });
});

describe("uniqueHeadingId", () => {
  it("добавляет суффиксы", () => {
    const seen = new Set<string>();
    expect(uniqueHeadingId("a", seen)).toBe("a");
    expect(uniqueHeadingId("a", seen)).toBe("a-2");
    expect(uniqueHeadingId("a", seen)).toBe("a-3");
  });
});

describe("extractHeadings", () => {
  it("H2–H6 по порядку, H1 пропускается", () => {
    const body = "# Титул\n\n## Раз\n\n### Два\n\n###### Шесть ##";
    expect(extractHeadings(body)).toEqual([
      { level: 2, text: "Раз", id: "raz" },
      { level: 3, text: "Два", id: "dva" },
      { level: 6, text: "Шесть", id: "shest" },
    ]);
  });

  it("пропускает заголовки в fenced code", () => {
    const body = "## До\n\n```md\n## Внутри кода\n```\n\n~~~\n### И тут\n~~~\n\n## После";
    expect(extractHeadings(body).map((h) => h.text)).toEqual(["До", "После"]);
  });

  it("уникальные id для повторов", () => {
    const body = "## Итоги\n\n## Итоги\n\n## Итоги";
    expect(extractHeadings(body).map((h) => h.id)).toEqual(["itogi", "itogi-2", "itogi-3"]);
  });

  it("вырезает шорткоды из текста заголовка", () => {
    const body = "## Видео {{Видео: https://vk.com/video-1_2}} урока";
    expect(extractHeadings(body)).toEqual([{ level: 2, text: "Видео урока", id: "video-uroka" }]);
  });

  it("заголовок только из шорткода пропускается; CRLF поддерживается", () => {
    expect(extractHeadings("## {{Видео: x}}\r\n## Есть\r\n")).toEqual([
      { level: 2, text: "Есть", id: "est" },
    ]);
  });
});

describe("stripMarkdown / truncateText", () => {
  it("снимает разметку", () => {
    const md =
      "## Заголовок\n\nТекст **жирный** и [ссылка](https://x.ru).\n\n![img](/media/a.webp)\n\n```js\ncode()\n```\n\n:::info\nВажно\n:::\n\n{{Видео: https://vk.com/video-1_2}}\n\n- пункт <b>html</b>";
    expect(stripMarkdown(md)).toBe("Заголовок Текст жирный и ссылка. Важно пункт html");
  });

  it("обрезает по слову", () => {
    expect(truncateText("один два три четыре", 12)).toBe("один два…");
    expect(truncateText("коротко", 12)).toBe("коротко");
  });
});
