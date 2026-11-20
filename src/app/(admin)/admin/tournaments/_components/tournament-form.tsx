"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useForm, useWatch, type Path } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FormActions } from "@/components/admin/form-actions";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
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
import { deleteTournament, saveTournament } from "../_actions";
import {
  DISCIPLINE_LABELS,
  DISCIPLINES,
  LEVEL_LABELS,
  LEVELS,
  MAX_DESCRIPTION_LENGTH,
} from "../_lib/labels";
import {
  SERIES_NAME_MAX,
  tournamentSchema,
  type TournamentInput,
  type TournamentValues,
} from "../_schema";
import { CategoriesField } from "./categories-field";
import { DateRangeField } from "./date-range-field";
import { saveSeries } from "../series/_actions";
import type { SeriesOption } from "../_queries";

type TournamentFormProps = {
  defaultValues: TournamentInput;
  initialCover: MediaDto | null;
  seriesOptions: SeriesOption[];
  /** Название исходного турнира, если форма открыта через «Дублировать» */
  duplicateOf?: string | undefined;
};

const LIST_HREF = "/admin/tournaments";
/** Radix Select не допускает пустое значение у пункта */
const NONE = "__none__";
const COVER_ASPECT = 16 / 6;

/** Значение `<Input type="number">` → `number | null` (пусто → null, мусор → NaN для ошибки zod) */
function toNullableNumber(raw: string): number | null {
  return raw.trim() === "" ? null : Number(raw);
}

function applyFieldErrors(
  setError: (name: Path<TournamentInput>, error: { message: string }) => void,
  fieldErrors: Record<string, string[]> | undefined
) {
  if (!fieldErrors) return;
  for (const [name, messages] of Object.entries(fieldErrors)) {
    const [message] = messages;
    if (message) setError(name as Path<TournamentInput>, { message });
  }
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

/** Диалог «Новая серия» прямо из формы турнира. */
function NewSeriesDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (series: SeriesOption) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Укажите название");
      return;
    }
    setPending(true);
    const res = await saveSeries({ name: trimmed, description: null });
    setPending(false);
    if (!res.ok) {
      setError(res.fieldErrors?.name?.[0] ?? res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Серия создана");
    onCreated(res.data);
    setName("");
    setError(null);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая серия</DialogTitle>
          <DialogDescription>
            Серия объединяет этапы, например «Марафон-Промнефтегаз».
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="new-series-name">Название</Label>
          <Input
            id="new-series-name"
            value={name}
            maxLength={SERIES_NAME_MAX}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              // Диалог рендерится в портале, но React-события всплывают в форму турнира
              if (event.key === "Enter") {
                event.preventDefault();
                void create();
              }
            }}
          />
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button type="button" disabled={pending} onClick={() => void create()}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Next (cacheComponents) сохраняет состояние посещённых страниц, поэтому после создания
 * турнира форма пересоздаётся — повторный заход на «Новый турнир» начинается с чистого листа.
 */
export function TournamentForm(props: TournamentFormProps) {
  const [instance, setInstance] = useState(0);
  return (
    <TournamentFormInner
      key={instance}
      {...props}
      onCreated={() => setInstance((value) => value + 1)}
    />
  );
}

function TournamentFormInner({
  defaultValues,
  initialCover,
  seriesOptions,
  duplicateOf,
  onCreated,
}: TournamentFormProps & { onCreated: () => void }) {
  const router = useRouter();
  const form = useForm<TournamentInput, unknown, TournamentValues>({
    resolver: zodResolver(tournamentSchema),
    defaultValues,
  });
  const { control, setValue, setError, formState } = form;
  // Пока slug не правили руками, он повторяет название
  const [slugTouched, setSlugTouched] = useState(Boolean(defaultValues.slug));
  const [series, setSeries] = useState(seriesOptions);
  const [seriesDialogOpen, setSeriesDialogOpen] = useState(false);

  const [seriesId, startDate, endDate, description] = useWatch({
    control,
    name: ["seriesId", "startDate", "endDate", "description"],
  });
  const isEdit = Boolean(defaultValues.id);
  const isSubmitting = formState.isSubmitting;

  async function onSubmit(values: TournamentValues) {
    const res = await saveTournament(values);
    if (!res.ok) {
      toast.error(res.error);
      applyFieldErrors(setError, res.fieldErrors);
      return;
    }
    toast.success("Сохранено");
    router.push(LIST_HREF);
    if (!isEdit) onCreated();
  }

  function setDates(nextStart: string, nextEnd: string) {
    const opts = { shouldDirty: true, shouldValidate: formState.isSubmitted };
    setValue("startDate", nextStart, opts);
    setValue("endDate", nextEnd, opts);
  }

  const dateError = formState.errors.startDate?.message ?? formState.errors.endDate?.message;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {duplicateOf ? (
          <div
            role="status"
            className="bg-accent text-accent-foreground flex items-start gap-3 rounded-lg border p-4 text-sm"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>Копия турнира «{duplicateOf}». Укажите даты — остальное можно оставить.</p>
          </div>
        ) : null}

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
                    maxLength={200}
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={control}
              name="seriesId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Серия</FormLabel>
                  <div className="flex gap-2">
                    <Select
                      value={field.value ?? NONE}
                      onValueChange={(next) => {
                        const value = next === NONE ? null : next;
                        field.onChange(value);
                        if (!value) setValue("stageNumber", null, { shouldDirty: true });
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full min-w-0">
                          <SelectValue placeholder="Без серии" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>Без серии</SelectItem>
                        {series.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Новая серия"
                      title="Новая серия"
                      onClick={() => setSeriesDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            {seriesId ? (
              <FormField
                control={control}
                name="stageNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Номер тура</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={99}
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(toNullableNumber(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={control}
              name="discipline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Дисциплина</FormLabel>
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(next) =>
                      field.onChange(
                        next === NONE ? null : (next as TournamentValues["discipline"])
                      )
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Не указана" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Не указана</SelectItem>
                      {DISCIPLINES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {DISCIPLINE_LABELS[value]}
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
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Уровень</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LEVELS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {LEVEL_LABELS[value]}
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
            name="categories"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Категории участников</FormLabel>
                <CategoriesField value={field.value} onChange={field.onChange} />
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Section title="Даты и взносы">
          <div className="space-y-2">
            <Label>Даты проведения</Label>
            <DateRangeField
              startDate={startDate}
              endDate={endDate}
              onChange={setDates}
              invalid={Boolean(dateError)}
            />
            {dateError ? <p className="text-destructive text-sm">{dateError}</p> : null}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(["entryFee", "prizeFund"] as const).map((name) => (
              <FormField
                key={name}
                control={control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{name === "entryFee" ? "Взнос, ₽" : "Призовой фонд, ₽"}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(toNullableNumber(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
        </Section>

        <Section title="Описание и афиша">
          <FormField
            control={control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Описание</FormLabel>
                <FormControl>
                  <Textarea
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    rows={3}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value || null)}
                  />
                </FormControl>
                <FormDescription className="flex justify-between gap-2">
                  <span>Показывается на главной под названием турнира.</span>
                  <span className="tabular-nums">
                    {(description ?? "").length}/{MAX_DESCRIPTION_LENGTH}
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
                <div className="max-w-xl">
                  <ImageUploadField
                    label="Афиша"
                    folder="tournaments"
                    aspect={COVER_ASPECT}
                    value={field.value}
                    initialAsset={initialCover}
                    onChange={(mediaId) => field.onChange(mediaId)}
                  />
                </div>
                <FormDescription>
                  Рекомендуемый размер 1600×600 (соотношение 16:6). На сайте афиша обрезается по
                  центру под это соотношение.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Section title="Публикация">
          {(
            [
              ["registrationOpen", "Открыта регистрация"],
              ["isPublished", "Опубликован на сайте"],
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
          isSubmitting={isSubmitting}
          submitLabel={isEdit ? "Сохранить" : "Создать турнир"}
          cancelHref={LIST_HREF}
        />
      </form>

      <NewSeriesDialog
        open={seriesDialogOpen}
        onOpenChange={setSeriesDialogOpen}
        onCreated={(created) => {
          setSeries((prev) => [...prev, created]);
          setValue("seriesId", created.id, { shouldDirty: true });
          // Новая серия появится и в списке серий, и в данных других страниц
          router.refresh();
        }}
      />
    </Form>
  );
}

/** Кнопка «Удалить» в шапке страницы редактирования. */
export function DeleteTournamentButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="outline" size="sm" className="text-destructive">
          <Trash2 className="h-4 w-4" aria-hidden />
          Удалить
        </Button>
      }
      title={`Удалить турнир «${title}»?`}
      description="Действие необратимо."
      onConfirm={async () => {
        const res = await deleteTournament({ id });
        if (res.ok) {
          toast.success("Турнир удалён");
          router.push(LIST_HREF);
        }
        return res;
      }}
    />
  );
}
