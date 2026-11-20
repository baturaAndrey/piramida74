import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export type AuthSession = typeof auth.$Infer.Session

/**
 * Сессия текущего запроса (дедуплицируется в рамках запроса).
 * `headers()` — динамический API: вызывать только внутри `<Suspense>`.
 */
export const getSession = cache(
  async (): Promise<AuthSession | null> => auth.api.getSession({ headers: await headers() })
)

export function isAdminSession(session: AuthSession | null): session is AuthSession {
  if (!session || session.user.banned) return false
  // role может быть списком через запятую (плагин admin)
  return String(session.user.role ?? "")
    .split(",")
    .map((r) => r.trim())
    .includes("admin")
}

/** Только для страниц и layout'ов админки: нет админа → redirect('/login'). */
export async function requireAdmin(): Promise<AuthSession> {
  const session = await getSession()
  if (!isAdminSession(session)) redirect("/login")
  return session
}

/** Для Server Actions и route handlers: нет админа → Error('UNAUTHORIZED'). */
export async function requireAdminAction(): Promise<AuthSession> {
  const session = await getSession()
  if (!isAdminSession(session)) throw new Error("UNAUTHORIZED")
  return session
}
