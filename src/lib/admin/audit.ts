import { db } from "@/lib/db";
import { auditLog } from "@/lib/schema";

/** `db` или транзакция из `db.transaction(tx => …)` — для записи в той же транзакции. */
export type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Запись в журнал действий админки.
 * `action` — короткий код (`tournament.create`, `media.delete`…);
 * `diff` — `{ before?, after? }` или набор изменённых полей, без секретов и паролей.
 * Внутри `adminAction` передавайте `ctx.tx`, чтобы аудит откатывался вместе с изменением.
 */
export async function audit(
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  diff?: unknown,
  tx: DbOrTx = db
): Promise<void> {
  await tx
    .insert(auditLog)
    .values({ userId, action, entity, entityId, diff: (diff ?? {}) as object });
}
