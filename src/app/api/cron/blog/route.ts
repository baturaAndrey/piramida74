import { revalidateTag } from "next/cache";
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

  revalidateTag(TAGS.blog, "max");
  return Response.json({ ok: true, revalidated: TAGS.blog });
}
