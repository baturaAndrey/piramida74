import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/session";
import { SetsList } from "./_components/sets-list";
import { listSets } from "./_queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Банкетные сеты" };

export default function BanquetSetsPage() {
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Банкетные сеты"
        description="Сеты показываются на сайте и в калькуляторе. Порядок — перетаскиванием."
        actions={
          <Button asChild size="sm">
            <Link href="/admin/banquet-sets/new">
              <Plus className="h-4 w-4" aria-hidden />
              Новый сет
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<AdminPageSkeleton />}>
        <SetsContent />
      </Suspense>
    </div>
  );
}

async function SetsContent() {
  await requireAdmin();
  const sets = await listSets();
  return <SetsList sets={sets} />;
}
