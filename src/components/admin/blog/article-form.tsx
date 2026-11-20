"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ChevronDown, ExternalLink, Loader2, Save } from "lucide-react";
import { useForm, useWatch, type Path } from "react-hook-form";
import { toast } from "sonner";
import { FormActions } from "@/components/admin/form-actions";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createPreviewLink, deleteArticle, saveArticle } from "@/lib/actions/blog-articles";
import type { MediaDto } from "@/lib/admin/media-dto";
import { cn } from "@/lib/utils";
import {
  ARTICLE_TITLE_MAX,
  articleSchema,
  EXCERPT_MAX,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  type ArticleInput,
  type ArticleStatus,
  type ArticleValues,
} from "@/lib/validation/blog";
import { ContentPreviewButton } from "./content-preview-button";
import { ShortcodeToolbar } from "./shortcode-toolbar";
import { SlugField } from "./slug-field";
import { TagPicker, type TagPickerOption } from "./tag-picker";

type Option = { id: string; name: string };

export type ArticleFormProps = {
  defaultValues: ArticleInput;
  initialCover: MediaDto | null;
  rubrics: Option[];
  authors: (Option & { isActive: boolean })[];
  tags: TagPickerOption[];
  /** Статья сейчас видна на сайте — перевод в черновик требует подтверждения */
  isLive?: boolean;
};

const LIST_HREF = "/admin/blog/articles";
/** Radix Select не допускает пустое значение у пункта */
const NONE = "__none__";
const COVER_ASPECT = 16 / 9;
const SEO_TITLE_HINT = "Оптимально 50–60 символов. Пусто — используется заголовок статьи.";
const SEO_DESCRIPTION_HINT = "До 160 символов. Пусто — используется краткое описание.";

const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: "Черновик",
  scheduled: "Запланирована",
  published: "Опубликована",
};

type SaveMode = "stay" | "close";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Counter({ value, max }: { value: string | null | undefined; max: number }) {
  const length = value?.length ?? 0;
  return (
    <span className={cn("tabular-nums", length > max && "text-destructive")}>
      {length}/{max}
    </span>
  );
}

function SwitchField({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <FormItem className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1">
        <FormLabel>{label}</FormLabel>
        <FormDescription>{description}</FormDescription>
      </div>
      <FormControl>
        <Switch checked={checked} onCheckedChange={onChange} />
      </FormControl>
    </FormItem>
  );
}

/**
 * Next (cacheComponents) сохраняет состояние посещённых страниц, поэтому после создания
 * статьи форма пересоздаётся — повторный заход на «Новую статью» начинается с чистого листа.
 */
export function ArticleForm(props: ArticleFormProps) {
  const [instance, setInstance] = useState(0);
  return (
    <ArticleFormInner
      key={instance}
      {...props}
      onCreated={() => setInstance((value) => value + 1)}
    />
  );
}

function ArticleFormInner({
  defaultValues,
  initialCover,
  rubrics,
  authors,
  tags,
  isLive = false,
  onCreated,
}: ArticleFormProps & { onCreated: () => void }) {
  const router = useRouter();
  const form = useForm<ArticleInput, unknown, ArticleValues>({
    resolver: zodResolver(articleSchema),
    defaultValues,
  });
  const { control, setValue, setError, formState } = form;
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const modeRef = useRef<SaveMode>("stay");
  const [serverError, setServerError] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<ArticleValues | null>(null);
  const [seoOpen, setSeoOpen] = useState(
    Boolean(defaultValues.seoTitle || defaultValues.seoDescription || defaultValues.noindex)
  );
  const [linkPending, setLinkPending] = useState(false);

  const articleId = defaultValues.id;
  const savedSlug = articleId ? defaultValues.slug : undefined;
  const [title, body, status, showToc, excerpt, seoTitle, seoDescription, slug] = useWatch({
    control,
    name: ["title", "body", "status", "showToc", "excerpt", "seoTitle", "seoDescription", "slug"],
  });
  const isDirty = formState.isDirty;
  const isSubmitting = formState.isSubmitting;

  // Предупреждение о несохранённых изменениях при закрытии/перезагрузке вкладки
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  async function save(values: ArticleValues) {
    setServerError(null);
    const res = await saveArticle(values);
    if (!res.ok) {
      setServerError(res.error);
      toast.error(res.error);
      for (const [name, messages] of Object.entries(res.fieldErrors ?? {})) {
        const [message] = messages;
        if (message) setError(name as Path<ArticleInput>, { message });
      }
      return;
    }
    toast.success("Статья сохранена");
    // Сбрасываем «грязное» состояние до навигации — иначе сработает предупреждение
    form.reset(form.getValues());
    if (modeRef.current === "close") {
      router.push(LIST_HREF);
      if (!articleId) onCreated();
      return;
    }
    if (!articleId) {
      router.replace(`/admin/blog/articles/${res.data.id}`);
      onCreated();
      return;
    }
    // Свежие значения с сервера (дата публикации, slug для предупреждения о 301)
    router.refresh();
  }

  async function onValid(values: ArticleValues) {
    // Опубликованная статья уходит в черновик — пропадёт с сайта: спрашиваем
    if (isLive && values.status === "draft") {
      setPendingDraft(values);
      return;
    }
    await save(values);
  }

  function submit(mode: SaveMode) {
    modeRef.current = mode;
    void form.handleSubmit(onValid)();
  }

  // Ctrl/Cmd+S — сохранить, оставаясь на странице. Обработчик через ref: без переподписки
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        submitRef.current("stay");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function openSignedPreview() {
    if (!articleId) return;
    if (isDirty) {
      toast.warning("Сначала сохраните изменения — предпросмотр показывает сохранённую версию");
      return;
    }
    // Окно открываем синхронно по клику (иначе блокировщик всплывающих окон), адрес — после ответа
    const win = window.open("about:blank", "_blank");
    setLinkPending(true);
    const res = await createPreviewLink({ id: articleId });
    setLinkPending(false);
    if (!res.ok) {
      win?.close();
      toast.error(res.error);
      return;
    }
    if (win) {
      win.opener = null;
      win.location.href = res.data.url;
    } else {
      toast.info("Разрешите всплывающие окна или откройте ссылку вручную", {
        description: res.data.url,
      });
    }
  }

  const showDate = status === "scheduled" || status === "published";

  return (
    <Form {...form}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit("stay");
        }}
        className="space-y-6"
        noValidate
      >
        {serverError ? (
          <div
            role="alert"
            className="border-destructive/50 text-destructive flex items-start gap-3 rounded-lg border p-4 text-sm"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>{serverError}</p>
          </div>
        ) : null}

        <Section title="Основное">
          <FormField
            control={control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Заголовок</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={ARTICLE_TITLE_MAX} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="slug"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Адрес (slug)</FormLabel>
                <SlugField
                  id="article-slug"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  source={title}
                  entity="article"
                  ignoreId={articleId}
                  savedSlug={savedSlug}
                  redirectNotice
                  pathPrefix="/blog/"
                  invalid={Boolean(fieldState.error)}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={control}
              name="rubricId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Рубрика</FormLabel>
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(next) => field.onChange(next === NONE ? null : next)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="— без рубрики —" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>— без рубрики —</SelectItem>
                      {rubrics.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="authorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Автор</FormLabel>
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(next) => field.onChange(next === NONE ? null : next)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="— без автора —" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>— без автора —</SelectItem>
                      {authors.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                          {option.isActive ? "" : " (скрыт)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={control}
            name="excerpt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Краткое описание</FormLabel>
                <FormControl>
                  <Textarea {...field} value={field.value ?? ""} rows={3} maxLength={EXCERPT_MAX} />
                </FormControl>
                <FormDescription className="flex justify-between gap-2">
                  <span>Показывается в карточке статьи и в поиске.</span>
                  <Counter value={excerpt} max={EXCERPT_MAX} />
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Section title="Публикация">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Статус</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.keys(STATUS_LABELS) as ArticleStatus[]).map((value) => (
                        <SelectItem key={value} value={value}>
                          {STATUS_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {status === "draft"
                      ? "Черновик не виден на сайте."
                      : status === "scheduled"
                        ? "Статья появится на сайте в указанное время (в пределах 5 минут)."
                        : "Статья видна на сайте сразу после сохранения."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {showDate ? (
              <FormField
                control={control}
                name="publishAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Дата и время публикации</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} value={field.value ?? ""} step={60} />
                    </FormControl>
                    <FormDescription>
                      Время по Екатеринбургу (UTC+5).
                      {status === "published" ? " Пусто — текущее время." : ""}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
          </div>
          <FormField
            control={control}
            name="isFeatured"
            render={({ field }) => (
              <SwitchField
                checked={field.value ?? false}
                onChange={field.onChange}
                label="Рекомендуемая"
                description="Показывать в блоке «Рекомендуем» на странице блога."
              />
            )}
          />
          <FormField
            control={control}
            name="showToc"
            render={({ field }) => (
              <SwitchField
                checked={field.value ?? true}
                onChange={field.onChange}
                label="Авто-оглавление"
                description="Оглавление строится по заголовкам H2/H3 текста."
              />
            )}
          />
        </Section>

        <Section title="Обложка">
          <FormField
            control={control}
            name="coverMediaId"
            render={({ field }) => (
              <FormItem>
                <ImageUploadField
                  value={field.value ?? null}
                  initialAsset={initialCover}
                  onChange={(mediaId) => field.onChange(mediaId)}
                  folder="blog"
                  label="Обложка статьи"
                  aspect={COVER_ASPECT}
                />
                <FormDescription>
                  Описание картинки (alt) задаётся при загрузке или в медиатеке.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Section title="Теги">
          <FormField
            control={control}
            name="tagIds"
            render={({ field }) => (
              <FormItem>
                <TagPicker options={tags} value={field.value ?? []} onChange={field.onChange} />
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Section
          title="Текст"
          description="Markdown. Панель вставляет заголовки, картинки из медиатеки, видео VK/Rutube, документы и врезки."
        >
          <FormField
            control={control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <FormLabel>Текст статьи</FormLabel>
                  <ContentPreviewButton
                    getSource={() => form.getValues("body") ?? ""}
                    showToc={showToc ?? true}
                    title={title}
                  />
                </div>
                <ShortcodeToolbar
                  value={body ?? ""}
                  onChange={(next) => setValue("body", next, { shouldDirty: true })}
                  targetRef={bodyRef}
                />
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    ref={(el) => {
                      field.ref(el);
                      bodyRef.current = el;
                    }}
                    spellCheck
                    className="min-h-[24rem] font-mono text-sm leading-6"
                  />
                </FormControl>
                <FormDescription>Ctrl+S — сохранить.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Card>
          <CardHeader>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 text-left"
              aria-expanded={seoOpen}
              aria-controls="article-seo"
              onClick={() => setSeoOpen((open) => !open)}
            >
              <span className="space-y-1.5">
                <CardTitle className="text-lg">SEO</CardTitle>
                <CardDescription>Заголовок и описание для поисковиков, индексация.</CardDescription>
              </span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 transition-transform", seoOpen && "rotate-180")}
                aria-hidden
              />
            </button>
          </CardHeader>
          <CardContent id="article-seo" className={cn("space-y-4", !seoOpen && "hidden")}>
            <FormField
              control={control}
              name="seoTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SEO-заголовок</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} maxLength={SEO_TITLE_MAX} />
                  </FormControl>
                  <FormDescription className="flex justify-between gap-2">
                    <span>{SEO_TITLE_HINT}</span>
                    <Counter value={seoTitle} max={SEO_TITLE_MAX} />
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="seoDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SEO-описание</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      rows={2}
                      maxLength={SEO_DESCRIPTION_MAX}
                    />
                  </FormControl>
                  <FormDescription className="flex justify-between gap-2">
                    <span>{SEO_DESCRIPTION_HINT}</span>
                    <Counter value={seoDescription} max={160} />
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div
              className="bg-muted/40 space-y-1 rounded-lg border p-4"
              aria-label="Сниппет в поиске"
            >
              <p className="text-muted-foreground text-xs">Так статья может выглядеть в поиске:</p>
              <p className="text-primary truncate text-base font-medium">
                {seoTitle?.trim() || title || "Заголовок статьи"}
              </p>
              <p className="truncate font-mono text-xs text-green-700 dark:text-green-400">
                /blog/{slug || "adres-stati"}
              </p>
              <p className="text-muted-foreground line-clamp-2 text-sm">
                {seoDescription?.trim() || excerpt || "Описание статьи"}
              </p>
            </div>
            <FormField
              control={control}
              name="noindex"
              render={({ field }) => (
                <SwitchField
                  checked={field.value ?? false}
                  onChange={field.onChange}
                  label="Не индексировать (noindex)"
                  description="Страница не попадёт в поисковую выдачу и sitemap."
                />
              )}
            />
          </CardContent>
        </Card>

        <FormActions
          isSubmitting={isSubmitting}
          submitLabel="Сохранить"
          cancelHref={LIST_HREF}
          {...(articleId
            ? {
                onDelete: async () => {
                  const res = await deleteArticle({ id: articleId });
                  if (res.ok) {
                    toast.success("Статья удалена");
                    form.reset(form.getValues());
                    router.push(LIST_HREF);
                  }
                  return res;
                },
                deleteDescription:
                  "Статья исчезнет с сайта, её адрес будет отдавать 404. Действие нельзя отменить.",
              }
            : {})}
          extra={
            <>
              {articleId ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={linkPending}
                  onClick={() => void openSignedPreview()}
                  title={
                    isDirty
                      ? "Сначала сохраните изменения"
                      : "Ссылка действует 24 часа и показывает черновик"
                  }
                >
                  {linkPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  )}
                  Открыть подписанный предпросмотр
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                disabled={isSubmitting}
                onClick={() => submit("close")}
              >
                <Save className="h-4 w-4" aria-hidden />
                Сохранить и закрыть
              </Button>
            </>
          }
        />
      </form>

      <AlertDialog
        open={pendingDraft !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDraft(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Снять статью с сайта?</AlertDialogTitle>
            <AlertDialogDescription>
              Статья опубликована. В статусе «Черновик» она пропадёт с сайта, а дата публикации
              будет сброшена.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const values = pendingDraft;
                setPendingDraft(null);
                if (values) void save(values);
              }}
            >
              Перевести в черновик
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}
