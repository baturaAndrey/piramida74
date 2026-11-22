import { cache } from "react";
import { connection } from "next/server";
import { roundedNowIso } from "@/lib/content/blog-now";
import { getOpDate } from "@/lib/dates";

export interface HomeContext {
  /** Операционная дата YYYY-MM-DD (до 09:00 — предыдущий день), Asia/Yekaterinburg. */
  opDate: string;
  /** Момент «сейчас», округлённый до 5 минут (ISO), для блога. */
  now: string;
}

/**
 * Контекст главной: «сегодня» и «сейчас» вычисляются один раз за запрос после `connection()`
 * (так `next build` не трогает время/БД, а `'use cache'`-запросы получают дату аргументом).
 * `cache` дедуплицирует вызов в рамках одного рендера — все блоки видят одно и то же значение.
 */
export const getHomeContext = cache(async (): Promise<HomeContext> => {
  await connection();
  return { opDate: getOpDate(), now: roundedNowIso() };
});
