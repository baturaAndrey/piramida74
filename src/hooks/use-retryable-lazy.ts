"use client";

import { lazy, useCallback, useState, type ComponentType, type LazyExoticComponent } from "react";

/** Загрузчик модуля с default-экспортом компонента — как для `React.lazy` */
export type LazyComponentLoader<T extends ComponentType<any>> = () => Promise<{ default: T }>;

/**
 * `React.lazy`, который можно перезапустить после сбоя загрузки чанка.
 *
 * Объект `lazy()` навсегда запоминает отклонённый промис: созданный один раз на уровне модуля,
 * после первого обрыва сети он бросает ту же ошибку при каждом рендере, и сброс `LazyBoundary`
 * ничего не даёт до перезагрузки страницы. Поэтому объект живёт в состоянии компонента,
 * а `retry()` (вызывать из `onError` границы) подменяет его новым — следующий рендер снова
 * вызовет `load()`. Сборщик (Turbopack/webpack) после неудачи убирает чанк из кэша, так что
 * повторный `import()` идёт в сеть заново.
 *
 * `load` должен быть стабильным (объявлен на уровне модуля): тот же загрузчик передаётся в
 * `createPrefetch`, и предзагрузка при наведении прогревает тот же модуль.
 */
export function useRetryableLazy<T extends ComponentType<any>>(
  load: LazyComponentLoader<T>
): [component: LazyExoticComponent<T>, retry: () => void] {
  const [component, setComponent] = useState(() => lazy(load));
  const retry = useCallback(() => setComponent(() => lazy(load)), [load]);
  return [component, retry];
}
