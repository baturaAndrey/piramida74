import { TagManager } from "@/components/admin/blog/tag-manager";
import { PageHeader } from "@/components/admin/page-header";
import { listTagsWithCounts } from "@/lib/blog-admin/queries";
import { requireStaff } from "@/lib/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Теги блога" };

export default async function AdminTagsPage() {
  await requireStaff();
  const tags = await listTagsWithCounts();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Теги" description="Теги можно создавать и прямо в форме статьи." />
      <TagManager tags={tags} />
    </div>
  );
}
