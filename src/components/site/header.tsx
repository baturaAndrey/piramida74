import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { MapPin } from "lucide-react";
import { LeadDialogTrigger } from "@/components/leads/lead-dialog";
import { getSettings } from "@/lib/queries/settings";
import { SETTINGS_DEFAULTS, type SiteSettings } from "@/lib/settings-defaults";
import { HeaderNav } from "./header-nav";
import { PrimaryButton } from "./primary-button";
import { TelegramIcon } from "./social-icons";

/**
 * Шапка сайта. Статическая оболочка (с дефолтными контактами) пререндерится без БД,
 * актуальные настройки подставляются в рантайме внутри `<Suspense>`.
 */
export function SiteHeader() {
  return (
    <Suspense fallback={<HeaderView settings={SETTINGS_DEFAULTS} />}>
      <HeaderWithSettings />
    </Suspense>
  );
}

async function HeaderWithSettings() {
  await connection();
  return <HeaderView settings={await getSettings()} />;
}

/** «г. Челябинск, Орджоникидзе 58а к3» → город отдельной (жирной) строкой, как в оригинале */
function splitCity(address: string): { city: string | null; street: string } {
  const match = /^\s*(г\.\s*[^,]+?)\s*,\s*(.+)$/u.exec(address);
  return match?.[1] && match[2]
    ? { city: match[1], street: match[2] }
    : { city: null, street: address };
}

/** Пульсирующая точка перед «Мы онлайн» и часами (::before/::after с pulse_1 в оригинале) */
function PulseDot() {
  return (
    <span className="relative flex size-2 shrink-0" aria-hidden="true">
      <span className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:animate-none" />
      <span className="bg-primary relative inline-flex size-2 rounded-full" />
    </span>
  );
}

/** Разметка шапки (`.header` старого сайта) по готовым настройкам — без загрузки данных. */
function HeaderView({ settings }: { settings: SiteSettings }) {
  const { city, street } = splitCity(settings.address);

  return (
    // `contents`: полоса навигации должна закрепляться относительно всей страницы, а не <header>
    <header className="contents">
      <HeaderNav settings={settings}>
        <div className="hidden lg:block">
          {/* Линия-разделитель — по ширине контента (внутри поля --gutter), а не всей рамки */}
          <div className="container-site mb-[clamp(12px,1.406vw,27px)]">
            <div className="border-foreground/[0.07] flex items-center justify-between gap-6 border-t pt-[0.1vw]">
              <div className="flex items-center gap-[clamp(20px,2.604vw,50px)]">
                <Link href="/" className="shrink-0 rounded-md">
                  <Image
                    src="/images/logo.png"
                    width={125}
                    height={106}
                    loading="eager"
                    alt="Бильярдный клуб «Пирамида» — на главную"
                    className="h-auto w-[clamp(64px,4.88vw,94px)]"
                  />
                </Link>
                <address className="flex items-center gap-[clamp(10px,0.78vw,15px)] text-[clamp(12px,0.833vw,16px)] leading-[1.5625] not-italic">
                  <MapPin
                    className="text-primary size-[clamp(18px,1.25vw,24px)] shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {city ? (
                      <>
                        <b className="font-bold">{city}</b>
                        <br />
                      </>
                    ) : null}
                    {street}
                    {settings.addressNote ? (
                      <>
                        <br />
                        {settings.addressNote}
                      </>
                    ) : null}
                  </span>
                </address>
              </div>

              <div className="flex items-center gap-[clamp(20px,2.604vw,50px)]">
                {settings.telegramUrl ? (
                  <div className="flex items-center gap-[clamp(10px,0.78vw,15px)]">
                    <PulseDot />
                    <p className="text-[clamp(12px,0.833vw,16px)] leading-[1.2]">
                      Мы онлайн,
                      <br />
                      <b className="font-semibold">пишите</b>
                    </p>
                    <a
                      href={settings.telegramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Написать в Telegram"
                      className="border-border flex size-[clamp(40px,2.604vw,50px)] items-center justify-center rounded-[10px] border bg-white text-[#05a0eb] transition-transform duration-300 hover:scale-110"
                    >
                      <TelegramIcon className="size-[clamp(16px,1.146vw,22px)]" />
                    </a>
                  </div>
                ) : null}

                <div className="flex flex-col items-center gap-[clamp(4px,0.52vw,10px)]">
                  <p className="flex items-center gap-2 text-[clamp(12px,0.833vw,16px)] leading-[1.2] font-medium">
                    <PulseDot />
                    {settings.hours}
                  </p>
                  <a
                    href={settings.phoneHref}
                    className="hover:text-primary text-[clamp(15px,1.146vw,22px)] leading-[1.2] font-bold whitespace-nowrap transition-colors duration-300"
                  >
                    {settings.phone}
                  </a>
                </div>

                <LeadDialogTrigger kind="callback" block="Шапка сайта" asChild>
                  <PrimaryButton
                    size="sm"
                    className="min-w-[clamp(150px,10.938vw,210px)] font-semibold"
                  >
                    Заказать звонок
                  </PrimaryButton>
                </LeadDialogTrigger>
              </div>
            </div>
          </div>
        </div>
      </HeaderNav>
    </header>
  );
}
