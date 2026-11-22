"use client";

import type { ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { type FieldPath, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ActionOutcome } from "@/components/admin/action-outcome";
import { FormActions } from "@/components/admin/form-actions";
import { ImageUploadField } from "@/components/admin/image-upload-field";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CopyCode } from "../../menu/_components/variants-table";
import { deleteSet, saveSet } from "../_actions";
import { SET_DESCRIPTION_MAX, type SetInput, type SetOutput, setSchema } from "../_schema";
import { CompositionEditor } from "./composition-editor";
import type { AdminSet, VariantOption } from "../_queries";

const LIST_HREF = "/admin/banquet-sets";

export type SetFormProps = {
  set: AdminSet | null;
  variantOptions: VariantOption[];
};

type NullableNumberInputProps = Omit<
  ComponentProps<typeof Input>,
  "value" | "onChange" | "type" | "ref"
> & {
  value: number | null;
  onChange: (value: number | null) => void;
  inputRef: (element: HTMLInputElement | null) => void;
};

/**
 * Числовое поле, допускающее пустое значение (null). Остальные пропсы (id, aria-* от FormControl)
 * передаются в Input — так работает связь с FormLabel и FormMessage.
 */
function NullableNumberInput({ value, onChange, inputRef, ...rest }: NullableNumberInputProps) {
  return (
    <Input
      {...rest}
      ref={inputRef}
      type="number"
      inputMode="numeric"
      min={1}
      step={1}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
      placeholder="—"
      className="tabular-nums"
    />
  );
}

const EMPTY_SET: SetInput = {
  title: "",
  description: null,
  coverMediaId: null,
  pricingMode: "per_person",
  price: 0,
  minGuests: null,
  maxGuests: null,
  isActive: true,
  items: [],
};

export function SetForm({ set, variantOptions }: SetFormProps) {
  const router = useRouter();
  const form = useForm<SetInput, unknown, SetOutput>({
    resolver: zodResolver(setSchema),
    defaultValues: set
      ? {
          id: set.id,
          title: set.title,
          description: set.description,
          coverMediaId: set.coverMediaId,
          pricingMode: set.pricingMode,
          price: set.price,
          minGuests: set.minGuests,
          maxGuests: set.maxGuests,
          isActive: set.isActive,
          items: set.items.map((item) =>
            item.kind === "menu"
              ? {
                  kind: "menu",
                  menuItemVariantId: item.menuItemVariantId ?? "",
                  customLabel: null,
                  qty: item.qty,
                }
              : {
                  kind: "custom",
                  menuItemVariantId: null,
                  customLabel: item.customLabel ?? "",
                  qty: item.qty,
                }
          ),
        }
      : EMPTY_SET,
  });
  const { control, handleSubmit, setError, formState } = form;

  async function onSubmit(values: SetOutput) {
    const result = await saveSet(values);
    if (!result.ok) {
      for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
        const message = messages[0];
        if (message) setError(key as FieldPath<SetInput>, { type: "server", message });
      }
      toast.error(result.error);
      return;
    }
    toast.success(set ? "Сет сохранён" : "Сет создан");
    // Маршрут остаётся в <Activity> (cacheComponents) — форма нового сета должна вернуться пустой
    if (!set) form.reset(EMPTY_SET);
    router.push(LIST_HREF);
    router.refresh();
  }

  async function handleDelete(): Promise<ActionOutcome> {
    if (!set) return;
    const result = await deleteSet({ id: set.id });
    if (result.ok) {
      toast.success("Сет удалён");
      router.push(LIST_HREF);
      router.refresh();
    }
    return result;
  }

  return (
    <Form {...form}>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg">
              Основное
              {set ? (
                <span className="flex items-center gap-1 text-sm font-normal">
                  <span className="text-muted-foreground text-xs">Код</span>
                  <CopyCode code={set.code} />
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={120} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      maxLength={SET_DESCRIPTION_MAX}
                      rows={5}
                      placeholder="Необязательно"
                    />
                  </FormControl>
                  <FormDescription>
                    Можно использовать markdown. {(field.value ?? "").length}/{SET_DESCRIPTION_MAX}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4 rounded-md border p-3">
                  <FormLabel>Показывать на сайте и в калькуляторе</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Цена и гости</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={control}
              name="pricingMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Как считается цена</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="flex flex-col gap-3 sm:flex-row sm:gap-6"
                    >
                      <label className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value="per_person" />
                        За человека
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value="fixed" />
                        Фиксированная цена за сет
                      </label>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                control={control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Цена, ₽</FormLabel>
                    <FormControl>
                      <Input
                        ref={field.ref}
                        name={field.name}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={Number.isFinite(field.value) ? field.value : ""}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value === "" ? Number.NaN : Number(event.target.value)
                          )
                        }
                        onBlur={field.onBlur}
                        className="tabular-nums"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="minGuests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Гостей от</FormLabel>
                    <FormControl>
                      <NullableNumberInput
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        inputRef={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="maxGuests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Гостей до</FormLabel>
                    <FormControl>
                      <NullableNumberInput
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        inputRef={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Состав</CardTitle>
            <CardDescription>Позиции меню и произвольные строки с количеством.</CardDescription>
          </CardHeader>
          <CardContent>
            <CompositionEditor control={control} options={variantOptions} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Обложка</CardTitle>
            <CardDescription>Рекомендуемая пропорция — 4:3.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={control}
              name="coverMediaId"
              render={({ field }) => (
                <ImageUploadField
                  value={field.value}
                  initialAsset={set?.cover ?? null}
                  onChange={(mediaId) => field.onChange(mediaId)}
                  folder="sets"
                  label="Обложка сета"
                  aspect={4 / 3}
                  disabled={formState.isSubmitting}
                />
              )}
            />
          </CardContent>
        </Card>

        <FormActions
          isSubmitting={formState.isSubmitting}
          cancelHref={LIST_HREF}
          {...(set
            ? {
                onDelete: handleDelete,
                deleteDescription: "Сет и его состав будут удалены. Действие нельзя отменить.",
              }
            : {})}
        />
      </form>
    </Form>
  );
}
