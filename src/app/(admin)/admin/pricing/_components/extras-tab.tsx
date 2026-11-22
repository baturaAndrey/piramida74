"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import type { ExtraService } from "@/lib/schema";
import { deleteExtra, reorderExtras, saveExtra, toggleExtra } from "../_actions";
import { EXTRA_UNIT_LABELS, formatExtraPrice } from "../_lib/labels";
import { extraSchema, type ExtraInput, type ExtraValues } from "../_schema";

/** Единицы доп. услуг, которые понимает калькулятор */
const EXTRA_UNITS = ["per_hour", "per_session"] as const;

type ExtrasTabProps = { extras: ExtraService[] };

type DialogState = { open: boolean; extra: ExtraService | null };

export function ExtrasTab({ extras }: ExtrasTabProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>({ open: false, extra: null });

  async function reorder(ids: string[]) {
    const result = await reorderExtras({ ids });
    if (result.ok) router.refresh();
    return result;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Нарды, шахматы, прокат кия — выводятся в прайсе и в калькуляторе.
        </p>
        <Button onClick={() => setDialog({ open: true, extra: null })} className="shrink-0">
          <Plus className="h-4 w-4" aria-hidden />
          Добавить услугу
        </Button>
      </div>

      {extras.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          Дополнительных услуг пока нет
        </p>
      ) : (
        <SortableList
          items={extras}
          onReorder={reorder}
          renderItem={(extra, { dragHandle }) => (
            <ExtraRow
              extra={extra}
              dragHandle={dragHandle}
              onEdit={() => setDialog({ open: true, extra })}
            />
          )}
        />
      )}

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog.extra ? "Изменить услугу" : "Новая услуга"}</DialogTitle>
            <DialogDescription>Цена указывается в целых рублях.</DialogDescription>
          </DialogHeader>
          {dialog.open ? (
            <ExtraForm
              extra={dialog.extra}
              onDone={() => setDialog((d) => ({ ...d, open: false }))}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExtraRow({
  extra,
  dragHandle,
  onEdit,
}: {
  extra: ExtraService;
  dragHandle: ReactNode;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle(isActive: boolean) {
    startTransition(async () => {
      const result = await toggleExtra({ id: extra.id, isActive });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isActive ? "Услуга включена" : "Услуга скрыта");
      router.refresh();
    });
  }

  async function remove() {
    const result = await deleteExtra({ id: extra.id });
    if (result.ok) {
      toast.success("Услуга удалена");
      router.refresh();
    }
    return result;
  }

  return (
    <div className="bg-card flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-3 sm:flex-nowrap">
      {dragHandle}
      <div className="min-w-0 flex-1">
        <p className={extra.isActive ? "font-medium" : "text-muted-foreground font-medium"}>
          {extra.name}
        </p>
        <p className="text-muted-foreground text-sm tabular-nums">
          {formatExtraPrice(extra.price, extra.priceUnit)}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <Switch
          checked={extra.isActive}
          onCheckedChange={toggle}
          disabled={isPending}
          aria-label={extra.isActive ? `Скрыть «${extra.name}»` : `Показать «${extra.name}»`}
          className="mr-2"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          aria-label={`Изменить «${extra.name}»`}
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
        <ConfirmDialog
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label={`Удалить «${extra.name}»`}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          }
          title={`Удалить «${extra.name}»?`}
          description="Услуга исчезнет из прайса и калькулятора. Действие нельзя отменить."
          onConfirm={remove}
        />
      </div>
    </div>
  );
}

function toDefaults(extra: ExtraService | null): ExtraInput {
  if (!extra) {
    return { name: "", description: "", price: 0, priceUnit: "per_hour", isActive: true };
  }
  return {
    id: extra.id,
    name: extra.name,
    description: extra.description ?? "",
    price: extra.price,
    // fixed для доп. услуг не поддерживается калькулятором — предлагаем «за раз»
    priceUnit: extra.priceUnit === "per_hour" ? "per_hour" : "per_session",
    isActive: extra.isActive,
  };
}

function ExtraForm({ extra, onDone }: { extra: ExtraService | null; onDone: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<ExtraInput, unknown, ExtraValues>({
    resolver: zodResolver(extraSchema),
    defaultValues: toDefaults(extra),
  });

  function onSubmit(values: ExtraValues) {
    startTransition(async () => {
      const result = await saveExtra(values);
      if (!result.ok) {
        for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as FieldPath<ExtraInput>, { message: messages[0] ?? "" });
        }
        toast.error(result.error);
        return;
      }
      toast.success(extra ? "Услуга сохранена" : "Услуга добавлена");
      onDone();
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Название</FormLabel>
              <FormControl>
                <Input placeholder="Прокат кия" maxLength={120} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Цена, ₽</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={10}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={Number.isNaN(field.value) ? "" : field.value}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="priceUnit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Единица</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EXTRA_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {EXTRA_UNIT_LABELS[u]}
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
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Описание</FormLabel>
              <FormControl>
                <Textarea rows={2} maxLength={500} {...field} value={field.value ?? ""} />
              </FormControl>
              <FormDescription>Необязательно</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-3">
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel>Показывать на сайте</FormLabel>
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
            Отмена
          </Button>
          <Button type="submit" disabled={isPending} aria-busy={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Сохранить
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
