import { describe, expect, it } from "vitest";
import type { CalcHall, CalcMenuVariant } from "@/lib/calculator/types";
import {
  addDays,
  autoTables,
  filterMenuGroups,
  formatHours,
  formatLongDate,
  formatRub,
  formatShortDate,
  groupMenuVariants,
  localDateToIso,
  isoToLocalDate,
  plural,
  setKeyQty,
  toQtyMap,
} from "./calculator-helpers";
import { buildTimeSlots, isNightOpMin } from "./time-slots";

const v = (
  code: string,
  itemName: string,
  label: string,
  price: number,
  categorySlug: string,
  categoryName: string
): CalcMenuVariant => ({ code, itemName, label, price, categorySlug, categoryName });

describe("groupMenuVariants", () => {
  const variants: CalcMenuVariant[] = [
    v("tea1", "Чай чёрный", "", 200, "tea", "Чай"),
    v("abc123-x9y8z7", "Пуэр", "Чайник 600 мл", 450, "tea", "Чай"),
    v("abc123-k1k2k3", "Пуэр", "Чайник 1 л", 650, "tea", "Чай"),
    v("beer05", "Пиво", "0,5 л", 250, "bar", "Бар"),
    v("beer10", "Пиво", "1 л", 450, "bar", "Бар"),
    v("tea2", "Чай зелёный", "", 210, "tea", "Чай"),
  ];

  it("группирует по categorySlug и itemName, сохраняя порядок появления", () => {
    const groups = groupMenuVariants(variants);
    expect(groups.map((g) => g.categorySlug)).toEqual(["tea", "bar"]);
    expect(groups[0]!.categoryName).toBe("Чай");
    expect(groups[0]!.items.map((i) => i.name)).toEqual(["Чай чёрный", "Пуэр", "Чай зелёный"]);
    expect(groups[1]!.items).toEqual([
      {
        name: "Пиво",
        variants: [
          { code: "beer05", label: "0,5 л", price: 250 },
          { code: "beer10", label: "1 л", price: 450 },
        ],
      },
    ]);
  });

  it("уровни сетки цен с составными кодами попадают в свою позицию", () => {
    const puer = groupMenuVariants(variants)[0]!.items.find((i) => i.name === "Пуэр")!;
    expect(puer.variants.map((x) => x.code)).toEqual(["abc123-x9y8z7", "abc123-k1k2k3"]);
    expect(puer.variants[0]!.label).toBe("Чайник 600 мл");
  });

  it("одноимённые позиции в разных категориях не сливаются", () => {
    const groups = groupMenuVariants([
      v("a", "Морс", "", 100, "drinks", "Напитки"),
      v("b", "Морс", "", 120, "kids", "Детское"),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[1]!.items[0]!.variants[0]!.code).toBe("b");
  });

  it("пустой вход → пустой список", () => {
    expect(groupMenuVariants([])).toEqual([]);
  });

  it("filterMenuGroups ищет по названию без учёта регистра", () => {
    const groups = groupMenuVariants(variants);
    const found = filterMenuGroups(groups, "  ПУЭР ");
    expect(found).toHaveLength(1);
    expect(found[0]!.items.map((i) => i.name)).toEqual(["Пуэр"]);
    expect(filterMenuGroups(groups, "")).toBe(groups);
    expect(filterMenuGroups(groups, "нет такого")).toEqual([]);
  });
});

describe("buildTimeSlots", () => {
  const slots = buildTimeSlots("2026-12-05");

  it("48 слотов от 09:00 до 08:30", () => {
    expect(slots).toHaveLength(48);
    expect(slots[0]!.value).toBe("09:00");
    expect(slots[0]!.night).toBe(false);
    expect(slots[0]!.label).toBe("09:00");
    expect(slots.at(-1)!.value).toBe("08:30");
  });

  it("порядок операционных суток: 23:30, затем 00:00 — первый ночной слот", () => {
    const idx = slots.findIndex((s) => s.value === "00:00");
    expect(slots[idx - 1]!.value).toBe("23:30");
    expect(slots[idx - 1]!.night).toBe(false);
    expect(slots[idx]!.night).toBe(true);
  });

  it("ночные слоты подписаны датой D+1", () => {
    const s = slots.find((x) => x.value === "00:30")!;
    expect(s.label).toBe("00:30 — ночь на 6 дек");
    expect(buildTimeSlots("2026-12-31").at(-1)!.label).toBe("08:30 — ночь на 1 янв");
  });

  it("isNightOpMin: граница — 00:00", () => {
    expect(isNightOpMin(899)).toBe(false);
    expect(isNightOpMin(900)).toBe(true);
  });
});

describe("даты", () => {
  it("addDays считает в UTC и переходит через месяц/год", () => {
    expect(addDays("2026-12-05", 1)).toBe("2026-12-06");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("formatShortDate / formatLongDate", () => {
    expect(formatShortDate("2026-12-06")).toBe("6 дек");
    expect(formatShortDate("2026-05-01")).toBe("1 мая");
    expect(formatLongDate("2026-12-05")).toBe("5 декабря 2026, сб");
  });

  it("isoToLocalDate ↔ localDateToIso без сдвига дня", () => {
    expect(localDateToIso(isoToLocalDate("2026-03-29"))).toBe("2026-03-29");
    expect(localDateToIso(isoToLocalDate("2026-10-25"))).toBe("2026-10-25");
  });
});

describe("прочие хелперы", () => {
  it("setKeyQty добавляет, обновляет, удаляет и зажимает", () => {
    let list = setKeyQty([], "a", 2);
    expect(list).toEqual([{ key: "a", qty: 2 }]);
    list = setKeyQty(list, "b", 1);
    list = setKeyQty(list, "a", 5);
    expect(list).toEqual([
      { key: "a", qty: 5 },
      { key: "b", qty: 1 },
    ]);
    expect(setKeyQty(list, "a", 0)).toEqual([{ key: "b", qty: 1 }]);
    expect(setKeyQty(list, "b", 500)).toEqual([
      { key: "a", qty: 5 },
      { key: "b", qty: 99 },
    ]);
    expect(toQtyMap(list)).toEqual({ a: 5, b: 1 });
  });

  it("autoTables: ceil(guests / seats), не больше tablesCount; VIP — 1", () => {
    const common: CalcHall = {
      id: "1",
      slug: "common",
      name: "Общий зал",
      kind: "common",
      tablesCount: 10,
      seatsPerTable: 4,
    };
    expect(autoTables(common, 1)).toBe(1);
    expect(autoTables(common, 9)).toBe(3);
    expect(autoTables(common, 100)).toBe(10);
    expect(autoTables({ ...common, kind: "vip", tablesCount: 1 }, 12)).toBe(1);
  });

  it("форматирование чисел", () => {
    expect(formatRub(12500).replace(/\s/g, " ")).toBe("12 500 ₽");
    expect(formatHours(2)).toBe("2 ч");
    expect(formatHours(2.5)).toBe("2,5 ч");
  });

  it("plural", () => {
    const f = ["гость", "гостя", "гостей"] as const;
    expect(plural(1, f)).toBe("гость");
    expect(plural(3, f)).toBe("гостя");
    expect(plural(11, f)).toBe("гостей");
    expect(plural(21, f)).toBe("гость");
    expect(plural(25, f)).toBe("гостей");
  });
});
