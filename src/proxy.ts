import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { lookupBlogRoute } from "@/lib/blog-route/lookup";

const BLOG_PREFIX = "/blog/";
/** Сегменты `/blog/*` со своими маршрутами — их proxy не проверяет */
const BLOG_RESERVED_SEGMENTS = new Set(["preview", "rss.xml"]);
/**
 * Путь без маршрута: сегменты с `_` в App Router приватные и никогда не становятся URL,
 * поэтому rewrite сюда рендерит корневой `not-found.tsx` с настоящим статусом 404.
 */
const NOT_FOUND_REWRITE_PATH = "/_not-found-blog";

/**
 * Только оптимистичный редирект по наличию cookie сессии (без обращения к БД).
 * Права проверяются в страницах (`requireStaff`) и Server Actions (`requireStaffAction`).
 */
function adminProxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = request.nextUrl.clone();
    const next = request.nextUrl.pathname + request.nextUrl.search;
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

/** `/blog/%D0%B0` → `/blog/а`; некорректная кодировка — `null` (адрес заведомо не найден) */
function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * Настоящие HTTP-коды для `/blog/<slug>`: страница стримится, и её `notFound()`/
 * `permanentRedirect()` (они остаются запасным вариантом) уже не могут поменять статус.
 */
async function blogProxy(request: NextRequest) {
  const segment = request.nextUrl.pathname.slice(BLOG_PREFIX.length);
  // Вложенные пути (`/blog/x/opengraph-image`) и служебные маршруты — без проверки
  if (!segment || segment.includes("/") || BLOG_RESERVED_SEGMENTS.has(segment)) {
    return NextResponse.next();
  }
  const slug = decodeSegment(segment);
  if (slug === null) {
    return NextResponse.rewrite(new URL(NOT_FOUND_REWRITE_PATH, request.url));
  }

  let route: Awaited<ReturnType<typeof lookupBlogRoute>>;
  try {
    route = await lookupBlogRoute(slug);
  } catch (error) {
    // БД недоступна — решение принимает сама страница (notFound/permanentRedirect)
    console.error("[proxy] blog route lookup failed", error);
    return NextResponse.next();
  }

  switch (route.kind) {
    case "page":
      return NextResponse.next();
    case "redirect": {
      const target = new URL(route.to, request.url);
      // Цель без своей query-строки сохраняет исходную (utm-метки и т. п.)
      if (!target.search) target.search = request.nextUrl.search;
      return NextResponse.redirect(target, route.code);
    }
    case "missing":
      return NextResponse.rewrite(new URL(NOT_FOUND_REWRITE_PATH, request.url));
  }
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith(BLOG_PREFIX)) return blogProxy(request);
  return adminProxy(request);
}

export const config = {
  // `/blog/:slug` — ровно один сегмент; `preview` и `rss.xml` исключены и здесь, и в коде
  matcher: ["/admin/:path*", "/blog/:slug((?!preview$|rss\\.xml$)[^/]+)"],
};
