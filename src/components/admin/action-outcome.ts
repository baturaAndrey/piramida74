/**
 * Результат клиентского колбэка админки. Server Actions из `adminAction` не бросают исключения,
 * а возвращают `{ ok: false, error }` — такой результат считается неуспехом наравне с исключением.
 */
export type ActionOutcome = void | { ok: boolean; error?: string };

/** Колбэк, который можно передать как обычную функцию или напрямую вернуть результат Server Action. */
export type ActionCallback<A extends unknown[] = []> = (
  ...args: A
) => ActionOutcome | Promise<ActionOutcome>;

/**
 * Выполняет колбэк и нормализует неуспех: исключение и `{ ok: false }` превращаются в текст ошибки.
 * Возвращает `null` при успехе.
 */
export async function runActionCallback<A extends unknown[]>(
  callback: ActionCallback<A>,
  args: A,
  fallbackError: string
): Promise<string | null> {
  try {
    const outcome = await callback(...args);
    if (outcome && !outcome.ok) return outcome.error || fallbackError;
    return null;
  } catch (error) {
    return error instanceof Error && error.message ? error.message : fallbackError;
  }
}
