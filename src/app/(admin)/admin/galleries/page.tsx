import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/session";
import { GalleryEditor, GalleryNav } from "./_components/gallery-editor";
import { GALLERY_KEY_RE } from "./_lib/labels";
import { getAdminGallery, listAdminGalleries } from "./_queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Галереи" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function AdminGalleriesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <GalleriesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function GalleriesContent({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const rawKey = typeof params.key === "string" ? params.key : undefined;
  if (rawKey !== undefined && !GALLERY_KEY_RE.test(rawKey)) notFound();

  const list = await listAdminGalleries();
  const activeKey = rawKey ?? list[0]?.key;
  const gallery = activeKey ? await getAdminGallery(activeKey) : null;
  if (rawKey !== undefined && !gallery) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Галереи"
        description="Фото на страницах сайта. Изменения видны на сайте сразу после сохранения."
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
        <aside>
          <GalleryNav galleries={list} activeKey={activeKey ?? ""} />
        </aside>
        <section className="min-w-0">
          {gallery ? (
            // key: при переключении галереи состояние редактора (загрузки, поля) сбрасывается
            <GalleryEditor key={gallery.key} gallery={gallery} />
          ) : (
            <p className="text-muted-foreground text-sm">Выберите галерею</p>
          )}
        </section>
      </div>
    </div>
  );
}
