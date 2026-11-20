// Без 'use server' и серверных импортов: схемы общие для форм (RHF-резолвер) и Server Actions блога.
import { z } from "zod";
import { toLocalInputValue } from "@/lib/content/local-datetime";
import { parseLocalDateTime } from "@/lib/dates";

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** «rss.xml» не пройдёт и по SLUG_RE; держим для явной ошибки и проверки в `checkSlugAvailable` */
export const RESERVED_BLOG_SLUGS = ["preview", "rss.xml"] as const;

export const SLUG_MAX = 120;
export const ARTICLE_TITLE_MAX = 200;
export const EXCERPT_MAX = 400;
export const BODY_MAX = 200_000;
export const ARTICLE_TAGS_MAX = 30;
export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 200;
export const RUBRIC_NAME_MAX = 100;
export const RUBRIC_DESCRIPTION_MAX = 500;
export const TAG_NAME_MAX = 60;
export const AUTHOR_NAME_MAX = 120;
export const AUTHOR_TEXT_MAX = 120;
export const AUTHOR_BIO_MAX = 5000;
export const SAME_AS_MAX = 10;

export const ARTICLE_STATUSES = ["draft", "scheduled", "published"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

/** Значение `<input type="datetime-local">` без секунд */
export const LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * Формат `LOCAL_DATETIME_RE` и существующая дата. `Date.UTC` молча переносит «2026-02-30»
 * или «25:00» на следующие сутки, поэтому значение должно совпасть с самим собой после
 * разбора и обратного форматирования (в Asia/Yekaterinburg нет перехода на летнее время).
 */
export function isValidLocalDateTime(value: string): boolean {
  if (!LOCAL_DATETIME_RE.test(value)) return false;
  const date = parseLocalDateTime(value);
  return !Number.isNaN(date.getTime()) && toLocalInputValue(date) === value;
}

export function isReservedBlogSlug(slug: string): boolean {
  return (RESERVED_BLOG_SLUGS as readonly string[]).includes(slug);
}

export const slugSchema = z
  .string()
  .trim()
  .min(1, "Укажите slug")
  .max(SLUG_MAX, `Не длиннее ${SLUG_MAX} символов`)
  .regex(SLUG_RE, "Slug: латиница, цифры и дефис")
  .refine((s) => !isReservedBlogSlug(s), "Этот slug зарезервирован");

/** Необязательная строка: пустая/пробельная → `null` */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Не длиннее ${max} символов`)
    .nullish()
    .transform((v) => v || null);
}

export const articleSchema = z
  .object({
    id: z.uuid().optional(),
    title: z
      .string()
      .trim()
      .min(1, "Укажите заголовок")
      .max(ARTICLE_TITLE_MAX, `Не длиннее ${ARTICLE_TITLE_MAX} символов`),
    slug: slugSchema,
    excerpt: z.string().trim().max(EXCERPT_MAX, `Не длиннее ${EXCERPT_MAX} символов`).default(""),
    body: z.string().max(BODY_MAX, "Слишком длинный текст").default(""),
    coverMediaId: z.uuid().nullish(),
    authorId: z.uuid().nullish(),
    rubricId: z.uuid().nullish(),
    tagIds: z
      .array(z.uuid())
      .max(ARTICLE_TAGS_MAX, `Не больше ${ARTICLE_TAGS_MAX} тегов`)
      .default([]),
    isFeatured: z.boolean().default(false),
    showToc: z.boolean().default(true),
    status: z.enum(ARTICLE_STATUSES),
    /** Значение `<input type="datetime-local">` (время Asia/Yekaterinburg), `''` или `null` */
    publishAt: z
      .string()
      .regex(LOCAL_DATETIME_RE, "Неверный формат даты")
      .refine(isValidLocalDateTime, "Такой даты не существует")
      .or(z.literal(""))
      .nullish(),
    seoTitle: optionalText(SEO_TITLE_MAX),
    seoDescription: optionalText(SEO_DESCRIPTION_MAX),
    noindex: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.status === "scheduled" && !v.publishAt) {
      ctx.addIssue({
        code: "custom",
        path: ["publishAt"],
        message: "Укажите дату и время публикации",
      });
    }
  });

export type ArticleInput = z.input<typeof articleSchema>;
export type ArticleValues = z.output<typeof articleSchema>;

export const rubricSchema = z.object({
  id: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Укажите название")
    .max(RUBRIC_NAME_MAX, `Не длиннее ${RUBRIC_NAME_MAX} символов`),
  slug: slugSchema,
  description: optionalText(RUBRIC_DESCRIPTION_MAX),
  imageMediaId: z.uuid().nullish(),
});

export type RubricInput = z.input<typeof rubricSchema>;

export const tagSchema = z.object({
  id: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Укажите название")
    .max(TAG_NAME_MAX, `Не длиннее ${TAG_NAME_MAX} символов`),
  slug: slugSchema,
});

export type TagInput = z.input<typeof tagSchema>;

export const tagInlineSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Укажите название")
    .max(TAG_NAME_MAX, `Не длиннее ${TAG_NAME_MAX} символов`),
});

/** Ссылка профиля автора (`sameAs`): только `https://` с доменным именем */
export const httpsUrlSchema = z
  .string()
  .trim()
  .pipe(
    z.url({
      protocol: /^https$/,
      hostname: z.regexes.domain,
      error: "Только ссылки https://",
    })
  );

export const authorSchema = z.object({
  id: z.uuid().optional(),
  slug: slugSchema,
  name: z
    .string()
    .trim()
    .min(1, "Укажите имя")
    .max(AUTHOR_NAME_MAX, `Не длиннее ${AUTHOR_NAME_MAX} символов`),
  photoMediaId: z.uuid().nullish(),
  roleInClub: optionalText(AUTHOR_TEXT_MAX),
  rank: optionalText(AUTHOR_TEXT_MAX),
  bio: optionalText(AUTHOR_BIO_MAX),
  sameAs: z.array(httpsUrlSchema).max(SAME_AS_MAX, `Не больше ${SAME_AS_MAX} ссылок`).default([]),
  isActive: z.boolean().default(true),
});

export type AuthorInput = z.input<typeof authorSchema>;

/**
 * Схема формы автора: `useFieldArray` работает только с массивом объектов,
 * поэтому `sameAs` в форме — `{ value }[]`; перед отправкой превращается в `string[]`.
 */
export const authorFormSchema = authorSchema.extend({
  sameAs: z
    .array(z.object({ value: httpsUrlSchema }))
    .max(SAME_AS_MAX, `Не больше ${SAME_AS_MAX} ссылок`),
});

export type AuthorFormInput = z.input<typeof authorFormSchema>;
export type AuthorFormValues = z.output<typeof authorFormSchema>;

export const idSchema = z.object({ id: z.uuid() });

export const reorderSchema = z.object({ ids: z.array(z.uuid()).max(500) });

export const SLUG_ENTITIES = ["article", "rubric", "author", "tag"] as const;
export type SlugEntity = (typeof SLUG_ENTITIES)[number];

/** Вход `checkSlugAvailable`: сам slug проверяется внутри (невалидный → `{ available: false }`) */
export const slugCheckSchema = z.object({
  entity: z.enum(SLUG_ENTITIES),
  slug: z.string().max(500),
  ignoreId: z.uuid().optional(),
});
