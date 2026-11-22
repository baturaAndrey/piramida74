import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { LeadDialogTrigger } from "@/components/leads/lead-dialog";
import { Container } from "@/components/site/container";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getOpDate } from "@/lib/dates";
import { getClientEnv } from "@/lib/env";
import { mediaUrl } from "@/lib/media/url";
import { getSettings } from "@/lib/queries/settings";
import { getSeasonTournaments, type PublicTournament } from "@/lib/queries/tournaments";
import { breadcrumbJsonLd, jsonLdScript, sportsEventJsonLd } from "@/lib/seo/jsonld";
import type { SiteSettings } from "@/lib/settings-defaults";
import { cn } from "@/lib/utils";
import { PastTournaments } from "./_components/past-tournaments";
import { TournamentCard } from "./_components/tournament-card";
import { TournamentFilters, tournamentsHref } from "./_components/tournament-filters";
import {
  applyFilters,
  filterOptions,
  groupByMonth,
  parseFilters,
  splitByDate,
  type RawSearchParams,
} from "./_lib/group";
import { DISCIPLINE_LABELS } from "./_lib/labels";
import type { Metadata } from "next";

const TITLE = "Календарь турниров по бильярду в Челябинске — «Пирамида»";
const DESCRIPTION =
  "Расписание соревнований по русскому бильярду: чемпионаты и первенства области, «Марафон-Промнефтегаз», «Сеньоры Челябинска»";
const CLUB_NAME = "Бильярдный клуб «Пирамида»";
/** Не больше 30 событий в JSON-LD */
const MAX_EVENTS_JSONLD = 30;
const COVER_JSONLD_WIDTH = 1280;

export const metadata: Metadata = {
  // absolute: шаблон root layout добавил бы название клуба второй раз
  title: { absolute: TITLE },
  description: DESCRIPTION,
  // Фильтры в searchParams не индексируются отдельно
  alternates: { canonical: "/tournaments" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: CLUB_NAME,
    title: TITLE,
    description: DESCRIPTION,
    url: "/tournaments",
  },
};

type PageProps = { searchParams: Promise<RawSearchParams> };

export default function TournamentsPage({ searchParams }: PageProps) {
  const siteUrl = getClientEnv().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  const breadcrumbs = breadcrumbJsonLd([
    { label: "Главная", href: `${siteUrl}/` },
    { label: "Турниры", href: `${siteUrl}/tournaments` },
  ]);

  return (
    <Container className="py-8 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbs) }}
      />
      <nav aria-label="Хлебные крошки" className="text-muted-foreground mb-4 text-sm">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-foreground rounded-sm transition-colors">
              Главная
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">
            Турниры
          </li>
        </ol>
      </nav>

      <Suspense fallback={<TournamentsSkeleton />}>
        <TournamentsContent searchParams={searchParams} siteUrl={siteUrl} />
      </Suspense>

      <section className="bg-primary mt-12 flex flex-col items-start gap-5 rounded-[12px] p-6 text-white md:flex-row md:items-center md:justify-between md:p-10">
        <div className="space-y-2">
          <h2 className="text-[clamp(22px,2.1vw,40px)] leading-tight font-semibold">
            Хотите участвовать или узнать детали?
          </h2>
          <p className="text-sm text-white/80 md:text-base">
            Оставьте телефон — расскажем о календарном плане, взносах и регламенте.
          </p>
        </div>
        <LeadDialogTrigger
          kind="callback"
          block="Календарный план"
          formTitle="Календарный план турниров"
          asChild
        >
          <Button variant="secondary" size="lg" className="h-12 px-8 text-base font-bold">
            Узнать подробнее
          </Button>
        </LeadDialogTrigger>
      </section>
    </Container>
  );
}

/** «г. Челябинск, Орджоникидзе 58а к3» → город и улица для PostalAddress */
function splitAddress(address: string): { city: string; street: string } {
  const match = /^\s*г\.\s*([^,]+?)\s*,\s*(.+)$/u.exec(address);
  return match?.[1] && match[2]
    ? { city: match[1], street: match[2] }
    : { city: "Челябинск", street: address };
}

function eventsJsonLd(list: PublicTournament[], settings: SiteSettings, siteUrl: string) {
  const { city, street } = splitAddress(settings.address);
  return list.slice(0, MAX_EVENTS_JSONLD).map((t) => {
    const image = t.cover ? mediaUrl(t.cover, COVER_JSONLD_WIDTH) : "";
    return sportsEventJsonLd({
      name: t.title,
      url: `${siteUrl}/tournaments`,
      startDate: t.startDate,
      endDate: t.endDate,
      ...(t.description ? { description: t.description } : {}),
      ...(image ? { image: `${siteUrl}${image}` } : {}),
      ...(t.discipline ? { sport: DISCIPLINE_LABELS[t.discipline] } : {}),
      entryFee: t.entryFee,
      location: { name: CLUB_NAME, street, city },
      organizer: { name: CLUB_NAME, url: siteUrl },
    });
  });
}

const YEAR_CHIP =
  "inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-semibold tabular-nums transition-colors focus-visible:ring-ring/50 focus-visible:ring-[3px]";

async function TournamentsContent({ searchParams, siteUrl }: PageProps & { siteUrl: string }) {
  await connection();
  const opDate = getOpDate();
  const filters = parseFilters(await searchParams, opDate);
  const defaultYear = Number(opDate.slice(0, 4));

  const [season, settings] = await Promise.all([getSeasonTournaments(filters.year), getSettings()]);

  const options = filterOptions(season);
  const { upcoming: allUpcoming } = splitByDate(season, opDate);
  const { upcoming, past } = splitByDate(applyFilters(season, filters), opDate);
  const months = groupByMonth(upcoming);
  const hasFilters = filters.discipline !== null || filters.category !== null;
  const resetHref = tournamentsHref(filters, defaultYear, { discipline: null, category: null });

  return (
    <>
      {allUpcoming.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript(eventsJsonLd(allUpcoming, settings, siteUrl)),
          }}
        />
      ) : null}

      <h1 className="text-[clamp(26px,3.4vw,55px)] leading-tight font-bold">
        Календарь турниров {filters.year}
      </h1>
      <p className="text-muted-foreground mt-4 max-w-3xl text-base md:text-lg">
        Соревнования по бильярдному спорту в Челябинске. Взнос и призовой фонд уточняйте в описании
        турнира или у администратора
      </p>

      <nav aria-label="Год" className="mt-6 flex flex-wrap gap-2">
        {[filters.year - 1, filters.year, filters.year + 1].map((year) => {
          const active = year === filters.year;
          return (
            <Link
              key={year}
              href={year === defaultYear ? "/tournaments" : `/tournaments?year=${year}`}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                YEAR_CHIP,
                active
                  ? "bg-primary border-primary text-white"
                  : "hover:text-foreground bg-white text-[#8E8E8E]"
              )}
            >
              {year}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6">
        <TournamentFilters
          filters={filters}
          defaultYear={defaultYear}
          disciplines={options.disciplines}
          categories={options.categories}
        />
      </div>

      <div className="mt-10 space-y-10">
        {months.length === 0 ? (
          <div className="rounded-[12px] bg-white p-6 text-center md:p-10">
            {hasFilters ? (
              <>
                <p className="text-lg font-semibold">
                  По выбранным фильтрам предстоящих турниров нет
                </p>
                <Link
                  href={resetHref}
                  scroll={false}
                  className="text-primary hover:text-primary-dark mt-3 inline-block rounded-sm font-semibold underline-offset-4 hover:underline"
                >
                  Сбросить фильтры
                </Link>
              </>
            ) : (
              <p className="text-lg font-semibold">
                В {filters.year} году запланированных турниров больше нет
              </p>
            )}
          </div>
        ) : null}

        {months.map((month) => (
          <section key={month.monthKey} aria-labelledby={`month-${month.monthKey}`}>
            <h2 id={`month-${month.monthKey}`} className="mb-5 text-2xl font-semibold">
              {month.title}
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {month.items.map((t) => (
                <TournamentCard key={t.id} tournament={t} upcoming />
              ))}
            </div>
          </section>
        ))}

        <PastTournaments tournaments={past} open={filters.past} />
      </div>
    </>
  );
}

function TournamentsSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="h-[clamp(34px,4.4vw,72px)] w-2/3 rounded-[12px]" />
      <Skeleton className="mt-4 h-12 max-w-3xl rounded-[12px]" />
      <div className="mt-6 flex gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-full" />
        ))}
      </div>
      <Skeleton className="mt-6 h-20 rounded-[12px]" />
      <Skeleton className="mt-10 h-8 w-48 rounded-[12px]" />
      <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Skeleton className="h-[420px] rounded-[12px]" />
        <Skeleton className="h-[420px] rounded-[12px]" />
      </div>
    </div>
  );
}
