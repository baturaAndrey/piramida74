import { revalidateTag } from "next/cache";
import { bumpBlogRouteCache } from "@/lib/blog-route/lookup";
import { TAGS } from "@/lib/cache-tags";
import { isValidCronRequest } from "@/lib/cron-auth";

/**
 * `POST /api/cron/blog` с `Authorization: Bearer $CRON_SECRET` — сбрасывает кэш блога
 * (отложенные статьи появляются сразу, а не через ≤ 5 минут). Dokploy Schedules
 * вызывает ежечасно. Без `CRON_SECRET` всегда 401.
 */

function unauthorized() {
  return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
}

export async function POST(request: Request) {
  if (!isValidCronRequest(request)) return unauthorized();

  // Вызов извне Server Action (cron) — updateTag недоступен; { expire: 0 } сбрасывает кэш без stale-ответов
  revalidateTag(TAGS.blog, { expire: 0 });
  // Proxy держит «404» для /blog/<slug> до 60 с — наступившая отложенная статья должна открываться сразу
  bumpBlogRouteCache();
  return Response.json({ ok: true, revalidated: TAGS.blog });
}
