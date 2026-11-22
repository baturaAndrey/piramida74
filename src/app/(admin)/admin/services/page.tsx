import { Suspense } from "react";
import { Wrench } from "lucide-react";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/session";
import { ServicesTabs } from "./_components/service-form";
import { listAdminServices, listGalleryOptions } from "./_queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Услуги" };

/** Сайт рассчитан на 4 вкладки: русский, американский, VIP, обучение */
const EXPECTED_SERVICES = 4;

export default function AdminServicesPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <ServicesContent />
    </Suspense>
  );
}

async function ServicesContent() {
  await requireAdmin();
  const [services, galleries] = await Promise.all([listAdminServices(), listGalleryOptions()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Услуги"
        description="Тексты вкладок блока «Услуги» на главной. Изменения видны на сайте сразу после сохранения."
      />
      {services.length < EXPECTED_SERVICES ? (
        <div className="text-muted-foreground mx-auto flex max-w-md flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center text-sm">
          <Wrench className="h-8 w-8" aria-hidden />
          <p className="text-foreground font-medium">Услуги не заполнены</p>
          <p>
            Найдено вкладок: {services.length} из {EXPECTED_SERVICES}. Запустите seed (
            <code className="font-mono">pnpm seed</code>), чтобы создать их.
          </p>
        </div>
      ) : (
        <ServicesTabs services={services} galleries={galleries} />
      )}
    </div>
  );
}
