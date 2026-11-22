import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { toMediaDto, type MediaDto } from "@/lib/admin/media-dto";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/queries/settings";
import { mediaAssets } from "@/lib/schema";
import { requireStaff } from "@/lib/session";
import { SettingsForm } from "./_components/settings-form";
import { TelegramPiiSwitch } from "./_components/telegram-pii-switch";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Настройки" };

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}

async function loadOgImage(id: string | null): Promise<MediaDto | null> {
  if (!id) return null;
  const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  return row ? toMediaDto(row) : null;
}

async function SettingsContent() {
  await requireStaff();
  // После updateTag(settings) getSettings возвращает свежие значения
  const { telegramIncludePii, ...settings } = await getSettings();
  const ogImage = await loadOgImage(settings.seoDefaults.ogImageMediaId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Настройки сайта"
        description="Контакты, тексты главной, SEO, реквизиты оператора ПДн и срок хранения заявок."
      />
      <TelegramPiiSwitch enabled={telegramIncludePii} />
      <SettingsForm initial={settings} ogImage={ogImage} />
    </div>
  );
}
