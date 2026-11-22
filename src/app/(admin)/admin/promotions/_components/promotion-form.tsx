"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCw } from "lucide-react";
import { useForm, useWatch, type Path } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { MediaDto } from "@/lib/admin/media-dto";
import { slugify } from "@/lib/slug";
import { deletePromotion, savePromotion } from "../_actions";
import { PROMOTION_TARGET_LABELS, PROMOTION_TARGETS } from "../_lib/labels";
import {
  AUDIENCE_NOTE_MAX,
  DESCRIPTION_MAX,
  promotionSchema,
  SHORT_TEXT_MAX,
  TITLE_MAX,
  type PromotionInput,
  type PromotionValues,
} from "../_schema";
import { DaysOfWeekField } from "./days-of-week-field";
import { TimeWindowField } from "./time-window-field";
import type { MenuCategoryOption } from "../_queries";

type PromotionFormProps = {
  defaultValues: PromotionInput;
  initialCover: MediaDto | null;
  menuCategories: MenuCategoryOption[];
};

const LIST_HREF = "/admin/promotions";
const COVER_ASPECT = 4 / 3;

/** Значение `<Input type="number">` → `number | null` (пусто → null, мусор → NaN для ошибки zod) */
function toNullableNumber(raw: string): number | null {
  return raw.trim() === "" ? null : Number(raw);
}

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

function categoryLabel(option: MenuCategoryOption): string {
  return option.parentTitle ? `${option.parentTitle} → ${option.title}` : option.title;
}

/**
 * Next (cacheComponents) сохраняет состояние посещённых страниц, поэтому после создания
 * акции форма пересоздаётся — повторный заход на «Новая акция» начинается с чистого листа.
 */
export function PromotionForm(props: PromotionFormProps) {
  const [instance, setInstance] = useState(0);
  return (
    <PromotionFormInner
      key={instance}
      {...props}
      onCreated={() => setInstance((value) => value + 1)}
    />
  );
}

function PromotionFormInner({
  defaultValues,
  initialCover,
  menuCategories,
  onCreated,
}: PromotionFormProps & { onCreated: () => void }) {
  const router = useRouter();
  const form = useForm<PromotionInput, unknown, PromotionValues>({
    resolver: zodResolver(promotionSchema),
    defaultValues,
  });
  const { control, setValue, setError, formState } = form;
  // Пока slug не правили руками, он повторяет название
  const [slugTouched, setSlugTouched] = useState(Boolean(defaultValues.slug));

  const [target, shortText, description, startMin, endMin] = useWatch({
    control,
    name: ["target", "shortText", "description", "startMin", "endMin"],
  });
  const promotionId = defaultValues.id;
  const isEdit = Boolean(promotionId);

  async function onSubmit(values: PromotionValues) {
    const res = await savePromotion(values);
    if (!res.ok) {
      toast.error(res.error);
      for (const [name, messages] of Object.entries(res.fieldErrors ?? {})) {
        const [message] = messages;
        if (message) setError(name as Path<PromotionInput>, { message });
      }
      return;
    }
    toast.success("Сохранено");
    router.push(LIST_HREF);
    if (!isEdit) onCreated();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <Section title="Основное">
          <FormField
            control={control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Название</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    maxLength={TITLE_MAX}
                    onChange={(event) => {
                      field.onChange(event);
                      if (!slugTouched) {
                        setValue("slug", slugify(event.target.value), { shouldDirty: true });
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Адрес (slug)</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input
                      {...field}
                      maxLength={120}
                      placeholder="sozdastsya-iz-nazvaniya"
                      onChange={(event) => {
                        setSlugTouched(true);
                        field.onChange(event);
                      }}
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSlugTouched(false);
                      setValue("slug", slugify(form.getValues("title")), {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden />
                    <span className="hidden sm:inline">Сгенерировать</span>
                  </Button>
                </div>
                <FormDescription>
                  Латиница, цифры и дефис. Если адрес занят, к нему добавится номер.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="shortText"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Короткий текст</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={2} maxLength={SHORT_TEXT_MAX} />
                </FormControl>
                <FormDescription className="flex justify-between gap-2">
                  <span>Показывается в карточке карусели на главной.</span>
                  <span className="tabular-nums">
                    {shortText.length}/{SHORT_TEXT_MAX}
                  </span>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Подробное описание</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={6} maxLength={DESCRIPTION_MAX} />
                </FormControl>
                <FormDescription className="flex justify-between gap-2">
                  <span>Необязательно. Поддерживается Markdown.</span>
                  <span className="tabular-nums">
                    {description.length}/{DESCRIPTION_MAX}
                  </span>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="coverMediaId"
            render={({ field }) => (
              <FormItem>
                <div className="max-w-md">
                  <ImageUploadField
                    label="Обложка"
                    folder="promotions"
                    aspect={COVER_ASPECT}
                    value={field.value}
                    initialAsset={initialCover}
                    onChange={(mediaId) => field.onChange(mediaId)}
                  />
                </div>
                <FormDescription>
                  Рекомендуется 1200×1200, на сайте обрезается до квадрата-прямоугольника 4:3.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Section title="Условия">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={control}
              name="discountPercent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Скидка, %</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={100}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(toNullableNumber(event.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Пусто — акция без процента скидки.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="audienceNote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Для кого</FormLabel>
                  <FormControl>
                    <Input
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      maxLength={AUDIENCE_NOTE_MAX}
                      placeholder="Девушкам, Студентам по студенческому"
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={control}
            name="daysOfWeek"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Дни недели</FormLabel>
                <DaysOfWeekField value={field.value} onChange={field.onChange} />
                <FormDescription>
                  Ничего не выбрано или выбраны все — каждый день. Дни считаются по операционным
                  суткам: ночные часы (00:00–08:59) относятся к предыдущему дню.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="space-y-2">
            <p className="text-sm font-medium">Время действия</p>
            <TimeWindowField
              startMin={startMin}
              endMin={endMin}
              startError={formState.errors.startMin?.message}
              endError={formState.errors.endMin?.message}
              onChange={(nextStart, nextEnd) => {
                const opts = { shouldDirty: true, shouldValidate: formState.isSubmitted };
                setValue("startMin", nextStart, opts);
                setValue("endMin", nextEnd, opts);
              }}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={control}
              name="target"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>На что действует</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(next) => {
                      field.onChange(next);
                      if (next !== "menu_category") {
                        setValue("targetMenuCategoryId", null, { shouldDirty: true });
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PROMOTION_TARGETS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {PROMOTION_TARGET_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {target === "menu_category" ? (
              <FormField
                control={control}
                name="targetMenuCategoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Категория меню</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full min-w-0">
                          <SelectValue placeholder="Выберите категорию" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {menuCategories.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {categoryLabel(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(
              [
                ["validFrom", "Действует с"],
                ["validTo", "Действует по"],
              ] as const
            ).map(([name, label]) => (
              <FormField
                key={name}
                control={control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
        </Section>

        <Section title="Показ на сайте">
          {(
            [
              ["showInCarousel", "Показывать в карусели на главной"],
              ["isActive", "Включена"],
            ] as const
          ).map(([name, label]) => (
            <FormField
              key={name}
              control={control}
              name={name}
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 space-y-0">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="font-normal">{label}</FormLabel>
                </FormItem>
              )}
            />
          ))}
        </Section>

        <FormActions
          isSubmitting={formState.isSubmitting}
          submitLabel={isEdit ? "Сохранить" : "Создать акцию"}
          cancelHref={LIST_HREF}
          deleteDescription={`Удалить акцию «${defaultValues.title}»? Действие необратимо.`}
          {...(promotionId
            ? {
                onDelete: async () => {
                  const res = await deletePromotion({ id: promotionId });
                  if (res.ok) {
                    toast.success("Акция удалена");
                    router.push(LIST_HREF);
                  }
                  return res;
                },
              }
            : {})}
        />
      </form>
    </Form>
  );
}
