"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { type FieldPath, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveCategory } from "../_actions";
import { type CategoryInput, type CategoryOutput, categorySchema } from "../_schema";
import type { AdminCategory } from "../_queries";

/** Radix Select не допускает пустое значение — «нет» кодируем отдельной строкой */
const NONE = "__none__";
const FUN_FACT_MAX = 400;

export type CategoryDialogState =
  { mode: "create"; parentId: string | null } | { mode: "edit"; category: AdminCategory };

export type CategoryDialogProps = {
  state: CategoryDialogState | null;
  onOpenChange: (open: boolean) => void;
  /** Категории верхнего уровня — кандидаты в родители */
  topLevel: { id: string; title: string }[];
  priceGroups: { id: string; name: string }[];
};

export function CategoryDialog({
  state,
  onOpenChange,
  topLevel,
  priceGroups,
}: CategoryDialogProps) {
  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {state ? (
          <CategoryForm
            state={state}
            topLevel={topLevel}
            priceGroups={priceGroups}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  state,
  topLevel,
  priceGroups,
  onDone,
}: {
  state: CategoryDialogState;
  topLevel: { id: string; title: string }[];
  priceGroups: { id: string; name: string }[];
  onDone: () => void;
}) {
  const router = useRouter();
  const category = state.mode === "edit" ? state.category : null;
  const hasChildren = (category?.children.length ?? 0) > 0;
  const parentOptions = topLevel.filter((option) => option.id !== category?.id);

  const form = useForm<CategoryInput, unknown, CategoryOutput>({
    resolver: zodResolver(categorySchema),
    defaultValues: category
      ? {
          id: category.id,
          title: category.title,
          slug: category.slug,
          parentId: category.parentId,
          funFactTitle: category.funFactTitle,
          funFactText: category.funFactText,
          priceGroupId: category.priceGroupId,
          isActive: category.isActive,
        }
      : {
          title: "",
          slug: "",
          parentId: state.mode === "create" ? state.parentId : null,
          funFactTitle: null,
          funFactText: null,
          priceGroupId: null,
          isActive: true,
        },
  });
  const { control, handleSubmit, setError, formState } = form;
  const priceGroupId = useWatch({ control, name: "priceGroupId" });
  // Подсказка о смене цен и кодов — только при переходе на другую сетку; снятие сетки при
  // наличии «наследующих» позиций сервер отклоняет с понятным сообщением
  const groupChanged =
    category !== null && Boolean(priceGroupId) && category.priceGroupId !== priceGroupId;

  async function onSubmit(values: CategoryOutput) {
    const result = await saveCategory(values);
    if (!result.ok) {
      for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
        const message = messages[0];
        if (message) setError(key as FieldPath<CategoryInput>, { type: "server", message });
      }
      toast.error(result.error);
      return;
    }
    toast.success(category ? "Категория сохранена" : "Категория создана");
    onDone();
    router.refresh();
  }

  const title = category
    ? "Категория"
    : state.mode === "create" && state.parentId
      ? "Новая подкатегория"
      : "Новая категория";

  return (
    <Form {...form}>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Категории и подкатегории меню бара и кухни (не больше двух уровней).
          </DialogDescription>
        </DialogHeader>

        <FormField
          control={control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Название</FormLabel>
              <FormControl>
                <Input {...field} maxLength={120} autoFocus />
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
              <FormControl>
                <Input
                  {...field}
                  maxLength={120}
                  placeholder="Сгенерируется из названия"
                  className="font-mono text-sm"
                />
              </FormControl>
              <FormDescription>
                Латиница, цифры и дефис. При совпадении добавится -2.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="parentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Родитель</FormLabel>
              <Select
                value={field.value ?? NONE}
                onValueChange={(value) => field.onChange(value === NONE ? null : value)}
                disabled={hasChildren}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NONE}>Без родителя</SelectItem>
                  {parentOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasChildren ? (
                <FormDescription>
                  У категории есть подкатегории — она остаётся верхнего уровня.
                </FormDescription>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="priceGroupId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Общая сетка цен</FormLabel>
              <Select
                value={field.value ?? NONE}
                onValueChange={(value) => field.onChange(value === NONE ? null : value)}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NONE}>Без общей сетки</SelectItem>
                  {priceGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Для чая, лимонадов: заголовок сетки (объёмы и цены) показывается над позициями на
                /menu.
              </FormDescription>
              {groupChanged ? (
                <p className="text-sm text-amber-700">
                  Позиции категории без своих вариантов и своей сетки получат цены новой сетки, а их
                  коды в калькуляторе изменятся — старые ссылки на расчёт перестанут их учитывать.
                </p>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="funFactTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Интересный факт — заголовок</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  maxLength={120}
                  placeholder="Необязательно"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="funFactText"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Интересный факт — текст</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  maxLength={FUN_FACT_MAX}
                  rows={3}
                  placeholder="Необязательно"
                />
              </FormControl>
              <FormDescription>
                {(field.value ?? "").length}/{FUN_FACT_MAX}
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
              <div className="space-y-1">
                <FormLabel>Показывать на сайте</FormLabel>
                <FormDescription>Скрытая категория не видна на /menu.</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onDone}
            disabled={formState.isSubmitting}
          >
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={formState.isSubmitting}
            aria-busy={formState.isSubmitting}
          >
            {formState.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            Сохранить
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
