import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/session";
import { PromotionForm } from "../_components/promotion-form";
import { listMenuCategoryOptions } from "../_queries";
import type { PromotionInput } from "../_schema";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Новая акция" };

const EMPTY_PROMOTION: PromotionInput = {
  title: "",
  slug: "",
  shortText: "",
  description: "",
  coverMediaId: null,
  discountPercent: null,
  daysOfWeek: null,
  startMin: null,
  endMin: null,
  target: "other",
  targetMenuCategoryId: null,
  audienceNote: null,
  validFrom: null,
  validTo: null,
  showInCarousel: true,
  isActive: true,
};

export default async function NewPromotionPage() {
  await requireAdmin();
  const menuCategories = await listMenuCategoryOptions();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Новая акция"
        backHref="/admin/promotions"
        breadcrumbs={[{ label: "Акции", href: "/admin/promotions" }, { label: "Новая акция" }]}
      />
      <PromotionForm
        defaultValues={EMPTY_PROMOTION}
        initialCover={null}
        menuCategories={menuCategories}
      />
    </div>
  );
}
