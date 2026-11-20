/**
 * Календарь турниров 2026 (раздел 1 res-transcription.md).
 * «Ч.О.» → «Чемпионат области», «П.О.» → «Первенство области» (интерпретация, см. транскрипцию).
 * slug турнира строится в seed.ts: slugify(title) + "-" + startDate.
 */
import type { SeedTournament, SeedTournamentSeries } from "./types";

const MARATHON = "marafon-promneftegaz";
const SENIORS = "senyory-chelyabinska";

export const SEED_TOURNAMENT_SERIES: SeedTournamentSeries[] = [
  {
    slug: MARATHON,
    name: "Марафон-Промнефтегаз",
    description: "Серия клубных турниров по свободной пирамиде из 12 туров в течение сезона.",
  },
  {
    slug: SENIORS,
    name: "Сеньоры Челябинска",
    description:
      "Серия клубных турниров для игроков категории «Сеньоры» из 8 туров в течение сезона.",
  },
];

const MEN_WOMEN = ["Мужчины", "Женщины"];
const YOUTH = ["До 13 лет", "До 16 лет", "До 19 лет"];
const SENIORS_CAT = ["Сеньоры"];

const marathon = (stage: number, startDate: string, endDate: string): SeedTournament => ({
  title: `Марафон-Промнефтегаз, ${stage} тур (свободная пирамида)`,
  startDate,
  endDate,
  series: { slug: MARATHON, stage },
  discipline: "free_pyramid",
  level: "club",
  categories: [],
});

// Дисциплина у «Сеньоров» в источнике не указана — null
const seniors = (stage: number, startDate: string, endDate: string): SeedTournament => ({
  title: `Сеньоры Челябинска, ${stage} тур`,
  startDate,
  endDate,
  series: { slug: SENIORS, stage },
  discipline: null,
  level: "club",
  categories: SENIORS_CAT,
});

export const SEED_TOURNAMENTS: SeedTournament[] = [
  {
    title: "Чемпионат области. Комбинированная пирамида",
    startDate: "2026-01-17",
    endDate: "2026-01-18",
    discipline: "combined_pyramid",
    level: "regional_championship",
    categories: MEN_WOMEN,
  },
  // В источнике в названии продублирована дата «24–25» — опечатка макета, в title не переносится
  marathon(1, "2026-01-24", "2026-01-25"),
  seniors(1, "2026-02-07", "2026-02-08"),
  marathon(2, "2026-02-21", "2026-02-22"),
  {
    title: "Мисс бильярд (свободная пирамида)",
    startDate: "2026-03-08",
    endDate: "2026-03-08",
    discipline: "free_pyramid",
    level: "club",
    // Категория «Женщины» выведена по смыслу названия [?]
    categories: ["Женщины"],
  },
  seniors(2, "2026-03-14", "2026-03-15"),
  marathon(3, "2026-03-29", "2026-03-30"),
  {
    title: "Чемпионат области. Свободная пирамида с продолжением",
    startDate: "2026-04-04",
    endDate: "2026-04-05",
    discipline: "free_pyramid_continuation",
    level: "regional_championship",
    categories: MEN_WOMEN,
  },
  seniors(3, "2026-04-11", "2026-04-12"),
  {
    title: "Чемпионат области. Свободная пирамида",
    startDate: "2026-04-18",
    endDate: "2026-04-19",
    discipline: "free_pyramid",
    level: "regional_championship",
    categories: MEN_WOMEN,
  },
  marathon(4, "2026-04-25", "2026-04-26"),
  {
    title: "День Победы. Ветераны 60+ (московская пирамида)",
    startDate: "2026-05-09",
    endDate: "2026-05-10",
    discipline: "moscow_pyramid",
    level: "club",
    categories: ["Ветераны 60+"],
  },
  seniors(4, "2026-05-16", "2026-05-17"),
  marathon(5, "2026-05-30", "2026-05-31"),
  marathon(6, "2026-06-27", "2026-06-28"),
  {
    title: "Командные соревнования",
    startDate: "2026-07-11",
    endDate: "2026-07-12",
    discipline: null,
    level: "club",
    categories: ["Мужчины", "Женщины", "Команды"],
  },
  marathon(7, "2026-07-25", "2026-07-26"),
  seniors(5, "2026-08-22", "2026-08-23"),
  marathon(8, "2026-08-29", "2026-08-30"),
  {
    title: "Первенство области. Динамичная пирамида",
    startDate: "2026-09-05",
    endDate: "2026-09-06",
    discipline: "dynamic_pyramid",
    level: "regional_youth",
    categories: YOUTH,
  },
  {
    title: "День города. Комбинированная пирамида",
    startDate: "2026-09-12",
    endDate: "2026-09-13",
    discipline: "combined_pyramid",
    level: "club",
    categories: [],
  },
  {
    title: "Чемпионат области. Динамичная пирамида",
    startDate: "2026-09-19",
    endDate: "2026-09-20",
    discipline: "dynamic_pyramid",
    level: "regional_championship",
    categories: MEN_WOMEN,
  },
  marathon(9, "2026-09-26", "2026-09-27"),
  seniors(6, "2026-10-03", "2026-10-04"),
  marathon(10, "2026-10-24", "2026-10-25"),
  {
    title: "Первенство области. Свободная пирамида",
    startDate: "2026-11-07",
    endDate: "2026-11-08",
    discipline: "free_pyramid",
    level: "regional_youth",
    categories: YOUTH,
  },
  seniors(7, "2026-11-14", "2026-11-15"),
  marathon(11, "2026-11-28", "2026-11-29"),
  seniors(8, "2026-12-12", "2026-12-13"),
  marathon(12, "2026-12-26", "2026-12-27"),
];
