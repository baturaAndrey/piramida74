import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Спасибо за обращение",
  robots: { index: false, follow: false },
};

const DOT_DELAYS = ["0s", ".3s", ".6s"] as const;

// TODO(after Wave 3): фото из галереи `hero` поверх градиента — async-компонент в <Suspense fallback={null}>
// с `await connection()` + getGallery("hero") (задача 12) и <Picture priority> (задача 09).
export default function ThankYouPage() {
  return (
    <div className="px-[1vw] py-4">
      <section className="from-primary-dark to-primary rounded-hero relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-gradient-to-br px-6 py-16 text-center">
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
