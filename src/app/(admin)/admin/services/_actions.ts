"use server";

import { eq } from "drizzle-orm";
import { ActionError, adminAction } from "@/lib/admin/action";
import { audit } from "@/lib/admin/audit";
import { TAGS } from "@/lib/cache-tags";
import { galleries, services } from "@/lib/schema";
import { serviceSchema } from "./_schema";

const EDITABLE_FIELDS = [
  "title",
  "subtitle",
  "bullets",
  "priceFrom",
  "priceNote",
  "ctaType",
  "ctaBlock",
  "galleryKey",
] as const;

export const saveService = adminAction(
  serviceSchema,
  async (input, ctx) => {
    const [current] = await ctx.tx
      .select()
      .from(services)
      .where(eq(services.id, input.id))
      .limit(1);
    if (!current) throw new ActionError("Услуга не найдена");

    if (input.galleryKey) {
      const [gallery] = await ctx.tx
        .select({ id: galleries.id })
        .from(galleries)
        .where(eq(galleries.key, input.galleryKey))
        .limit(1);
      if (!gallery) {
        throw new ActionError("Галерея не найдена", { galleryKey: ["Галерея не найдена"] });
      }
    }

    const next = {
      title: input.title,
      // Пустые необязательные поля храним как null — так их понимает публичная выдача
      subtitle: input.subtitle === "" ? null : input.subtitle,
      bullets: input.bullets,
      priceFrom: input.priceFrom,
      priceNote: input.priceNote === "" ? null : input.priceNote,
      ctaType: input.ctaType,
      ctaBlock: input.ctaBlock,
      galleryKey: input.galleryKey,
    };

    const diff: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of EDITABLE_FIELDS) {
      if (JSON.stringify(current[field]) !== JSON.stringify(next[field])) {
        diff[field] = { from: current[field], to: next[field] };
      }
    }
    if (Object.keys(diff).length === 0) return { id: current.id, changed: false };

    await ctx.tx.update(services).set(next).where(eq(services.id, current.id));
    await audit(ctx.userId, "service.update", "service", current.id, diff, ctx.tx);
    return { id: current.id, changed: true };
  },
  { tags: [TAGS.services] }
);
