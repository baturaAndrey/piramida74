import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { LeadDialogTrigger } from "@/components/leads/lead-dialog";
import { Container } from "@/components/site/container";
import { PrimaryButton } from "@/components/site/primary-button";
import { Skeleton } from "@/components/ui/skeleton";
import { getOpDate } from "@/lib/dates";
import { getClientEnv } from "@/lib/env";
import {
  getExtraServices,
  getHalls,
  getPenalties,
  getTariffs,
  type PublicHall,
  type PublicTariff,
} from "@/lib/queries/pricing";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo/jsonld";
import { ExtrasTable } from "./_components/extras-table";
import { PenaltiesList } from "./_components/penalties-list";
import { TariffMatrix } from "./_components/tariff-matrix";
import { plural } from "./_lib/format";
import { buildMatrix, isTariffValidOn, tariffSignature } from "./_lib/matrix";
import type { Metadata } from "next";

const TITLE = "Цены на бильярд в Челябинске — прайс клуба «Пирамида»";
const DESCRIPTION =
  "Стоимость часа игры в русскую пирамиду и американский пул, VIP-комнаты, пенсионный тариф, прокат и штрафы";

export const metadata: Metadata = {
  // absolute: шаблон root layout добавил бы название клуба второй раз
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/prices" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Бильярдный клуб «Пирамида»",
    title: TITLE,
    description: DESCRIPTION,
    url: "/prices",
  },
};

export default function PricesPage() {
  const siteUrl = getClientEnv().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  const breadcrumbs = breadcrumbJsonLd([
    { label: "Главная", href: `${siteUrl}/` },
    { label: "Цены", href: `${siteUrl}/prices` },
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
            Цены
          </li>
        </ol>
      </nav>

      <h1 className="text-[clamp(26px,3.4vw,55px)] leading-tight font-bold">Цены на бильярд</h1>
      <p className="text-muted-foreground mt-4 max-w-3xl text-base md:text-lg">
        Стоимость часа игры. Время после полуночи относится к предыдущему дню: 02:00–09:00 в ночь с
        пятницы на субботу считается по тарифу пятницы.
      </p>

      <Suspense fallback={<PricesSkeleton />}>
        <PricesContent />
      </Suspense>

      <p className="text-subtle mt-10 text-sm">
        *Стоимость может отличаться от указанной. Точную стоимость уточняйте у администратора.
      </p>

      <section className="mt-8 flex flex-col items-start gap-5 rounded-[12px] bg-white p-6 md:flex-row md:items-center md:justify-between md:p-10">
        <div className="space-y-2">
          <h2 className="text-[clamp(22px,2.1vw,40px)] leading-tight font-semibold">
            Забронируйте стол заранее
          </h2>
          <p className="text-subtle text-sm md:text-base">
            Администратор перезвонит и подтвердит бронь.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
          <LeadDialogTrigger kind="booking" block="Прайс" formTitle="Бронирование стола" asChild>
            <PrimaryButton>Забронировать стол</PrimaryButton>
          </LeadDialogTrigger>
          <Link
            href="/calculator"
            className="text-primary hover:text-primary-dark link-underline rounded-sm font-semibold transition-colors"
          >
            Рассчитать стоимость вечера
          </Link>
        </div>
      </section>
    </Container>
  );
}

/** Карточка тарифов: один зал либо несколько залов с одинаковыми тарифами */
type TariffGroup = {
  key: string;
  title: string;
  halls: PublicHall[];
  tariffs: PublicTariff[];
};

/**
 * Группирует тарифы по залам; залы с одинаковой «подписью» тарифов объединяются
 * (VIP-комнаты с одинаковыми ценами — одна таблица).
 */
function groupHalls(
  halls: PublicHall[],
  tariffs: PublicTariff[],
  merge: boolean
): { halls: PublicHall[]; tariffs: PublicTariff[] }[] {
  const groups = new Map<string, { halls: PublicHall[]; tariffs: PublicTariff[] }>();
  for (const hall of halls) {
    const own = tariffs.filter((t) => t.hallId === hall.id);
    if (own.length === 0) continue;
    const key = merge ? tariffSignature(own) : hall.id;
    const existing = groups.get(key);
    if (existing) existing.halls.push(hall);
    else groups.set(key, { halls: [hall], tariffs: own });
  }
  return [...groups.values()];
}

/**
 * «12 столов · 4 места за столом»; для объединённых комнат с одинаковой вместимостью —
 * «В каждой комнате: 1 стол · 4 места за столом» (сумма столов по комнатам вводила бы в заблуждение).
 */
function capacityLine(halls: PublicHall[]): string | null {
  const [first] = halls;
  if (!first) return null;
  const sameCapacity = halls.every(
    (h) => h.tablesCount === first.tablesCount && h.seatsPerTable === first.seatsPerTable
  );
  const tables =
    halls.length > 1 && sameCapacity
      ? first.tablesCount
      : halls.reduce((sum, h) => sum + h.tablesCount, 0);
  if (tables <= 0) return null;
  const parts = [`${tables} ${plural(tables, ["стол", "стола", "столов"])}`];
  const seats = first.seatsPerTable;
  if (seats > 0 && halls.every((h) => h.seatsPerTable === seats)) {
    parts.push(`${seats} ${plural(seats, ["место", "места", "мест"])} за столом`);
  }
  const line = parts.join(" · ");
  return halls.length > 1 && sameCapacity ? `В каждой комнате: ${line}` : line;
}

function vipTitle(halls: PublicHall[]): string {
  const [first] = halls;
  if (halls.length === 1 && first) return first.name;
  return `VIP-комнаты (${halls.map((h) => h.name).join(", ")})`;
}

async function PricesContent() {
  await connection();
  const opDate = getOpDate();
  const [halls, tariffs, extras, penalties] = await Promise.all([
    getHalls(),
    getTariffs(),
    getExtraServices(),
    getPenalties(),
  ]);

  // getTariffs отдаёт только активные; срок действия проверяем на операционную дату
  const valid = tariffs.filter((t) => isTariffValidOn(t, opDate));
  const regular = valid.filter((t) => t.audience === "all");
  const pensioner = valid.filter((t) => t.audience === "pensioner");

  const commonHalls = halls.filter((h) => h.kind === "common");
  const vipHalls = halls.filter((h) => h.kind === "vip");

  const rentalGroups: TariffGroup[] = [
    ...groupHalls(commonHalls, regular, false).map((g) => ({
      ...g,
      key: `common-${g.halls[0]?.id}`,
      title: g.halls.map((h) => h.name).join(", "),
    })),
    ...groupHalls(vipHalls, regular, true).map((g) => ({
      ...g,
      key: `vip-${g.halls.map((h) => h.id).join("-")}`,
      title: vipTitle(g.halls),
    })),
  ];
  const pensionerGroups = groupHalls(halls, pensioner, true);

  return (
    <div className="mt-8 space-y-12 md:mt-12">
      <section aria-labelledby="rental-title" className="space-y-6">
        <h2 id="rental-title" className="text-[clamp(22px,2.1vw,40px)] leading-tight font-semibold">
          Аренда столов
        </h2>
        {rentalGroups.length === 0 ? (
          <p className="text-muted-foreground rounded-[12px] bg-white p-6">
            Цены уточняйте у администратора.
          </p>
        ) : null}
        {rentalGroups.map((group) => {
          const description = group.halls.length === 1 ? group.halls[0]?.description : null;
          const capacity = capacityLine(group.halls);
          return (
            <article key={group.key} className="rounded-[12px] bg-white p-4 md:p-6">
              <div className="mb-4 space-y-1">
                <h3 className="text-xl font-semibold md:text-2xl">{group.title}</h3>
                {description ? (
                  <p className="text-subtle text-sm md:text-base">{description}</p>
                ) : null}
                {capacity ? <p className="text-subtle text-sm">{capacity}</p> : null}
              </div>
              <TariffMatrix
                matrix={buildMatrix(group.tariffs)}
                caption={`Стоимость часа игры: ${group.title}`}
              />
            </article>
          );
        })}

        {pensionerGroups.length > 0 ? (
          <article className="rounded-[12px] bg-white p-4 md:p-6">
            <div className="mb-4 space-y-1">
              <h3 className="text-xl font-semibold md:text-2xl">Пенсионный тариф</h3>
              <p className="text-subtle text-sm md:text-base">для гостей пенсионного возраста</p>
            </div>
            <div className="space-y-6">
              {pensionerGroups.map((group) => {
                const names = group.halls.map((h) => h.name).join(", ");
                return (
                  <div key={group.halls.map((h) => h.id).join("-")}>
                    {pensionerGroups.length > 1 ? (
                      <p className="mb-2 font-semibold">{names}</p>
                    ) : null}
                    <TariffMatrix
                      matrix={buildMatrix(group.tariffs)}
                      caption={`Пенсионный тариф: ${names}`}
                    />
                  </div>
                );
              })}
            </div>
          </article>
        ) : null}
      </section>

      {extras.length > 0 ? (
        <section aria-labelledby="extras-title" className="space-y-6">
          <h2
            id="extras-title"
            className="text-[clamp(22px,2.1vw,40px)] leading-tight font-semibold"
          >
            Дополнительные услуги
          </h2>
          <div className="rounded-[12px] bg-white p-4 md:p-6">
            <ExtrasTable services={extras} />
          </div>
        </section>
      ) : null}

      {penalties.length > 0 ? (
        <section aria-labelledby="penalties-title" className="space-y-6">
          <h2
            id="penalties-title"
            className="text-[clamp(22px,2.1vw,40px)] leading-tight font-semibold"
          >
            Штрафы
          </h2>
          <PenaltiesList penalties={penalties} />
        </section>
      ) : null}
    </div>
  );
}

function PricesSkeleton() {
  return (
    <div className="mt-8 space-y-6 md:mt-12" aria-busy="true">
      <Skeleton className="h-10 w-1/3 rounded-[12px]" />
      <Skeleton className="h-[300px] rounded-[12px]" />
      <Skeleton className="h-[240px] rounded-[12px]" />
      <Skeleton className="h-[160px] rounded-[12px]" />
      <Skeleton className="h-10 w-1/4 rounded-[12px]" />
      <Skeleton className="h-[180px] rounded-[12px]" />
    </div>
  );
}
