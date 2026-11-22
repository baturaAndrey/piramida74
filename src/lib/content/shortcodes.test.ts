import { describe, expect, it } from "vitest";
import { isSafeContentUrl, parseRichText, type RichSegment } from "./shortcodes";

const VK = "https://vkvideo.ru/video-12345_67890";
const DOC = "/media/docs/reglament.pdf";

function singleEmbed(source: string): RichSegment {
  const embeds = parseRichText(source).filter((s) => s.kind === "embed");
  expect(embeds).toHaveLength(1);
  return embeds[0]!;
}

describe("parseRichText — типы (RU + EN)", () => {
  it("Видео / video", () => {
    const expected = { kind: "embed", token: { type: "video", url: VK } };
    expect(singleEmbed(`{{Видео: ${VK}}}`)).toEqual(expected);
    expect(singleEmbed(`{{video: ${VK}}}`)).toEqual(expected);
  });

  it("Документ / файл / document", () => {
    const expected = { kind: "embed", token: { type: "document", url: DOC } };
    expect(singleEmbed(`{{Документ: ${DOC}}}`)).toEqual(expected);
    expect(singleEmbed(`{{Файл: ${DOC}}}`)).toEqual(expected);
    expect(singleEmbed(`{{document: ${DOC}}}`)).toEqual(expected);
  });

  it("подпись после `|`", () => {
    expect(singleEmbed(`{{Документ: ${DOC} | Регламент турнира}}`)).toEqual({
      kind: "embed",
      token: { type: "document", url: DOC, label: "Регламент турнира" },
    });
  });

  it("ключевое слово без учёта регистра, разделитель `-`, пробелы", () => {
    expect(singleEmbed(`{{ВИДЕО: ${VK}}}`).kind).toBe("embed");
    expect(singleEmbed(`{{  Документ  -  ${DOC}  }}`)).toEqual({
      kind: "embed",
      token: { type: "document", url: DOC },
    });
  });
});

describe("parseRichText — отбрасывание токенов", () => {
  it("магазинные и неизвестные типы", () => {
    expect(parseRichText("{{Товар: kij}}")).toEqual([]);
    expect(parseRichText("{{Коллекция: kii}}")).toEqual([]);
    expect(parseRichText("{{Комплект: nabor}}")).toEqual([]);
    expect(parseRichText("{{Подборка: a, b}}")).toEqual([]);
    expect(parseRichText("{{Видеоролик: abc}}")).toEqual([]);
  });

  it("без разделителя и с пустым URL", () => {
    expect(parseRichText(`{{Видео ${VK}}}`)).toEqual([]);
    expect(parseRichText("{{Видео: }}")).toEqual([]);
    expect(parseRichText("{{Документ:  | Подпись}}")).toEqual([]);
  });

  it("не выводит отброшенный токен литералом", () => {
    expect(parseRichText("до {{Неизвестно: x}} после")).toEqual([
      { kind: "markdown", text: "до  после" },
    ]);
  });

  it("документ: только /media/… и https://", () => {
    expect(parseRichText("{{Документ: javascript:alert(1)}}")).toEqual([]);
    expect(parseRichText("{{Документ: JavaScript:alert(1) | x}}")).toEqual([]);
    expect(parseRichText("{{Документ: data:text/html;base64,AAAA}}")).toEqual([]);
    expect(parseRichText("{{Документ: http://example.com/a.pdf}}")).toEqual([]);
    expect(parseRichText("{{Документ: //evil.com/a.pdf}}")).toEqual([]);
    expect(parseRichText("{{Документ: /media/../etc/passwd}}")).toEqual([]);
    expect(parseRichText("{{Документ: /admin/secret.pdf}}")).toEqual([]);
    expect(singleEmbed("{{Документ: https://example.com/a.pdf}}").kind).toBe("embed");
  });

  it("видео: чужие хосты отбрасываются", () => {
    expect(parseRichText("{{Видео: https://youtu.be/abcdef}}")).toEqual([]);
    expect(parseRichText("{{Видео: https://vk.com.evil.com/video-1_2}}")).toEqual([]);
    expect(parseRichText("{{Видео: javascript:alert(1)}}")).toEqual([]);
  });
});

describe("parseRichText — позиции и текст", () => {
  it("простой Markdown — один сегмент", () => {
    expect(parseRichText("## Заголовок\n\nАбзац.")).toEqual([
      { kind: "markdown", text: "## Заголовок\n\nАбзац." },
    ]);
  });

  it("пустой источник → []", () => {
    expect(parseRichText("")).toEqual([]);
    expect(parseRichText("  \n ")).toEqual([]);
  });

  it("токен в середине и подряд", () => {
    expect(parseRichText(`вступление\n\n{{Видео: ${VK}}}\n\nфинал`)).toEqual([
      { kind: "markdown", text: "вступление\n\n" },
      { kind: "embed", token: { type: "video", url: VK } },
      { kind: "markdown", text: "\n\nфинал" },
    ]);
    expect(parseRichText(`{{Видео: ${VK}}}{{Документ: ${DOC}}}`)).toEqual([
      { kind: "embed", token: { type: "video", url: VK } },
      { kind: "embed", token: { type: "document", url: DOC } },
    ]);
  });

  it("HTML остаётся текстом Markdown (экранирует рендерер)", () => {
    expect(parseRichText("<script>alert(1)</script>")).toEqual([
      { kind: "markdown", text: "<script>alert(1)</script>" },
    ]);
  });
});

describe("isSafeContentUrl", () => {
  it.each([
    ["/media/a/b.webp", true],
    ["https://example.com/x.png", true],
    ["http://example.com/x.png", false],
    ["//evil.com/x.png", false],
    ["/media/../x", false],
    ["/media\\..\\x", false],
    ["/uploads/x.png", false],
    ["javascript:alert(1)", false],
    ["data:image/png;base64,AAAA", false],
    ["", false],
  ])("%s → %s", (url, expected) => {
    expect(isSafeContentUrl(url)).toBe(expected);
  });
});
