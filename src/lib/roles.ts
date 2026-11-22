/**
 * Уровни доступа к админке (поле `user.role` плагина admin Better Auth).
 *
 * - `admin` — главный админ (владелец): вся админка + раздел «Пользователи». Единственная роль,
 *   которой плагин admin разрешает свои эндпоинты (`createUser`, `removeUser`, `setRole`…):
 *   в `auth.ts` не задан `roles`, поэтому действуют встроенные роли `admin`/`user`, а у `staff`
 *   прав в access control нет совсем.
 * - `staff` — сотрудник: вся админка, кроме раздела «Пользователи».
 *
 * Чистый модуль без server-only: используется в guard'ах, Server Actions и unit-тестах.
 */
export const OWNER_ROLE = "admin";
export const STAFF_ROLE = "staff";

export type PanelLevel = "owner" | "staff";

/** Подписи уровней в интерфейсе */
export const PANEL_LEVEL_LABELS: Record<PanelLevel, string> = {
  owner: "Главный админ",
  staff: "Сотрудник",
};

/**
 * Роль плагина admin может быть списком через запятую: `"admin,staff"`. Без trim — как в
 * hasPermission Better Auth: `"staff, admin"` не должна давать в панели больше прав, чем там.
 */
export function parseRoles(role: string | null | undefined): string[] {
  return String(role ?? "")
    .split(",")
    .filter(Boolean);
}

/** Уровень доступа к админке по роли; `null` — доступа нет (например, роль по умолчанию `user`) */
export function panelLevel(role: string | null | undefined): PanelLevel | null {
  const roles = parseRoles(role);
  if (roles.includes(OWNER_ROLE)) return "owner";
  if (roles.includes(STAFF_ROLE)) return "staff";
  return null;
}

type DeletableUser = { id: string; role: string | null };

/**
 * Можно ли удалить пользователя. `ownerCount` — число главных админов в БД (включая цель).
 * Возвращает текст ошибки для интерфейса или `null`, если удаление разрешено.
 */
export function userDeletionError(
  actorId: string,
  target: DeletableUser,
  ownerCount: number
): string | null {
  if (target.id === actorId) return "Нельзя удалить самого себя";
  if (panelLevel(target.role) === "owner" && ownerCount <= 1) {
    return "Нельзя удалить последнего главного админа";
  }
  return null;
}
