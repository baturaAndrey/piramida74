import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { getToday } from "@/lib/dates";
import { requireStaff } from "@/lib/session";
import { PromotionsList } from "./_components/promotions-list";
import { listPromotions } from "./_queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Акции" };

export default async function AdminPromotionsPage() {
  await requireStaff();
  const items = await listPromotions();
  const today = getToday();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Акции"
        description="Акции клуба и карусель на главной. Порядок меняется перетаскиванием или стрелками."
        actions={
          <Button asChild>
            <Link href="/admin/promotions/new">
              <Plus className="h-4 w-4" aria-hidden />
              Создать акцию
            </Link>
          </Button>
        }
      />
      <PromotionsList items={items} today={today} />
    </div>
  );
}
