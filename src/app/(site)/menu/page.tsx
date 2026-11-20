import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ShoppingBag } from "lucide-react";
import { LeadDialogTrigger } from "@/components/leads/lead-dialog";
import { Container } from "@/components/site/container";
import { PrimaryButton } from "@/components/site/primary-button";
import { Skeleton } from "@/components/ui/skeleton";
import { getClientEnv } from "@/lib/env";
import { getMenuTree } from "@/lib/queries/menu";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo/jsonld";
import { MenuCatalog } from "./_components/menu-catalog";
import { menuJsonLd } from "./_lib/menu-jsonld";
import type { Metadata } from "next";

const TITLE = "Меню бильярдного клуба «Пирамида» в Челябинске — кухня и бар";
const DESCRIPTION =
  "Холодные и горячие закуски, пицца, паста, десерты, чай, кофе, пиво, коктейли и крепкие напитки. Цены и составы блюд";

export const metadata: Metadata = {
  // absolute: шаблон root layout добавил бы название клуба второй раз
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/menu" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Бильярдный клуб «Пирамида»",
    title: TITLE,
    description: DESCRIPTION,
    url: "/menu",
  },
};

export default function MenuPage() {
  const siteUrl = getClientEnv().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  const breadcrumbs = breadcrumbJsonLd([
    { label: "Главная", href: `${siteUrl}/` },
    { label: "Меню", href: `${siteUrl}/menu` },
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
            Меню
          </li>
        </ol>
      </nav>

      <h1 className="text-[clamp(26px,3.4vw,55px)] leading-tight font-bold">Меню</h1>
      <p className="text-muted-foreground mt-4 max-w-3xl text-base md:text-lg">
        Авторская кухня и бар клуба «Пирамида»: закуски, горячие блюда, пицца, десерты, чай и кофе,
        пиво, коктейли и крепкие напитки.
      </p>
      <p className="bg-primary/10 text-primary mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
        <ShoppingBag className="size-4 shrink-0" aria-hidden="true" />
        При заказе любого блюда на вынос скидка 10%
      </p>

      <Suspense fallback={<MenuSkeleton />}>
        <MenuContent siteUrl={siteUrl} />
      </Suspense>

      <section className="mt-12 flex flex-col items-start gap-5 rounded-[12px] bg-white p-6 md:flex-row md:items-center md:justify-between md:p-10">
        <div className="space-y-2">
          <h2 className="text-[clamp(22px,2.1vw,40px)] leading-tight font-semibold">
            Ждём вас в «Пирамиде»
          </h2>
          <p className="text-subtle text-sm md:text-base">
            Забронируйте стол — блюда и напитки подадут прямо к игре.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
          <LeadDialogTrigger kind="booking" block="Меню" formTitle="Бронирование стола" asChild>
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

async function MenuContent({ siteUrl }: { siteUrl: string }) {
  await connection();
  const tree = await getMenuTree();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(menuJsonLd(tree, siteUrl)) }}
      />
      <MenuCatalog categories={tree.categories} modifiers={tree.modifiers} />
    </>
  );
}

function MenuSkeleton() {
  return (
    <div className="mt-8 lg:flex lg:items-start lg:gap-10" aria-busy="true">
      <div className="hidden w-[260px] shrink-0 space-y-2 lg:block">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="h-9 rounded-[12px]" />
        ))}
      </div>
      <div className="min-w-0 flex-1 space-y-6">
        <Skeleton className="h-12 rounded-[12px]" />
        <Skeleton className="h-10 w-1/3 rounded-[12px]" />
        <Skeleton className="h-[640px] rounded-[12px]" />
      </div>
    </div>
  );
}
