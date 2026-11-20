import { eq } from "drizzle-orm";
import type { DbOrTx } from "@/lib/admin/audit";
import { redirects } from "@/lib/schema";

/**
 * 301-редиректы при смене slug статьи или рубрики (`/blog/<old>` → `/blog/<new>`).
 * Правила (одинаковые для чистой модели и записи в БД):
 *  1) редиректы, ведущие на старый путь, перенаправляются на новый — цепочек a→b→c нет;
 *  2) редирект С нового пути (возврат к прежнему slug) удаляется — иначе петля;
 *  3) upsert `fromPath → toPath` с кодом 301.
 */

export type RedirectRule = { fromPath: string; toPath: string; code: number };

export const SLUG_REDIRECT_CODE = 301;

export function blogPath(slug: string): string {
  return `/blog/${slug}`;
}

/** Чистая модель `recordSlugRedirect` над списком правил — для тестов и документации. */
export function applySlugRedirect(
  rules: readonly RedirectRule[],
  fromPath: string,
  toPath: string
): RedirectRule[] {
  if (fromPath === toPath) return [...rules];
  const next = rules
    .map((rule) => (rule.toPath === fromPath ? { ...rule, toPath } : rule))
    .filter((rule) => rule.fromPath !== toPath && rule.fromPath !== fromPath);
  next.push({ fromPath, toPath, code: SLUG_REDIRECT_CODE });
  return next;
}

/** Записывает редирект в той же транзакции, что и смена slug. */
export async function recordSlugRedirect(
  tx: DbOrTx,
  fromPath: string,
  toPath: string
): Promise<void> {
  if (fromPath === toPath) return;
  await tx.update(redirects).set({ toPath }).where(eq(redirects.toPath, fromPath));
  await tx.delete(redirects).where(eq(redirects.fromPath, toPath));
  await tx
    .insert(redirects)
    .values({ fromPath, toPath, code: SLUG_REDIRECT_CODE })
    .onConflictDoUpdate({
      target: redirects.fromPath,
      set: { toPath, code: SLUG_REDIRECT_CODE },
    });
}

/**
 * Адрес `/blog/<slug>` снова занят статьёй или рубрикой (создание или переименование) —
 * редирект с него удаляется, иначе живая страница уводила бы посетителя по старому правилу.
 */
export async function releaseRedirectFrom(tx: DbOrTx, path: string): Promise<void> {
  await tx.delete(redirects).where(eq(redirects.fromPath, path));
}

/** Сущность удалена: редиректы на её адрес вели бы на 404 — убираем их, адреса отдают 404 сами. */
export async function dropRedirectsTo(tx: DbOrTx, path: string): Promise<void> {
  await tx.delete(redirects).where(eq(redirects.toPath, path));
}
