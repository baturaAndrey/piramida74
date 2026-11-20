import type { Discipline, TournamentLevel } from "@/lib/schema/enums";

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  free_pyramid: "Свободная пирамида",
  combined_pyramid: "Комбинированная пирамида",
  dynamic_pyramid: "Динамичная пирамида",
  moscow_pyramid: "Московская пирамида",
  free_pyramid_continuation: "Свободная пирамида с продолжением",
  pool: "Американский пул",
  other: "Другое",
};

export const LEVEL_LABELS: Record<TournamentLevel, string> = {
  regional_championship: "Чемпионат области",
  regional_youth: "Первенство области",
  club: "Клубный турнир",
  other: "Другое",
};

/** Порядок дисциплин в фильтре — как в enum */
export const DISCIPLINES = Object.keys(DISCIPLINE_LABELS) as Discipline[];

export function isDiscipline(value: unknown): value is Discipline {
  return typeof value === "string" && Object.hasOwn(DISCIPLINE_LABELS, value);
}
