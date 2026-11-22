// Только nuqs/server: модуль используется и в серверных страницах, и в клиентском компоненте
import { createParser, createSerializer, parseAsBoolean } from "nuqs/server";
import { clockToOpMin, isValidIsoDate, opMinToClock } from "./calculate";
import type { CalcHall, CalculatorCatalog, QuoteInput } from "./types";

export type KeyQty = { key: string; qty: number };

const KEY_RE = /^[A-Za-z0-9-]+$/; // пропускает составные коды уровней сетки: abc123-x9y8z7
const MAX_LIST_QTY = 99;

/** "abc123:2,def456:1" → [{key:"abc123",qty:2},…]; мусорные элементы пропускаются, qty 1..99 */
export function parseKeyQtyList(value: string): KeyQty[] {
  const out: KeyQty[] = [];
  for (const part of value.split(",")) {
    const [key, qtyRaw] = part.split(":");
    const qty = Number(qtyRaw);
    if (key && KEY_RE.test(key) && Number.isInteger(qty) && qty >= 1 && qty <= MAX_LIST_QTY) {
      out.push({ key, qty });
    }
  }
  return out;
}

export function serializeKeyQtyList(list: KeyQty[]): string {
  return list.map((e) => `${e.key}:${e.qty}`).join(",");
}

const keyQtyParser = createParser<KeyQty[]>({
  parse: (v) => {
    const list = parseKeyQtyList(v);
    return list.length ? list : null;
  },
  serialize: serializeKeyQtyList,
  eq: (a, b) => serializeKeyQtyList(a) === serializeKeyQtyList(b),
});

const isoDateParser = createParser<string>({
  parse: (v) => (isValidIsoDate(v) ? v : null),
  serialize: (v) => v,
});

const clockParser = createParser<string>({
  parse: (v) => (/^([01]\d|2[0-3]):(00|30)$/.test(v) ? v : null), // только :00 / :30
  serialize: (v) => v,
});

const hoursParser = createParser<number>({
  parse: (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0.5 && n <= 12 && (n * 2) % 1 === 0 ? n : null;
  },
  serialize: (v) => String(v),
});

const intParser = (min: number, max: number) =>
  createParser<number>({
    parse: (v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= min && n <= max ? n : null;
    },
    serialize: (v) => String(v),
  });

const slugParser = createParser<string>({
  parse: (v) => (/^[a-z0-9-]{1,64}$/.test(v) ? v : null),
  serialize: (v) => v,
});

/** Параметры страницы /calculator: ?d=&t=&h=&g=&hall=&tables=&p=&x=&s=&i= */
export const calculatorParsers = {
  d: isoDateParser, // дата визита; нет → сегодня (операционная дата)
  t: clockParser.withDefault("19:00"), // время начала (обычные часы)
  h: hoursParser.withDefault(3), // длительность в часах, шаг 0.5
  g: intParser(1, 200).withDefault(4), // гости
  hall: slugParser, // slug зала; нет → первый зал каталога
  tables: intParser(1, 50), // нет → min(tablesCount, ceil(g / seatsPerTable))
  p: parseAsBoolean.withDefault(false), // пенсионер
  x: keyQtyParser.withDefault([]), // доп. услуги: id:qty
  s: keyQtyParser.withDefault([]), // сеты: code:qty
  i: keyQtyParser.withDefault([]), // позиции меню: code:qty
};

export type CalculatorUrlState = {
  d: string | null;
  t: string;
  h: number;
  g: number;
  hall: string | null;
  tables: number | null;
  p: boolean;
  x: KeyQty[];
  s: KeyQty[];
  i: KeyQty[];
};

const FALLBACK_SEATS_PER_TABLE = 4;

/**
 * Авто-режим столов: VIP — 1; иначе `ceil(g / seatsPerTable)`, но не больше столов в зале
 * (иначе считали бы аренду несуществующих столов) и не меньше 1.
 */
function defaultTables(hall: CalcHall | undefined, guests: number): number {
  if (hall?.kind === "vip") return 1;
  const seats = hall?.seatsPerTable || FALLBACK_SEATS_PER_TABLE;
  const needed = Math.ceil(guests / seats);
  // Та же формула, что autoTables() в UI калькулятора — серверный расчёт и форма совпадают
  return Math.max(1, hall ? Math.min(hall.tablesCount, needed) : needed);
}

/** Состояние URL → QuoteInput (подставляет дефолты, переводит часы в минуты суток) */
export function toQuoteInput(
  state: CalculatorUrlState,
  catalog: CalculatorCatalog,
  todayOpDate: string
): QuoteInput {
  const hall = catalog.halls.find((h) => h.slug === state.hall) ?? catalog.halls[0];
  return {
    opDate: state.d ?? todayOpDate,
    startMin: clockToOpMin(state.t),
    durationMin: Math.round(state.h * 60),
    guests: state.g,
    hallId: hall?.id ?? "",
    tables: state.tables ?? defaultTables(hall, state.g),
    pensioner: state.p,
    extras: state.x.map((e) => ({ id: e.key, qty: e.qty })),
    sets: state.s.map((e) => ({ code: e.key, qty: e.qty })),
    items: state.i.map((e) => ({ code: e.key, qty: e.qty })),
  };
}

type HallsCatalog = Pick<CalculatorCatalog, "halls">;

const MIN_HOURS = 0.5;
const MAX_HOURS = 12;

/**
 * Минуты → часы для `h`: округление до ближайших 30 мин и зажим в 0.5..12 —
 * иначе hoursParser отбросит значение при чтении ссылки (например, 100 мин → 1.666…).
 */
function durationMinToHours(durationMin: number): number {
  const halfHours = Math.round(durationMin / 30) / 2;
  return Math.min(MAX_HOURS, Math.max(MIN_HOURS, halfHours));
}

// В nuqs v2 clearOnDefault включён по умолчанию: значения, равные default, в URL не пишутся
const serializeState = createSerializer(calculatorParsers);

function toKeyQtyList<T>(
  arr: T[] | undefined,
  key: (e: T) => string,
  qty: (e: T) => number
): KeyQty[] | null {
  return arr && arr.length ? arr.map((e) => ({ key: key(e), qty: qty(e) })) : null;
}

/** Partial<QuoteInput> → "?d=…&i=…" (или "") для ссылки на /calculator */
export function serializeCalculator(input: Partial<QuoteInput>, catalog?: HallsCatalog): string {
  const slug =
    input.hallId && catalog ? catalog.halls.find((h) => h.id === input.hallId)?.slug : undefined;
  return serializeState({
    d: input.opDate ?? null,
    t: input.startMin != null ? opMinToClock(input.startMin) : null,
    h: input.durationMin != null ? durationMinToHours(input.durationMin) : null,
    g: input.guests ?? null,
    hall: slug ?? null,
    tables: input.tables ?? null,
    p: input.pensioner ?? null,
    x: toKeyQtyList(
      input.extras,
      (e) => e.id,
      (e) => e.qty
    ),
    s: toKeyQtyList(
      input.sets,
      (e) => e.code,
      (e) => e.qty
    ),
    i: toKeyQtyList(
      input.items,
      (e) => e.code,
      (e) => e.qty
    ),
  });
}

type ParserKey = keyof typeof calculatorParsers;
type ParsedValue<K extends ParserKey> = ReturnType<(typeof calculatorParsers)[K]["parse"]>;

/**
 * URL-параметры → Partial<QuoteInput>: только присутствующие и валидные поля, без default'ов.
 * Намеренно не createLoader — он подставляет default'ы.
 */
export function parseCalculatorSearchParams(
  sp: URLSearchParams | Record<string, string | string[] | undefined>,
  catalog?: HallsCatalog
): Partial<QuoteInput> {
  const get = (k: string): string | null => {
    if (sp instanceof URLSearchParams) return sp.get(k);
    const v = sp[k];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };
  const parse = <K extends ParserKey>(k: K): ParsedValue<K> | null => {
    const raw = get(k);
    return raw == null ? null : (calculatorParsers[k].parse(raw) as ParsedValue<K>);
  };

  const out: Partial<QuoteInput> = {};
  const d = parse("d");
  if (d != null) out.opDate = d;
  const t = parse("t");
  if (t != null) out.startMin = clockToOpMin(t);
  const h = parse("h");
  if (h != null) out.durationMin = Math.round(h * 60);
  const g = parse("g");
  if (g != null) out.guests = g;
  const hallSlug = parse("hall");
  const hall = hallSlug && catalog ? catalog.halls.find((x) => x.slug === hallSlug) : undefined;
  if (hall) out.hallId = hall.id;
  const tables = parse("tables");
  if (tables != null) out.tables = tables;
  const p = parse("p");
  if (p != null) out.pensioner = p;
  const x = parse("x");
  if (x) out.extras = x.map((e) => ({ id: e.key, qty: e.qty }));
  const s = parse("s");
  if (s) out.sets = s.map((e) => ({ code: e.key, qty: e.qty }));
  const i = parse("i");
  if (i) out.items = i.map((e) => ({ code: e.key, qty: e.qty }));
  return out;
}
