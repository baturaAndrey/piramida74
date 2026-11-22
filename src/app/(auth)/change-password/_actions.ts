"use server";

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { isAPIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import type { ActionResult } from "@/lib/admin/action";
import { audit } from "@/lib/admin/audit";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { user } from "@/lib/schema";
import { getSession, isStaffSession, mustChangePassword } from "@/lib/session";
import { changeTemporaryPasswordSchema, type ChangeTemporaryPasswordValues } from "./_schema";

const ADMIN_HOME = "/admin";

/** Коды ошибок Better Auth → поле формы и текст */
const AUTH_ERRORS: Record<string, { field: keyof ChangeTemporaryPasswordValues; message: string }> =
  {
    INVALID_PASSWORD: { field: "currentPassword", message: "Неверный временный пароль" },
    PASSWORD_TOO_SHORT: {
      field: "newPassword",
      message: `Не короче ${MIN_PASSWORD_LENGTH} символов`,
    },
    PASSWORD_TOO_LONG: {
      field: "newPassword",
      message: `Не длиннее ${MAX_PASSWORD_LENGTH} символов`,
    },
  };

/**
 * Смена временного пароля при первом входе (или после сброса главным админом).
 *
 * Не через `adminAction`: тот требует уже сменённый пароль. Здесь достаточно сессии сотрудника
 * или админа с флагом `mustChangePassword`. Пароль меняет сам Better Auth (`changePassword`
 * проверяет временный пароль); `revokeOtherSessions` завершает все прочие сеансы и выдаёт новую
 * сессию — cookie ставит плагин `nextCookies`, поэтому пользователь остаётся в системе.
 * Флаг снимается только после успешной смены. Успех — redirect в /admin.
 */
export async function changeTemporaryPassword(
  input: ChangeTemporaryPasswordValues
): Promise<ActionResult> {
  let userId: string;
  try {
    const session = await getSession();
    if (!isStaffSession(session)) return { ok: false, error: "Нет доступа" };
    // Пароль уже сменён (например, во второй вкладке) — просто в админку
    if (!mustChangePassword(session)) redirect(ADMIN_HOME);
    userId = session.user.id;
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: "Нет доступа" };
  }

  const parsed = changeTemporaryPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Проверьте введённые данные" };

  try {
    await auth.api.changePassword({
      headers: await headers(),
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
    });
  } catch (error) {
    const known = isAPIError(error) ? AUTH_ERRORS[String(error.body?.code)] : undefined;
    if (known) {
      return { ok: false, error: known.message, fieldErrors: { [known.field]: [known.message] } };
    }
    console.error("[changeTemporaryPassword]", error);
    return { ok: false, error: "Не удалось сменить пароль. Попробуйте ещё раз" };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.update(user).set({ mustChangePassword: false }).where(eq(user.id, userId));
      await audit(userId, "user.change-temporary-password", "user", userId, {}, tx);
    });
  } catch (error) {
    // Пароль уже новый: при повторе формы его нужно ввести как «временный»
    console.error("[changeTemporaryPassword] flag reset failed", error);
    return {
      ok: false,
      error: "Пароль изменён, но вход не завершён. Обновите страницу и введите новый пароль",
    };
  }

  redirect(ADMIN_HOME);
}
