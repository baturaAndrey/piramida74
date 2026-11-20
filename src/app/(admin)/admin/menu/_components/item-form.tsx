"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { type FieldPath, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { ActionOutcome } from "@/components/admin/action-outcome";
import { FormActions } from "@/components/admin/form-actions";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import {
  AlertDialog,
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { deleteMenuItem, saveMenuItem } from "../_actions";
import { formatRub } from "../_lib/labels";
import { type ItemInput, type ItemOutput, itemSchema, type PricingMode } from "../_schema";
import { CopyCode, EMPTY_PRICE_ROW, VariantsTable } from "./variants-table";
import type { AdminMenuItem, AdminPriceGroup, CategoryOption } from "../_queries";

/** Пункт «Как у категории» (priceGroupId = null) в Select сетки */
const INHERIT = "__category__";
const DESCRIPTION_MAX = 400;

export type ItemFormProps = {
  item: AdminMenuItem | null;
  /** Категория новой позиции (`?cat=`) */
  defaultCategoryId: string | null;
  categories: CategoryOption[];
  priceGroups: Pick<AdminPriceGroup, "id" | "name" | "tiers">[];
};

function buildDefaults(
  item: AdminMenuItem | null,
  category: CategoryOption | undefined
): ItemInput {
  if (item) {
    const hasVariants = item.variants.length > 0;
    return {
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      choiceNote: item.choiceNote,
      originCountry: item.originCountry,
      isTakeawayDiscount: item.isTakeawayDiscount,
      imageMediaId: item.imageMediaId,
      isActive: item.isActive,
      pricingMode: hasVariants ? "variants" : "group",
      priceGroupId: hasVariants ? null : item.priceGroupId,
      variants: item.variants.map((variant) => ({
        id: variant.id,
        code: variant.code,
        label: variant.label,
        amount: variant.amount,
        unit: variant.unit,
        price: variant.price,
      })),
    };
  }
  // В категории с сеткой цен новая позиция по умолчанию берёт сетку категории
  const inheritGroup = Boolean(category?.priceGroupId);
  return {
    categoryId: category?.id ?? "",
    name: "",
    description: null,
    choiceNote: null,
    originCountry: null,
    isTakeawayDiscount: true,
    imageMediaId: null,
    isActive: true,
    pricingMode: inheritGroup ? "group" : "variants",
    priceGroupId: null,
    variants: inheritGroup ? [] : [{ ...EMPTY_PRICE_ROW }],
  };
}

function hasVariantData(variants: ItemInput["variants"]): boolean {
  return variants.some(
    (variant) =>
      Boolean(variant.id) ||
      Boolean(variant.label?.trim()) ||
      variant.amount != null ||
      (Number.isFinite(variant.price) && variant.price > 0)
  );
}

export function ItemForm({ item, defaultCategoryId, categories, priceGroups }: ItemFormProps) {
  const router = useRouter();
  const initialCategory =
    categories.find((category) => category.id === (item?.categoryId ?? defaultCategoryId)) ??
    categories[0];
  const [confirmGroupOpen, setConfirmGroupOpen] = useState(false);

  const form = useForm<ItemInput, unknown, ItemOutput>({
    resolver: zodResolver(itemSchema),
    defaultValues: buildDefaults(item, initialCategory),
  });
  const { control, handleSubmit, setError, setValue, getValues, clearErrors, formState } = form;
  const [categoryId, pricingMode, priceGroupId] = useWatch({
    control,
    name: ["categoryId", "pricingMode", "priceGroupId"],
  });

  const category = categories.find((option) => option.id === categoryId);
  const categoryGroup = category?.priceGroupId
    ? priceGroups.find((group) => group.id === category.priceGroupId)
    : undefined;
  const effectiveGroup = priceGroupId
    ? priceGroups.find((group) => group.id === priceGroupId)
    : categoryGroup;
  const listHref = `/admin/menu?cat=${categoryId || initialCategory?.id || ""}`;

  function applyMode(mode: PricingMode) {
    clearErrors(["variants", "priceGroupId"]);
    if (mode === "group") {
      setValue("variants", []);
      setValue("pricingMode", "group", { shouldDirty: true });
      return;
    }
    setValue("priceGroupId", null);
    if (getValues("variants").length === 0) setValue("variants", [{ ...EMPTY_PRICE_ROW }]);
    setValue("pricingMode", "variants", { shouldDirty: true });
  }

  function handleModeChange(next: string) {
    const mode = next as PricingMode;
    if (mode === pricingMode) return;
    // Уже введённые варианты пропадут — спрашиваем подтверждение
    if (mode === "group" && hasVariantData(getValues("variants"))) {
      setConfirmGroupOpen(true);
      return;
    }
    applyMode(mode);
  }

  async function onSubmit(values: ItemOutput) {
    if (values.pricingMode === "group" && !values.priceGroupId && !category?.priceGroupId) {
      setError("priceGroupId", { type: "manual", message: "Выберите сетку цен" });
      return;
    }
    const result = await saveMenuItem(values);
    if (!result.ok) {
      for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
        const message = messages[0];
        if (message) setError(key as FieldPath<ItemInput>, { type: "server", message });
      }
      toast.error(result.error);
      return;
    }
    toast.success(item ? "Позиция сохранена" : "Позиция создана");
    // cacheComponents хранит посещённые маршруты в <Activity> вместе с состоянием:
    // форма новой позиции должна вернуться пустой. Форму редактирования пересоздаёт key страницы.
    if (!item) form.reset(buildDefaults(null, initialCategory));
    router.push(`/admin/menu?cat=${values.categoryId}`);
    router.refresh();
  }

  async function handleDelete(): Promise<ActionOutcome> {
    if (!item) return;
    const result = await deleteMenuItem({ id: item.id });
    if (result.ok) {
      toast.success("Позиция удалена");
      router.push(listHref);
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
              {item ? (
                <span className="flex items-center gap-1 text-sm font-normal">
                  <span className="text-muted-foreground text-xs">Код</span>
                  <CopyCode code={item.code} />
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Категория</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Выберите категорию" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          <span className={cn(option.depth === 1 && "pl-4")}>{option.title}</span>
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={160} />
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
                  <FormLabel>Состав</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      maxLength={DESCRIPTION_MAX}
                      rows={3}
                      placeholder="Необязательно"
                    />
                  </FormControl>
                  <FormDescription>
                    {(field.value ?? "").length}/{DESCRIPTION_MAX}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={control}
                name="choiceNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Выбор подачи</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        maxLength={120}
                        placeholder="кляр / чесночный соус"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="originCountry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Страна</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        maxLength={60}
                        placeholder="Необязательно"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={control}
                name="isTakeawayDiscount"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4 rounded-md border p-3">
                    <FormLabel>Скидка 10% на вынос</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4 rounded-md border p-3">
                    <FormLabel>Показывать на сайте</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Цены</CardTitle>
            <CardDescription>
              Либо свои варианты (объём, порция), либо общая сетка цен — одновременно нельзя.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Как задаются цены</Label>
              <RadioGroup
                value={pricingMode}
                onValueChange={handleModeChange}
                className="flex flex-col gap-3 sm:flex-row sm:gap-6"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="variants" />
                  Свои варианты
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="group" />
                  Общая сетка цен
                </label>
              </RadioGroup>
            </div>

            {pricingMode === "variants" ? (
              <VariantsTable
                control={control}
                name="variants"
                labelPlaceholder="0,3 л, Малая… или пусто"
                minRows={1}
              />
            ) : (
              <FormField
                control={control}
                name="priceGroupId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Сетка цен</FormLabel>
                    <Select
                      value={field.value ?? (categoryGroup ? INHERIT : "")}
                      onValueChange={(value) => field.onChange(value === INHERIT ? null : value)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Выберите сетку цен" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categoryGroup ? (
                          <SelectItem value={INHERIT}>
                            Как у категории: {categoryGroup.name}
                          </SelectItem>
                        ) : null}
                        {priceGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!categoryGroup ? (
                      <FormDescription>
                        У категории нет общей сетки — выберите сетку.
                      </FormDescription>
                    ) : null}
                    <FormMessage />
                    {effectiveGroup ? (
                      <ul className="bg-muted/50 divide-y rounded-md border text-sm">
                        {effectiveGroup.tiers.map((tier) => (
                          <li
                            key={tier.id}
                            className="flex items-center justify-between gap-3 px-3 py-2"
                          >
                            <span className="min-w-0 flex-1">{tier.label}</span>
                            <span className="tabular-nums">{formatRub(tier.price)}</span>
                            <code className="text-muted-foreground w-14 text-right font-mono text-xs">
                              {tier.code}
                            </code>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Фото</CardTitle>
            <CardDescription>Необязательно</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={control}
              name="imageMediaId"
              render={({ field }) => (
                <ImageUploadField
                  value={field.value}
                  initialAsset={item?.image ?? null}
                  onChange={(mediaId) => field.onChange(mediaId)}
                  folder="menu"
                  label="Фото позиции"
                  aspect={4 / 3}
                  disabled={formState.isSubmitting}
                />
              )}
            />
          </CardContent>
        </Card>

        <FormActions
          isSubmitting={formState.isSubmitting}
          cancelHref={listHref}
          {...(item
            ? {
                onDelete: handleDelete,
                deleteDescription:
                  "Позиция и её варианты будут удалены. Если вариант входит в банкетный сет, удаление будет отклонено.",
              }
            : {})}
        />
      </form>

      <AlertDialog open={confirmGroupOpen} onOpenChange={setConfirmGroupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Перейти на общую сетку цен?</AlertDialogTitle>
            <AlertDialogDescription>
              Варианты позиции будут удалены при сохранении.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                applyMode("group");
                setConfirmGroupOpen(false);
              }}
            >
              Перейти
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}
