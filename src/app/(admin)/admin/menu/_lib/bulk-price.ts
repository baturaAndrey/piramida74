// Чистые функции массового изменения цен: общие для предпросмотра и применения на сервере.

export type BulkMode = { kind: "percent"; value: number } | { kind: "amount"; value: number };

/** Округление до ближайших 10 ₽ (125 → 130, 124 → 120) */
export const roundTo10 = (n: number) => Math.round(n / 10) * 10;

/** Нижняя граница новой цены: при округлении — 10 ₽, без него — 1 ₽ */
const MIN_PRICE_ROUNDED = 10;
const MIN_PRICE_EXACT = 1;

export function newPrice(old: number, mode: BulkMode, round: boolean): number {
  const raw = mode.kind === "percent" ? old * (1 + mode.value / 100) : old + mode.value;
  const v = round ? roundTo10(raw) : Math.round(raw);
  return Math.max(v, round ? MIN_PRICE_ROUNDED : MIN_PRICE_EXACT);
}

export type BulkSourceRow = {
  kind: "variant" | "tier";
  id: string;
  itemName: string;
  label: string;
  oldPrice: number;
};

export type BulkChangeRow = BulkSourceRow & { newPrice: number };

/** Применяет режим ко всем строкам и оставляет только те, где цена действительно меняется */
export function computeBulkChanges(
  rows: readonly BulkSourceRow[],
  mode: BulkMode,
  round: boolean
): BulkChangeRow[] {
  const changes: BulkChangeRow[] = [];
  for (const row of rows) {
    const next = newPrice(row.oldPrice, mode, round);
    if (next !== row.oldPrice) changes.push({ ...row, newPrice: next });
  }
  return changes;
}
