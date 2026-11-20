"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import { LeadDialogTrigger } from "@/components/leads/lead-dialog";
import type { PublicMedia } from "@/lib/queries/types";
import { PrimaryButton } from "../primary-button";
import { LightboxGallery } from "./lightbox-gallery";

export type ServiceTab = {
  id: string;
  title: string;
  subtitle: string | null;
  bullets: string[];
  /** Готовая строка «От 580₽/час» или `null` — блок цены скрыт */
  price: string | null;
  priceNote: string | null;
  ctaKind: "booking" | "callback";
  ctaLabel: string;
  /** → `leads.sourceBlock` */
  ctaBlock: string;
  images: { asset: PublicMedia; alt: string }[];
};

type ServicesTabsClientProps = {
  tabs: ServiceTab[];
};

/**
 * Вкладки услуг на Radix Tabs: `role="tablist"`/`tab`, `aria-selected`, переключение стрелками.
 * Все панели рендерятся на сервере (`forceMount` + `hidden`) — тексты услуг попадают в HTML для SEO,
 * а ленивые картинки скрытых панелей не грузятся, пока панель не открыта.
 */
export function ServicesTabsClient({ tabs }: ServicesTabsClientProps) {
  const first = tabs[0];
  if (!first) return null;

  return (
    <TabsPrimitive.Root defaultValue={first.id} activationMode="automatic">
      <TabsPrimitive.List
        aria-label="Услуги бильярдной"
        className="-mx-1 mb-[clamp(20px,3.4vw,65px)] flex snap-x gap-2 overflow-x-auto p-1 lg:gap-5"
      >
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.id}
            value={tab.id}
            className="text-muted-foreground hover:text-foreground data-[state=active]:bg-primary shrink-0 snap-start rounded-[12px] bg-white px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors data-[state=active]:text-white lg:min-w-[clamp(200px,15.625vw,300px)] lg:px-[30px] lg:py-5 lg:text-[clamp(16px,1.15vw,22px)] lg:leading-none"
          >
            {tab.title}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {tabs.map((tab) => (
        <TabsPrimitive.Content
          key={tab.id}
          value={tab.id}
          forceMount
          className="flex flex-col gap-5 data-[state=inactive]:hidden lg:flex-row lg:items-start lg:justify-between"
        >
          {tab.images.length > 0 ? (
            <LightboxGallery
              items={tab.images}
              variant="services"
              className="lg:w-[calc(50%-10px)] lg:shrink-0"
            />
          ) : null}
          <ServiceCard tab={tab} />
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}

function ServiceCard({ tab }: { tab: ServiceTab }) {
  return (
    <div className="rounded-[12px] bg-white p-5 lg:w-[calc(50%-10px)] lg:shrink-0 lg:p-[clamp(24px,2.5vw,48px)]">
      <h3 className="mb-[clamp(10px,2vw,38px)] text-[clamp(16px,2.5vw,48px)] leading-[1.5] font-semibold">
        {tab.title}
      </h3>
      {tab.subtitle ? (
        <p className="text-muted-foreground mb-[clamp(13px,1.8vw,35px)] text-[clamp(13px,1vw,19px)] leading-[1.4] whitespace-pre-line">
          {tab.subtitle}
        </p>
      ) : null}
      {tab.bullets.length > 0 ? (
        <ul className="mb-[clamp(13px,1.8vw,35px)] space-y-[clamp(8px,1.1vw,22px)] text-[clamp(13px,0.94vw,18px)] font-medium">
          {tab.bullets.map((bullet, index) => (
            <li key={index}>{bullet}</li>
          ))}
        </ul>
      ) : null}
      {tab.price ? (
        <div className="mb-[clamp(16px,1.8vw,35px)]">
          <p className="text-muted-foreground mb-2.5 text-base">Цена:</p>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[clamp(24px,2.08vw,40px)] leading-none font-bold">
              {tab.price}
            </span>
            {tab.priceNote ? (
              <span className="text-muted-foreground text-sm">{tab.priceNote}</span>
            ) : null}
          </p>
        </div>
      ) : null}
      <LeadDialogTrigger kind={tab.ctaKind} block={tab.ctaBlock} formTitle={tab.title} asChild>
        <PrimaryButton className="w-full">{tab.ctaLabel}</PrimaryButton>
      </LeadDialogTrigger>
    </div>
  );
}
