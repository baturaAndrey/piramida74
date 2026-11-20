import { describe, expect, it } from "vitest";
import type { PublicExtraService, PublicHall, PublicTariff } from "@/lib/queries/pricing";
import { buildPriceGroups, formatDays, formatPrice, isTariffActiveOn } from "./price-groups";

const ALL = [0, 1, 2, 3, 4, 5, 6];
const SUN_THU = [0, 1, 2, 3, 4];
const FRI_SAT = [5, 6];

function hall(id: string, name: string, kind: PublicHall["kind"]): PublicHall {
  return { id, name, slug: id, kind, tablesCount: 1, seatsPerTable: 4, description: null };
}

let order = 0;
function tariff(
  h: PublicHall,
  daysOfWeek: number[],
  startMin: number,
  endMin: number,
  price: number,
  audience: PublicTariff["audience"] = "all"
): PublicTariff {
  return {
    id: `t${order}`,
    hallId: h.id,
    hallName: h.name,
    hallKind: h.kind,
    daysOfWeek,
    startMin,
    endMin,
    price,
    priceUnit: "per_hour",
    audience,
    label: "",
    validFrom: null,
    validTo: null,
    sortOrder: order++,
  };
}

const common = hall("common", "Общий зал", "common");
const vips = [hall("v1", "VIP 1", "vip"), hall("v2", "VIP 2", "vip"), hall("v3", "VIP 3", "vip")];
const halls = [common, ...vips];

/** Тарифы как в seed (scripts/seed-data/halls-pricing.ts) */
function seedTariffs(): PublicTariff[] {
  order = 0;
  return [
    tariff(common, SUN_THU, 0, 420, 580),
    tariff(common, SUN_THU, 420, 1020, 640),
    tariff(common, FRI_SAT, 0, 420, 680),
    tariff(common, FRI_SAT, 420, 1020, 760),
    tariff(common, ALL, 1020, 1440, 3500),
    tariff(common, ALL, 0, 180, 200, "pensioner"),
    ...vips.flatMap((v) => [tariff(v, ALL, 0, 1020, 1400), tariff(v, ALL, 1020, 1440, 4800)]),
  ];
}

const extras: PublicExtraService[] = [
  { id: "e1", name: "Нарды / шахматы", description: null, price: 250, priceUnit: "per_session" },
  {
    id: "e2",
    name: "Прокат кия ручной работы",
    description: null,
    price: 250,
    priceUnit: "per_hour",
  },
];

const nbsp = (s: string) => s.replace(/\s/g, " ");

describe("formatDays", () => {
  it("names known sets and lists others from Monday", () => {
    expect(formatDays(ALL)).toBe("Ежедневно");
    expect(formatDays([4, 3, 2, 1, 0])).toBe("Вс-Чт");
    expect(formatDays(FRI_SAT)).toBe("Пт-Сб");
    expect(formatDays([0, 1, 3])).toBe("Пн, Ср, Вс");
  });
});

describe("formatPrice", () => {
  it("uses unit suffixes", () => {
    expect(formatPrice(580, "per_hour")).toBe("580 руб/час");
    expect(formatPrice(250, "per_session")).toBe("250 руб");
    expect(formatPrice(900, "fixed")).toBe("900 руб");
  });
});

describe("isTariffActiveOn", () => {
  it("respects validity bounds", () => {
    expect(isTariffActiveOn({ validFrom: null, validTo: null }, "2026-05-01")).toBe(true);
    expect(isTariffActiveOn({ validFrom: "2026-06-01", validTo: null }, "2026-05-01")).toBe(false);
    expect(isTariffActiveOn({ validFrom: null, validTo: "2026-04-30" }, "2026-05-01")).toBe(false);
    expect(isTariffActiveOn({ validFrom: "2026-05-01", validTo: "2026-05-01" }, "2026-05-01")).toBe(
      true
    );
  });
});

describe("buildPriceGroups", () => {
  it("matches the legacy price list on seed data", () => {
    const groups = buildPriceGroups(halls, seedTariffs(), extras).map((g) => ({
      title: g.title,
      rows: g.rows.map((r) => `${r.days}|${r.time}|${nbsp(r.price)}`),
    }));
    expect(groups).toEqual([
      {
        title: "Бильярд",
        rows: [
          "Вс-Чт|09:00-16:00|580 руб/час",
          "|16:00-02:00|640 руб/час",
          "Пт-Сб|09:00-16:00|680 руб/час",
          "|16:00-02:00|760 руб/час",
          "Ежедневно|02:00-09:00|3 500 руб/час",
        ],
      },
      { title: "VIP", rows: ["Ежедневно|09:00-02:00|1 400 руб/час", "|02:00-09:00|4 800 руб/час"] },
      { title: "Пенсионный тариф", rows: ["Ежедневно|09:00-12:00|200 руб/час"] },
      {
        title: "Прокат",
        rows: ["Нарды / шахматы||250 руб", "Прокат кия ручной работы||250 руб/час"],
      },
    ]);
  });

  it("prefixes hall names when VIP prices differ", () => {
    order = 0;
    const tariffs = [tariff(vips[0]!, ALL, 0, 1020, 1400), tariff(vips[1]!, ALL, 0, 1020, 1600)];
    const [vip] = buildPriceGroups(halls, tariffs, []);
    expect(vip?.rows.map((r) => `${r.days}|${nbsp(r.price)}`)).toEqual([
      "VIP 1 · Ежедневно|1 400 руб/час",
      "VIP 2 · Ежедневно|1 600 руб/час",
    ]);
  });

  it("skips empty groups and tariffs of unknown halls", () => {
    order = 0;
    const ghost = hall("ghost", "Старый зал", "common");
    expect(buildPriceGroups(halls, [tariff(ghost, ALL, 0, 60, 100)], [])).toEqual([]);
  });
});
