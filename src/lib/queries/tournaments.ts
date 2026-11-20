import { cacheLife, cacheTag } from "next/cache";
import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { tournamentSeries, tournaments } from "@/lib/schema";
import type { Discipline, TournamentLevel } from "@/lib/schema/enums";
import { withCovers, type PublicMedia } from "./types";

export type PublicTournament = {
  id: string;
  slug: string;
  title: string;
  seriesName: string | null;
  seriesSlug: string | null;
  stageNumber: number | null;
  discipline: Discipline | null;
  level: TournamentLevel;
  categories: string[];
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  /** ₽ */
  entryFee: number | null;
  /** ₽ */
  prizeFund: number | null;
  description: string | null;
  registrationOpen: boolean;
  cover: PublicMedia | null;
};

export type PublicTournamentSeries = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tournamentsCount: number;
};

const tournamentColumns = {
  id: tournaments.id,
  slug: tournaments.slug,
  title: tournaments.title,
  seriesName: tournamentSeries.name,
  seriesSlug: tournamentSeries.slug,
  stageNumber: tournaments.stageNumber,
  discipline: tournaments.discipline,
  level: tournaments.level,
  categories: tournaments.categories,
  startDate: tournaments.startDate,
  endDate: tournaments.endDate,
  entryFee: tournaments.entryFee,
  prizeFund: tournaments.prizeFund,
  description: tournaments.description,
  registrationOpen: tournaments.registrationOpen,
  coverMediaId: tournaments.coverMediaId,
};

function selectTournaments() {
  return db
    .select(tournamentColumns)
    .from(tournaments)
    .leftJoin(tournamentSeries, eq(tournaments.seriesId, tournamentSeries.id));
}

/**
 * Предстоящие и идущие турниры: `isPublished AND endDate >= opDate`.
 * `opDate` — операционная дата `getOpDate()` (до 09:00 — вчера), поэтому турнир виден
 * до 09:00 дня после окончания — намеренно (решение 17 в contracts.md).
 * Вызывать после `await connection()` внутри `<Suspense>`.
 */
export async function getUpcomingTournaments(
  opDate: string,
  limit = 5
): Promise<PublicTournament[]> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.tournaments);
  const rows = await selectTournaments()
    .where(and(eq(tournaments.isPublished, true), gte(tournaments.endDate, opDate)))
    .orderBy(asc(tournaments.startDate), asc(tournaments.endDate))
    .limit(limit);
  return withCovers(rows);
}

/**
 * Опубликованные турниры, начинающиеся в указанном году, по дате начала.
 * Вызывать после `await connection()` внутри `<Suspense>`.
 */
export async function getSeasonTournaments(year: number): Promise<PublicTournament[]> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.tournaments);
  const rows = await selectTournaments()
    .where(
      and(
        eq(tournaments.isPublished, true),
        gte(tournaments.startDate, `${year}-01-01`),
        lte(tournaments.startDate, `${year}-12-31`)
      )
    )
    .orderBy(asc(tournaments.startDate), asc(tournaments.endDate));
  return withCovers(rows);
}

/**
 * Активные серии турниров с числом опубликованных турниров.
 * Вызывать после `await connection()` внутри `<Suspense>`.
 */
export async function getTournamentSeries(): Promise<PublicTournamentSeries[]> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.tournaments);
  const rows = await db
    .select({
      id: tournamentSeries.id,
      slug: tournamentSeries.slug,
      name: tournamentSeries.name,
      description: tournamentSeries.description,
      tournamentsCount: count(tournaments.id),
    })
    .from(tournamentSeries)
    .leftJoin(
      tournaments,
      and(eq(tournaments.seriesId, tournamentSeries.id), eq(tournaments.isPublished, true))
    )
    .where(eq(tournamentSeries.isActive, true))
    .groupBy(tournamentSeries.id)
    .orderBy(asc(tournamentSeries.sortOrder), asc(tournamentSeries.name));
  return rows.map((r) => ({ ...r, tournamentsCount: Number(r.tournamentsCount) }));
}

/**
 * Годы (по `startDate`) опубликованных турниров, по убыванию — для архива `/tournaments`.
 * Вызывать после `await connection()` внутри `<Suspense>`.
 */
export async function getTournamentYears(): Promise<number[]> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.tournaments);
  const yearExpr = sql<number>`extract(year from ${tournaments.startDate})::int`;
  const rows = await db
    .selectDistinct({ year: yearExpr })
    .from(tournaments)
    .where(eq(tournaments.isPublished, true))
    .orderBy(desc(yearExpr));
  return rows.map((r) => Number(r.year));
}
