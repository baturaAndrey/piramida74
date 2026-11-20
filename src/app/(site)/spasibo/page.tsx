import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Picture } from "@/components/media/picture";
import { Button } from "@/components/ui/button";
import { getGallery } from "@/lib/queries/galleries";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Спасибо за обращение",
  robots: { index: false, follow: false },
};

const DOT_DELAYS = ["0s", ".3s", ".6s"] as const;

/** Фото из галереи `hero` поверх градиента; пока фото нет (или оно грузится) — виден градиент. */
async function HeroBackground() {
  await connection();
  const gallery = await getGallery("hero");
  const items = gallery?.items ?? [];
  const item = items.find((i) => i.variant === "default") ?? items[0];
  if (!item) return null;
  return (
    <Picture
      asset={item.media}
      sizes="(min-width:1920px) 1882px, 100vw"
      alt=""
      priority
      pictureClassName="absolute inset-0"
      className="absolute inset-0 size-full object-cover opacity-40"
    />
  );
}

export default function ThankYouPage() {
  return (
    <div className="container-frame py-4">
      <section className="from-primary-dark to-primary rounded-hero relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-gradient-to-br px-6 py-16 text-center">
        <div className="absolute inset-0" aria-hidden="true">
          <Suspense fallback={null}>
            <HeroBackground />
          </Suspense>
        </div>
        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-8">
          <h1 className="text-h1 font-semibold text-white">
            <strong className="font-semibold">Спасибо за обращение</strong> в Бильярдный клуб
            «Пирамида»!
          </h1>
          <div className="flex items-center gap-2" aria-hidden="true">
            {DOT_DELAYS.map((delay) => (
              <span
                key={delay}
                className="animate-pulse-dot size-2.5 rounded-full border border-white bg-white/80"
                style={{ animationDelay: delay }}
              />
            ))}
          </div>
          <p className="text-body-lg font-medium text-white/90">Мы скоро свяжемся с вами</p>
          <Button
            asChild
            className="bg-primary hover:bg-primary-dark h-12 rounded-xl border border-white/30 px-8 text-base font-bold md:h-14 md:text-lg"
          >
            <Link href="/">На главную</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
