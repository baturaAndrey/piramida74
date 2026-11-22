import { describe, expect, it } from "vitest";
import {
  type CalculatorUrlState,
  calculatorParsers,
  parseCalculatorSearchParams,
  parseKeyQtyList,
  serializeCalculator,
  serializeKeyQtyList,
  toQuoteInput,
} from "./url-state";
import type { CalcHall, CalculatorCatalog, QuoteInput } from "./types";

const COMMON: CalcHall = {
  id: "h-common",
  slug: "obshchiy-zal",
  name: "Общий зал",
  kind: "common",
  tablesCount: 12,
  seatsPerTable: 4,
};
const VIP1: CalcHall = {
  id: "h-vip1",
  slug: "vip-1",
  name: "VIP-1",
  kind: "vip",
  tablesCount: 1,
  seatsPerTable: 8,
};

const catalog: CalculatorCatalog = {
  halls: [COMMON, VIP1],
  tariffs: [],
  extraServices: [],
  menuVariants: [],
  sets: [],
  promotions: [],
};

const baseState: CalculatorUrlState = {
  d: "2026-11-23",
  t: "19:00",
  h: 3,
  g: 4,
  hall: null,
  tables: null,
  p: false,
  x: [],
  s: [],
  i: [],
};

const query = (serialized: string) => new URLSearchParams(serialized.slice(1));

describe("parseKeyQtyList / serializeKeyQtyList", () => {
  it("разбирает корректный список", () => {
    expect(parseKeyQtyList("abc123:2,def456:1")).toEqual([
      { key: "abc123", qty: 2 },
      { key: "def456", qty: 1 },
    ]);
  });

  it("пропускает мусор", () => {
    expect(parseKeyQtyList("x:0,y:abc,:3,z:100,ok:5")).toEqual([{ key: "ok", qty: 5 }]);
    expect(parseKeyQtyList("x:0")).toEqual([]);
    expect(parseKeyQtyList("y:abc")).toEqual([]);
    expect(parseKeyQtyList(":3")).toEqual([]);
    expect(parseKeyQtyList("z:100")).toEqual([]);
  });

  it("пропускает составные коды уровней сетки", () => {
    expect(parseKeyQtyList("abc123-x9y8z7:2")).toEqual([{ key: "abc123-x9y8z7", qty: 2 }]);
  });

  it("round-trip", () => {
    const list = [
      { key: "abc123", qty: 2 },
      { key: "abc123-x9y8z7", qty: 99 },
    ];
    expect(parseKeyQtyList(serializeKeyQtyList(list))).toEqual(list);
  });
});

describe("calculatorParsers", () => {
  it("t — только :00 и :30", () => {
    expect(calculatorParsers.t.parse("19:15")).toBeNull();
    expect(calculatorParsers.t.parse("19:30")).toBe("19:30");
  });

  it("h — шаг 0.5 в пределах 0.5..12", () => {
    expect(calculatorParsers.h.parse("0.3")).toBeNull();
    expect(calculatorParsers.h.parse("2.5")).toBe(2.5);
    expect(calculatorParsers.h.parse("13")).toBeNull();
  });

  it("d — строгая дата", () => {
    expect(calculatorParsers.d.parse("2026-13-45")).toBeNull();
    expect(calculatorParsers.d.parse("2026-02-30")).toBeNull();
    expect(calculatorParsers.d.parse("2026-11-23")).toBe("2026-11-23");
  });
});

describe("toQuoteInput", () => {
  it("переводит часы в минуты суток и находит зал по slug", () => {
    const input = toQuoteInput(
      { ...baseState, h: 2.5, hall: "obshchiy-zal" },
      catalog,
      "2026-01-01"
    );
    expect(input.startMin).toBe(600);
    expect(input.durationMin).toBe(150);
    expect(input.hallId).toBe("h-common");
    expect(input.opDate).toBe("2026-11-23");
  });

  it("tables по умолчанию = ceil(g / seatsPerTable)", () => {
    expect(toQuoteInput({ ...baseState, g: 9 }, catalog, "2026-01-01").tables).toBe(3);
  });

  it("tables по умолчанию не превышает tablesCount зала", () => {
    // 60 гостей / 4 места = 15 столов, но в общем зале всего 12
    expect(toQuoteInput({ ...baseState, g: 60 }, catalog, "2026-01-01").tables).toBe(12);
    expect(toQuoteInput({ ...baseState, g: 48 }, catalog, "2026-01-01").tables).toBe(12);
  });

  it("явный tables из URL не трогается", () => {
    expect(toQuoteInput({ ...baseState, g: 60, tables: 3 }, catalog, "2026-01-01").tables).toBe(3);
  });

  it("tables по умолчанию не меньше 1, даже если tablesCount = 0", () => {
    const emptyHall: CalcHall = { ...COMMON, id: "h-empty", slug: "empty", tablesCount: 0 };
    const input = toQuoteInput(
      { ...baseState, g: 9, hall: "empty" },
      { ...catalog, halls: [emptyHall] },
      "2026-01-01"
    );
    expect(input.tables).toBe(1);
  });

  it("VIP-зал → 1 стол", () => {
    expect(toQuoteInput({ ...baseState, g: 9, hall: "vip-1" }, catalog, "2026-01-01").tables).toBe(
      1
    );
  });

  it("без даты подставляется todayOpDate", () => {
    expect(toQuoteInput({ ...baseState, d: null }, catalog, "2026-01-01").opDate).toBe(
      "2026-01-01"
    );
  });

  it("переносит списки", () => {
    const input = toQuoteInput(
      {
        ...baseState,
        x: [{ key: "cue", qty: 1 }],
        s: [{ key: "set", qty: 8 }],
        i: [{ key: "a1", qty: 2 }],
      },
      catalog,
      "2026-01-01"
    );
    expect(input.extras).toEqual([{ id: "cue", qty: 1 }]);
    expect(input.sets).toEqual([{ code: "set", qty: 8 }]);
    expect(input.items).toEqual([{ code: "a1", qty: 2 }]);
  });
});

describe("serializeCalculator", () => {
  const input: Partial<QuoteInput> = {
    opDate: "2026-11-23",
    startMin: 630,
    durationMin: 150,
    guests: 8,
    hallId: "h-common",
    tables: 2,
    pensioner: true,
    items: [{ code: "abc123-x9y8z7", qty: 2 }],
  };

  it("пишет все заданные параметры", () => {
    const result = serializeCalculator(input, catalog);
    expect(result.startsWith("?")).toBe(true);
    const q = query(result);
    expect(q.get("d")).toBe("2026-11-23");
    expect(q.get("t")).toBe("19:30");
    expect(q.get("h")).toBe("2.5");
    expect(q.get("g")).toBe("8");
    expect(q.get("hall")).toBe("obshchiy-zal");
    expect(q.get("tables")).toBe("2");
    expect(q.get("p")).toBe("true");
    expect(q.get("i")).toBe("abc123-x9y8z7:2");
    expect(q.has("x")).toBe(false);
    expect(q.has("s")).toBe(false);
  });

  it("округляет durationMin до ближайших 30 мин и зажимает в 0.5..12 ч", () => {
    const h = (durationMin: number) => query(serializeCalculator({ durationMin })).get("h");
    expect(h(100)).toBe("1.5"); // 1.666… ч → 1.5
    expect(h(140)).toBe("2.5"); // 2.333… ч → 2.5
    expect(h(195)).toBe("3.5"); // ровно между 3 и 3.5 → вверх
    expect(h(10)).toBe("0.5");
    expect(h(1000)).toBe("12");
    // Каждое значение h проходит обратно через hoursParser
    for (const min of [100, 140, 195, 10, 1000]) {
      expect(parseCalculatorSearchParams(query(serializeCalculator({ durationMin: min })))).toEqual(
        expect.objectContaining({ durationMin: expect.any(Number) })
      );
    }
  });

  it("не пишет hall без каталога или для неизвестного зала", () => {
    expect(query(serializeCalculator(input)).has("hall")).toBe(false);
    expect(query(serializeCalculator({ ...input, hallId: "nope" }, catalog)).has("hall")).toBe(
      false
    );
  });

  it("пустой вход и default-значения не пишутся", () => {
    expect(serializeCalculator({})).toBe("");
    expect(
      serializeCalculator({
        startMin: 600,
        durationMin: 180,
        guests: 4,
        pensioner: false,
        extras: [],
        sets: [],
        items: [],
      })
    ).toBe("");
  });

  it("round-trip через parseCalculatorSearchParams", () => {
    const parsed = parseCalculatorSearchParams(query(serializeCalculator(input, catalog)), catalog);
    expect(parsed).toEqual(input);
  });
});

describe("parseCalculatorSearchParams", () => {
  it("отбрасывает невалидные значения, берёт первое из массива", () => {
    expect(
      parseCalculatorSearchParams({
        t: "19:15",
        h: "13",
        g: "abc",
        d: "2026-13-45",
        hall: "vip-1",
        i: ["a1b2c3:2", "zzz:1"],
      })
    ).toEqual({ items: [{ code: "a1b2c3", qty: 2 }] });
  });

  it("заполняет hallId только при найденном slug", () => {
    expect(parseCalculatorSearchParams({ hall: "vip-1" }, catalog)).toEqual({ hallId: "h-vip1" });
    expect(parseCalculatorSearchParams({ hall: "net-takogo" }, catalog)).toEqual({});
  });

  it("пустой вход → {}", () => {
    expect(parseCalculatorSearchParams({})).toEqual({});
    expect(parseCalculatorSearchParams(new URLSearchParams())).toEqual({});
  });
});
