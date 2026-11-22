"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { useFieldArray, useForm, useWatch, type Path } from "react-hook-form";
import { toast } from "sonner";
import { FormActions } from "@/components/admin/form-actions";
import { ImageUploadField } from "@/components/admin/image-upload-field";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteAuthor, saveAuthor } from "@/lib/actions/blog-authors";
import type { MediaDto } from "@/lib/admin/media-dto";
import {
  AUTHOR_BIO_MAX,
  AUTHOR_NAME_MAX,
  AUTHOR_TEXT_MAX,
  authorFormSchema,
  SAME_AS_MAX,
  type AuthorFormInput,
  type AuthorFormValues,
} from "@/lib/validation/blog";
import { SlugField } from "./slug-field";

export type AuthorFormProps = {
  defaultValues: AuthorFormInput;
  initialPhoto: MediaDto | null;
  articlesCount?: number;
};

const LIST_HREF = "/admin/blog/authors";

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

/** Форма автора-тренера; после создания форма пересоздаётся (состояние страниц сохраняется). */
export function AuthorForm(props: AuthorFormProps) {
  const [instance, setInstance] = useState(0);
  return (
    <AuthorFormInner
      key={instance}
      {...props}
      onCreated={() => setInstance((value) => value + 1)}
    />
  );
}

function AuthorFormInner({
  defaultValues,
  initialPhoto,
  articlesCount = 0,
  onCreated,
}: AuthorFormProps & { onCreated: () => void }) {
  const router = useRouter();
  const form = useForm<AuthorFormInput, unknown, AuthorFormValues>({
    resolver: zodResolver(authorFormSchema),
    defaultValues,
  });
  const { control, setError, formState } = form;
  const sameAs = useFieldArray({ control, name: "sameAs" });
  const name = useWatch({ control, name: "name" });
  const authorId = defaultValues.id;

  async function onSubmit(values: AuthorFormValues) {
    const res = await saveAuthor({ ...values, sameAs: values.sameAs.map((item) => item.value) });
    if (!res.ok) {
      toast.error(res.error);
      for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
        const [message] = messages;
        if (message) setError(field as Path<AuthorFormInput>, { message });
      }
      return;
    }
    toast.success("Автор сохранён");
    form.reset(form.getValues());
    router.push(LIST_HREF);
    if (!authorId) onCreated();
  }

  const sameAsError = formState.errors.sameAs?.message ?? formState.errors.sameAs?.root?.message;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <Section title="Основное">
          <FormField
            control={control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Имя</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={AUTHOR_NAME_MAX} />
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
                  id="author-slug"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  source={name}
                  entity="author"
                  ignoreId={authorId}
                  savedSlug={authorId ? defaultValues.slug : undefined}
                  pathPrefix="/authors/"
                  invalid={Boolean(fieldState.error)}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={control}
              name="roleInClub"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Роль в клубе</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      maxLength={AUTHOR_TEXT_MAX}
                      placeholder="Тренер клуба"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="rank"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Звание, разряд</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      maxLength={AUTHOR_TEXT_MAX}
                      placeholder="Мастер спорта"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>О себе</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    rows={6}
                    maxLength={AUTHOR_BIO_MAX}
                  />
                </FormControl>
                <FormDescription>Поддерживается Markdown.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex items-start justify-between gap-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <FormLabel>Показывать на сайте</FormLabel>
                  <FormDescription>
                    Скрытый автор не выводится в статьях и на странице /authors.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </Section>

        <Section title="Фото">
          <FormField
            control={control}
            name="photoMediaId"
            render={({ field }) => (
              <FormItem>
                <ImageUploadField
                  value={field.value ?? null}
                  initialAsset={initialPhoto}
                  onChange={(mediaId) => field.onChange(mediaId)}
                  folder="authors"
                  label="Фото автора"
                  aspect={1}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Section
          title="Профили в сети"
          description="Ссылки на страницы автора (VK, сайт федерации и т. п.) — только https://."
        >
          {sameAs.fields.length === 0 ? (
            <p className="text-muted-foreground text-sm">Ссылок нет.</p>
          ) : (
            <ul className="space-y-2">
              {sameAs.fields.map((item, index) => (
                <li key={item.id}>
                  <FormField
                    control={control}
                    name={`sameAs.${index}.value`}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input
                              {...field}
                              inputMode="url"
                              placeholder="https://vk.com/…"
                              aria-label={`Ссылка ${index + 1}`}
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Удалить ссылку"
                            onClick={() => sameAs.remove(index)}
                          >
                            <X className="h-4 w-4" aria-hidden />
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </li>
              ))}
            </ul>
          )}
          {sameAsError ? <p className="text-destructive text-sm">{sameAsError}</p> : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={sameAs.fields.length >= SAME_AS_MAX}
            onClick={() => sameAs.append({ value: "https://" })}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Добавить ссылку
          </Button>
        </Section>

        <FormActions
          isSubmitting={formState.isSubmitting}
          cancelHref={LIST_HREF}
          {...(authorId
            ? {
                onDelete: async () => {
                  const res = await deleteAuthor({ id: authorId });
                  if (res.ok) {
                    toast.success("Автор удалён");
                    router.push(LIST_HREF);
                  }
                  return res;
                },
                deleteDescription:
                  articlesCount > 0
                    ? `У автора есть статьи (${articlesCount}) — удалить нельзя. Снимите «Показывать на сайте».`
                    : "Страница автора начнёт отдавать 404.",
              }
            : {})}
        />
      </form>
    </Form>
  );
}
