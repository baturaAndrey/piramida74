"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExtrasTab } from "./extras-tab";
import { HallsTab } from "./halls-tab";
import { PenaltiesTab } from "./penalties-tab";
import { TariffsTab } from "./tariffs-tab";
import { isPricingTab, PRICING_TABS, type PricingTab } from "../_lib/labels";
import type { PricingAdminData } from "../_queries";

const TAB_LABELS: Record<PricingTab, string> = {
  halls: "Залы",
  tariffs: "Тарифы",
  extras: "Доп. услуги",
  penalties: "Штрафы",
};

type PricingTabsProps = { initialTab: PricingTab; data: PricingAdminData };

/** Вкладки раздела «Цены»; активная хранится в `?tab=` */
export function PricingTabs({ initialTab, data }: PricingTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<PricingTab>(initialTab);

  function handleChange(value: string) {
    if (!isPricingTab(value)) return;
    setTab(value);
    router.replace(`${pathname}?tab=${value}`, { scroll: false });
  }

  return (
    <Tabs value={tab} onValueChange={handleChange} className="gap-6">
      {/* На узких экранах список вкладок прокручивается по горизонтали */}
      <div className="-mx-1 overflow-x-auto px-1">
        <TabsList>
          {PRICING_TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {TAB_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value="halls">
        <HallsTab halls={data.halls} />
      </TabsContent>
      <TabsContent value="tariffs">
        <TariffsTab halls={data.halls} tariffs={data.tariffs} warnings={data.warnings} />
      </TabsContent>
      <TabsContent value="extras">
        <ExtrasTab extras={data.extras} />
      </TabsContent>
      <TabsContent value="penalties">
        <PenaltiesTab penalties={data.penalties} />
      </TabsContent>
    </Tabs>
  );
}
