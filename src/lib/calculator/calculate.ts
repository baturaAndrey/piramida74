import type {
  CalcHall,
  CalcPromotion,
  CalcTariff,
  CalculatorCatalog,
  Quote,
  QuoteInput,
  QuoteLine,
} from "./types";

/**
 * Чистый расчёт стоимости заказа. Работает одинаково в браузере (живой расчёт) и на сервере
 * (пересчёт при отправке заявки), поэтому не импортирует ничего, кроме собственных типов,
 * не читает текущее время, не мутирует вход и не бросает исключений.
 */

export const OP_DAY_START_MIN = 9 * 60; // операционные сутки начинаются в 09:00
const DAY = 1440;
const SLOT_MIN = 30; // шаг начала и длительности брони
const MIN_DURATION_MIN = 30;
const MAX_DURATION_MIN = 720;
const MINUTES_PER_HOUR = 60;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 0 → "09:00", 960 → "01:00", 1020 → "02:00" (по модулю суток) */
export function opMinToClock(min: number): string {
  const total = (((OP_DAY_START_MIN + min) % DAY) + DAY) % DAY;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** "19:00" → 600, "01:00" → 960, "09:00" → 0 */
export function clockToOpMin(hhmm: string): number {
  const [h = "0", m = "0"] = hhmm.split(":");
  const abs = Number(h) * 60 + Number(m);
  return (((abs - OP_DAY_START_MIN) % DAY) + DAY) % DAY;
}

function parseIsoParts(iso: string): [number, number, number] {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return [y, m, d];
}

/** Строгая проверка YYYY-MM-DD (отсекает 2026-02-30 и т. п.) — без неё Date.toISOString() бросил бы RangeError */
export function isValidIsoDate(iso: string): boolean {
  if (!ISO_DATE_RE.test(iso)) return false;
  const [y, m, d] = parseIsoParts(iso);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = parseIsoParts(iso);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function dayOfWeek(iso: string): number {
  const [y, m, d] = parseIsoParts(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = вс
}

function isWithinValidity(dayIso: string, validFrom: string | null, validTo: string | null) {
  return (validFrom == null || validFrom <= dayIso) && (validTo == null || validTo >= dayIso);
}

function formatRange(from: number, to: number): string {
  return `${opMinToClock(from)}–${opMinToClock(to)}`;
}

/** Часть брони, попавшая в операционные сутки k (минуты from/to — относительно 09:00 этих суток) */
interface DayWindow {
  k: number;
  from: number;
  to: number;
  dayIso: string;
  dow: number;
}

/** Разбить интервал брони [S, E) по операционным суткам; хвост за 1440 уходит в сутки D+1 с их днём недели */
function splitByOpDays(opDate: string, start: number, end: number): DayWindow[] {
  const windows: DayWindow[] = [];
  const firstK = Math.floor(start / DAY);
  const lastK = Math.floor((end - 1) / DAY);
  for (let k = firstK; k <= lastK; k++) {
    const dayIso = addDaysIso(opDate, k);
    windows.push({
      k,
      from: Math.max(start, k * DAY) - k * DAY,
      to: Math.min(end, (k + 1) * DAY) - k * DAY,
      dayIso,
      dow: dayOfWeek(dayIso),
    });
  }
  return windows;
}

interface Segment {
  tariff: CalcTariff | null;
  k: number;
  from: number;
  to: number;
}

/** Разбить окно суток на сегменты по границам тарифов зала; соседние сегменты с одним тарифом склеиваются */
function segmentDay(window: DayWindow, hallTariffs: CalcTariff[], pensioner: boolean): Segment[] {
  const { k, from, to, dayIso, dow } = window;
  const cands = hallTariffs.filter(
    (t) => t.daysOfWeek.includes(dow) && isWithinValidity(dayIso, t.validFrom, t.validTo)
  );
  const points = new Set<number>([from, to]);
  for (const t of cands) {
    if (t.startMin > from && t.startMin < to) points.add(t.startMin);
    if (t.endMin > from && t.endMin < to) points.add(t.endMin);
  }
  const sorted = [...points].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    const here = cands.filter((t) => t.startMin <= a && a < t.endMin);
    // Пенсионный тариф применяется только по флагу; при пересечении в одной аудитории — первый по каталогу
    const picked =
      (pensioner ? here.find((t) => t.audience === "pensioner") : undefined) ??
      here.find((t) => t.audience === "all") ??
      null;
    const prev = out[out.length - 1];
    if (prev && prev.to === a && (prev.tariff?.id ?? null) === (picked?.id ?? null)) prev.to = b;
    else out.push({ tariff: picked, k, from: a, to: b });
  }
  return out;
}

function isValidBookingTime(startMin: number, durationMin: number): boolean {
  return (
    Number.isInteger(startMin) &&
    startMin >= 0 &&
    startMin < DAY &&
    startMin % SLOT_MIN === 0 &&
    Number.isInteger(durationMin) &&
    durationMin >= MIN_DURATION_MIN &&
    durationMin <= MAX_DURATION_MIN &&
    durationMin % SLOT_MIN === 0
  );
}

/** Целое ≥ 1; мусор (NaN, Infinity, < 1) → 1 */
function toPositiveInt(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

/** Строки аренды для выбранного зала; дыры в покрытии тарифами → предупреждения */
function buildRentalLines(
  hall: CalcHall,
  tables: number,
  windows: DayWindow[],
  catalog: CalculatorCatalog,
  pensioner: boolean,
  warnings: string[]
): QuoteLine[] {
  const hallTariffs = catalog.tariffs.filter((t) => t.hallId === hall.id);
  const lines: QuoteLine[] = [];
  // fixed — раз за сутки k на стол, per_session — раз за бронь на стол
  const chargedOnce = new Set<string>();
  const tablesSuffix = tables > 1 ? `, столов: ${tables}` : "";

  for (const window of windows) {
    for (const seg of segmentDay(window, hallTariffs, pensioner)) {
      const { tariff } = seg;
      if (!tariff) {
        warnings.push(
          `Время ${formatRange(seg.from, seg.to)} не покрыто тарифами — уточните стоимость у администратора`
        );
        continue;
      }
      const label = `${hall.name}, ${tariff.label} (${formatRange(seg.from, seg.to)}${tablesSuffix})`;

      if (tariff.priceUnit === "per_hour") {
        const qty = (tables * (seg.to - seg.from)) / MINUTES_PER_HOUR;
        lines.push({
          kind: "rental",
          label,
          qty,
          unitPrice: tariff.price,
          total: Math.round(tariff.price * qty),
        });
        continue;
      }

      const dedupKey = tariff.priceUnit === "fixed" ? `${tariff.id}:${seg.k}` : tariff.id;
      if (chargedOnce.has(dedupKey)) continue;
      chargedOnce.add(dedupKey);
      lines.push({
        kind: "rental",
        label,
        qty: tables,
        unitPrice: tariff.price,
        total: tariff.price * tables,
      });
    }
  }
  return lines;
}

function buildExtraLines(
  input: QuoteInput,
  catalog: CalculatorCatalog,
  timeValid: boolean,
  warnings: string[]
): QuoteLine[] {
  const lines: QuoteLine[] = [];
  for (const entry of input.extras) {
    const service = catalog.extraServices.find((s) => s.id === entry.id);
    if (!service) {
      warnings.push(`Доп. услуга «${entry.id}» не найдена и не включена в расчёт`);
      continue;
    }
    if (!(entry.qty >= 1)) continue;
    if (service.priceUnit === "per_hour") {
      // Почасовую услугу без корректной длительности посчитать нельзя
      if (!timeValid) continue;
      const qty = (entry.qty * input.durationMin) / MINUTES_PER_HOUR;
      lines.push({
        kind: "extra",
        label: service.name,
        qty,
        unitPrice: service.price,
        total: Math.round(service.price * qty),
      });
    } else {
      lines.push({
        kind: "extra",
        label: service.name,
        qty: entry.qty,
        unitPrice: service.price,
        total: service.price * entry.qty,
      });
    }
  }
  return lines;
}

function buildSetLines(
  input: QuoteInput,
  catalog: CalculatorCatalog,
  guests: number,
  warnings: string[]
): QuoteLine[] {
  const lines: QuoteLine[] = [];
  for (const entry of input.sets) {
    const set = catalog.sets.find((s) => s.code === entry.code);
    if (!set) {
      warnings.push(`Сет «${entry.code}» не найден и не включён в расчёт`);
      continue;
    }
    if (!(entry.qty >= 1)) continue;
    const min = set.minGuests ?? null;
    const max = set.maxGuests ?? null;
    if ((min != null && guests < min) || (max != null && guests > max)) {
      warnings.push(`Сет «${set.title}» рассчитан на ${min ?? 1}–${max ?? "∞"} гостей`);
    }
    // per_person: qty — число персон; fixed: qty — штуки. Формула одна, различается смысл qty
    lines.push({
      kind: "set",
      label: set.title,
      qty: entry.qty,
      unitPrice: set.price,
      total: set.price * entry.qty,
    });
  }
  return lines;
}

function buildItemLines(
  input: QuoteInput,
  catalog: CalculatorCatalog,
  warnings: string[]
): QuoteLine[] {
  const lines: QuoteLine[] = [];
  for (const entry of input.items) {
    const variant = catalog.menuVariants.find((v) => v.code === entry.code);
    if (!variant) {
      warnings.push(`Позиция меню «${entry.code}» не найдена и не включена в расчёт`);
      continue;
    }
    if (!(entry.qty >= 1)) continue;
    lines.push({
      kind: "item",
      label: variant.itemName + (variant.label ? `, ${variant.label}` : ""),
      qty: entry.qty,
      unitPrice: variant.price,
      total: variant.price * entry.qty,
    });
  }
  return lines;
}

function isPromoActive(promo: CalcPromotion, window: DayWindow): boolean {
  if (!isWithinValidity(window.dayIso, promo.validFrom, promo.validTo)) return false;
  if (promo.daysOfWeek != null && !promo.daysOfWeek.includes(window.dow)) return false;
  const promoStart = promo.startMin ?? 0;
  const promoEnd = promo.endMin ?? DAY;
  return promoStart < window.to && window.from < promoEnd;
}

/** Подсказки по акциям: информативны, в сумму не входят; одна подсказка на акцию */
function buildPromoHints(windows: DayWindow[], catalog: CalculatorCatalog): string[] {
  const hints: string[] = [];
  const seen = new Set<string>();
  for (const window of windows) {
    for (const promo of catalog.promotions) {
      if (seen.has(promo.id) || !isPromoActive(promo, window)) continue;
      seen.add(promo.id);
      const discount = promo.discountPercent ? ` (−${promo.discountPercent}%)` : "";
      hints.push(
        `В это время действует акция «${promo.title}»${discount} — скидка в расчёт не включена, уточните условия у администратора`
      );
    }
  }
  return hints;
}

const sumTotals = (lines: QuoteLine[]) => lines.reduce((s, l) => s + l.total, 0);

export function calculateQuote(input: QuoteInput, catalog: CalculatorCatalog): Quote {
  const lines: QuoteLine[] = [];
  const warnings: string[] = [];

  // 1. Нормализация и валидация
  const hall = catalog.halls.find((h) => h.id === input.hallId);
  if (!hall) warnings.push("Зал не найден — аренда не рассчитана");

  const dateValid = typeof input.opDate === "string" && isValidIsoDate(input.opDate);
  if (!dateValid) warnings.push("Некорректная дата визита — аренда не рассчитана");

  const timeValid = isValidBookingTime(input.startMin, input.durationMin);
  if (!timeValid) {
    warnings.push(
      "Некорректное время брони: начало и длительность должны быть кратны 30 минутам, длительность — от 30 минут до 12 часов"
    );
  }

  const guestsRaw = Number.isFinite(input.guests) ? Math.floor(input.guests) : 0;
  const guests = Math.max(1, guestsRaw);
  let tables = toPositiveInt(input.tables);
  if (hall && tables > hall.tablesCount) {
    tables = Math.max(1, hall.tablesCount);
    warnings.push(`В зале «${hall.name}» доступно столов: ${hall.tablesCount}`);
  }

  // 2–7. Аренда и подсказки по акциям — только при корректных дате и времени
  const windows =
    dateValid && timeValid
      ? splitByOpDays(input.opDate, input.startMin, input.startMin + input.durationMin)
      : [];
  if (hall)
    lines.push(...buildRentalLines(hall, tables, windows, catalog, input.pensioner, warnings));

  // 8–10. Доп. услуги, сеты, позиции меню
  lines.push(...buildExtraLines(input, catalog, timeValid, warnings));
  lines.push(...buildSetLines(input, catalog, guests, warnings));
  lines.push(...buildItemLines(input, catalog, warnings));

  // 12. Вместимость
  if (hall && hall.seatsPerTable > 0 && guests > tables * hall.seatsPerTable) {
    const recommended = Math.ceil(guests / hall.seatsPerTable);
    warnings.push(
      `На ${guests} гостей за выбранными столами (${tables}) не хватит мест — рекомендуем столов: ${recommended}`
    );
  }

  // 13. Акции
  const promoHints = buildPromoHints(windows, catalog);

  // 11. Итоги
  const rentalTotal = sumTotals(lines.filter((l) => l.kind === "rental" || l.kind === "extra"));
  const foodTotal = sumTotals(lines.filter((l) => l.kind === "set" || l.kind === "item"));
  const total = rentalTotal + foodTotal;
  const perGuest = guestsRaw >= 1 ? Math.round(total / guestsRaw) : 0;
  return { lines, rentalTotal, foodTotal, total, perGuest, warnings, promoHints };
}
