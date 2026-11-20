import { MediaLibrary } from "@/components/admin/media-library";
import { PageHeader } from "@/components/admin/page-header";
import { MEDIA_PAGE_SIZE_DEFAULT } from "@/lib/admin/media-dto";
import { listMedia, listMediaFolders } from "@/lib/admin/media-queries";
import { requireAdmin } from "@/lib/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Медиатека" };

export default async function AdminMediaPage() {
  await requireAdmin();
  const [initial, folders] = await Promise.all([
    listMedia({ page: 1, pageSize: MEDIA_PAGE_SIZE_DEFAULT }),
    listMediaFolders(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Медиатека"
        description="Все загруженные изображения. Используемые на сайте файлы удалить нельзя."
      />
      <MediaLibrary initial={initial} folders={folders} />
    </div>
  );
}
