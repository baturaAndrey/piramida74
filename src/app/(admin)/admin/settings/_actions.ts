"use server";

import { eq } from "drizzle-orm";
import { adminAction, type ActionCtx } from "@/lib/admin/action";
import { audit } from "@/lib/admin/audit";
import { TAGS } from "@/lib/cache-tags";
import { siteSettings } from "@/lib/schema";
import { mergeSettings, type SiteSettings } from "@/lib/settings-defaults";
import { settingsSchema, telegramPiiSchema, type SettingsValues } from "./_schema";

const PII_KEY = "telegramIncludePii" satisfies keyof SiteSettings;

async function upsertSetting(tx: ActionCtx["tx"], key: keyof SiteSettings, value: unknown) {
  await tx
    .insert(siteSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date() } });
}

/** JSON с отсортированными ключами: jsonb в Postgres не сохраняет порядок ключей объекта. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
        )
      : v
  );
}

/** Текущие значения (с дефолтами для отсутствующих ключей) — внутри транзакции действия. */
async function readSettings(tx: ActionCtx["tx"]): Promise<SiteSettings> {
  const rows = await tx
    .select({ key: siteSettings.key, value: siteSettings.value })
    .from(siteSettings);
  return mergeSettings(rows);
}

/** Пишет только изменившиеся ключи верхнего уровня (объекты geo/seoDefaults/operator — целиком). */
export const saveSettings = adminAction(
  settingsSchema,
  async (input, ctx) => {
    const current = await readSettings(ctx.tx);
    const diff: Record<string, { from: unknown; to: unknown }> = {};

    for (const key of Object.keys(input) as (keyof SettingsValues)[]) {
      const next = input[key];
      if (stableJson(current[key]) === stableJson(next)) continue;
      await upsertSetting(ctx.tx, key, next);
      diff[key] = { from: current[key], to: next };
    }

    const changed = Object.keys(diff);
    if (changed.length > 0) {
      await audit(ctx.userId, "settings.update", "settings", "*", diff, ctx.tx);
    }
    return { changed };
  },
  { tags: [TAGS.settings] }
);

/** Флаг ПДн в Telegram: включение только с явным подтверждением; каждое изменение — в журнал. */
export const setTelegramPii = adminAction(
  telegramPiiSchema,
  async (input, ctx) => {
    const [row] = await ctx.tx
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, PII_KEY))
      .limit(1);
    const from = row?.value === true;
    await upsertSetting(ctx.tx, PII_KEY, input.enabled);
    await audit(
      ctx.userId,
      "settings.telegramIncludePii",
      "settings",
      PII_KEY,
      { from, to: input.enabled, confirmed: input.confirmed },
      ctx.tx
    );
    return { enabled: input.enabled };
  },
  { tags: [TAGS.settings] }
);
