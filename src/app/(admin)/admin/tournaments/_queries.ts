import "server-only";
import { and, asc, count, desc, eq, gte, ilike, lt, sql, type SQL } from "drizzle-orm";
import { toMediaDto, type MediaDto } from "@/lib/admin/media-dto";
import { getToday } from "@/lib/dates";
import { db } from "@/lib/db";
import { mediaAssets, tournamentSeries, tournaments, type Tournament } from "@/lib/schema";
import type { TournamentsWhen } from "./_lib/labels";

/** Строка списка турниров (сериализуемая — уходит в клиентскую таблицу) */
export type TournamentRow = {
  id: string;
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  seriesName: string | null;
  stageNumber: number | null;
  discipline: Tournament["discipline"];
  level: Tournament["level"];
  isPublished: boolean;
  registrationOpen: boolean;
};

export type SeriesOption = { id: string; name: string };

export type SeriesRow = {
  id: string;
  name: string;
  description: string | null;
  tournamentsCount: number;
};

/** `%` и `_` в поисковой строке — обычные символы, а не шаблоны LIKE */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export async function listTournaments(p: {
  when: TournamentsWhen;
  year?: number | undefined;
  q?: string | undefined;
}): Promise<TournamentRow[]> {
  const today = getToday();
  const conds: SQL[] = [];
  // «Предстоящие» по календарной дате: endDate >= сегодня (Екатеринбург)
  if (p.when === "upcoming") conds.push(gte(tournaments.endDate, today));
  if (p.when === "past") conds.push(lt(tournaments.endDate, today));
  if (p.year && p.when !== "upcoming") {
    conds.push(sql`extract(year from ${tournaments.startDate}) = ${p.year}`);
  }
  if (p.q) conds.push(ilike(tournaments.title, `%${escapeLike(p.q)}%`));

  const order =
    p.when === "past"
      ? [desc(tournaments.startDate), asc(tournaments.title)]
      : [asc(tournaments.startDate), asc(tournaments.title)];

  return db
    .select({
      id: tournaments.id,
      title: tournaments.title,
      slug: tournaments.slug,
      startDate: tournaments.startDate,
      endDate: tournaments.endDate,
      seriesName: tournamentSeries.name,
      stageNumber: tournaments.stageNumber,
      discipline: tournaments.discipline,
      level: tournaments.level,
      isPublished: tournaments.isPublished,
      registrationOpen: tournaments.registrationOpen,
    })
    .from(tournaments)
    .leftJoin(tournamentSeries, eq(tournaments.seriesId, tournamentSeries.id))
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(...order);
}

/** Годы, в которых есть турниры (по дате начала), от новых к старым */
export async function listTournamentYears(): Promise<number[]> {
  const year = sql<number>`extract(year from ${tournaments.startDate})::int`;
  const rows = await db.selectDistinct({ year }).from(tournaments).orderBy(desc(year));
  return rows.map((row) => Number(row.year));
}

export type TournamentWithCover = { tournament: Tournament; cover: MediaDto | null };

export async function getTournament(id: string): Promise<TournamentWithCover | null> {
  const [row] = await db
    .select({ tournament: tournaments, cover: mediaAssets })
    .from(tournaments)
    .leftJoin(mediaAssets, eq(tournaments.coverMediaId, mediaAssets.id))
    .where(eq(tournaments.id, id))
    .limit(1);
  if (!row) return null;
  return { tournament: row.tournament, cover: row.cover ? toMediaDto(row.cover) : null };
}

export async function listSeriesOptions(): Promise<SeriesOption[]> {
  return db
    .select({ id: tournamentSeries.id, name: tournamentSeries.name })
    .from(tournamentSeries)
    .orderBy(asc(tournamentSeries.sortOrder), asc(tournamentSeries.name));
}

export async function listSeriesWithCounts(): Promise<SeriesRow[]> {
  const rows = await db
    .select({
      id: tournamentSeries.id,
      name: tournamentSeries.name,
      description: tournamentSeries.description,
      tournamentsCount: count(tournaments.id),
    })
    .from(tournamentSeries)
    .leftJoin(tournaments, eq(tournaments.seriesId, tournamentSeries.id))
    .groupBy(tournamentSeries.id)
    .orderBy(asc(tournamentSeries.sortOrder), asc(tournamentSeries.name));
  return rows.map((row) => ({ ...row, tournamentsCount: Number(row.tournamentsCount) }));
}
