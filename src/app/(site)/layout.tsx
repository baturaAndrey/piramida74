import { BackToTop } from "@/components/site/back-to-top";
import { CookieBanner } from "@/components/site/cookie-banner";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { Metrika } from "@/components/site/metrika";

/**
 * Layout публичного сайта: шапка, `<main>`, футер, кнопка «наверх», cookie-баннер и Метрика.
 * `[&_[id]]:scroll-mt-24` — якорные секции не уходят под закреплённую полосу навигации.
 * Метаданные и JSON-LD по умолчанию — в задаче 23.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col [&_[id]]:scroll-mt-24">
      <a
        href="#main-content"
        className="focus:bg-primary sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-md focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Перейти к содержимому
      </a>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <BackToTop />
      <CookieBanner />
      <Metrika />
    </div>
  );
}
