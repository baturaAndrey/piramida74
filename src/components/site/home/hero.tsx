import { connection } from "next/server";
import { LeadDialogTrigger } from "@/components/leads/lead-dialog";
import { Picture } from "@/components/media/picture";
import { Skeleton } from "@/components/ui/skeleton";
import { getGallery } from "@/lib/queries/galleries";
import { getSettings } from "@/lib/queries/settings";
import { Container } from "../container";
import { PrimaryButton } from "../primary-button";
import { HeroBadge } from "./hero-badge";

/** Рамка секции: поля по бокам, скругление и высота — общие для секции и скелетона */
const HERO_FRAME =
  "relative mx-2 mb-6 min-h-[clamp(520px,40vw,770px)] overflow-hidden rounded-[12px] md:mx-[1vw] md:mb-[2.6vw] md:rounded-[25px]";

/** Первый экран: фон из галереи `hero`, печатающийся бейдж, H1, подзаголовок и кнопка брони. */
export async function Hero() {
  await connection();
  const [settings, gallery] = await Promise.all([getSettings(), getGallery("hero")]);
  // Основной кадр — элемент варианта `default`; `mobile` используется только как запасной
  const background =
    gallery?.items.find((item) => item.variant === "default")?.media ??
    gallery?.items[0]?.media ??
    null;

  return (
    <section className={`${HERO_FRAME} bg-footer scroll-mt-24 pb-[clamp(40px,5.3vw,102px)]`}>
      {background ? (
        <>
          <Picture
            asset={background}
            sizes="100vw"
            alt={background.alt || settings.heroTitle}
            priority
            pictureClassName="absolute inset-0 z-0"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Лёгкое затемнение ради читаемости белого текста (осознанное отличие от старого сайта) */}
          <div aria-hidden="true" className="absolute inset-0 z-0 bg-black/25" />
        </>
      ) : null}

      <Container className="relative z-10 pt-[clamp(32px,3.6vw,69px)] text-center md:text-left">
        <HeroBadge phrases={settings.heroBadgePhrases} className="mb-4" />
        <h1 className="mb-[clamp(16px,2.34vw,45px)] max-w-[992px] text-[clamp(24px,3.385vw,65px)] leading-[1.31] font-semibold text-white">
          {settings.heroTitle}
        </h1>
        <p className="mb-[clamp(20px,2.24vw,43px)] max-w-[705px] text-[clamp(12px,1.5625vw,30px)] leading-[1.5] font-medium whitespace-pre-line text-white">
          {settings.heroSubtitle}
        </p>
        <LeadDialogTrigger
          kind="booking"
          block="Первый экран"
          formTitle="Забронировать стол"
          asChild
        >
          <PrimaryButton className="w-full md:w-[clamp(280px,20.83vw,400px)]">
            Забронировать стол
          </PrimaryButton>
        </LeadDialogTrigger>
      </Container>
    </section>
  );
}

/** Заглушка первого экрана той же высоты. */
export function HeroSkeleton() {
  return <Skeleton className={`${HERO_FRAME} bg-muted block`} />;
}
