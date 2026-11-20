import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

/**
 * Только оптимистичный редирект по наличию cookie сессии (без обращения к БД).
 * Права проверяются в страницах (`requireAdmin`) и Server Actions (`requireAdminAction`).
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = request.nextUrl.clone()
    const next = request.nextUrl.pathname + request.nextUrl.search
    url.pathname = "/login"
    url.search = ""
    url.searchParams.set("next", next)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = { matcher: ["/admin/:path*"] }
