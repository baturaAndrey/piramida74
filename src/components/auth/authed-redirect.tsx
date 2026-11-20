import { redirect } from "next/navigation"
import { getSession, isAdminSession } from "@/lib/session"

/**
 * Уже вошедшего админа уводит в /admin. Пользователя с сессией, но без роли admin,
 * не редиректим — иначе цикл /admin → /login → /admin.
 * Использует headers(), поэтому рендерится внутри <Suspense>.
 */
export async function AuthedRedirect() {
  const session = await getSession()
  if (isAdminSession(session)) redirect("/admin")
  return null
}
