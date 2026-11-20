/**
 * Теги кэша публичных запросов (`'use cache'` + `cacheTag`).
 * Админка сбрасывает их через `updateTag` (Server Actions); route handlers (cron, вебхуки) —
 * через `revalidateTag(tag, { expire: 0 })`: немедленное истечение, следующий запрос ждёт свежие данные.
 * Модуль без серверных импортов — безопасен для клиентских компонентов.
 */
export const TAGS = {
  tournaments: "tournaments",
  pricing: "pricing",
  promotions: "promotions",
  menu: "menu",
  sets: "sets",
  galleries: "galleries",
  services: "services",
  settings: "settings",
  blog: "blog",
  legal: "legal",
} as const;

export type CacheTag = (typeof TAGS)[keyof typeof TAGS];

/** Тег отдельной статьи блога */
export const articleTag = (slug: string) => `article:${slug}`;
