import { describe, expect, it } from "vitest";
import { formatArticleDate, readingTimeLabel } from "./format";

describe("formatArticleDate", () => {
  it("дата по Екатеринбургу без « г.»", () => {
    expect(formatArticleDate("2026-11-20T10:00:00.000Z")).toBe("20 ноября 2026");
  });

  it("учитывает часовой пояс клуба (UTC+5)", () => {
    // 20:00 UTC 31 декабря — уже 1 января по Екатеринбургу
    expect(formatArticleDate(new Date("2026-12-31T20:00:00.000Z"))).toBe("1 января 2027");
  });

  it("некорректная дата → пустая строка", () => {
    expect(formatArticleDate("not-a-date")).toBe("");
  });
});

describe("readingTimeLabel", () => {
  it("минуты чтения", () => {
    expect(readingTimeLabel(5)).toBe("5 мин чтения");
    expect(readingTimeLabel(0)).toBe("1 мин чтения");
    expect(readingTimeLabel(Number.NaN)).toBe("1 мин чтения");
  });
});
