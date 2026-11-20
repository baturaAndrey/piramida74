"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send, Trash2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { deleteLegalDraft, publishLegalDocument, saveLegalDraft } from "../_actions";
import {
  fillLegalPlaceholders,
  findUnknownPlaceholders,
  LEGAL_PLACEHOLDERS,
  legalFormSchema,
  legalPlaceholderValues,
  MAX_LEGAL_TITLE_LENGTH,
  type LegalDocTypeValue,
  type LegalFormValues,
  type LegalPreviewSettings,
} from "../_schema";

const BODY_ROWS = 18;
const PUBLISH_WARNING =
  "Опубликованную версию нельзя изменить. Новые согласия будут ссылаться на неё";

/** Разметка превью — как на публичных страницах (без rehype-raw: HTML экранируется). */
const markdownComponents: Components = {
  h1: ({ node: _node, ...props }) => <h2 className="mt-6 mb-3 text-xl font-semibold" {...props} />,
  h2: ({ node: _node, ...props }) => <h2 className="mt-6 mb-3 text-xl font-semibold" {...props} />,
  h3: ({ node: _node, ...props }) => <h3 className="mt-6 mb-3 text-lg font-semibold" {...props} />,
  p: ({ node: _node, ...props }) => <p className="mb-4 leading-7" {...props} />,
  ul: ({ node: _node, ...props }) => (
    <ul className="mb-4 list-disc space-y-1 pl-6 leading-7" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="mb-4 list-decimal space-y-1 pl-6 leading-7" {...props} />
  ),
  a: ({ node: _node, ...props }) => (
    <a
      className="text-primary underline underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  strong: ({ node: _node, ...props }) => <strong className="font-semibold" {...props} />,
  table: ({ node: _node, ...props }) => (
    <div className="mb-4 overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: ({ node: _node, ...props }) => (
    <th className="border-b px-3 py-2 text-left font-semibold" {...props} />
  ),
  td: ({ node: _node, ...props }) => <td className="border-b px-3 py-2 align-top" {...props} />,
};

/** Отрисовка markdown юр. документа (превью в форме и просмотр опубликованной версии). */
export function LegalMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="text-sm break-words [&>:first-child]:mt-0">
      <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {markdown}
      </Markdown>
    </div>
  );
}

function PlaceholdersHint() {
  return (
    <>
      Можно использовать плейсхолдеры{" "}
      {LEGAL_PLACEHOLDERS.map((name, index) => (
        <span key={name}>
          <code className="bg-muted rounded px-1 font-mono text-xs">{`{{${name}}}`}</code>
          {index < LEGAL_PLACEHOLDERS.length - 1 ? ", " : ""}
        </span>
      ))}{" "}
      — они подставляются из «Настроек» при показе страницы (пустое значение → «[не указано]»). Хэш
      считается от исходного текста с плейсхолдерами.
    </>
  );
}

type SaveOutcome = { ok: true; id: string; created: boolean } | { ok: false; error: string };

export type LegalFormProps = {
  /** Есть → редактирование черновика, нет → новая версия */
  id?: string;
  type: LegalDocTypeValue;
  defaultValues: LegalFormValues;
  /** Реквизиты из «Настроек» — только для предпросмотра */
  settings: LegalPreviewSettings;
  siteUrl: string;
};

export function LegalForm({ id, type, defaultValues, settings, siteUrl }: LegalFormProps) {
  const router = useRouter();
  // После первого сохранения новой версии повторные сохранения должны обновлять её, а не плодить копии
  const [docId, setDocId] = useState(id);
  const [busy, setBusy] = useState(false);

  const form = useForm<LegalFormValues>({
    resolver: zodResolver(legalFormSchema),
    defaultValues,
  });

  const body = useWatch({ control: form.control, name: "body" });
  const placeholderValues = useMemo(
    () => legalPlaceholderValues(settings, siteUrl),
    [settings, siteUrl]
  );
  const previewMarkdown = useMemo(
    () => fillLegalPlaceholders(body ?? "", placeholderValues),
    [body, placeholderValues]
  );

  /** Сохраняет черновик (создаёт версию, если её ещё нет). Ошибки полей — в форму. */
  async function persist(values: LegalFormValues): Promise<SaveOutcome> {
    const unknown = findUnknownPlaceholders(values.body);
    if (unknown.length > 0) {
      toast.warning(
        `Неизвестные плейсхолдеры: ${unknown.join(", ")}. На сайте они останутся как есть.`
      );
    }
    const result = await saveLegalDraft({ ...(docId ? { id: docId } : {}), type, ...values });
    if (!result.ok) {
      for (const field of ["title", "body"] as const) {
        const message = result.fieldErrors?.[field]?.[0];
        if (message) form.setError(field, { message });
      }
      return { ok: false, error: result.error };
    }
    setDocId(result.data.id);
    form.reset(values);
    return { ok: true, id: result.data.id, created: result.data.created };
  }

  /** Новая версия получает свой адрес; существующая — перечитывает серверные данные. */
  function afterSave(outcome: { id: string; created: boolean }) {
    if (outcome.created) router.replace(`/admin/legal/${outcome.id}`);
    else router.refresh();
  }

  async function onSubmit(values: LegalFormValues) {
    setBusy(true);
    try {
      const outcome = await persist(values);
      if (!outcome.ok) {
        toast.error(outcome.error);
        return;
      }
      toast.success("Черновик сохранён");
      afterSave(outcome);
    } finally {
      setBusy(false);
    }
  }

  /** Публикация: сначала сохраняем текущий текст черновика, затем публикуем именно его. */
  async function publish() {
    const valid = await form.trigger();
    if (!valid) return { ok: false, error: "Проверьте заголовок и текст документа" };
    setBusy(true);
    try {
      const saved = await persist(form.getValues());
      if (!saved.ok) return saved;
      const published = await publishLegalDocument({ id: saved.id });
      if (!published.ok) {
        // Черновик уже сохранён — переходим на его страницу, чтобы не потерять id
        if (saved.created) router.replace(`/admin/legal/${saved.id}`);
        return published;
      }
      toast.success("Версия опубликована и стала текущей");
      afterSave(saved);
      return published;
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!docId) return;
    const result = await deleteLegalDraft({ id: docId });
    if (result.ok) {
      toast.success("Черновик удалён");
      router.push("/admin/legal");
    }
    return result;
  }

  const disabled = busy || form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Заголовок</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  maxLength={MAX_LEGAL_TITLE_LENGTH}
                  placeholder="Политика обработки персональных данных"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Текст (Markdown)</FormLabel>
              <Tabs defaultValue="editor">
                <TabsList>
                  <TabsTrigger value="editor">Редактор</TabsTrigger>
                  <TabsTrigger value="preview">Предпросмотр</TabsTrigger>
                </TabsList>
                <TabsContent value="editor">
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={BODY_ROWS}
                      spellCheck
                      className="[field-sizing:fixed] max-h-[70vh] resize-y font-mono text-sm leading-6"
                    />
                  </FormControl>
                </TabsContent>
                <TabsContent value="preview">
                  <div className="bg-card max-h-[70vh] min-h-64 overflow-y-auto rounded-md border p-4">
                    {previewMarkdown.trim() ? (
                      <LegalMarkdown markdown={previewMarkdown} />
                    ) : (
                      <p className="text-muted-foreground text-sm">Текст пока пуст</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              <FormDescription>
                <PlaceholdersHint />
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {docId ? (
              <ConfirmDialog
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive w-full sm:w-auto"
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Удалить черновик
                  </Button>
                }
                title="Удалить черновик?"
                description="Черновик будет удалён без возможности восстановления."
                onConfirm={remove}
              />
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="submit" variant="outline" disabled={disabled}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Сохранить черновик
            </Button>
            <ConfirmDialog
              trigger={
                <Button type="button" disabled={disabled}>
                  <Send className="h-4 w-4" aria-hidden />
                  Опубликовать
                </Button>
              }
              title="Опубликовать версию?"
              description={PUBLISH_WARNING}
              confirmLabel="Опубликовать"
              destructive={false}
              onConfirm={publish}
            />
          </div>
        </div>
      </form>
    </Form>
  );
}
