"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, ExternalLink, Plus, X } from "lucide-react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { FormActions } from "@/components/admin/form-actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { saveService } from "../_actions";
import {
  SERVICE_BULLETS_MAX,
  SERVICE_BULLET_MAX,
  SERVICE_CTA_BLOCK_MAX,
  SERVICE_CTA_LABELS,
  SERVICE_CTA_TYPES,
  SERVICE_PRICE_NOTE_MAX,
  SERVICE_SUBTITLE_MAX,
  SERVICE_TITLE_MAX,
  serviceFormSchema,
  type ServiceFormInput,
  type ServiceFormValues,
} from "../_schema";
import type { AdminService, GalleryOption } from "../_queries";

/** Radix Select не допускает пустое значение у пункта */
const NO_GALLERY = "__none__";

export function ServicesTabs({
  services,
  galleries,
}: {
  services: AdminService[];
  galleries: GalleryOption[];
}) {
  const first = services[0];
  if (!first) return null;
  return (
    <Tabs defaultValue={first.id} className="space-y-4">
      <div className="overflow-x-auto">
        <TabsList>
          {services.map((service) => (
            <TabsTrigger key={service.id} value={service.id}>
              {service.title}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {services.map((service) => (
        <TabsContent key={service.id} value={service.id}>
          <ServiceForm service={service} galleries={galleries} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function toFormValues(service: AdminService): ServiceFormInput {
  return {
    title: service.title,
    subtitle: service.subtitle,
    bullets: service.bullets.map((value) => ({ value })),
    priceFrom: service.priceFrom === null ? "" : String(service.priceFrom),
    priceNote: service.priceNote,
    ctaType: service.ctaType,
    ctaBlock: service.ctaBlock,
    galleryKey: service.galleryKey ?? "",
  };
}

function ServiceForm({
  service,
  galleries,
}: {
  service: AdminService;
  galleries: GalleryOption[];
}) {
  const router = useRouter();
  const form = useForm<ServiceFormInput, unknown, ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: toFormValues(service),
  });
  const bullets = useFieldArray({ control: form.control, name: "bullets" });
  const galleryKey = useWatch({ control: form.control, name: "galleryKey" });
  // Галерея из БД могла быть удалена — показываем её ключ, чтобы не потерять значение
  const galleryOptions =
    service.galleryKey && !galleries.some((g) => g.key === service.galleryKey)
      ? [...galleries, { key: service.galleryKey, label: `${service.galleryKey} (не найдена)` }]
      : galleries;

  async function onSubmit(values: ServiceFormValues) {
    const result = await saveService({
      id: service.id,
      title: values.title,
      subtitle: values.subtitle,
      bullets: values.bullets.map((b) => b.value),
      priceFrom: values.priceFrom === "" ? null : Number(values.priceFrom),
      priceNote: values.priceNote,
      ctaType: values.ctaType,
      ctaBlock: values.ctaBlock,
      galleryKey: values.galleryKey === "" ? null : values.galleryKey,
    });
    if (!result.ok) {
      const fieldErrors = result.fieldErrors ?? {};
      for (const name of ["title", "subtitle", "priceNote", "ctaBlock", "galleryKey"] as const) {
        const message = fieldErrors[name]?.[0];
        if (message) form.setError(name, { message });
      }
      toast.error(result.error);
      return;
    }
    toast.success(result.data.changed ? "Услуга сохранена" : "Изменений нет");
    // Сохранённые значения становятся новыми «чистыми» (isDirty = false)
    form.reset(form.getValues());
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl space-y-6" noValidate>
        {service.isActive ? null : (
          <p className="bg-muted text-muted-foreground rounded-md p-3 text-sm">
            Вкладка скрыта на сайте (isActive = false).
          </p>
        )}

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Заголовок</FormLabel>
              <FormControl>
                <Input {...field} maxLength={SERVICE_TITLE_MAX} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="subtitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Подзаголовок</FormLabel>
              <FormControl>
                <Textarea {...field} rows={4} maxLength={SERVICE_SUBTITLE_MAX} />
              </FormControl>
              <FormDescription>
                До {SERVICE_SUBTITLE_MAX} символов, переносы строк сохраняются, эмодзи допускаются.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Пункты списка</legend>
          {bullets.fields.length === 0 ? (
            <p className="text-muted-foreground text-sm">Пунктов нет</p>
          ) : null}
          <ul className="space-y-2">
            {bullets.fields.map((item, index) => (
              <li key={item.id}>
                <FormField
                  control={form.control}
                  name={`bullets.${index}.value`}
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-1">
                        <FormControl>
                          <Input
                            {...field}
                            maxLength={SERVICE_BULLET_MAX}
                            aria-label={`Пункт ${index + 1}`}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Выше"
                          disabled={index === 0}
                          onClick={() => bullets.move(index, index - 1)}
                        >
                          <ArrowUp className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Ниже"
                          disabled={index === bullets.fields.length - 1}
                          onClick={() => bullets.move(index, index + 1)}
                        >
                          <ArrowDown className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Удалить пункт"
                          onClick={() => bullets.remove(index)}
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={bullets.fields.length >= SERVICE_BULLETS_MAX}
            onClick={() => bullets.append({ value: "" })}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Пункт
          </Button>
          <p className="text-muted-foreground text-xs">
            До {SERVICE_BULLETS_MAX} пунктов по {SERVICE_BULLET_MAX} символов.
          </p>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="priceFrom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Цена «от», ₽</FormLabel>
                <FormControl>
                  <Input {...field} inputMode="numeric" placeholder="Автоматически" />
                </FormControl>
                <FormDescription>
                  Пусто — цена «от» считается автоматически из тарифов (Русский/Американский/VIP).
                  Для «Обучения» заполните вручную, например 2580.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="priceNote"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Пояснение к цене</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    maxLength={SERVICE_PRICE_NOTE_MAX}
                    placeholder="Тренер + стол"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ctaType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Кнопка</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SERVICE_CTA_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {SERVICE_CTA_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ctaBlock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Метка блока в заявках</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={SERVICE_CTA_BLOCK_MAX} />
                </FormControl>
                <FormDescription>Попадает в поле «Блок» заявки с этой кнопки.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="galleryKey"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Галерея</FormLabel>
                <Select
                  value={field.value === "" ? NO_GALLERY : field.value}
                  onValueChange={(value) => field.onChange(value === NO_GALLERY ? "" : value)}
                >
                  <FormControl>
                    <SelectTrigger className="w-full md:max-w-sm">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NO_GALLERY}>Без галереи</SelectItem>
                    {galleryOptions.map((g) => (
                      <SelectItem key={g.key} value={g.key}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {galleryKey ? (
                  <Button asChild variant="link" size="sm" className="h-auto px-0">
                    <Link href={`/admin/galleries?key=${encodeURIComponent(galleryKey)}`}>
                      Редактировать галерею
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </Button>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormActions isSubmitting={form.formState.isSubmitting} />
      </form>
    </Form>
  );
}
