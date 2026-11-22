import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/session";
import { PromotionForm } from "../_components/promotion-form";
import { getPromotion, listMenuCategoryOptions } from "../_queries";
import type { PromotionInput } from "../_schema";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Акция" };

export default async function EditPromotionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [found, menuCategories] = await Promise.all([getPromotion(id), listMenuCategoryOptions()]);
  if (!found) notFound();
  const p = found.promotion;

  const defaultValues: PromotionInput = {
    id: p.id,
    title: p.title,
    slug: p.slug,
    shortText: p.shortText,
    description: p.description,
    coverMediaId: p.coverMediaId,
    discountPercent: p.discountPercent,
    daysOfWeek: p.daysOfWeek,
    startMin: p.startMin,
    endMin: p.endMin,
    target: p.target,
    targetMenuCategoryId: p.targetMenuCategoryId,
    audienceNote: p.audienceNote,
    validFrom: p.validFrom,
    validTo: p.validTo,
    showInCarousel: p.showInCarousel,
    isActive: p.isActive,
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={p.title}
        backHref="/admin/promotions"
        breadcrumbs={[{ label: "Акции", href: "/admin/promotions" }, { label: "Редактирование" }]}
      />
      {/* key: после сохранения и повторного открытия форма получает свежие значения */}
      <PromotionForm
        key={p.updatedAt.toISOString()}
        defaultValues={defaultValues}
        initialCover={found.cover}
        menuCategories={menuCategories}
      />
    </div>
  );
}
