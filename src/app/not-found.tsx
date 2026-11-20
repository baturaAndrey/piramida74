import { Suspense } from "react";
import { connection } from "next/server";
import { LeadDialogTrigger } from "@/components/leads/lead-dialog";
import { Picture } from "@/components/media/picture";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { PrimaryButton } from "@/components/site/primary-button";
import { getGallery } from "@/lib/queries/galleries";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Страница не найдена",
  robots: { index: false, follow: false },
};

/**
 * Фото из галереи `hero` поверх градиента; без фото остаётся градиент.
 * Без `priority`: корневой not-found Next.js отправляет вместе с КАЖДОЙ страницей, и
 * `preload()` из Picture добавлял высокоприоритетную загрузку этого фото на всех страницах,
 * отнимая канал у CSS/JS и настоящего LCP-изображения.
 */
async function HeroBackground() {
  await connection();
  const gallery = await getGallery("hero");
  const items = gallery?.items ?? [];
  const item = items.find((i) => i.variant === "default") ?? items[0];
  if (!item) return null;
  return (
    <Picture
      asset={item.media}
      sizes="98vw"
      alt=""
      pictureClassName="absolute inset-0"
      className="absolute inset-0 size-full object-cover opacity-60"
    />
  );
}

/**
 * 404 в стиле старого сайта (hero `.first` + «Страница не найдена!»).
 * Корневой not-found рендерится вне layout `(site)`, поэтому шапка и футер подключены явно.
 */
export default function NotFound() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" className="flex-1 pb-[clamp(32px,2.604vw,50px)]">
        <section className="rounded-hero from-primary-dark to-primary container-frame relative isolate flex min-h-[clamp(420px,39.53vw,759px)] overflow-hidden bg-gradient-to-br">
          <div className="absolute inset-0 -z-10" aria-hidden="true">
            <Suspense fallback={null}>
              <HeroBackground />
            </Suspense>
            {/* Затемнение слева — белый текст читается на любом фото */}
            <div className="from-primary-dark/80 absolute inset-0 bg-gradient-to-r via-black/20 to-transparent" />
          </div>
          <div className="px-gutter-framed flex w-full flex-col items-start justify-center py-[clamp(40px,7.29vw,140px)] text-white">
            <p className="bg-badge text-badge-foreground text-badge-size mb-4 rounded-lg p-[clamp(10px,0.83vw,16px)] font-medium">
              Русский бильярд
            </p>
            <h1 className="text-h1 mb-[clamp(16px,3.125vw,60px)] max-w-[clamp(260px,40vw,600px)] font-semibold text-white">
              Страница не найдена!
            </h1>
            <p className="text-hero-sub mb-[clamp(24px,3.125vw,60px)] max-w-[clamp(280px,36.72vw,705px)] font-medium text-white">
              Возможно, это связано с обновлением нашего сайта и ссылка устарела. Вы можете перейти
              на главную страницу или воспользоваться формой бронирования.
            </p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-[clamp(16px,1.82vw,35px)]">
              <PrimaryButton href="/">На главную</PrimaryButton>
              <LeadDialogTrigger kind="booking" block="Страница 404" asChild>
                <PrimaryButton variant="outline-light">Забронировать стол</PrimaryButton>
              </LeadDialogTrigger>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
