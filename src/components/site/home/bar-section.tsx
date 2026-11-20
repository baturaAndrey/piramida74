import Link from "next/link";
import { connection } from "next/server";
import { LeadDialogTrigger } from "@/components/leads/lead-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getGallery } from "@/lib/queries/galleries";
import { Container } from "../container";
import { Reveal } from "../reveal";
import { SectionTitle } from "../section-title";
import { LightboxGallery } from "./lightbox-gallery";

const SECTION_CLASS = "scroll-mt-24 pt-[clamp(32px,4vw,77px)] pb-[clamp(24px,2.6vw,50px)]";
const TITLE = "Бар и кухня";
/** Фото в сетке: 1 крупное + 5 миниатюр */
const BAR_PHOTOS_LIMIT = 6;

// Тексты бара статичны: в SiteSettings для них ключей нет (взяты со старого сайта)
const BAR_HEADING =
  "🍽️ Изысканная кухня и коктейли от клуба «Пирамида» — гастрономическое путешествие для истинных ценителей";
const BAR_TEXT =
  "👨‍🍳 Где каждое блюдо — произведение искусства, а каждый глоток — история вкуса. Погрузитесь в мир гастрономических открытий, не покидая игрового стола! Наш бильярд бар создан для тех, кто понимает: настоящий отдых — это симфония вкусов, ароматов и атмосферы.";

/** «Ссылка с подчёркиванием» старого сайта: линия исчезает при наведении */
const UNDERLINE_LINK =
  "text-primary border-primary border-b pb-px text-base font-semibold uppercase transition-colors hover:border-b-transparent";

/** «Бар и кухня»: галерея с лайтбоксом, описание, ссылки на меню и бронь стола. */
export async function BarSection() {
  await connection();
  const gallery = await getGallery("bar");
  const images = (gallery?.items ?? []).slice(0, BAR_PHOTOS_LIMIT).map((item) => ({
    asset: item.media,
    alt: item.media.alt || item.caption || TITLE,
  }));

  return (
    <section id="portfolio" className={SECTION_CLASS}>
      <Container>
        <Reveal>
          <SectionTitle className="mb-5">{TITLE}</SectionTitle>
        </Reveal>
        {images.length > 0 ? <LightboxGallery items={images} variant="bar" /> : null}
        <h3 className="mt-[clamp(16px,1.8vw,35px)] mb-3.5 max-w-[1152px] text-[clamp(16px,1.98vw,38px)] leading-[1.32] font-bold">
          {BAR_HEADING}
        </h3>
        <p className="text-bar-text mb-4 max-w-[1152px] text-[clamp(13px,0.94vw,18px)] leading-[1.22]">
          {BAR_TEXT}
        </p>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <Link href="/menu" className={UNDERLINE_LINK}>
            Меню
          </Link>
          <LeadDialogTrigger
            kind="booking"
            block="Бар и кухня"
            formTitle="Бронирование стола"
            asChild
          >
            <button type="button" className={UNDERLINE_LINK}>
              Забронировать стол
            </button>
          </LeadDialogTrigger>
        </div>
      </Container>
    </section>
  );
}

/** Заглушка: крупное фото + 5 миниатюр. */
export function BarSectionSkeleton() {
  return (
    <section aria-hidden="true" className={SECTION_CLASS}>
      <Container>
        <SectionTitle className="mb-5">{TITLE}</SectionTitle>
        <Skeleton className="mb-2 h-[clamp(221px,31.25vw,600px)] rounded-[12px] lg:mb-4" />
        <div className="grid grid-cols-5 gap-2 lg:gap-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[clamp(53px,7.8vw,150px)] rounded-[12px]" />
          ))}
        </div>
      </Container>
    </section>
  );
}
