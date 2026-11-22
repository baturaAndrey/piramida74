"use server";

import { headers } from "next/headers";
import { isAPIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";
import { ActionError, adminAction } from "@/lib/admin/action";
import { audit } from "@/lib/admin/audit";
import { auth } from "@/lib/auth";
import { panelLevel, STAFF_ROLE, userDeletionError } from "@/lib/roles";
import { account, session, user } from "@/lib/schema";
import { createUserSchema, deleteUserSchema, resetTemporaryPasswordSchema } from "./_lib/schema";

// Раздел «Пользователи» — только главный админ (`access: "owner"`). Публичного кэша нет —
// tags: [], клиент делает router.refresh().

const CREDENTIAL_PROVIDER = "credential";
const BETTER_AUTH_USER_EXISTS = "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL";

/**
 * Новый сотрудник с временным паролем. Создаётся через `auth.api.createUser` с заголовками
 * запроса: Better Auth сам ещё раз проверяет, что вызывающий — admin (право `user:create`),
 * хеширует пароль по своей конфигурации и создаёт credential-аккаунт.
 * `mustChangePassword: true` — при первом входе админка пустит только на смену пароля.
 */
export const createPanelUser = adminAction(
  createUserSchema,
  async (input, ctx) => {
    let created: { id: string };
    try {
      const result = await auth.api.createUser({
        headers: await headers(),
        body: {
          email: input.email,
          name: input.name,
          password: input.password,
          // role — через data: тип body.role у плагина допускает только встроенные роли
          // (user/admin); плагин читает role и из data и так же проверяет право set-role
          data: { role: STAFF_ROLE, mustChangePassword: true, emailVerified: true },
        },
      });
      created = result.user;
    } catch (error) {
      if (isAPIError(error) && error.body?.code === BETTER_AUTH_USER_EXISTS) {
        throw new ActionError("Пользователь с таким email уже есть", {
          email: ["Этот email уже занят"],
        });
      }
      throw error;
    }

    await audit(
      ctx.userId,
      "user.create",
      "user",
      created.id,
      { after: { email: input.email, name: input.name, role: STAFF_ROLE } },
      ctx.tx
    );
    return { id: created.id };
  },
  { tags: [], access: "owner" }
);

/**
 * Удаление пользователя админки. Нельзя удалить себя и последнего главного админа.
 * Строки пользователей блокируются (`FOR UPDATE`) — два одновременных удаления не оставят
 * клуб без главного админа. Сессии, аккаунты и 2FA удаляются каскадом (FK on delete cascade);
 * в audit_log и медиатеке ссылка на пользователя обнуляется (set null).
 */
export const deletePanelUser = adminAction(
  deleteUserSchema,
  async (input, ctx) => {
    // Пользователей единицы — блокируем всех, чтобы подсчёт главных админов был согласованным
    const users = await ctx.tx
      .select({ id: user.id, role: user.role, email: user.email, name: user.name })
      .from(user)
      .for("update");
    // Права проверены до транзакции — под блокировкой убеждаемся, что вызывающий всё ещё
    // главный админ (его могли разжаловать или удалить параллельно)
    const actor = users.find((row) => row.id === ctx.userId);
    if (!actor || panelLevel(actor.role) !== "owner") throw new ActionError("Нет доступа");
    const target = users.find((row) => row.id === input.userId);
    if (!target) throw new ActionError("Пользователь не найден — возможно, уже удалён");

    const ownerCount = users.filter((row) => panelLevel(row.role) === "owner").length;
    const denied = userDeletionError(ctx.userId, target, ownerCount);
    if (denied) throw new ActionError(denied);

    // Явно, хотя FK удалит сессии каскадом: сеансы пользователя завершаются в любом случае
    await ctx.tx.delete(session).where(eq(session.userId, target.id));
    await ctx.tx.delete(user).where(eq(user.id, target.id));
    await audit(
      ctx.userId,
      "user.delete",
      "user",
      target.id,
      { before: { email: target.email, name: target.name, role: target.role } },
      ctx.tx
    );
    return { id: target.id };
  },
  { tags: [], access: "owner" }
);

/**
 * Новый временный пароль сотруднику: завершает все его сеансы и снова требует смену пароля
 * при входе. Главным админам (в т. ч. себе) не сбрасывается — они меняют пароль в «Аккаунте».
 */
export const resetTemporaryPassword = adminAction(
  resetTemporaryPasswordSchema,
  async (input, ctx) => {
    const [target] = await ctx.tx
      .select({ id: user.id, role: user.role, email: user.email })
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1)
      .for("update");
    if (!target) throw new ActionError("Пользователь не найден — возможно, уже удалён");
    if (panelLevel(target.role) !== "staff") {
      throw new ActionError("Временный пароль можно задать только сотруднику");
    }

    // Хеш — тем же алгоритмом, что и у Better Auth (scrypt из конфигурации auth)
    const authContext = await auth.$context;
    const passwordHash = await authContext.password.hash(input.password);
    const updated = await ctx.tx
      .update(account)
      .set({ password: passwordHash })
      .where(and(eq(account.userId, target.id), eq(account.providerId, CREDENTIAL_PROVIDER)))
      .returning({ id: account.id });
    if (updated.length === 0) throw new ActionError("У пользователя нет входа по паролю");

    await ctx.tx.update(user).set({ mustChangePassword: true }).where(eq(user.id, target.id));
    await ctx.tx.delete(session).where(eq(session.userId, target.id));
    // Пароль в аудит не пишется
    await audit(
      ctx.userId,
      "user.reset-password",
      "user",
      target.id,
      { email: target.email },
      ctx.tx
    );
    return { id: target.id };
  },
  { tags: [], access: "owner" }
);
