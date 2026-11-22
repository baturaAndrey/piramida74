/**
 * Анализ тарифов аренды: пересечения (запрещены) и «дыры» (допустимы, но показываются).
 * Чистые функции без зависимостей от БД и React — используются и на сервере, и в тестах.
 *
 * Время — минуты от 09:00 операционных суток, интервалы полуоткрытые `[startMin, endMin)`.
 */

/** Полные операционные сутки в минутах */
export const OP_DAY_MINUTES = 1440;

const MIN_DATE = "0000-00-00";
const MAX_DATE = "9999-99-99";

export type TariffLike = {
  id?: string;
  hallId: string;
  daysOfWeek: number[];
  startMin: number;
  endMin: number;
  audience: "all" | "pensioner";
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
};

export type Overlap<T extends TariffLike = TariffLike> = { a: T; b: T; days: number[] };
export type Hole = { hallId: string; days: number[]; fromMin: number; toMin: number };

const validityIntersects = (a: TariffLike, b: TariffLike) =>
  (a.validFrom ?? MIN_DATE) <= (b.validTo ?? MAX_DATE) &&
  (b.validFrom ?? MIN_DATE) <= (a.validTo ?? MAX_DATE);

/** Тариф действует на дату `today` (ISO-строки сравниваются лексикографически) */
const isValidOn = (t: TariffLike, today: string) =>
  (t.validFrom ?? MIN_DATE) <= today && today <= (t.validTo ?? MAX_DATE);

/**
 * Пересечения внутри одного зала и одной аудитории (all и pensioner проверяются отдельно друг от друга).
 * Учитываются только активные тарифы с пересекающимися периодами действия.
 */
export function findOverlaps<T extends TariffLike>(tariffs: T[]): Overlap<T>[] {
  const active = tariffs.filter((t) => t.isActive);
  const result: Overlap<T>[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!;
      const b = active[j]!;
      if (a.hallId !== b.hallId || a.audience !== b.audience) continue;
      if (!validityIntersects(a, b)) continue;
      // Полуоткрытые интервалы [start, end): касание границ пересечением не считается
      if (!(a.startMin < b.endMin && b.startMin < a.endMin)) continue;
      const days = a.daysOfWeek.filter((d) => b.daysOfWeek.includes(d));
      if (days.length > 0) result.push({ a, b, days });
    }
  }
  return result;
}

type Gap = { fromMin: number; toMin: number };

/** Зазоры в покрытии `[0, OP_DAY_MINUTES)` набором интервалов (интервалы могут пересекаться) */
function findGaps(intervals: Gap[]): Gap[] {
  const sorted = [...intervals].sort((x, y) => x.fromMin - y.fromMin || x.toMin - y.toMin);
  const gaps: Gap[] = [];
  let cursor = 0;
  for (const interval of sorted) {
    if (interval.fromMin > cursor) gaps.push({ fromMin: cursor, toMin: interval.fromMin });
    cursor = Math.max(cursor, interval.toMin);
    if (cursor >= OP_DAY_MINUTES) break;
  }
  if (cursor < OP_DAY_MINUTES) gaps.push({ fromMin: cursor, toMin: OP_DAY_MINUTES });
  return gaps;
}

const gapsKey = (gaps: Gap[]) => gaps.map((g) => `${g.fromMin}-${g.toMin}`).join(",");

/**
 * «Дыры» 0..1440 для audience='all' по каждому залу и дню; учитываются только активные тарифы,
 * действующие на дату `today`. Пенсионные тарифы не учитываются. Тариф с `fixed`-ценой покрывает
 * время так же, как почасовой. Дни с одинаковым набором дыр объединяются в одну запись.
 */
export function findHoles(tariffs: TariffLike[], hallIds: string[], today: string): Hole[] {
  const relevant = tariffs.filter((t) => t.isActive && t.audience === "all" && isValidOn(t, today));
  const holes: Hole[] = [];

  for (const hallId of hallIds) {
    const hallTariffs = relevant.filter((t) => t.hallId === hallId);
    // Ключ — набор дыр дня; Map сохраняет порядок первого появления (дни 0..6)
    const bySignature = new Map<string, { gaps: Gap[]; days: number[] }>();

    for (let day = 0; day < 7; day++) {
      const gaps = findGaps(
        hallTariffs
          .filter((t) => t.daysOfWeek.includes(day))
          .map((t) => ({ fromMin: t.startMin, toMin: t.endMin }))
      );
      if (gaps.length === 0) continue;
      const key = gapsKey(gaps);
      const group = bySignature.get(key);
      if (group) group.days.push(day);
      else bySignature.set(key, { gaps, days: [day] });
    }

    for (const { gaps, days } of bySignature.values()) {
      for (const gap of gaps) holes.push({ hallId, days: [...days], ...gap });
    }
  }
  return holes;
}

export type TariffAnalysis<T extends TariffLike = TariffLike> = {
  overlaps: Overlap<T>[];
  holes: Hole[];
};

export function analyzeTariffs<T extends TariffLike>(
  all: T[],
  activeHallIds: string[],
  today: string
): TariffAnalysis<T> {
  return { overlaps: findOverlaps(all), holes: findHoles(all, activeHallIds, today) };
}
