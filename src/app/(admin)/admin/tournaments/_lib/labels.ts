// Изоморфный модуль: подписи и константы раздела «Турниры» (без серверных импортов).
import type { Discipline, TournamentLevel } from "@/lib/schema/enums";

export const DISCIPLINES = [
  "free_pyramid",
  "combined_pyramid",
  "dynamic_pyramid",
  "moscow_pyramid",
  "free_pyramid_continuation",
  "pool",
  "other",
] as const satisfies readonly Discipline[];

export const LEVELS = [
  "regional_championship",
  "regional_youth",
  "club",
  "other",
] as const satisfies readonly TournamentLevel[];

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
  regional_youth: "Первенство области (юноши)",
  club: "Клубный турнир",
  other: "Другое",
};

/** Быстрый выбор категорий участников; произвольные добавляются вручную */
export const CATEGORY_PRESETS = [
  "Мужчины",
  "Женщины",
  "до 13",
  "до 16",
  "до 19",
  "60+",
  "Сеньоры",
  "Команды",
] as const;

export const MAX_CATEGORIES = 12;
export const MAX_CATEGORY_LENGTH = 40;
export const MAX_DESCRIPTION_LENGTH = 600;

export const WHEN_OPTIONS = [
  { value: "upcoming", label: "Предстоящие" },
  { value: "past", label: "Прошедшие" },
  { value: "all", label: "Все" },
] as const;

export type TournamentsWhen = (typeof WHEN_OPTIONS)[number]["value"];

export function parseWhen(value: string | undefined): TournamentsWhen {
  return value === "past" || value === "all" ? value : "upcoming";
}

/** «Марафон 3 тур» → «Марафон 4 тур»; без номера тура название не меняется */
export function nextStageTitle(title: string): string {
  return title.replace(/(\d+)(\s*тур)/i, (_match, num: string, rest: string) => {
    return `${Number(num) + 1}${rest}`;
  });
}
