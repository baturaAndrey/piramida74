// Намеренно без 'use server': модуль — фабрика, её результат экспортируют 'use server'-файлы разделов.
import { updateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { DbOrTx } from "@/lib/admin/audit";
import { db } from "@/lib/db";
import { requireAdminAction } from "@/lib/session";

export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Ожидаемая бизнес-ошибка: превращается в `{ ok: false, error, fieldErrors }`. */
export class ActionError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ActionError";
  }
}

/** Контекст handler'а. Аудита в ctx НЕТ: handler сам вызывает `audit(ctx.userId, …, ctx.tx)`. */
export type ActionCtx = { userId: string; tx: DbOrTx };

type TagsOption<I, T> = string[] | ((input: I, result: T) => string[]);

const ERR_UNAUTHORIZED = "Нет доступа";
const ERR_VALIDATION = "Проверьте введённые данные";
const ERR_INTERNAL = "Внутренняя ошибка. Попробуйте ещё раз.";

const NO_REDIRECT = Symbol("no-redirect");

/**
 * Ошибка-сигнал `redirect()`/`permanentRedirect()`. Next не экспортирует публичный
 * `isRedirectError`, поэтому проверяем формат digest (`NEXT_REDIRECT;…`), как делает сам Next.
 * Прочие сигналы (`notFound()`, `forbidden()`) откатывают транзакцию и пробрасываются в catch.
 */
function isRedirectError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) return false;
  return typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT;");
}

/** `z.flattenError` типизирует значения как `string[] | undefined` — убираем пустые ключи. */
function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  const result: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(flat)) {
    if (messages && messages.length > 0) result[key] = messages;
  }
  return result;
}

/**
 * Обёртка Server Action админки:
 * проверка роли → zod → транзакция с handler'ом (он же пишет аудит через `ctx.tx`)
 * → `updateTag` для тегов и `afterCommit` (только после успешного коммита) → `{ ok: true, data }`.
 */
export function adminAction<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.output<S>, ctx: ActionCtx) => Promise<T>,
  opts: {
    tags: TagsOption<z.output<S>, T>;
    /** Сброс внешних (не `'use cache'`) кэшей — только после успешного коммита */
    afterCommit?: () => void;
  }
): (input: z.input<S>) => Promise<ActionResult<T>> {
  return async (input) => {
    let userId: string;
    try {
      const session = await requireAdminAction();
      userId = session.user.id;
    } catch (error) {
      // Динамические API (prerender) и redirect не должны превращаться в «Нет доступа»
      unstable_rethrow(error);
      return { ok: false, error: ERR_UNAUTHORIZED };
    }

    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: ERR_VALIDATION, fieldErrors: toFieldErrors(parsed.error) };
    }

    try {
      // redirect() из handler'а означает успех: перехватываем его внутри транзакции,
      // чтобы изменения закоммитились, и пробрасываем после коммита и сброса кэша.
      let redirectSignal: unknown = NO_REDIRECT;
      const data = await db.transaction(async (tx) => {
        try {
          return await handler(parsed.data, { userId, tx });
        } catch (error) {
          if (!isRedirectError(error)) throw error;
          redirectSignal = error;
          return undefined as T;
        }
      });
      // `result` при redirect() — undefined: функция тегов должна это допускать
      const tags = typeof opts.tags === "function" ? opts.tags(parsed.data, data) : opts.tags;
      for (const tag of new Set(tags)) updateTag(tag);
      opts.afterCommit?.();
      if (redirectSignal !== NO_REDIRECT) throw redirectSignal;
      return { ok: true, data };
    } catch (error) {
      // redirect()/notFound() внутри handler'а должны дойти до Next
      unstable_rethrow(error);
      if (error instanceof ActionError) {
        return error.fieldErrors
          ? { ok: false, error: error.message, fieldErrors: error.fieldErrors }
          : { ok: false, error: error.message };
      }
      console.error("[adminAction]", error);
      return { ok: false, error: ERR_INTERNAL };
    }
  };
}
