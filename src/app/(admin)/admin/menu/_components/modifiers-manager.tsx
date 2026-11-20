"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { type FieldPath, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ActionOutcome } from "@/components/admin/action-outcome";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { SortableList } from "@/components/admin/sortable-list";
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
import { cn } from "@/lib/utils";
import { deleteModifier, reorderModifiers, saveModifier, toggleModifier } from "../_actions";
import { formatRub } from "../_lib/labels";
import { type ModifierInput, type ModifierOutput, modifierSchema } from "../_schema";
import { ActiveToggle } from "./items-list";
import type { AdminModifier, CategoryOption } from "../_queries";

const ALL = "__all__";

type DialogTarget = AdminModifier | "new" | null;

export type ModifiersManagerProps = {
  modifiers: AdminModifier[];
  categories: CategoryOption[];
};

export function ModifiersManager({ modifiers, categories }: ModifiersManagerProps) {
  const router = useRouter();
  const [target, setTarget] = useState<DialogTarget>(null);
  const categoryTitle = new Map(categories.map((category) => [category.id, category.title]));

  async function handleDelete(id: string): Promise<ActionOutcome> {
    const result = await deleteModifier({ id });
    if (result.ok) {
      toast.success("Добавка удалена");
      router.refresh();
    }
    return result;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground max-w-2xl text-sm">
          Платные добавки показываются на /menu текстом и в калькулятор не входят.
        </p>
        <Button type="button" size="sm" onClick={() => setTarget("new")} className="shrink-0">
          <Plus className="h-4 w-4" aria-hidden />
          Новая добавка
        </Button>
      </div>

      {modifiers.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Добавок пока нет
        </p>
      ) : (
        <SortableList
          items={modifiers}
          onReorder={(ids) => reorderModifiers({ ids })}
          renderItem={(modifier, ctx) => (
            <div
              className={cn(
                "bg-card flex flex-wrap items-center gap-2 rounded-lg border p-3 shadow-xs",
                !modifier.isActive && "bg-muted/50"
              )}
            >
              {ctx.dragHandle}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "font-medium break-words",
                    !modifier.isActive && "text-muted-foreground"
                  )}
                >
                  {modifier.name}
                </p>
                <p className="text-muted-foreground text-sm">
                  {modifier.categoryId
                    ? (categoryTitle.get(modifier.categoryId) ?? "Категория удалена")
                    : "Для всех"}
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums">{formatRub(modifier.price)}</span>
              <ActiveToggle
                checked={modifier.isActive}
                onToggle={(isActive) => toggleModifier({ id: modifier.id, isActive })}
                label={`Показывать «${modifier.name}»`}
              />
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={ctx.moveUp}
                  disabled={!ctx.canMoveUp}
                  aria-label="Выше"
                >
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={ctx.moveDown}
                  disabled={!ctx.canMoveDown}
                  aria-label="Ниже"
                >
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setTarget(modifier)}
                  aria-label="Изменить"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive size-8"
                      aria-label="Удалить"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  }
                  title={`Удалить «${modifier.name}»?`}
                  description="Действие нельзя отменить."
                  onConfirm={() => handleDelete(modifier.id)}
                />
              </div>
            </div>
          )}
        />
      )}

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {target !== null ? (
            <ModifierForm
              modifier={target === "new" ? null : target}
              categories={categories}
              onDone={() => setTarget(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModifierForm({
  modifier,
  categories,
  onDone,
}: {
  modifier: AdminModifier | null;
  categories: CategoryOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const form = useForm<ModifierInput, unknown, ModifierOutput>({
    resolver: zodResolver(modifierSchema),
    defaultValues: modifier
      ? {
          id: modifier.id,
          name: modifier.name,
          price: modifier.price,
          categoryId: modifier.categoryId,
          isActive: modifier.isActive,
        }
      : { name: "", price: 0, categoryId: null, isActive: true },
  });
  const { control, handleSubmit, setError, formState } = form;

  async function onSubmit(values: ModifierOutput) {
    const result = await saveModifier(values);
    if (!result.ok) {
      for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
        const message = messages[0];
        if (message) setError(key as FieldPath<ModifierInput>, { type: "server", message });
      }
      toast.error(result.error);
      return;
    }
    toast.success(modifier ? "Добавка сохранена" : "Добавка создана");
    onDone();
    router.refresh();
  }

  return (
    <Form {...form}>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <DialogHeader>
          <DialogTitle>{modifier ? "Добавка" : "Новая добавка"}</DialogTitle>
          <DialogDescription>Например: «Сироп», «Дополнительный соус».</DialogDescription>
        </DialogHeader>

        <FormField
          control={control}
          name="name"
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
                  className="w-40 tabular-nums"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Категория</FormLabel>
              <Select
                value={field.value ?? ALL}
                onValueChange={(value) => field.onChange(value === ALL ? null : value)}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={ALL}>Для всех</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <span className={cn(category.depth === 1 && "pl-4")}>{category.title}</span>
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
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div className="space-y-1">
                <FormLabel>Показывать на сайте</FormLabel>
                <FormDescription>Скрытая добавка не видна на /menu.</FormDescription>
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
