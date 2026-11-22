import "server-only";
import { asc, eq, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { panelLevel, type PanelLevel } from "@/lib/roles";
import { session, user } from "@/lib/schema";
import { fullDateTimeFormat } from "../leads/_lib/labels";

/** Строка списка пользователей (сериализуемая — уходит в клиентскую таблицу) */
export type PanelUserRow = {
  id: string;
  name: string;
  email: string;
  level: PanelLevel;
  createdAt: string; // ISO
  createdAtLabel: string; // «22 нояб. 2026 г., 14:05» (Екатеринбург)
  /** Начало последнего активного сеанса; null — активных сеансов нет */
  lastSignInAt: string | null;
  lastSignInLabel: string | null;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
};

/**
 * Пользователи админки (главные админы и сотрудники). Пользователи без доступа (роль `user`)
 * не показываются: управлять ими здесь нечем.
 * «Последний вход» — по существующим сессиям: истёкшие и завершённые Better Auth удаляет.
 */
export async function listPanelUsers(): Promise<PanelUserRow[]> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      mustChangePassword: user.mustChangePassword,
      twoFactorEnabled: user.twoFactorEnabled,
      lastSignInAt: max(session.createdAt),
    })
    .from(user)
    .leftJoin(session, eq(session.userId, user.id))
    .groupBy(user.id)
    .orderBy(asc(user.createdAt));

  return rows.flatMap((row) => {
    const level = panelLevel(row.role);
    if (!level) return [];
    const lastSignIn = row.lastSignInAt ? new Date(row.lastSignInAt) : null;
    return [
      {
        id: row.id,
        name: row.name,
        email: row.email,
        level,
        createdAt: row.createdAt.toISOString(),
        createdAtLabel: fullDateTimeFormat.format(row.createdAt),
        lastSignInAt: lastSignIn?.toISOString() ?? null,
        lastSignInLabel: lastSignIn ? fullDateTimeFormat.format(lastSignIn) : null,
        mustChangePassword: row.mustChangePassword,
        twoFactorEnabled: row.twoFactorEnabled === true,
      },
    ];
  });
}
