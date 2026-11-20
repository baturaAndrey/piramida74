import { describe, expect, it } from "vitest";
import { calculateQuote, clockToOpMin, opMinToClock } from "./calculate";
import type { CalcHall, CalcPromotion, CalcTariff, CalculatorCatalog, QuoteInput } from "./types";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const SUN_THU = [0, 1, 2, 3, 4];
const FRI_SAT = [5, 6];

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

function tariff(
  id: string,
  hallId: string,
  daysOfWeek: number[],
  startMin: number,
  endMin: number,
  price: number,
  overrides: Partial<CalcTariff> = {}
): CalcTariff {
  return {
    id,
    hallId,
    daysOfWeek,
    startMin,
    endMin,
    price,
    priceUnit: "per_hour",
    audience: "all",
    label: id,
    validFrom: null,
    validTo: null,
    ...overrides,
  };
}

const T1 = tariff("T1", COMMON.id, SUN_THU, 0, 420, 580);
const T2 = tariff("T2", COMMON.id, SUN_THU, 420, 1020, 640);
const T3 = tariff("T3", COMMON.id, FRI_SAT, 0, 420, 680);
const T4 = tariff("T4", COMMON.id, FRI_SAT, 420, 1020, 760);
const T5 = tariff("T5", COMMON.id, ALL_DAYS, 1020, 1440, 3500);
const TP = tariff("TP", COMMON.id, ALL_DAYS, 0, 180, 200, { audience: "pensioner" });
const V1 = tariff("V1", VIP1.id, ALL_DAYS, 0, 1020, 1400);
const V2 = tariff("V2", VIP1.id, ALL_DAYS, 1020, 1440, 4800);

function makeCatalog(overrides: Partial<CalculatorCatalog> = {}): CalculatorCatalog {
  return {
    halls: [COMMON, VIP1],
    tariffs: [T1, T2, T3, T4, T5, TP, V1, V2],
    extraServices: [
      { id: "cue", name: "Прокат кия", price: 250, priceUnit: "per_hour" },
      { id: "chalk", name: "Мелок", price: 250, priceUnit: "per_session" },
    ],
    menuVariants: [
      {
        code: "a1b2c3",
        itemName: "Бургер",
        label: "",
        price: 450,
        categorySlug: "kuhnya",
        categoryName: "Кухня",
      },
    ],
    sets: [
      {
        code: "set-party",
        title: "Банкетный",
        pricingMode: "per_person",
        price: 1500,
        minGuests: 6,
        maxGuests: 20,
      },
      {
        code: "set-fixed",
        title: "Компания",
        pricingMode: "fixed",
        price: 9000,
        minGuests: null,
        maxGuests: 6,
      },
    ],
    promotions: [],
    ...overrides,
  };
}

const MON = "2026-11-23";
const TUE = "2026-11-24";
const THU = "2026-11-26";
const SAT = "2026-11-21";
const SUN = "2026-11-22";

function makeInput(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    opDate: MON,
    startMin: 600,
    durationMin: 180,
    guests: 4,
    hallId: COMMON.id,
    tables: 1,
    pensioner: false,
    extras: [],
    sets: [],
    items: [],
    ...overrides,
  };
}

const rentalLines = (q: ReturnType<typeof calculateQuote>) =>
  q.lines.filter((l) => l.kind === "rental");

describe("calculateQuote — аренда", () => {
  it("1. будний вечер", () => {
    const q = calculateQuote(makeInput(), makeCatalog());
    const lines = rentalLines(q);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.label).toContain("T2");
    expect(lines[0]!.qty).toBe(3);
    expect(q.total).toBe(1920);
    expect(q.warnings).toEqual([]);
  });

  it("2. смена тарифа посреди брони", () => {
    const q = calculateQuote(makeInput({ startMin: 300, durationMin: 240 }), makeCatalog());
    const lines = rentalLines(q);
    expect(lines).toHaveLength(2);
    expect(lines[0]!).toMatchObject({ qty: 2, total: 1160 });
    expect(lines[0]!.label).toContain("T1");
    expect(lines[1]!).toMatchObject({ qty: 2, total: 1280 });
    expect(lines[1]!.label).toContain("T2");
    expect(q.total).toBe(2440);
  });

  it("3. выходной вечер", () => {
    const q = calculateQuote(
      makeInput({ opDate: SAT, startMin: 660, durationMin: 240 }),
      makeCatalog()
    );
    expect(rentalLines(q)[0]!.label).toContain("T4");
    expect(q.total).toBe(3040);
  });

  it("4. ночь сб→вс по тарифу субботы", () => {
    const q = calculateQuote(
      makeInput({ opDate: SAT, startMin: 900, durationMin: 120 }),
      makeCatalog()
    );
    expect(rentalLines(q)).toHaveLength(1);
    expect(rentalLines(q)[0]!.label).toContain("T4");
    expect(q.total).toBe(1520);
  });

  it("5. ночь чт→пт по тарифу четверга", () => {
    const q = calculateQuote(
      makeInput({ opDate: THU, startMin: 900, durationMin: 120 }),
      makeCatalog()
    );
    expect(rentalLines(q)[0]!.label).toContain("T2");
    expect(q.total).toBe(1280);
  });

  it("6. воскресенье→понедельник", () => {
    const q = calculateQuote(
      makeInput({ opDate: SUN, startMin: 960, durationMin: 60 }),
      makeCatalog()
    );
    expect(rentalLines(q)[0]!.label).toContain("T2");
    expect(q.total).toBe(640);
  });

  it("7. переход вечер → ночной тариф", () => {
    const q = calculateQuote(makeInput({ startMin: 930, durationMin: 180 }), makeCatalog());
    const lines = rentalLines(q);
    expect(lines).toHaveLength(2);
    expect(lines[0]!).toMatchObject({ qty: 1.5, total: 960 });
    expect(lines[1]!).toMatchObject({ qty: 1.5, total: 5250 });
    expect(q.total).toBe(6210);
  });

  it("8. переход через границу суток 09:00 — хвост по тарифу пятницы", () => {
    const q = calculateQuote(
      makeInput({ opDate: THU, startMin: 1320, durationMin: 240 }),
      makeCatalog()
    );
    const lines = rentalLines(q);
    expect(lines).toHaveLength(2);
    expect(lines[0]!.label).toContain("T5");
    expect(lines[0]!.total).toBe(7000);
    expect(lines[1]!.label).toContain("T3");
    expect(lines[1]!.total).toBe(1360);
    expect(q.total).toBe(8360);
  });

  it("9. полчаса", () => {
    const q = calculateQuote(
      makeInput({ opDate: SUN, startMin: 180, durationMin: 90 }),
      makeCatalog()
    );
    const lines = rentalLines(q);
    expect(lines[0]!.label).toContain("T1");
    expect(lines[0]!.qty).toBe(1.5);
    expect(q.total).toBe(870);
  });

  it("10. два стола", () => {
    const q = calculateQuote(makeInput({ tables: 2 }), makeCatalog());
    const line = rentalLines(q)[0]!;
    expect(line.qty).toBe(6);
    expect(line.label).toContain("столов: 2");
    expect(q.total).toBe(3840);
  });

  it("11. «дыра» в покрытии тарифами", () => {
    const catalog = makeCatalog({ tariffs: [T1, T2, T3, T4, TP, V1, V2] });
    const q = calculateQuote(makeInput({ startMin: 900, durationMin: 180 }), catalog);
    expect(q.total).toBe(1280);
    expect(
      q.warnings.some((w) => w.includes("02:00–03:00") && w.includes("не покрыто тарифами"))
    ).toBe(true);
  });

  it("12. истёкший тариф не применяется", () => {
    const expired = { ...T2, validTo: "2026-11-01" };
    const catalog = makeCatalog({ tariffs: [T1, expired, T3, T4, T5, TP, V1, V2] });
    const q = calculateQuote(makeInput(), catalog);
    expect(q.total).toBe(0);
    expect(q.warnings.some((w) => w.includes("не покрыто тарифами"))).toBe(true);
  });

  it("13. пенсионер, флаг включён", () => {
    const q = calculateQuote(
      makeInput({ startMin: 60, durationMin: 120, pensioner: true }),
      makeCatalog()
    );
    expect(rentalLines(q)[0]!.label).toContain("TP");
    expect(q.total).toBe(400);
  });

  it("14. пенсионер, флаг выключен", () => {
    const q = calculateQuote(makeInput({ startMin: 60, durationMin: 120 }), makeCatalog());
    expect(rentalLines(q)[0]!.label).toContain("T1");
    expect(q.total).toBe(1160);
  });

  it("15. пенсионер, смена тарифа", () => {
    const q = calculateQuote(
      makeInput({ startMin: 60, durationMin: 180, pensioner: true }),
      makeCatalog()
    );
    const lines = rentalLines(q);
    expect(lines).toHaveLength(2);
    expect(lines[0]!.total).toBe(400);
    expect(lines[1]!.total).toBe(580);
    expect(q.total).toBe(980);
  });

  it("16. fixed-ночь — одна строка на тариф и сутки", () => {
    const fixedNight = { ...T5, priceUnit: "fixed" as const, price: 5000 };
    const catalog = makeCatalog({ tariffs: [T1, T2, T3, T4, fixedNight, TP, V1, V2] });
    const q = calculateQuote(makeInput({ startMin: 960, durationMin: 180, tables: 2 }), catalog);
    const lines = rentalLines(q);
    expect(lines).toHaveLength(2);
    expect(lines[0]!).toMatchObject({ qty: 2, total: 1280 });
    expect(lines.filter((l) => l.label.includes("T5"))).toHaveLength(1);
    expect(lines[1]!).toMatchObject({ qty: 2, unitPrice: 5000, total: 10000 });
    expect(q.total).toBe(11280);
  });

  it("17. VIP днём, лишние столы урезаются", () => {
    const q = calculateQuote(makeInput({ hallId: VIP1.id, tables: 3 }), makeCatalog());
    expect(rentalLines(q)[0]!.qty).toBe(3);
    expect(q.warnings.some((w) => w.includes("доступно столов: 1"))).toBe(true);
    expect(q.total).toBe(4200);
  });

  it("18. VIP ночью", () => {
    const q = calculateQuote(
      makeInput({ hallId: VIP1.id, startMin: 1020, durationMin: 120 }),
      makeCatalog()
    );
    expect(rentalLines(q)[0]!.label).toContain("V2");
    expect(q.total).toBe(9600);
  });

  it("19. VIP: смена дневного на ночной", () => {
    const q = calculateQuote(
      makeInput({ hallId: VIP1.id, startMin: 960, durationMin: 120 }),
      makeCatalog()
    );
    const lines = rentalLines(q);
    expect(lines.map((l) => l.total)).toEqual([1400, 4800]);
    expect(q.total).toBe(6200);
  });

  it("20. столов больше, чем в зале", () => {
    const q = calculateQuote(makeInput({ tables: 15 }), makeCatalog());
    expect(rentalLines(q)[0]!.qty).toBe(36); // 12 столов × 3 ч
    expect(q.warnings.some((w) => w.includes("доступно столов: 12"))).toBe(true);
  });

  it("21. вместимость", () => {
    const q = calculateQuote(makeInput({ guests: 10, tables: 2 }), makeCatalog());
    const warning = q.warnings.find((w) => w.includes("мест"));
    expect(warning).toBeDefined();
    expect(warning).toContain("рекомендуем столов: 3");
  });
});

describe("calculateQuote — заказ", () => {
  it("22. полный заказ", () => {
    const q = calculateQuote(
      makeInput({
        guests: 8,
        tables: 2,
        extras: [{ id: "cue", qty: 2 }],
        sets: [{ code: "set-party", qty: 8 }],
        items: [{ code: "a1b2c3", qty: 4 }],
      }),
      makeCatalog()
    );
    expect(q.rentalTotal).toBe(5340);
    expect(q.foodTotal).toBe(13800);
    expect(q.total).toBe(19140);
    expect(q.perGuest).toBe(2393);
    expect(q.warnings).toEqual([]);
    const extra = q.lines.find((l) => l.kind === "extra")!;
    expect(extra).toMatchObject({ qty: 6, total: 1500 });
    expect(q.lines.find((l) => l.kind === "item")!.label).toBe("Бургер");
  });

  it("23. доп. услуга per_session", () => {
    const q = calculateQuote(makeInput({ extras: [{ id: "chalk", qty: 1 }] }), makeCatalog());
    const extra = q.lines.find((l) => l.kind === "extra")!;
    expect(extra).toMatchObject({ qty: 1, total: 250 });
    expect(q.rentalTotal).toBe(1920 + 250);
  });

  it("24. fixed-сет", () => {
    const ok = calculateQuote(makeInput({ sets: [{ code: "set-fixed", qty: 1 }] }), makeCatalog());
    expect(ok.lines.find((l) => l.kind === "set")!.total).toBe(9000);
    expect(ok.foodTotal).toBe(9000);
    expect(ok.warnings).toEqual([]);

    const many = calculateQuote(
      makeInput({ guests: 8, tables: 2, sets: [{ code: "set-fixed", qty: 1 }] }),
      makeCatalog()
    );
    expect(many.warnings.some((w) => w.includes("Компания") && w.includes("гостей"))).toBe(true);
  });

  it("25. неизвестные коды пропускаются с предупреждениями", () => {
    const q = calculateQuote(
      makeInput({
        extras: [{ id: "nope", qty: 1 }],
        sets: [{ code: "nope", qty: 1 }],
        items: [
          { code: "nope", qty: 1 },
          { code: "a1b2c3", qty: 1 },
        ],
      }),
      makeCatalog()
    );
    expect(q.lines.filter((l) => l.kind !== "rental")).toHaveLength(1);
    expect(q.warnings).toHaveLength(3);
    expect(q.total).toBe(1920 + 450);
  });

  it.each([{ startMin: 15 }, { durationMin: 20 }, { durationMin: 750 }, { startMin: 1440 }])(
    "26. некорректное время %o",
    (override) => {
      const q = calculateQuote(makeInput(override), makeCatalog());
      expect(q.rentalTotal).toBe(0);
      expect(q.warnings.some((w) => w.includes("Некорректное время брони"))).toBe(true);
    }
  );

  it("27. пустой каталог", () => {
    const empty: CalculatorCatalog = {
      halls: [],
      tariffs: [],
      extraServices: [],
      menuVariants: [],
      sets: [],
      promotions: [],
    };
    const q = calculateQuote(makeInput(), empty);
    expect(q.total).toBe(0);
    expect(q.warnings.some((w) => w.includes("Зал не найден"))).toBe(true);
  });

  it("27a. некорректная дата не приводит к исключению", () => {
    const q = calculateQuote(makeInput({ opDate: "2026-02-30" }), makeCatalog());
    expect(q.rentalTotal).toBe(0);
    expect(q.warnings.length).toBeGreaterThan(0);
  });
});

describe("calculateQuote — акции", () => {
  const P1: CalcPromotion = {
    id: "P1",
    title: "Девичник",
    discountPercent: 50,
    daysOfWeek: [1],
    startMin: null,
    endMin: null,
    validFrom: null,
    validTo: null,
  };
  const P2: CalcPromotion = {
    id: "P2",
    title: "Утро в движении",
    discountPercent: null,
    daysOfWeek: SUN_THU,
    startMin: 0,
    endMin: 180,
    validFrom: null,
    validTo: null,
  };
  const P3: CalcPromotion = {
    id: "P3",
    title: "Прошлогодняя",
    discountPercent: 10,
    daysOfWeek: null,
    startMin: null,
    endMin: null,
    validFrom: null,
    validTo: "2025-12-31",
  };
  const catalog = makeCatalog({ promotions: [P1, P2, P3] });

  it("28. подсказки по акциям не влияют на сумму", () => {
    const evening = calculateQuote(makeInput(), catalog);
    expect(evening.promoHints).toHaveLength(1);
    expect(evening.promoHints[0]).toContain("«Девичник» (−50%)");
    expect(evening.promoHints[0]).toContain("скидка в расчёт не включена");
    expect(evening.total).toBe(1920);

    const morning = calculateQuote(makeInput({ startMin: 60, durationMin: 120 }), catalog);
    expect(morning.promoHints).toHaveLength(2);
    expect(morning.promoHints[1]).toContain("«Утро в движении» —");
    expect(morning.total).toBe(1160);

    const tuesday = calculateQuote(makeInput({ opDate: TUE }), catalog);
    expect(tuesday.promoHints).toEqual([]);

    for (const q of [evening, morning, tuesday]) {
      expect(q.promoHints.some((h) => h.includes("Прошлогодняя"))).toBe(false);
    }
  });
});

describe("calculateQuote — чистота", () => {
  it("29. повторный вызов даёт равный результат, вход не мутирован", () => {
    const input = makeInput({
      guests: 8,
      tables: 15,
      extras: [{ id: "cue", qty: 2 }],
      sets: [{ code: "set-party", qty: 8 }],
      items: [{ code: "a1b2c3", qty: 4 }],
    });
    const catalog = makeCatalog();
    const inputBefore = structuredClone(input);
    const catalogBefore = structuredClone(catalog);
    const first = calculateQuote(input, catalog);
    const second = calculateQuote(input, catalog);
    expect(second).toEqual(first);
    expect(input).toEqual(inputBefore);
    expect(catalog).toEqual(catalogBefore);
  });
});

describe("помощники времени", () => {
  it("30. clockToOpMin / opMinToClock", () => {
    expect(clockToOpMin("09:00")).toBe(0);
    expect(clockToOpMin("19:00")).toBe(600);
    expect(clockToOpMin("00:00")).toBe(900);
    expect(clockToOpMin("01:00")).toBe(960);
    expect(clockToOpMin("08:30")).toBe(1410);
    expect(opMinToClock(0)).toBe("09:00");
    expect(opMinToClock(960)).toBe("01:00");
    expect(opMinToClock(1020)).toBe("02:00");
    expect(opMinToClock(1440)).toBe("09:00");
  });
});
