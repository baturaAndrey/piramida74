import { describe, expect, it } from "vitest";
import { describeRange, formatDays, formatHole, formatTimeRange } from "./labels";
import { analyzeTariffs, findHoles, findOverlaps, type TariffLike } from "./tariff-analysis";

const HALL = "hall-1";
const VIP = "hall-2";
const TODAY = "2026-11-20";
const SUN_THU = [0, 1, 2, 3, 4];
const FRI_SAT = [5, 6];
const ALL = [0, 1, 2, 3, 4, 5, 6];

function t(over: Partial<TariffLike>): TariffLike {
  return {
    hallId: HALL,
    daysOfWeek: ALL,
    startMin: 0,
    endMin: 1440,
    audience: "all",
    validFrom: null,
    validTo: null,
    isActive: true,
    ...over,
  };
}

/** Тарифы общего зала из seed: полное покрытие суток */
const seedCommon = [
  t({ id: "a", daysOfWeek: SUN_THU, startMin: 0, endMin: 420 }),
  t({ id: "b", daysOfWeek: SUN_THU, startMin: 420, endMin: 1020 }),
  t({ id: "c", daysOfWeek: FRI_SAT, startMin: 0, endMin: 420 }),
  t({ id: "d", daysOfWeek: FRI_SAT, startMin: 420, endMin: 1020 }),
  t({ id: "e", daysOfWeek: ALL, startMin: 1020, endMin: 1440 }),
  t({ id: "p", daysOfWeek: ALL, startMin: 0, endMin: 180, audience: "pensioner" }),
];

describe("findOverlaps", () => {
  it("не находит пересечений в тарифах seed (касание границ — не пересечение)", () => {
    expect(findOverlaps(seedCommon)).toEqual([]);
  });

  it("находит пересечение по общим дням и времени", () => {
    const res = findOverlaps([
      ...seedCommon,
      t({ id: "x", daysOfWeek: [1, 5], startMin: 400, endMin: 500 }),
    ]);
    const ids = res.map((o) => [o.a.id, o.b.id, o.days]);
    expect(ids).toEqual([
      ["a", "x", [1]],
      ["b", "x", [1]],
      ["c", "x", [5]],
      ["d", "x", [5]],
    ]);
  });

  it("не сравнивает разные залы, аудитории, неактивные и непересекающиеся периоды", () => {
    const base = t({ id: "1", validFrom: "2026-01-01", validTo: "2026-06-30" });
    expect(
      findOverlaps([
        base,
        t({ id: "2", hallId: VIP }),
        t({ id: "3", audience: "pensioner" }),
        t({ id: "4", isActive: false }),
        t({ id: "5", validFrom: "2026-07-01" }),
      ])
    ).toEqual([]);
  });

  it("бессрочный тариф пересекается с ограниченным по сроку", () => {
    expect(findOverlaps([t({ id: "1" }), t({ id: "2", validTo: "2026-12-31" })])).toHaveLength(1);
  });
});

describe("findHoles", () => {
  it("полное покрытие — дыр нет; пенсионные тарифы не учитываются", () => {
    expect(findHoles(seedCommon, [HALL], TODAY)).toEqual([]);
  });

  it("зал без тарифов — одна дыра на все дни", () => {
    expect(findHoles([], [VIP], TODAY)).toEqual([
      { hallId: VIP, days: ALL, fromMin: 0, toMin: 1440 },
    ]);
  });

  it("объединяет дни с одинаковыми дырами", () => {
    const tariffs = seedCommon.filter((x) => x.id !== "e");
    tariffs.push(t({ id: "n", daysOfWeek: FRI_SAT, startMin: 1020, endMin: 1440 }));
    tariffs.push(t({ id: "m", daysOfWeek: [1, 2, 3, 4], startMin: 1080, endMin: 1440 }));
    expect(findHoles(tariffs, [HALL], TODAY)).toEqual([
      { hallId: HALL, days: [0], fromMin: 1020, toMin: 1440 },
      { hallId: HALL, days: [1, 2, 3, 4], fromMin: 1020, toMin: 1080 },
    ]);
  });

  it("учитывает только тарифы, действующие сегодня, и сливает пересекающиеся интервалы", () => {
    const tariffs = [
      t({ startMin: 0, endMin: 600 }),
      t({ startMin: 300, endMin: 900 }),
      t({ startMin: 900, endMin: 1440, validTo: "2026-01-01" }),
    ];
    expect(findHoles(tariffs, [HALL], TODAY)).toEqual([
      { hallId: HALL, days: ALL, fromMin: 900, toMin: 1440 },
    ]);
  });

  it("analyzeTariffs проверяет дыры только у переданных залов", () => {
    const res = analyzeTariffs(seedCommon, [HALL, VIP], TODAY);
    expect(res.overlaps).toEqual([]);
    expect(res.holes).toEqual([{ hallId: VIP, days: ALL, fromMin: 0, toMin: 1440 }]);
  });
});

describe("labels", () => {
  it("formatDays", () => {
    expect(formatDays(SUN_THU)).toBe("Вс–Чт");
    expect(formatDays(FRI_SAT)).toBe("Пт–Сб");
    expect(formatDays(ALL)).toBe("Ежедневно");
    expect(formatDays([1, 3, 5])).toBe("Пн, Ср, Пт");
    expect(formatDays([4, 1, 2, 3])).toBe("Пн–Чт");
    expect(formatDays([6, 0])).toBe("Сб, Вс");
  });

  it("formatTimeRange и describeRange", () => {
    expect(formatTimeRange(420, 1020)).toBe("16:00–02:00");
    expect(formatTimeRange(1020, 1440)).toBe("02:00–09:00");
    expect(describeRange(1020, 1440, [5])).toBe("ночь на Сб");
    expect(describeRange(1020, 1440, FRI_SAT)).toBe("ночь на Сб, Вс");
    expect(describeRange(420, 1020, [5])).toBe("через полночь (до 02:00 на Сб)");
    expect(describeRange(0, 420, [5])).toBe("");
    expect(describeRange(1020, 1440, ALL)).toBe("ночь, ежедневно");
    expect(describeRange(0, 1020, ALL)).toBe("через полночь (до 02:00 следующего дня)");
  });

  it("formatHole", () => {
    expect(
      formatHole({ hallId: HALL, days: [1, 2, 3, 4], fromMin: 1020, toMin: 1080 }, "Общий зал")
    ).toBe("Общий зал · Пн–Чт · нет тарифа 02:00–03:00");
  });
});
