import { minToClock } from "@/lib/dates";
import type { PublicExtraService, PublicHall, PublicTariff } from "@/lib/queries/pricing";
import type { PriceUnit } from "@/lib/schema/enums";

/** Строка прайса: подпись слева (дни или название услуги), время, цена */
export type PriceRow = { days: string; time: string; price: string };

export type PriceGroup = { title: string; rows: PriceRow[] };

/** Сокращения дней: индекс = номер дня (0 = Вс … 6 = Сб) */
const DAY_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] as const;
/** Порядок перечисления дней в подписи: с понедельника */
const DAY_LIST_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
/** Именованные наборы дней старого сайта (ключ — отсортированные номера дней) */
const NAMED_DAY_SETS: Record<string, string> = {
  "0,1,2,3,4,5,6": "Ежедневно",
  "0,1,2,3,4": "Вс-Чт",
  "5,6": "Пт-Сб",
};

const UNIT_SUFFIX: Record<PriceUnit, string> = {
  per_hour: "руб/час",
  fixed: "руб",
  per_session: "руб",
};

/** Набор дней → «Ежедневно» | «Вс-Чт» | «Пт-Сб» | «Пн, Ср» */
export function formatDays(days: readonly number[]): string {
  const unique = [...new Set(days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  const named = NAMED_DAY_SETS[unique.join(",")];
  if (named) return named;
  return DAY_LIST_ORDER.filter((d) => unique.includes(d))
    .map((d) => DAY_SHORT[d])
    .join(", ");
}

/** Интервал в минутах операционных суток → «09:00-16:00» (дефис, как на старом сайте) */
export function formatTimeRange(startMin: number, endMin: number): string {
  return `${minToClock(startMin)}-${minToClock(endMin)}`;
}

/** 3500 + per_hour → «3 500 руб/час» */
export function formatPrice(price: number, unit: PriceUnit): string {
  const amount = Math.round(price).toLocaleString("ru-RU");
  return `${amount} ${UNIT_SUFFIX[unit]}`;
}

/** Тариф действует на операционную дату (YYYY-MM-DD сравниваются как строки) */
export function isTariffActiveOn(
  tariff: Pick<PublicTariff, "validFrom" | "validTo"> & { isActive?: boolean },
  opDate: string
): boolean {
  if (tariff.isActive === false) return false;
  if (tariff.validFrom && tariff.validFrom > opDate) return false;
  if (tariff.validTo && tariff.validTo < opDate) return false;
  return true;
}

/** Строка до схлопывания: подпись дней ещё без имени зала */
type DraftRow = {
  daysLabel: string;
  time: string;
  price: string;
  hallName: string;
  hallOrder: number;
  sortOrder: number;
  startMin: number;
};

/**
 * Схлопывает одинаковые строки разных залов (те же дни, время и цена) в одну.
 * Если у залов для одного слота цены различаются — каждая строка получает имя зала
 * перед днями («VIP 3 · Ежедневно»).
 */
function collapseRows(tariffs: PublicTariff[], hallOrder: Map<string, number>): PriceRow[] {
  const slots = new Map<string, DraftRow[]>();
  for (const t of tariffs) {
    const daysLabel = formatDays(t.daysOfWeek);
    const time = formatTimeRange(t.startMin, t.endMin);
    const key = `${daysLabel}|${time}`;
    const list = slots.get(key) ?? [];
    list.push({
      daysLabel,
      time,
      price: formatPrice(t.price, t.priceUnit),
      hallName: t.hallName,
      hallOrder: hallOrder.get(t.hallId) ?? Number.MAX_SAFE_INTEGER,
      sortOrder: t.sortOrder,
      startMin: t.startMin,
    });
    slots.set(key, list);
  }

  const drafts: (DraftRow & { label: string })[] = [];
  for (const list of slots.values()) {
    const prices = new Set(list.map((r) => r.price));
    if (prices.size === 1) {
      // Слот одинаков у всех залов — одна строка с минимальным sortOrder слота
      const first = list.reduce((a, b) => (b.sortOrder < a.sortOrder ? b : a));
      drafts.push({ ...first, label: first.daysLabel });
      continue;
    }
    for (const row of list) {
      drafts.push({ ...row, label: `${row.hallName} · ${row.daysLabel}` });
    }
  }

  drafts.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.startMin - b.startMin || a.hallOrder - b.hallOrder
  );
  return withRepeatedDaysBlank(
    drafts.map((d) => ({ days: d.label, time: d.time, price: d.price }))
  );
}

/** Подпись дней показывается только у первой из подряд идущих строк с теми же днями */
function withRepeatedDaysBlank(rows: PriceRow[]): PriceRow[] {
  return rows.map((row, i) =>
    i > 0 && rows[i - 1]?.days === row.days ? { ...row, days: "" } : row
  );
}

/**
 * Группы аккордеона «Прайс-лист»: Бильярд, VIP, Пенсионный тариф, Прокат.
 * Пустые группы пропускаются. Фильтрацию тарифов по дате действия делает вызывающая сторона
 * (`isTariffActiveOn`).
 */
export function buildPriceGroups(
  halls: PublicHall[],
  tariffs: PublicTariff[],
  extras: PublicExtraService[]
): PriceGroup[] {
  const hallOrder = new Map(halls.map((h, i) => [h.id, i]));
  // Тарифы залов, которых нет среди активных, не показываем
  const known = tariffs.filter((t) => hallOrder.has(t.hallId));

  const groups: PriceGroup[] = [
    {
      title: "Бильярд",
      rows: collapseRows(
        known.filter((t) => t.hallKind === "common" && t.audience === "all"),
        hallOrder
      ),
    },
    {
      title: "VIP",
      rows: collapseRows(
        known.filter((t) => t.hallKind === "vip" && t.audience === "all"),
        hallOrder
      ),
    },
    {
      title: "Пенсионный тариф",
      rows: collapseRows(
        known.filter((t) => t.audience === "pensioner"),
        hallOrder
      ),
    },
    {
      title: "Прокат",
      rows: extras.map((e) => ({
        days: e.name,
        time: "",
        price: formatPrice(e.price, e.priceUnit),
      })),
    },
  ];
  return groups.filter((g) => g.rows.length > 0);
}
