import { Suspense } from "react";
import { connection } from "next/server";
import { BlogTeaserSkeleton } from "@/components/blog/blog-skeletons";
import { BlogTeaser } from "@/components/blog/blog-teaser";
import { HomeCalculatorTeaser } from "@/components/calculator/home-calculator-teaser";
import { LocalBusinessJsonLd } from "@/components/seo/local-business-jsonld";
import { Container } from "@/components/site/container";
import { AboutSection, AboutSectionSkeleton } from "@/components/site/home/about-section";
import { BarSection, BarSectionSkeleton } from "@/components/site/home/bar-section";
import { BookingSteps, BookingStepsSkeleton } from "@/components/site/home/booking-steps";
import { ContactsSection, ContactsSectionSkeleton } from "@/components/site/home/contacts-section";
import { CtaFormSection, CtaFormSectionSkeleton } from "@/components/site/home/cta-form-section";
import { Hero, HeroSkeleton } from "@/components/site/home/hero";
import { getHomeContext } from "@/components/site/home/home-context";
import { getHomeOgImage } from "@/components/site/home/home-og";
import {
  CALCULATOR_SECTION_CLASS,
  CALCULATOR_TITLE,
  CalculatorTeaserSkeleton,
} from "@/components/site/home/home-skeletons";
import { PriceAccordion, PriceAccordionSkeleton } from "@/components/site/home/price-accordion";
import {
  PromotionsCarousel,
  PromotionsCarouselSkeleton,
} from "@/components/site/home/promotions-carousel";
import { ServicesTabs, ServicesTabsSkeleton } from "@/components/site/home/services-tabs";
import {
  TournamentsPreview,
  TournamentsPreviewSkeleton,
} from "@/components/site/home/tournaments-preview";
import { Reveal } from "@/components/site/reveal";
import { SectionTitle } from "@/components/site/section-title";
import { getSettings } from "@/lib/queries/settings";
import { buildMetadata, DEFAULT_DESCRIPTION, SITE_NAME } from "@/lib/seo/metadata";
import type { Metadata } from "next";

const FALLBACK_TITLE = `${SITE_NAME} в Челябинске — русская пирамида, пул, VIP-комнаты`;

/** Title/description/OG главной — из `settings.seoDefaults` (редактируются в админке). */
export async function generateMetadata(): Promise<Metadata> {
  // Настройки читаются из 'use cache' + БД — только в рантайме, не при `next build`
  await connection();
  const { seoDefaults } = await getSettings();

  // Относительный путь; buildMetadata делает его абсолютным. Нет картинки → OG по умолчанию
  const image = seoDefaults.ogImageMediaId
    ? await getHomeOgImage(seoDefaults.ogImageMediaId)
    : null;

  return buildMetadata({
    title: { absolute: seoDefaults.title || FALLBACK_TITLE },
    description: seoDefaults.description || DEFAULT_DESCRIPTION,
    path: "/",
    ...(image ? { image } : {}),
  });
}

/** Новый блок «Калькулятор»: «сегодня» берётся из общего контекста запроса. */
async function CalculatorBlock() {
  const { opDate } = await getHomeContext();
  return (
    <section
      id="calculator"
      aria-labelledby="calculator-title"
      className={CALCULATOR_SECTION_CLASS}
    >
      <Container className="flex flex-col gap-8">
        {/* У SectionTitle нет `id`, поэтому якорь для aria-labelledby — на внутреннем span */}
        <Reveal>
          <SectionTitle>
            <span id="calculator-title">{CALCULATOR_TITLE}</span>
          </SectionTitle>
        </Reveal>
        <HomeCalculatorTeaser opDate={opDate} />
      </Container>
    </section>
  );
}

/**
 * Новый блок «Из блога». Секция и заголовок — внутри BlogTeaser (без `id`), поэтому якорь
 * `#blog` вешается на обёртку; без статей BlogTeaser возвращает null и обёртка пуста (0px).
 */
async function BlogBlock() {
  const { now } = await getHomeContext();
  return (
    <div id="blog">
      <BlogTeaser now={now} />
    </div>
  );
}

/**
 * Главная: секции в порядке старого сайта + «Калькулятор» и «Из блога».
 * Каждый блок с данными — в своём Suspense со скелетоном той же высоты; в статическую
 * оболочку попадают только скелетоны. Анимация появления (Reveal) — внутри самих секций.
 */
export default function HomePage() {
  return (
    <>
      <Suspense fallback={null}>
        <LocalBusinessJsonLd />
      </Suspense>

      <Suspense fallback={<HeroSkeleton />}>
        <Hero />
      </Suspense>

      <Suspense fallback={<PromotionsCarouselSkeleton />}>
        <PromotionsCarousel />
      </Suspense>
      <Suspense fallback={<ServicesTabsSkeleton />}>
        <ServicesTabs />
      </Suspense>
      <Suspense fallback={<TournamentsPreviewSkeleton />}>
        <TournamentsPreview />
      </Suspense>
      <Suspense fallback={<BarSectionSkeleton />}>
        <BarSection />
      </Suspense>
      <Suspense fallback={<PriceAccordionSkeleton />}>
        <PriceAccordion />
      </Suspense>
      <Suspense fallback={<CalculatorTeaserSkeleton />}>
        <CalculatorBlock />
      </Suspense>
      <Suspense fallback={<AboutSectionSkeleton />}>
        <AboutSection />
      </Suspense>
      <Suspense fallback={<BookingStepsSkeleton />}>
        <BookingSteps />
      </Suspense>
      <Suspense fallback={<CtaFormSectionSkeleton />}>
        <CtaFormSection />
      </Suspense>
      <Suspense fallback={<BlogTeaserSkeleton />}>
        <BlogBlock />
      </Suspense>
      <Suspense fallback={<ContactsSectionSkeleton />}>
        <ContactsSection />
      </Suspense>
    </>
  );
}
