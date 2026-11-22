/**
 * Подбор списков карточек под статьёй. Изоморфный модуль: без React, `next/*` и БД.
 */

/** Сколько карточек показывать в «Похожих статьях» под статьёй. */
export const RELATED_UNDER_ARTICLE = 3;

/** Сколько карточек показывать в «Последних статьях» под статьёй. */
export const RECENT_UNDER_ARTICLE = 4;

/**
 * «Последние статьи» без тех, что уже показаны в «Похожих»: иначе при малом числе
 * статей оба блока выводят одни и те же карточки. Порядок `recent` сохраняется,
 * результат обрезается до `limit`. Поэтому `recent` нужно запрашивать с запасом
 * (`limit + shown.length`).
 */
export function excludeShown<T extends { id: string }>(
  recent: readonly T[],
  shown: readonly { id: string }[],
  limit: number
): T[] {
  const shownIds = new Set(shown.map((item) => item.id));
  return recent.filter((item) => !shownIds.has(item.id)).slice(0, Math.max(0, limit));
}
