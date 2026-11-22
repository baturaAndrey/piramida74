import { redirect } from "next/navigation"
import { getSession, isStaffSession } from "@/lib/session"

/**
 * Уже вошедшего сотрудника или админа уводит в /admin. Пользователя с сессией, но без доступа к админке,
 * не редиректим — иначе цикл /admin → /login → /admin.
 * Использует headers(), поэтому рендерится внутри <Suspense>.
 */
export async function AuthedRedirect() {
  const session = await getSession()
  if (isStaffSession(session)) redirect("/admin")
  return null
}
