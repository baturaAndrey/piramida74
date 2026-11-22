import { cache } from "react"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { panelLevel, type PanelLevel } from "@/lib/roles"

export type AuthSession = typeof auth.$Infer.Session

/** Страница принудительной смены временного пароля (вне layout админки) */
export const CHANGE_PASSWORD_PATH = "/change-password"

/**
 * Сессия текущего запроса (дедуплицируется в рамках запроса).
 * `headers()` — динамический API: вызывать только внутри `<Suspense>`.
 */
export const getSession = cache(
  async (): Promise<AuthSession | null> => auth.api.getSession({ headers: await headers() })
)

/** Уровень доступа сессии к админке; `null` — нет сессии, бан или роль без доступа */
export function sessionLevel(session: AuthSession | null): PanelLevel | null {
  if (!session || session.user.banned) return null
  return panelLevel(session.user.role)
}

/** Сессия сотрудника или главного админа (без учёта флага смены пароля) */
export function isStaffSession(session: AuthSession | null): session is AuthSession {
  return sessionLevel(session) !== null
}

/** Сессия главного админа (роль `admin`) */
export function isOwnerSession(session: AuthSession | null): session is AuthSession {
  return sessionLevel(session) === "owner"
}

/** Флаг выставляется при создании пользователя и сбросе временного пароля главным админом */
export function mustChangePassword(session: AuthSession): boolean {
  return session.user.mustChangePassword === true
}

/**
 * Страницы и layout'ы админки: нет доступа → `/login`; временный пароль не сменён →
 * `/change-password` (вся админка недоступна, пока пароль не сменён).
 */
export async function requireStaff(): Promise<AuthSession> {
  const session = await getSession()
  if (!isStaffSession(session)) redirect("/login")
  if (mustChangePassword(session)) redirect(CHANGE_PASSWORD_PATH)
  return session
}

/** Разделы только для главного админа («Пользователи»): сотруднику — 404, как будто раздела нет. */
export async function requireOwner(): Promise<AuthSession> {
  const session = await requireStaff()
  if (!isOwnerSession(session)) notFound()
  return session
}

/**
 * Server Actions и route handlers админки: нет доступа или не сменён временный пароль →
 * `Error('UNAUTHORIZED')`.
 */
export async function requireStaffAction(): Promise<AuthSession> {
  const session = await getSession()
  if (!isStaffSession(session) || mustChangePassword(session)) throw new Error("UNAUTHORIZED")
  return session
}

/** Server Actions только для главного админа → `Error('UNAUTHORIZED')` для остальных. */
export async function requireOwnerAction(): Promise<AuthSession> {
  const session = await requireStaffAction()
  if (!isOwnerSession(session)) throw new Error("UNAUTHORIZED")
  return session
}
