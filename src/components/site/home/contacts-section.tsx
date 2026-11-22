import Image from "next/image";
import { connection } from "next/server";
import { Clock, Mail, MapPin, Phone, type LucideIcon } from "lucide-react";
import { Container } from "@/components/site/container";
import { MapFacade } from "@/components/site/home/map-facade";
import { Skeleton } from "@/components/ui/skeleton";
import { getSettings } from "@/lib/queries/settings";
import type { SiteSettings } from "@/lib/settings-defaults";

const MAP_HEIGHT = "h-[230px] md:h-[420px] lg:h-[clamp(420px,31vw,600px)]";
const LINK_CLASS = "hover:text-primary transition-colors";
const SOCIAL_LINK_CLASS = "mr-2.5 inline-block transition-transform duration-300 hover:scale-[1.2]";

/** «г. Челябинск, Орджоникидзе 58а к3» → ["г. Челябинск", "Орджоникидзе 58а к3"] */
function splitAtFirst(value: string, separator: string): [string, string] {
  const index = value.indexOf(separator);
  if (index === -1) return [value, ""];
  return [value.slice(0, index), value.slice(index + separator.length).trim()];
}

/** Ссылка «Построить маршрут» на карточку организации в Яндекс Картах */
function buildRouteUrl(settings: SiteSettings) {
  const { lat, lon } = settings.geo;
  const oid = settings.mapOrgId;
  return (
    `https://yandex.ru/maps/56/chelyabinsk/?ll=${lon}%2C${lat}&mode=poi` +
    `&poi%5Bpoint%5D=${lon}%2C${lat}&poi%5Buri%5D=ymapsbm1%3A%2F%2Forg%3Foid%3D${oid}&z=18`
  );
}

function ContactRow({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="mb-[23px] flex items-start">
      <Icon className="size-6 shrink-0 text-[#31B939]" aria-hidden="true" />
      <span className="ml-3 text-[clamp(15px,0.99vw,19px)] leading-[1.4] font-normal">
        {children}
      </span>
    </li>
  );
}

function SocialLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={SOCIAL_LINK_CLASS}
    >
      <Image src={icon} alt="" width={42} height={42} unoptimized className="size-[42px]" />
    </a>
  );
}

/** «Контакты»: адрес, часы, телефон, почта, соцсети и карта за фасадом (`#contacts`) */
export async function ContactsSection() {
  await connection();
  const settings = await getSettings();

  const [city, street] = splitAtFirst(settings.address, ",");
  const [hoursLead, hoursRest] = splitAtFirst(settings.hours, " ");
  const umParam = settings.mapConstructorId.replace(/^constructor:/, "");

  return (
    <section
      id="contacts"
      className="scroll-mt-24 pt-[clamp(24px,2.7vw,52px)] pb-[clamp(32px,4vw,77px)]"
    >
      <h2 className="sr-only">Контакты</h2>
      <Container className="flex flex-col lg:flex-row lg:justify-between lg:gap-[clamp(24px,3vw,72px)]">
        <div className="flex shrink-0 flex-col justify-between lg:w-[280px]">
          <ul>
            <ContactRow icon={MapPin}>
              <b className="font-semibold">{city}</b>
              {street ? (
                <>
                  <br />
                  {street}
                </>
              ) : null}
              {settings.addressNote ? (
                <>
                  <br />({settings.addressNote})
                </>
              ) : null}
            </ContactRow>
            <ContactRow icon={Clock}>
              <b className="font-semibold">{hoursLead}</b> {hoursRest}
            </ContactRow>
            <ContactRow icon={Phone}>
              <a href={settings.phoneHref} className={LINK_CLASS}>
                {settings.phone}
              </a>
            </ContactRow>
            <ContactRow icon={Mail}>
              <a href={`mailto:${settings.email}`} className={`${LINK_CLASS} break-all`}>
                {settings.email}
              </a>
            </ContactRow>
          </ul>

          <div className="mb-6 flex gap-10 lg:mb-0 lg:block">
            <div className="mt-[clamp(32px,5.9vw,114px)]">
              <p className="mb-4 text-base leading-6">
                Пишите, <b className="font-semibold">мы онлайн</b>
              </p>
              <SocialLink
                href={settings.telegramUrl}
                label="Telegram"
                icon="/images/home/social-telegram.svg"
              />
            </div>
            <div className="mt-[clamp(32px,5.9vw,114px)] lg:mt-[clamp(20px,2.6vw,50px)]">
              <p className="mb-4 text-base leading-6">
                <b className="font-semibold">Мы в соцсетях</b>
              </p>
              <SocialLink
                href={settings.vkUrl}
                label="ВКонтакте"
                icon="/images/home/social-vk.svg"
              />
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col lg:flex-1">
          <div className="order-last mt-3 mb-3 flex items-center justify-center lg:order-none lg:mt-0 lg:mb-[19px] lg:justify-end">
            <a
              href={buildRouteUrl(settings)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary after:border-primary relative text-[13px] leading-6 font-bold uppercase after:absolute after:top-full after:left-0 after:h-0 after:w-full after:border-b after:transition-all after:duration-300 hover:after:w-[60%] md:text-base"
            >
              Построить маршрут в навигаторе
            </a>
          </div>
          <div className={`${MAP_HEIGHT} overflow-hidden rounded-[12px]`}>
            <MapFacade umParam={umParam} title={settings.address} />
          </div>
        </div>
      </Container>
    </section>
  );
}

export function ContactsSectionSkeleton() {
  return (
    <div className="pt-[clamp(24px,2.7vw,52px)] pb-[clamp(32px,4vw,77px)]">
      <Container className="flex flex-col gap-6 lg:flex-row lg:justify-between lg:gap-[clamp(24px,3vw,72px)]">
        <div className="flex shrink-0 flex-col gap-[23px] lg:w-[280px]">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
        <Skeleton className="h-[230px] min-w-0 rounded-[12px] md:h-[420px] lg:flex-1" />
      </Container>
    </div>
  );
}
