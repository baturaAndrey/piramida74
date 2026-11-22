import { RubricManager } from "@/components/admin/blog/rubric-manager";
import { PageHeader } from "@/components/admin/page-header";
import { listRubricsWithCounts } from "@/lib/blog-admin/queries";
import { requireStaff } from "@/lib/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Рубрики блога" };

export default async function AdminRubricsPage() {
  await requireStaff();
  const rubrics = await listRubricsWithCounts();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Рубрики"
        description="Порядок рубрик — как в фильтре блога. Перетащите, чтобы изменить."
      />
      <RubricManager rubrics={rubrics} />
    </div>
  );
}
