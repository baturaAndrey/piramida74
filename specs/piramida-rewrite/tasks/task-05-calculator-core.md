# Task 05: Ядро калькулятора (чистые функции) + Vitest

## Status

pending

## Wave

2

## Description

Реализует ядро калькулятора стоимости заказа на N гостей: чистую функцию `calculateQuote(input, catalog)`, типы каталога/ввода/результата и сериализацию состояния в URL (nuqs). Функция одинаково работает в браузере (живой расчёт) и на сервере (пересчёт при отправке заявки), поэтому она **не импортирует ничего из схемы БД, `next/*`, React** — только собственные типы. Основа расчёта — модель «операционных суток» (с 09:00 даты визита до 09:00 следующей даты): тарифы и окна акций хранятся в минутах от 09:00. Задача содержит юнит-тесты с конкретными числами.

## Dependencies

**Depends on:** task-01-starter-cleanup-deps.md
**Blocks:** task-24-calculator-ui.md (и косвенно task-11, task-12: `submitLead` пересчитывает quote, `getCalculatorCatalog()` возвращает `CalculatorCatalog`; обе собирают `menuVariants` через `buildMenuVariants`)

**Context from dependencies:** задача 01 установила `vitest` (скрипт `pnpm test` = `vitest run`, конфиг `vitest.config.ts` с алиасом `@` → `src`, включает `src/**/*.test.ts`), `nuqs` и настроила строгий `tsconfig` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`). Схема БД (задача 03) в этом Wave пишется параллельно, поэтому здесь **нельзя** импортировать из `@/lib/schema`: типы каталога описаны локально, а задача 12 (`getCalculatorCatalog`) и задача 11 (`loadCatalogForQuote`) приводят строки БД к этим типам; `menuVariants` обе собирают **только** через чистую функцию `buildMenuVariants(rows: MenuVariantSourceRows)` из `src/lib/calculator/catalog-mapper.ts` (создаётся здесь), передавая плоские строки `menuCategories`/`menuItems`/`menuItemVariants`/`priceGroupTiers` (у `priceGroupTiers` в задаче 03 есть `code varchar(8)` unique). Утилиты дат (`@/lib/dates`, задача 06) тоже пишутся параллельно — нужные 2 функции времени реализованы внутри этой задачи.

## Files to Create

- `src/lib/calculator/types.ts` — `CalculatorCatalog`, `QuoteInput`, `Quote` и вложенные типы
- `src/lib/calculator/calculate.ts` — `calculateQuote`, помощники времени (`opMinToClock`, `clockToOpMin`)
- `src/lib/calculator/url-state.ts` — парсеры nuqs, `toQuoteInput`, сериализация списков, `serializeCalculator`, `parseCalculatorSearchParams`
- `src/lib/calculator/catalog-mapper.ts` — тип `MenuVariantSourceRows` и чистая функция `buildMenuVariants(rows)` (строки меню → `CalcMenuVariant[]`)
- `src/lib/calculator/index.ts` — реэкспорт
- `src/lib/calculator/calculate.test.ts` — тесты расчёта
- `src/lib/calculator/url-state.test.ts` — тесты парсинга/сериализации URL-состояния
- `src/lib/calculator/catalog-mapper.test.ts` — тесты `buildMenuVariants`

## Files to Modify

Нет.

## Technical Details

### Модель времени (обязательно прочитать)

- **Операционные сутки** даты D: с 09:00 D до 09:00 D+1. Время 00:00–08:59 относится к **предыдущей** дате визита. `daysOfWeek` тарифа (0 = вс … 6 = сб) — день D.
- **Минуты операционных суток:** `0` = 09:00, `420` = 16:00, `900` = 00:00, `1020` = 02:00, `1440` = 09:00 следующего дня. `startMin`/`endMin` тарифа: `0 ≤ start < end ≤ 1440`.
- **Бронь:** `startMin` (0..1439, кратно 30) и `durationMin` (30..720, кратно 30) → интервал `[S, E)`, `E = S + durationMin` и **может быть > 1440**: тогда хвост попадает в операционные сутки D+1 с **днём недели D+1** (пример: четверг 07:00 на 4 часа = четверг 07:00–09:00 по ночному тарифу, затем пятница 09:00–11:00 по дневному тарифу пятницы).
- UI показывает клиенту обычное время (`19:00`) и «дату визита»; конверсия `clockToOpMin("19:00") = 600`, `clockToOpMin("01:00") = 960`, `opMinToClock(960) = "01:00"`.

### Implementation Steps

1. Создать `types.ts` (код ниже). Поля каталога подобраны так, чтобы задача 12 заполнила их одним запросом; `null` используется вместо `?` (из-за `exactOptionalPropertyTypes`), кроме `minGuests?/maxGuests?` из контракта.
2. Создать `calculate.ts` по алгоритму ниже. Функция **чистая**: не читает время, не обращается к сети/БД, не мутирует вход, не бросает исключений (некорректный ввод → предупреждение в `warnings` и нулевая аренда).
3. Алгоритм `calculateQuote`:
   1. **Нормализация/валидация.** Находим зал по `hallId`; нет зала → warning «Зал не найден», аренда не считается. Проверка времени: `startMin` целое, `0 ≤ startMin < 1440`, `startMin % 30 === 0`; `durationMin` целое, `30 ≤ durationMin ≤ 720`, `% 30 === 0`; иначе warning «Некорректное время брони…» и аренда не считается. `tables` → целое ≥ 1; если `tables > hall.tablesCount` — урезать до `tablesCount` + warning «В зале «X» доступно столов: N»; у VIP-комнат `tablesCount = 1`, поэтому `tables > 1` тоже даст warning. `guests` → целое ≥ 1.
   2. **Разбиение интервала по суткам.** Для `k` от `floor(S/1440)` до `floor((E-1)/1440)`: окно `[max(S,k·1440)−k·1440, min(E,(k+1)·1440)−k·1440)`; дата `dayIso = addDays(opDate, k)`, `dow = dayOfWeek(dayIso)`.
   3. **Кандидаты-тарифы окна:** тарифы выбранного зала (`hallId`), у которых `daysOfWeek` содержит `dow` и (`validFrom == null || validFrom <= dayIso`) и (`validTo == null || validTo >= dayIso`).
   4. **Точки разбиения:** границы окна + `startMin`/`endMin` каждого кандидата внутри окна. Отсортировать, убрать дубли. Для каждого подотрезка `[a, b)` взять кандидатов, у которых `startMin <= a < endMin`, и выбрать тариф: если `input.pensioner` — первый кандидат с `audience === "pensioner"`, иначе/если нет — первый с `audience === "all"` (при пересечении внутри одной аудитории выигрывает первый в порядке каталога; пересечения контролирует админка). Тарифы `audience: "pensioner"` **никогда** не применяются без флага `pensioner`.
   5. **Слияние:** соседние подотрезки с одним и тем же тарифом (или оба без тарифа) склеиваются в сегмент `{ tariff | null, k, from, to }`.
   6. **Сегменты без тарифа («дыры»)** → одно предупреждение на сегмент: `Время 02:00–03:00 не покрыто тарифами — уточните стоимость у администратора`; в сумму не входят.
   7. **Строки аренды:**
      - `per_hour`: `qty = tables × (to − from) / 60` (стол-часы), `unitPrice = price`, `total = Math.round(unitPrice × qty)`;
      - `fixed`: начисляется **один раз за операционную ночь/сутки `k` на каждый стол/комнату**, если сегмент хоть как-то пересекается с тарифом: ключ дедупликации `${tariff.id}:${k}`, `qty = tables`, `total = price × tables`;
      - `per_session` (для тарифов аренды): один раз за бронь на каждый стол, ключ `tariff.id`;
      - `label`: `${hall.name}, ${tariff.label} (${HH:mm}–${HH:mm}${tables > 1 ? `, столов: ${tables}` : ""})`; `kind: "rental"`.
   8. **Доп. услуги** (`input.extras`, `{id, qty}`): неизвестный `id` или `qty < 1` → пропуск (+ warning для неизвестного). `per_hour`: `qty = qty × durationMin/60`, `total = Math.round(price × qty)`; `per_session`: `qty = qty`, `total = price × qty`. `kind: "extra"`, попадают в `rentalTotal`.
   9. **Сеты** (`input.sets`, `{code, qty}`): `per_person` — `qty` это **число персон** (UI подставляет = гостям), `total = price × qty`; `fixed` — `qty` штук, `total = price × qty`. Если задан `minGuests`/`maxGuests` и `input.guests` вне диапазона — warning «Сет «X» рассчитан на N–M гостей». Неизвестный `code` → warning + пропуск. `kind: "set"`.
   10. **Позиции меню** (`input.items`, `{code, qty}`): `total = price × qty`, `label = itemName + (label ? ", " + label : "")`, `kind: "item"`. Неизвестный `code` → warning + пропуск.
   11. **Итоги:** `rentalTotal` = аренда + доп. услуги; `foodTotal` = сеты + позиции меню; `total = rentalTotal + foodTotal`; `perGuest = Math.round(total / guests)` (до целых рублей, половинки вверх; при `guests < 1` — `0`).
   12. **Предупреждение о вместимости:** если `guests > tables × seatsPerTable` — «На N гостей за выбранными столами (M) не хватит мест — рекомендуем столов: ⌈N / seats⌉».
   13. **Подсказки по акциям (`promoHints`)** — **в сумму не входят**. Для каждого окна суток `k` (как в п. 2) и каждой акции: действует, если (`validFrom/validTo` содержат `dayIso`) и (`daysOfWeek == null || содержит dow`) и окно акции `[startMin ?? 0, endMin ?? 1440)` пересекается с окном брони в сутках `k`. Строка: `В это время действует акция «${title}»${discountPercent ? ` (−${discountPercent}%)` : ""} — скидка в расчёт не включена, уточните условия у администратора`. Один раз на акцию (дедупликация по `id`).
4. Создать `url-state.ts` (код ниже): парсеры для `?d=&t=&h=&g=&hall=&tables=&p=&x=&s=&i=`; **импорт только из `nuqs/server`** (модуль используется и на сервере, и в клиентском компоненте); валидирующие парсеры возвращают `null` на мусор (nuqs подставит default). `toQuoteInput(state, catalog, todayOpDate)` собирает `QuoteInput`. Плюс две функции для серверных страниц и ссылок (задача 24 — ссылка из блока на главной и «Скопировать ссылку»):
   - `serializeCalculator(input: Partial<QuoteInput>, catalog?: Pick<CalculatorCatalog, "halls">): string` — строка запроса (`"?…"` или `""`) для ссылки на `/calculator`. Маппинг: `opDate → d`, `startMin → t` (`opMinToClock`), `durationMin → h` (`/60`), `guests → g`, `hallId → hall` (slug зала по `catalog.halls`; без `catalog` или если зал не найден — `hall` **не пишется**), `tables → tables`, `pensioner → p`, `extras → x` (`id:qty`), `sets → s`, `items → i` (`code:qty`). Отсутствующие поля, пустые массивы и значения, равные default парсера, не пишутся. Реализация — `createSerializer(calculatorParsers)` из `nuqs/server` (в nuqs v2 `clearOnDefault` включён по умолчанию).
   - `parseCalculatorSearchParams(sp: URLSearchParams | Record<string, string | string[] | undefined>, catalog?: Pick<CalculatorCatalog, "halls">): Partial<QuoteInput>` — обратный разбор: в результат попадают **только присутствующие и валидные** параметры (невалидные отбрасываются, default'ы **не** подставляются); для массива значений берётся первое; `hallId` заполняется, только если передан `catalog` и slug найден. Реализация — вручную через `calculatorParsers[key].parse(raw)` (каждый парсер nuqs имеет `.parse`), а не `createLoader` (тот подставляет default'ы).
5. Создать `catalog-mapper.ts` (код ниже): тип `MenuVariantSourceRows` и чистая `buildMenuVariants(rows): CalcMenuVariant[]`. Без импортов из схемы/БД/`next/*`. Правила:
   - позиция с **собственными** вариантами → по записи на вариант: `code = variant.code`, `label = variant.label ?? ""`, `price = variant.price`;
   - позиция **без** вариантов, у которой есть сетка `item.priceGroupId ?? category.priceGroupId` → по записи на каждый уровень этой сетки: `code = \`${item.code}-${tier.code}\`` (до 17 символов, содержит `-`), `label = tier.label`, `price = tier.price`;
   - позиция без вариантов и без сетки → пропускается; позиция, чья категория отсутствует в `rows.categories`, → пропускается;
   - `itemName = item.name`, `categorySlug = category.slug`, `categoryName = category.title`;
   - порядок: категории по `sortOrder`, внутри — позиции по `sortOrder`, внутри — варианты/уровни по `sortOrder` (сортировка стабильная, вход не мутируется).
   Вызывающие (задачи 11 и 12) передают только активные позиции и варианты (фильтр `isActive` — их ответственность).
6. Создать `index.ts`: `export * from "./types"; export * from "./calculate"; export * from "./url-state"; export * from "./catalog-mapper";`.
7. Написать тесты (раздел «Тест-кейсы»). Запустить `pnpm test` — все зелёные.
8. `pnpm lint`, `pnpm typecheck`. (`pnpm build:ci` не требуется — задача не меняет приложение.)

### Code Snippets

`src/lib/calculator/types.ts`:

```ts
export type CalcHallKind = "common" | "vip";
export type CalcPriceUnit = "per_hour" | "fixed" | "per_session";
export type CalcAudience = "all" | "pensioner";

export interface CalcHall {
  id: string;
  slug: string; // для URL ?hall=
  name: string;
  kind: CalcHallKind;
  tablesCount: number; // у VIP-комнаты = 1
  seatsPerTable: number;
}

export interface CalcTariff {
  id: string;
  hallId: string;
  daysOfWeek: number[]; // 0 = вс … 6 = сб, день D операционных суток
  startMin: number; // минуты от 09:00, 0..1440
  endMin: number;
  price: number; // целые рубли
  priceUnit: CalcPriceUnit;
  audience: CalcAudience;
  label: string;
  validFrom: string | null; // YYYY-MM-DD
  validTo: string | null;
}

export interface CalcExtraService {
  id: string;
  name: string;
  price: number;
  priceUnit: "per_hour" | "per_session";
}

export interface CalcMenuVariant {
  code: string; // variant.code или `${item.code}-${tier.code}` (до 17 символов, [a-z0-9-])
  itemName: string;
  label: string; // variant.label ?? "" или tier.label
  price: number;
  categorySlug: string; // menuCategories.slug категории позиции (группировка в UI, задача 24)
  categoryName: string; // menuCategories.title
}

export interface CalcSet {
  code: string;
  title: string;
  pricingMode: "per_person" | "fixed";
  price: number;
  minGuests?: number | null;
  maxGuests?: number | null;
}

export interface CalcPromotion {
  id: string;
  title: string;
  discountPercent: number | null;
  daysOfWeek: number[] | null;
  startMin: number | null;
  endMin: number | null;
  validFrom: string | null;
  validTo: string | null;
}

export interface CalculatorCatalog {
  halls: CalcHall[];
  tariffs: CalcTariff[];
  extraServices: CalcExtraService[];
  menuVariants: CalcMenuVariant[];
  sets: CalcSet[];
  promotions: CalcPromotion[];
}

export interface QuoteInput {
  opDate: string; // YYYY-MM-DD, дата визита D
  startMin: number; // минуты от 09:00 D, кратно 30
  durationMin: number; // 30..720, кратно 30
  guests: number;
  hallId: string;
  tables: number;
  pensioner: boolean;
  extras: { id: string; qty: number }[];
  sets: { code: string; qty: number }[];
  items: { code: string; qty: number }[];
}

export type QuoteLineKind = "rental" | "extra" | "set" | "item";

export interface QuoteLine {
  kind: QuoteLineKind;
  label: string;
  qty: number; // может быть дробным (стол-часы, шаг 0.5)
  unitPrice: number;
  total: number; // целые рубли
}

export interface Quote {
  lines: QuoteLine[];
  rentalTotal: number;
  foodTotal: number;
  total: number;
  perGuest: number;
  warnings: string[];
  promoHints: string[];
}
```

`src/lib/calculator/calculate.ts` — каркас и нетривиальные куски (остальное — по алгоритму):

```ts
import type { CalcTariff, CalculatorCatalog, Quote, QuoteInput, QuoteLine } from "./types";

export const OP_DAY_START_MIN = 9 * 60; // операционные сутки начинаются в 09:00
const DAY = 1440;

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

function addDaysIso(iso: string, n: number): string {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
function dayOfWeek(iso: string): number {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = вс
}

interface Segment { tariff: CalcTariff | null; k: number; from: number; to: number }

/** Разбить окно суток k на сегменты по границам тарифов выбранного зала */
function segmentDay(
  k: number, from: number, to: number, dayIso: string,
  tariffs: CalcTariff[], pensioner: boolean
): Segment[] {
  const dow = dayOfWeek(dayIso);
  const cands = tariffs.filter(
    (t) =>
      t.daysOfWeek.includes(dow) &&
      (t.validFrom == null || t.validFrom <= dayIso) &&
      (t.validTo == null || t.validTo >= dayIso)
  );
  const points = new Set<number>([from, to]);
  for (const t of cands) {
    if (t.startMin > from && t.startMin < to) points.add(t.startMin);
    if (t.endMin > from && t.endMin < to) points.add(t.endMin);
  }
  const sorted = [...points].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!, b = sorted[i + 1]!;
    const here = cands.filter((t) => t.startMin <= a && a < t.endMin);
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

export function calculateQuote(input: QuoteInput, catalog: CalculatorCatalog): Quote {
  const lines: QuoteLine[] = [];
  const warnings: string[] = [];
  const promoHints: string[] = [];
  // … валидация, сегменты (segmentDay для каждого k), строки аренды, extras, sets, items, promoHints …
  const rentalTotal = lines.filter((l) => l.kind === "rental" || l.kind === "extra").reduce((s, l) => s + l.total, 0);
  const foodTotal = lines.filter((l) => l.kind === "set" || l.kind === "item").reduce((s, l) => s + l.total, 0);
  const total = rentalTotal + foodTotal;
  const perGuest = input.guests >= 1 ? Math.round(total / input.guests) : 0;
  return { lines, rentalTotal, foodTotal, total, perGuest, warnings, promoHints };
}
```
(Каркас показывает форму; реализация обязана покрывать весь алгоритм из шага 3, включая `fixed`/`per_session`, extras, sets, items и promoHints.)

`src/lib/calculator/url-state.ts`:

```ts
import { createParser, createSerializer, parseAsBoolean } from "nuqs/server";
import { clockToOpMin, opMinToClock } from "./calculate";
import type { CalculatorCatalog, QuoteInput } from "./types";

export type KeyQty = { key: string; qty: number };

/** "abc123:2,def456:1" → [{key:"abc123",qty:2},…]; мусорные элементы пропускаются, qty 1..99 */
export function parseKeyQtyList(value: string): KeyQty[] {
  const out: KeyQty[] = [];
  for (const part of value.split(",")) {
    const [key, qtyRaw] = part.split(":");
    const qty = Number(qtyRaw);
    if (key && /^[A-Za-z0-9-]+$/.test(key) && Number.isInteger(qty) && qty >= 1 && qty <= 99) out.push({ key, qty });
  }
  return out;
}
export function serializeKeyQtyList(list: KeyQty[]): string {
  return list.map((e) => `${e.key}:${e.qty}`).join(",");
}

const keyQtyParser = createParser<KeyQty[]>({
  parse: (v) => { const l = parseKeyQtyList(v); return l.length ? l : null; },
  serialize: serializeKeyQtyList,
  eq: (a, b) => serializeKeyQtyList(a) === serializeKeyQtyList(b),
});

const isoDateParser = createParser<string>({
  parse: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null),
  serialize: (v) => v,
});
const clockParser = createParser<string>({
  parse: (v) => (/^([01]\d|2[0-3]):(00|30)$/.test(v) ? v : null), // только :00 / :30
  serialize: (v) => v,
});
const hoursParser = createParser<number>({
  parse: (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0.5 && n <= 12 && (n * 2) % 1 === 0 ? n : null; },
  serialize: (v) => String(v),
});
const intParser = (min: number, max: number) =>
  createParser<number>({
    parse: (v) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; },
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
  tables: intParser(1, 50), // нет → ceil(g / seatsPerTable)
  p: parseAsBoolean.withDefault(false), // пенсионер
  x: keyQtyParser.withDefault([]), // доп. услуги: id:qty
  s: keyQtyParser.withDefault([]), // сеты: code:qty
  i: keyQtyParser.withDefault([]), // позиции меню: code:qty
};

export type CalculatorUrlState = {
  d: string | null; t: string; h: number; g: number; hall: string | null; tables: number | null;
  p: boolean; x: KeyQty[]; s: KeyQty[]; i: KeyQty[];
};

/** Состояние URL → QuoteInput (подставляет дефолты, переводит часы в минуты суток) */
export function toQuoteInput(state: CalculatorUrlState, catalog: CalculatorCatalog, todayOpDate: string): QuoteInput {
  const hall = catalog.halls.find((h) => h.slug === state.hall) ?? catalog.halls[0];
  const seats = hall?.seatsPerTable ?? 4;
  const defaultTables = hall?.kind === "vip" ? 1 : Math.ceil(state.g / seats);
  return {
    opDate: state.d ?? todayOpDate,
    startMin: clockToOpMin(state.t),
    durationMin: Math.round(state.h * 60),
    guests: state.g,
    hallId: hall?.id ?? "",
    tables: state.tables ?? defaultTables,
    pensioner: state.p,
    extras: state.x.map((e) => ({ id: e.key, qty: e.qty })),
    sets: state.s.map((e) => ({ code: e.key, qty: e.qty })),
    items: state.i.map((e) => ({ code: e.key, qty: e.qty })),
  };
}

type HallsCatalog = Pick<CalculatorCatalog, "halls">;
const serializeState = createSerializer(calculatorParsers);

/** Partial<QuoteInput> → "?d=…&i=…" (или "") для ссылки на /calculator */
export function serializeCalculator(input: Partial<QuoteInput>, catalog?: HallsCatalog): string {
  const slug = input.hallId && catalog ? catalog.halls.find((h) => h.id === input.hallId)?.slug : undefined;
  const list = <T>(arr: T[] | undefined, key: (e: T) => string, qty: (e: T) => number) =>
    arr && arr.length ? arr.map((e) => ({ key: key(e), qty: qty(e) })) : null;
  return serializeState({
    d: input.opDate ?? null,
    t: input.startMin != null ? opMinToClock(input.startMin) : null,
    h: input.durationMin != null ? input.durationMin / 60 : null,
    g: input.guests ?? null,
    hall: slug ?? null,
    tables: input.tables ?? null,
    p: input.pensioner ?? null,
    x: list(input.extras, (e) => e.id, (e) => e.qty),
    s: list(input.sets, (e) => e.code, (e) => e.qty),
    i: list(input.items, (e) => e.code, (e) => e.qty),
  });
}

/** URL-параметры → Partial<QuoteInput>: только присутствующие и валидные поля, без default'ов */
export function parseCalculatorSearchParams(
  sp: URLSearchParams | Record<string, string | string[] | undefined>,
  catalog?: HallsCatalog,
): Partial<QuoteInput> {
  const get = (k: string): string | null => {
    if (sp instanceof URLSearchParams) return sp.get(k);
    const v = sp[k];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };
  const parse = <K extends keyof typeof calculatorParsers>(k: K) => {
    const raw = get(k);
    return raw == null ? null : (calculatorParsers[k].parse(raw) as ReturnType<(typeof calculatorParsers)[K]["parse"]>);
  };
  const out: Partial<QuoteInput> = {};
  const d = parse("d"); if (d != null) out.opDate = d;
  const t = parse("t"); if (t != null) out.startMin = clockToOpMin(t);
  const h = parse("h"); if (h != null) out.durationMin = Math.round(h * 60);
  const g = parse("g"); if (g != null) out.guests = g;
  const hallSlug = parse("hall");
  const hall = hallSlug && catalog ? catalog.halls.find((x) => x.slug === hallSlug) : undefined;
  if (hall) out.hallId = hall.id;
  const tables = parse("tables"); if (tables != null) out.tables = tables;
  const p = parse("p"); if (p != null) out.pensioner = p;
  const x = parse("x"); if (x) out.extras = x.map((e) => ({ id: e.key, qty: e.qty }));
  const s = parse("s"); if (s) out.sets = s.map((e) => ({ code: e.key, qty: e.qty }));
  const i = parse("i"); if (i) out.items = i.map((e) => ({ code: e.key, qty: e.qty }));
  return out;
}
```
Если сигнатуры `createParser`/`withDefault`/`createSerializer` в установленной версии nuqs отличаются — сверить с документацией через context7 (`/47ng/nuqs`) и подправить реализацию (допустима ручная сборка `URLSearchParams` через `parser.serialize`), сохранив семантику выше. Публичные имена `url-state.ts` фиксированы контрактом и используются задачами 11/12/24 буквально: `calculatorParsers`, `CalculatorUrlState`, `toQuoteInput`, `parseKeyQtyList`, `serializeKeyQtyList`, `serializeCalculator`, `parseCalculatorSearchParams` (имени `stateToQuoteInput` нет). Регулярка ключа в `parseKeyQtyList` (`/^[A-Za-z0-9-]+$/`) обязана пропускать коды вида `abc123-x9y8z7` (код уровня сетки из `buildMenuVariants`).

`src/lib/calculator/catalog-mapper.ts`:

```ts
import type { CalcMenuVariant } from "./types";

/** Плоские строки БД (задачи 11/12 выбирают их из menuCategories/menuItems/menuItemVariants/priceGroupTiers) */
export interface MenuVariantSourceRows {
  categories: { id: string; slug: string; title: string; priceGroupId: string | null; sortOrder: number }[];
  items: { id: string; code: string; name: string; categoryId: string; priceGroupId: string | null; sortOrder: number }[]; // только активные
  variants: { code: string; itemId: string; label: string | null; price: number; sortOrder: number }[]; // только активные
  tiers: { code: string; groupId: string; label: string; price: number; sortOrder: number }[];
}

const bySort = <T extends { sortOrder: number }>(list: readonly T[]): T[] =>
  [...list].sort((a, b) => a.sortOrder - b.sortOrder); // стабильная, копия — вход не мутируется

function groupBy<T>(list: readonly T[], key: (e: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const e of list) { const k = key(e); const arr = m.get(k); if (arr) arr.push(e); else m.set(k, [e]); }
  return m;
}

export function buildMenuVariants(rows: MenuVariantSourceRows): CalcMenuVariant[] {
  const itemsByCat = groupBy(bySort(rows.items), (i) => i.categoryId);
  const variantsByItem = groupBy(bySort(rows.variants), (v) => v.itemId);
  const tiersByGroup = groupBy(bySort(rows.tiers), (t) => t.groupId);
  const out: CalcMenuVariant[] = [];
  for (const cat of bySort(rows.categories)) {
    for (const item of itemsByCat.get(cat.id) ?? []) {
      const base = { itemName: item.name, categorySlug: cat.slug, categoryName: cat.title };
      const own = variantsByItem.get(item.id);
      if (own?.length) {
        for (const v of own) out.push({ ...base, code: v.code, label: v.label ?? "", price: v.price });
        continue;
      }
      const groupId = item.priceGroupId ?? cat.priceGroupId;
      if (!groupId) continue; // ни вариантов, ни сетки — в калькулятор не попадает
      for (const t of tiersByGroup.get(groupId) ?? [])
        out.push({ ...base, code: `${item.code}-${t.code}`, label: t.label, price: t.price });
    }
  }
  return out;
}
```

### Тест-кейсы (`calculate.test.ts`)

**Фикстура** (константы в тесте): залы — `common` (`id: "h-common"`, `slug: "obshchiy-zal"`, `tablesCount: 12`, `seatsPerTable: 4`), `vip1` (`id: "h-vip1"`, `slug: "vip-1"`, `kind: "vip"`, `tablesCount: 1`, `seatsPerTable: 8`). Тарифы (минуты от 09:00):

| id | зал | дни | окно | цена | единица | аудитория |
|---|---|---|---|---|---|---|
| T1 | common | 0,1,2,3,4 | 0–420 (09–16) | 580 | per_hour | all |
| T2 | common | 0,1,2,3,4 | 420–1020 (16–02) | 640 | per_hour | all |
| T3 | common | 5,6 | 0–420 | 680 | per_hour | all |
| T4 | common | 5,6 | 420–1020 | 760 | per_hour | all |
| T5 | common | 0–6 | 1020–1440 (02–09) | 3500 | per_hour | all |
| TP | common | 0–6 | 0–180 (09–12) | 200 | per_hour | pensioner |
| V1 | vip1 | 0–6 | 0–1020 | 1400 | per_hour | all |
| V2 | vip1 | 0–6 | 1020–1440 | 4800 | per_hour | all |

`menuVariants` фикстуры — полные объекты `CalcMenuVariant` (с `categorySlug`/`categoryName`), например `{ code: "a1b2c3", itemName: "Бургер", label: "", price: 450, categorySlug: "kuhnya", categoryName: "Кухня" }`.

Даты (2026): пн 23 ноя, вт 24, ср 25, чт 26, пт 27 (20 ноя — тоже пт), сб 21 и 28, вс 22 и 29 ноя. Все примеры — зал `common`, 1 стол, `guests: 4`, `pensioner: false`, если не указано иное.

| # | Сценарий | Ввод (дата визита, начало, длительность) | Ожидание |
|---|---|---|---|
| 1 | Будний вечер | пн 2026-11-23, 19:00 (`600`), 3 ч | 1 строка T2, qty 3, `total = 1920` |
| 2 | Смена тарифа посреди брони | пн 2026-11-23, 14:00 (`300`), 4 ч | 2 строки: T1 2 ч = 1160, T2 2 ч = 1280; `total = 2440` |
| 3 | Выходной вечер | сб 2026-11-21, 20:00 (`660`), 4 ч | T4, `total = 3040` |
| 4 | Ночь сб→вс по тарифу субботы | сб 2026-11-21, 00:00 (`900`), 2 ч | T4 (не T2 воскресенья): `total = 1520` |
| 5 | Ночь чт→пт по тарифу четверга | чт 2026-11-26, 00:00 (`900`), 2 ч | T2 (не T4 пятницы): `total = 1280` |
| 6 | Воскресенье→понедельник | вс 2026-11-22, 01:00 (`960`), 1 ч | T2: `total = 640` |
| 7 | Переход вечер → ночной тариф | пн 2026-11-23, 00:30 (`930`), 3 ч | T2 1.5 ч = 960 + T5 1.5 ч = 5250; `total = 6210`, 2 строки |
| 8 | Переход через границу суток 09:00 | чт 2026-11-26, 07:00 (`1320`), 4 ч | T5 2 ч = 7000 + (пятница, `dow 5`) T3 2 ч = 1360; `total = 8360` |
| 9 | Полчаса | вс 2026-11-22, 12:00 (`180`), 1.5 ч | T1, qty 1.5, `total = 870` |
| 10 | Два стола | пн 2026-11-23, 19:00, 3 ч, `tables: 2` | qty 6, `total = 3840` |
| 11 | «Дыра» (каталог без T5) | пн 2026-11-23, 00:00 (`900`), 3 ч | `total = 1280` (T2 2 ч), в `warnings` есть «02:00–03:00… не покрыто тарифами» |
| 12 | Истёкший тариф | T2 с `validTo: "2026-11-01"`, пн 2026-11-23, 19:00, 3 ч | `total = 0`, warning о «дыре» |
| 13 | Пенсионер, флаг включён | пн, 10:00 (`60`), 2 ч, `pensioner: true` | TP: `total = 400` |
| 14 | Пенсионер, флаг выключен | то же, `pensioner: false` | T1: `total = 1160` |
| 15 | Пенсионер, смена тарифа | пн, 10:00, 3 ч, `pensioner: true` | TP 2 ч = 400 + T1 1 ч = 580; `total = 980` |
| 16 | `fixed`-ночь (T5 → `priceUnit: "fixed"`, `price: 5000`) | пн, 01:00 (`960`), 3 ч, `tables: 2` | T2 qty 2 = 1280 + fixed 5000 × 2 = 10000; `total = 11280`; fixed — **одна** строка на тариф |
| 17 | VIP днём, лишние столы | зал `vip1`, пн, 19:00, 3 ч, `tables: 3` | `tables` урезано до 1 + warning; `total = 4200` |
| 18 | VIP ночью | `vip1`, пн, 02:00 (`1020`), 2 ч | V2: `total = 9600` |
| 19 | VIP: смена дневного на ночной | `vip1`, пн, 01:00 (`960`), 2 ч | V1 1 ч = 1400 + V2 1 ч = 4800; `total = 6200` |
| 20 | Столов больше, чем в зале | `common`, `tables: 15` | урезано до 12 + warning |
| 21 | Вместимость | `guests: 10`, `tables: 2` (8 мест) | warning содержит «мест» и рекомендацию 3 столов |
| 22 | Полный заказ | `common`, пн 19:00, 3 ч, `guests: 8`, `tables: 2`; extras: «Прокат кия» `per_hour` 250 × qty 2; set `per_person` 1500, qty 8 (`minGuests: 6, maxGuests: 20`); item `a1b2c3` 450 × qty 4 | `rentalTotal = 3840 + 1500 = 5340`, `foodTotal = 12000 + 1800 = 13800`, `total = 19140`, `perGuest = 2393` (19140/8 = 2392.5 → 2393), `warnings` пусты |
| 23 | Доп. услуга `per_session` | extra 250 `per_session` qty 1 | строка `total = 250`, qty 1 |
| 24 | Fixed-сет | set `fixed` 9000, qty 1 | `total = 9000`; при `guests: 8` и `maxGuests: 6` — warning |
| 25 | Неизвестные коды | неизвестные `extras/sets/items` | строки не добавлены, warnings есть, итог — только по существующим |
| 26 | Некорректное время | `startMin: 15`; `durationMin: 20`; `durationMin: 750`; `startMin: 1440` | `rentalTotal = 0`, warning «Некорректное время брони» (в каждом случае) |
| 27 | Пустой каталог | `halls: []` | `total = 0`, warning «Зал не найден», без исключений |
| 28 | Подсказки по акциям | акции: P1 «Девичник» `daysOfWeek: [1]`, окно `null` (весь день), `discountPercent: 50`; P2 «Утро в движении» `daysOfWeek: [0,1,2,3,4]`, `startMin: 0`, `endMin: 180`; P3 с `validTo` в прошлом | пн 19:00 → `promoHints` только P1; пн 10:00 (`60`) 2 ч → P1 и P2; вт 19:00 → пусто; P3 никогда; `total` не меняется |
| 29 | Чистота функции | вызвать дважды с одинаковым входом; проверить, что входные объекты не изменились (`structuredClone` до/после) | результаты равны, вход не мутирован |
| 30 | Помощники времени | `clockToOpMin("09:00") = 0`, `("19:00") = 600`, `("00:00") = 900`, `("01:00") = 960`, `("08:30") = 1410`; `opMinToClock(0)="09:00"`, `(960)="01:00"`, `(1020)="02:00"`, `(1440)="09:00"` | как указано |

**`url-state.test.ts`:** `parseKeyQtyList("abc123:2,def456:1")` → два элемента; мусор (`"x:0"`, `"y:abc"`, `":3"`, `"z:100"`) пропускается; `serializeKeyQtyList` ↔ `parseKeyQtyList` — round-trip; `calculatorParsers.t.parse("19:15")` → `null`, `("19:30")` → `"19:30"`; `h.parse("0.3")` → `null`, `("2.5")` → `2.5`, `("13")` → `null`; `d.parse("2026-13-45")` → `null`; `toQuoteInput`: `t = "19:00"` → `startMin 600`, `h = 2.5` → `durationMin 150`, `hall = "obshchiy-zal"` → `hallId "h-common"`, `tables = null` и `g = 9` → `3`, VIP-зал → `1`, `d = null` → подставляется `todayOpDate`; `parseKeyQtyList("abc123-x9y8z7:2")` → `[{ key: "abc123-x9y8z7", qty: 2 }]`.

`serializeCalculator` / `parseCalculatorSearchParams` (каталог залов — фикстура выше; проверять через `new URLSearchParams(result.slice(1)).get(…)`, а не сравнением строки целиком):
- `serializeCalculator({ opDate: "2026-11-23", startMin: 630, durationMin: 150, guests: 8, hallId: "h-common", tables: 2, pensioner: true, items: [{ code: "abc123-x9y8z7", qty: 2 }] }, catalog)` → начинается с `?`; `d = "2026-11-23"`, `t = "19:30"`, `h = "2.5"`, `g = "8"`, `hall = "obshchiy-zal"`, `tables = "2"`, `p = "true"`, `i = "abc123-x9y8z7:2"`; `x`/`s` отсутствуют;
- то же без `catalog` → параметра `hall` нет; `hallId` неизвестного зала → `hall` нет;
- `serializeCalculator({})` → `""`; значения, равные default (`startMin: 600` → `t=19:00`, `guests: 4`, `pensioner: false`, пустые массивы), не пишутся;
- round-trip: `parseCalculatorSearchParams(new URLSearchParams(serializeCalculator(input, catalog).slice(1)), catalog)` возвращает заданные поля `input` (кроме опущенных default'ов);
- `parseCalculatorSearchParams({ t: "19:15", h: "13", g: "abc", d: "2026-13-45", hall: "vip-1", i: ["a1b2c3:2", "zzz:1"] })` без `catalog` → `{ items: [{ code: "a1b2c3", qty: 2 }] }` (невалидные отброшены, `hallId` не заполнен, из массива взято первое значение);
- с `catalog` и `hall: "vip-1"` → `hallId: "h-vip1"`; `hall: "net-takogo"` → `hallId` отсутствует; пустой вход → `{}`.

**`catalog-mapper.test.ts`** (фикстура: категории `chai` (`priceGroupId: "g-tea"`, sortOrder 2) и `kuhnya` (`priceGroupId: null`, sortOrder 1); сетки `g-tea` (уровни `t600` «Чайник 600 мл» 350 sortOrder 1, `t1000` «Чайник 1 л» 500 sortOrder 2) и `g-big` (уровень `b1` «Большой» 900)):
1. Позиция с собственными вариантами (`kuhnya`, два варианта, у одного `label: null`) → две записи `code = variant.code`, `label` второго = `""`, `categorySlug = "kuhnya"`, `categoryName` = `title` категории.
2. Позиция без вариантов в категории `chai` (сетка категории) → две записи `code = "<item.code>-t600"` / `"<item.code>-t1000"`, `label`/`price` из уровней.
3. Позиция без вариантов с `item.priceGroupId = "g-big"` в категории `chai` → сетка позиции перекрывает сетку категории: одна запись `"<item.code>-b1"`.
4. Позиция **с** вариантами в категории с сеткой → только собственные варианты, уровней сетки нет.
5. Позиция без вариантов и без сетки (категория `kuhnya`, `priceGroupId: null`) → пропущена.
6. Позиция с `categoryId`, которого нет в `categories`, → пропущена.
7. Порядок: строки во входе перемешаны → результат по `sortOrder` категорий (`kuhnya` раньше `chai`), позиций, вариантов/уровней.
8. Пустой вход (`{ categories: [], items: [], variants: [], tiers: [] }`) → `[]`.
9. Вход не мутирован (`structuredClone` до/после), повторный вызов даёт равный результат.

### Environment Variables

Нет.

## Acceptance Criteria

- [ ] `calculateQuote` — чистая функция без импортов из `@/lib/schema`, `@/lib/dates`, `next/*`, React; не бросает исключений на некорректном вводе
- [ ] Типы `CalculatorCatalog`, `QuoteInput`, `Quote` соответствуют `contracts.md`; экспортируются из `src/lib/calculator/index.ts`
- [ ] Корректно обрабатываются: переход через полночь, ночь пт→сб/сб→вс/чт→пт по тарифу дня визита, переход через границу суток 09:00 с днём недели D+1, смена тарифа посреди брони, интервалы по 30 минут, несколько столов, VIP-комната (1 стол), флаг пенсионера, `fixed`-тариф (раз на ночь на стол), «дыры» (предупреждение, расчёт части не производится), срок действия тарифа
- [ ] Сеты (`per_person` × персоны, `fixed` × штуки), позиции меню, доп. услуги (`per_hour` и `per_session`) считаются по спецификации; `perGuest` округляется до целых рублей (половинка вверх)
- [ ] `promoHints` формируются по дням недели и окнам акций и **не** влияют на сумму
- [ ] Все 30 тест-кейсов из таблицы реализованы в `calculate.test.ts` с указанными числами и проходят; `url-state.test.ts` проходит
- [ ] `url-state.ts` экспортирует `calculatorParsers` (ключи `d,t,h,g,hall,tables,p,x,s,i`), `CalculatorUrlState`, `toQuoteInput`, `parseKeyQtyList`, `serializeKeyQtyList`, `serializeCalculator`, `parseCalculatorSearchParams`; импорты — только из `nuqs/server`; `hall` в URL — slug зала; коды с `-` (`abc123-x9y8z7`) проходят парсинг
- [ ] `serializeCalculator` возвращает `"?…"` или `""`, не пишет `hall` без `catalog`; `parseCalculatorSearchParams` возвращает только валидные присутствующие поля и заполняет `hallId` только при найденном slug
- [ ] `CalcMenuVariant` = `{ code; itemName; label: string; price; categorySlug; categoryName }`; `catalog-mapper.ts` экспортирует `MenuVariantSourceRows` и `buildMenuVariants` (чистая, без импортов схемы/БД), правила «свои варианты → `variant.code`; иначе сетка `item.priceGroupId ?? category.priceGroupId` → `${item.code}-${tier.code}`; иначе пропуск» и порядок по `sortOrder` соблюдены; `catalog-mapper.test.ts` проходит
- [ ] `index.ts` реэкспортирует `types`, `calculate`, `url-state`, `catalog-mapper`
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck` проходят

## Notes

- Если числа в таблице не сходятся с результатом корректной реализации — это ошибка в реализации (числа посчитаны вручную по ценам seed: общий зал Вс–Чт 09–16 = 580, 16–02 = 640; Пт–Сб 680/760; ночь 02–09 = 3500 ₽/ч; VIP 09–02 = 1400, 02–09 = 4800 ₽/ч; пенсионный 09–12 = 200).
- Клубы могут поправить цены в админке: тесты используют **собственную фикстуру**, а не seed.
- В каталоге в `CalcTariff` нет `isActive`: `getCalculatorCatalog()` (задача 12) отдаёт только активные тарифы/залы/акции/позиции, упорядоченные по `sortOrder`.
- Платные добавки меню (`menu_modifiers`) в калькулятор не входят.
- Позиции с сеткой цен (чай, кальяны и т. п.) **попадают** в `menuVariants`: по записи на уровень сетки с составным кодом `${item.code}-${tier.code}` (оба кода — nanoid 6, `varchar(8)`, итог до 17 символов). Zod-схема `QuoteInput` в задаче 11 допускает коды до 20 символов `[a-z0-9-]`.
- `fixed`-тариф начисляется по ключу `(tariff.id, k)`, т.е. один раз за сутки `k`; при брони через границу 09:00 два разных `k` дают два начисления — это допустимо (разные ночи).
