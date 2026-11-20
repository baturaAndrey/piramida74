import { describe, expect, it } from "vitest";
import { nanoCode, slugify } from "./slug";

describe("slugify", () => {
  it.each([
    ["Девичник по понедельникам", "devichnik-po-ponedelnikam"],
    ["Марафон-Промнефтегаз 1 тур", "marafon-promneftegaz-1-tur"],
    ["Сеньоры Челябинска", "senory-chelyabinska"],
    ["Мисс бильярд", "miss-bilyard"],
    ["Ёлка & Щука!", "elka-schuka"],
    ["Хамам", "hamam"],
    ["  --Hello__World--  ", "hello-world"],
    ["Pool 8 ball 2026", "pool-8-ball-2026"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it.each(["", "!!!", "ъь"])("returns empty string for %j", (input) => {
    expect(slugify(input)).toBe("");
  });
});

describe("nanoCode", () => {
  it("generates 6-char [0-9a-z] codes that are practically unique", () => {
    const codes = Array.from({ length: 1000 }, () => nanoCode());
    for (const code of codes) {
      expect(code).toMatch(/^[0-9a-z]{6}$/);
    }
    expect(new Set(codes).size).toBeGreaterThanOrEqual(990);
  });
});
