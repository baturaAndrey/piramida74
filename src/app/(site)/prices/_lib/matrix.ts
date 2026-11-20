import { minToClock } from "@/lib/dates";
import type { PublicTariff } from "@/lib/queries/pricing";
import type { PriceUnit } from "@/lib/schema/enums";
import { formatDayMonth } from "./format";

/** Поля тарифа, нужные для построения таблицы */
export type TariffRow = Pick<
  PublicTariff,
  "daysOfWeek" | "startMin" | "endMin" | "price" | "priceUnit" | "validFrom" | "validTo"
>;

export type MatrixCell = { price: number; unit: PriceUnit; note?: string };

export type Matrix = {
  /** Группы дней; будни/«Вс–Чт» раньше «Пт–Сб», «Ежедневно» — в конце */
  columns: { key: string; label: string; days: number[] }[];
  /** Уникальные интервалы, по `startMin` */
  rows: { key: string; startMin: number; endMin: number; label: string; night: boolean }[];
  cells: Record<string, Record<string, MatrixCell | null>>;
};

/** Интервал, заканчивающийся после 00:00 (900 мин от 09:00), включает ночные часы */
const MIDNIGHT_MIN = 900;
const ALL_DAYS_KEY = "0,1,2,3,4,5,6";
const SUN_THU_KEY = "0,1,2,3,4";
const FRI_SAT_KEY = "5,6";
/** Порядок перечисления дней: с понедельника, воскресенье последним */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const DAY_SHORT: Record<number, string> = {
  0: "Вс",
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
};

const normalizeDays = (days: readonly number[]) =>
  [...new Set(days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);

const daysKey = (days: readonly number[]) => normalizeDays(days).join(",");

const rowKey = (startMin: number, endMin: number) => `${startMin}-${endMin}`;

/** Подпись набора дней: «Вс–Чт», «Пт–Сб», «Ежедневно» или перечисление «Пн, Ср» */
export function daysLabel(days: readonly number[]): string {
  const key = daysKey(days);
  if (key === ALL_DAYS_KEY) return "Ежедневно";
  if (key === SUN_THU_KEY) return "Вс–Чт";
  if (key === FRI_SAT_KEY) return "Пт–Сб";
  const set = new Set(days);
  return DAY_ORDER.filter((d) => set.has(d))
    .map((d) => DAY_SHORT[d])
    .join(", ");
}

/** Ранг столбца: только будни → с пятницей/субботой → ежедневно */
function columnRank(days: readonly number[]): number {
  if (days.length === 7) return 2;
  return days.some((d) => d === 5 || d === 6) ? 1 : 0;
}

const isSuperset = (outer: readonly number[], inner: readonly number[]) =>
  inner.every((d) => outer.includes(d));

/** «до 31.12» / «с 01.12» / «с 01.12 до 31.12» для тарифов с ограниченным сроком */
function validityNote(t: TariffRow): string | undefined {
  const from = t.validFrom ? `с ${formatDayMonth(t.validFrom)}` : "";
  const to = t.validTo ? `до ${formatDayMonth(t.validTo)}` : "";
  const note = [from, to].filter(Boolean).join(" ");
  return note || undefined;
}

/**
 * Строит таблицу «интервалы времени × группы дней» по тарифам одного зала (или группы залов
 * с одинаковыми тарифами). Чистая функция.
 *
 * Столбец, покрывающий все дни остальных столбцов (обычно «Ежедневно» у ночного тарифа),
 * не выводится отдельно: его тарифы заполняют пустые ячейки остальных столбцов —
 * иначе в таблице появляется столбец почти из одних прочерков.
 */
export function buildMatrix(tariffs: readonly TariffRow[]): Matrix {
  const sorted = [...tariffs].sort(
    (a, b) => a.startMin - b.startMin || a.endMin - b.endMin || a.price - b.price
  );

  // (а) уникальные наборы дней в порядке первого появления, затем по рангу (sort стабилен)
  const columnMap = new Map<string, number[]>();
  for (const t of sorted) {
    const days = normalizeDays(t.daysOfWeek);
    if (days.length === 0) continue;
    const key = days.join(",");
    if (!columnMap.has(key)) columnMap.set(key, days);
  }
  let columns = [...columnMap.entries()]
    .map(([key, days]) => ({ key, label: daysLabel(days), days }))
    .sort((a, b) => columnRank(a.days) - columnRank(b.days));

  if (columns.length > 1) {
    const narrow = columns.filter(
      (col) => !columns.every((other) => other === col || isSuperset(col.days, other.days))
    );
    if (narrow.length > 0) columns = narrow;
  }

  // (в) уникальные интервалы
  const rowMap = new Map<string, Matrix["rows"][number]>();
  for (const t of sorted) {
    const key = rowKey(t.startMin, t.endMin);
    if (rowMap.has(key)) continue;
    rowMap.set(key, {
      key,
      startMin: t.startMin,
      endMin: t.endMin,
      label: `${minToClock(t.startMin)}–${minToClock(t.endMin)}`,
      night: t.endMin > MIDNIGHT_MIN,
    });
  }
  const rows = [...rowMap.values()];

  // (г) ячейка: тариф с тем же интервалом и набором дней, иначе — покрывающий эти дни
  const cells: Matrix["cells"] = {};
  for (const row of rows) {
    const inRow = sorted.filter((t) => t.startMin === row.startMin && t.endMin === row.endMin);
    const rowCells: Record<string, MatrixCell | null> = {};
    for (const col of columns) {
      const tariff =
        inRow.find((t) => daysKey(t.daysOfWeek) === col.key) ??
        inRow.find((t) => isSuperset(normalizeDays(t.daysOfWeek), col.days));
      if (!tariff) {
        rowCells[col.key] = null;
        continue;
      }
      const note = validityNote(tariff);
      rowCells[col.key] = {
        price: tariff.price,
        unit: tariff.priceUnit,
        ...(note ? { note } : {}),
      };
    }
    cells[row.key] = rowCells;
  }

  return { columns, rows, cells };
}

/** Подпись тарифов для объединения VIP-комнат с одинаковыми ценами */
export function tariffSignature(tariffs: readonly TariffRow[]): string {
  return tariffs
    .map((t) => `${daysKey(t.daysOfWeek)}|${t.startMin}|${t.endMin}|${t.price}|${t.priceUnit}`)
    .sort()
    .join(";");
}

/** Тариф действует на дату `opDate` (YYYY-MM-DD) */
export function isTariffValidOn(
  t: Pick<TariffRow, "validFrom" | "validTo">,
  opDate: string
): boolean {
  return (!t.validFrom || t.validFrom <= opDate) && (!t.validTo || t.validTo >= opDate);
}
