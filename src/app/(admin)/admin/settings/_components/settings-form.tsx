"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useForm, useFormContext, type FieldPath, type FieldPathByValue } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import type { MediaDto } from "@/lib/admin/media-dto";
import { saveSettings } from "../_actions";
import {
  ABOUT_POINTS_COUNT,
  ABOUT_POINT_TEXT_MAX,
  ABOUT_POINT_TITLE_MAX,
  HERO_BADGES_MAX,
  HERO_BADGES_MIN,
  HERO_BADGE_MAX,
  RETENTION_MAX,
  RETENTION_MIN,
  SEO_DESCRIPTION_MAX,
  settingsSchema,
  type SettingsValues,
} from "../_schema";

type StringPath = FieldPathByValue<SettingsValues, string>;
type NumberPath = FieldPathByValue<SettingsValues, number>;

/** «+7 (900) 068-50-00» → «tel:+79000685000»; ведущая 8 российского номера → 7 */
function phoneToHref(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  return `tel:+${digits}`;
}

export function SettingsForm({
  initial,
  ogImage,
}: {
  initial: SettingsValues;
  ogImage: MediaDto | null;
}) {
  const router = useRouter();
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: initial,
  });

  async function onSubmit(values: SettingsValues) {
    const result = await saveSettings(values);
    if (!result.ok) {
      // Ошибки сервера приходят по ключам верхнего уровня (geo, operator…) — показываем у группы
      for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
        const message = messages[0];
        if (message) form.setError(key as FieldPath<SettingsValues>, { message });
      }
      toast.error(result.error);
      return;
    }
    const { changed } = result.data;
    toast.success(changed.length > 0 ? `Сохранено: ${changed.length} изм.` : "Изменений нет");
    form.reset(values);
    router.refresh();
  }

  function onInvalid() {
    toast.error("Проверьте поля, отмеченные красным");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6" noValidate>
        <Group
          title="Контакты"
          description="Телефон, адрес, ссылки и карта в шапке, подвале и на странице контактов."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              name="phone"
              label="Телефон (как показывать)"
              placeholder="+7 (900) 068-50-00"
            />
            <PhoneHrefField />
            <TextField name="email" label="Email" placeholder="club@example.ru" type="email" />
            <TextField
              name="hours"
              label="Часы работы"
              placeholder="Ежедневно 09:00–02:00"
              maxLength={100}
            />
            <TextField
              name="address"
              label="Адрес"
              placeholder="г. Челябинск, Орджоникидзе 58а к3"
              maxLength={200}
            />
            <TextField
              name="addressNote"
              label="Ориентир"
              placeholder="Горсад им. А.С. Пушкина"
              maxLength={200}
            />
            <TextField name="telegramUrl" label="Telegram" placeholder="https://t.me/…" />
            <TextField
              name="vkUrl"
              label="ВКонтакте"
              placeholder="https://vk.ru/…"
              description="Используйте домен vk.ru"
            />
            <NumberField name="geo.lat" label="Широта" placeholder="55.153739" step="any" />
            <NumberField name="geo.lon" label="Долгота" placeholder="61.404441" step="any" />
            <TextField
              name="mapOrgId"
              label="ID организации в Яндекс Картах"
              placeholder="47911977113"
              inputMode="numeric"
            />
            <TextField
              name="mapConstructorId"
              label="Карта из конструктора Яндекс Карт"
              placeholder="constructor:…"
              description="Значение параметра um= с префиксом constructor:. Пусто — карта по ID организации."
            />
          </div>
          <GroupError name="geo" />
        </Group>

        <Group title="Первый экран (hero)">
          <TextField name="heroTitle" label="Заголовок" maxLength={200} textarea />
          <TextField name="heroSubtitle" label="Подзаголовок" maxLength={300} textarea />
          <StringListField
            name="heroBadgePhrases"
            label="Бегущие фразы"
            min={HERO_BADGES_MIN}
            max={HERO_BADGES_MAX}
            itemMax={HERO_BADGE_MAX}
          />
        </Group>

        <Group title="О клубе">
          <TextField name="aboutTitle" label="Заголовок блока" maxLength={300} textarea />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: ABOUT_POINTS_COUNT }, (_, index) => (
              <fieldset key={index} className="space-y-3 rounded-md border p-3">
                <legend className="px-1 text-sm font-medium">Пункт {index + 1}</legend>
                <TextField
                  name={`aboutPoints.${index}.title`}
                  label="Заголовок"
                  maxLength={ABOUT_POINT_TITLE_MAX}
                />
                <TextField
                  name={`aboutPoints.${index}.text`}
                  label="Текст"
                  maxLength={ABOUT_POINT_TEXT_MAX}
                  textarea
                />
              </fieldset>
            ))}
          </div>
          <GroupError name="aboutPoints" />
        </Group>

        <Group
          title="SEO по умолчанию"
          description="Используется на страницах без собственных title и description."
        >
          <TextField name="seoDefaults.title" label="Title" maxLength={70} />
          <TextField
            name="seoDefaults.description"
            label="Description"
            maxLength={SEO_DESCRIPTION_MAX}
            textarea
          />
          <FormField
            control={form.control}
            name="seoDefaults.ogImageMediaId"
            render={({ field }) => (
              <FormItem>
                <ImageUploadField
                  value={field.value}
                  initialAsset={ogImage}
                  onChange={(mediaId) => field.onChange(mediaId)}
                  folder="seo"
                  label="Картинка для соцсетей (OG)"
                  aspect={1200 / 630}
                />
                <FormDescription>Рекомендуемый размер 1200×630.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <GroupError name="seoDefaults" />
        </Group>

        <Group
          title="Реквизиты оператора персональных данных"
          description="Подставляются в политику и согласие (плейсхолдеры {{operator_…}})."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField name="operator.name" label="Оператор (ИП / ООО)" maxLength={200} />
            <TextField name="operator.email" label="Email для обращений" type="email" />
            <TextField
              name="operator.inn"
              label="ИНН"
              inputMode="numeric"
              description="10 или 12 цифр"
            />
            <TextField
              name="operator.ogrn"
              label="ОГРН / ОГРНИП"
              inputMode="numeric"
              description="13 или 15 цифр"
            />
            <div className="md:col-span-2">
              <TextField name="operator.address" label="Адрес оператора" maxLength={300} />
            </div>
          </div>
          <GroupError name="operator" />
        </Group>

        <Group title="Хранение заявок">
          <div className="max-w-xs">
            <NumberField
              name="leadRetentionMonths"
              label="Срок хранения, месяцев"
              min={RETENTION_MIN}
              max={RETENTION_MAX}
              step="1"
              description="Через этот срок имя, телефон, комментарий и хэш IP заявки удаляются автоматически."
            />
          </div>
        </Group>

        <FormActions isSubmitting={form.formState.isSubmitting} submitLabel="Сохранить настройки" />
      </form>
    </Form>
  );
}

function Group({
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
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

/** Ошибка, пришедшая с сервера на объект целиком (geo, operator…) */
function GroupError({ name }: { name: "geo" | "aboutPoints" | "seoDefaults" | "operator" }) {
  const { formState } = useFormContext<SettingsValues>();
  const error = formState.errors[name];
  const message =
    error && "message" in error && typeof error.message === "string" ? error.message : null;
  if (!message) return null;
  return <p className="text-destructive text-sm">{message}</p>;
}

function TextField({
  name,
  label,
  description,
  placeholder,
  maxLength,
  textarea = false,
  type = "text",
  inputMode,
}: {
  name: StringPath;
  label: string;
  description?: string;
  placeholder?: string;
  maxLength?: number;
  textarea?: boolean;
  type?: "text" | "email";
  inputMode?: "numeric";
}) {
  const { control } = useFormContext<SettingsValues>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            {textarea ? (
              <Textarea {...field} rows={3} maxLength={maxLength} placeholder={placeholder} />
            ) : (
              <Input
                {...field}
                type={type}
                maxLength={maxLength}
                placeholder={placeholder}
                inputMode={inputMode}
              />
            )}
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function NumberField({
  name,
  label,
  description,
  placeholder,
  min,
  max,
  step,
}: {
  name: NumberPath;
  label: string;
  description?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step: string;
}) {
  const { control } = useFormContext<SettingsValues>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              inputMode="decimal"
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              // NaN не отображаем — поле просто пустое, zod сообщит «Укажите …»
              value={Number.isFinite(field.value) ? field.value : ""}
              onChange={(event) => field.onChange(event.target.valueAsNumber)}
              placeholder={placeholder}
              min={min}
              max={max}
              step={step}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function PhoneHrefField() {
  const { control, getValues, setValue } = useFormContext<SettingsValues>();
  return (
    <FormField
      control={control}
      name="phoneHref"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Ссылка для звонка</FormLabel>
          <div className="flex gap-2">
            <FormControl>
              <Input {...field} placeholder="tel:+79000685000" />
            </FormControl>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={() =>
                setValue("phoneHref", phoneToHref(getValues("phone")), {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            >
              Из телефона
            </Button>
          </div>
          <FormDescription>
            Формат tel:+79000685000 — «Из телефона» заполнит автоматически.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Список строк (фразы hero): добавить, удалить, ↑/↓ */
function StringListField({
  name,
  label,
  min,
  max,
  itemMax,
}: {
  name: "heroBadgePhrases";
  label: string;
  min: number;
  max: number;
  itemMax: number;
}) {
  const { control } = useFormContext<SettingsValues>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const items = field.value;
        const update = (next: string[]) => field.onChange(next);
        const move = (from: number, to: number) => {
          const next = [...items];
          const [moved] = next.splice(from, 1);
          if (moved === undefined) return;
          next.splice(to, 0, moved);
          update(next);
        };
        // Ошибки элементов массива: errors.heroBadgePhrases[i].message
        const itemErrors =
          (fieldState.error as unknown as ({ message?: string } | undefined)[]) ?? [];
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <ul className="space-y-2">
              {items.map((value, index) => (
                <li key={index} className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Input
                      value={value}
                      maxLength={itemMax}
                      aria-label={`${label}: ${index + 1}`}
                      aria-invalid={itemErrors[index]?.message ? true : undefined}
                      onChange={(event) =>
                        update(items.map((v, i) => (i === index ? event.target.value : v)))
                      }
                      onBlur={field.onBlur}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Выше"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Ниже"
                      disabled={index === items.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Удалить"
                      disabled={items.length <= min}
                      onClick={() => update(items.filter((_, i) => i !== index))}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                  {itemErrors[index]?.message ? (
                    <p className="text-destructive text-sm">{itemErrors[index]?.message}</p>
                  ) : null}
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={items.length >= max}
              onClick={() => update([...items, ""])}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Фраза
            </Button>
            <FormDescription>
              От {min} до {max} фраз по {itemMax} символов.
            </FormDescription>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
