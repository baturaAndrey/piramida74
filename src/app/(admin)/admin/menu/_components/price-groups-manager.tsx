"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { type FieldPath, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ActionOutcome } from "@/components/admin/action-outcome";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { deletePriceGroup, savePriceGroup } from "../_actions";
import { formatAmount, formatRub, plural } from "../_lib/labels";
import { type PriceGroupInput, type PriceGroupOutput, priceGroupSchema } from "../_schema";
import { CopyCode, EMPTY_PRICE_ROW, VariantsTable } from "./variants-table";
import type { AdminPriceGroup } from "../_queries";

/** Диалог: null — закрыт, "new" — создание, иначе — редактирование */
type DialogTarget = AdminPriceGroup | "new" | null;

export function PriceGroupsManager({ groups }: { groups: AdminPriceGroup[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<DialogTarget>(null);

  async function handleDelete(id: string): Promise<ActionOutcome> {
    const result = await deletePriceGroup({ id });
    if (result.ok) {
      toast.success("Сетка удалена");
      router.refresh();
    }
    return result;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground max-w-2xl text-sm">
          Общие цены для позиций без своих вариантов (чаи, лимонады). В калькуляторе каждая позиция
          с сеткой — это строки «позиция — уровень» с кодом{" "}
          <code className="font-mono">позиция-уровень</code>.
        </p>
        <Button type="button" size="sm" onClick={() => setTarget("new")} className="shrink-0">
          <Plus className="h-4 w-4" aria-hidden />
          Новая сетка
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Сеток цен пока нет
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {groups.map((group) => {
            const inUse = group.categoryCount + group.itemCount > 0;
            return (
              <Card key={group.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1.5">
                      <CardTitle className="text-lg break-words">{group.name}</CardTitle>
                      <CardDescription>
                        Используют: {group.categoryCount}{" "}
                        {plural(group.categoryCount, ["категория", "категории", "категорий"])},{" "}
                        {group.itemCount}{" "}
                        {plural(group.itemCount, ["позиция", "позиции", "позиций"])}
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setTarget(group)}
                        aria-label={`Изменить сетку «${group.name}»`}
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
                            aria-label={`Удалить сетку «${group.name}»`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </Button>
                        }
                        title={`Удалить сетку «${group.name}»?`}
                        description={
                          inUse
                            ? "Сетку используют категории или позиции — сначала отвяжите их, иначе удаление будет отклонено."
                            : "Уровни сетки пропадут из калькулятора. Действие нельзя отменить."
                        }
                        onConfirm={() => handleDelete(group.id)}
                      />
                    </div>
                  </div>
                  {group.description ? (
                    <p className="text-muted-foreground text-sm">{group.description}</p>
                  ) : null}
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Уровень</TableHead>
                        <TableHead className="text-right">Цена</TableHead>
                        <TableHead className="text-right">Код</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.tiers.map((tier) => (
                        <TableRow key={tier.id}>
                          <TableCell className="whitespace-normal">
                            {tier.label}
                            {tier.amount != null ? (
                              <span className="text-muted-foreground">
                                {" "}
                                · {formatAmount(tier.amount, tier.unit)}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatRub(tier.price)}
                          </TableCell>
                          <TableCell className="text-right">
                            <CopyCode code={tier.code} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {target !== null ? (
            <PriceGroupForm
              group={target === "new" ? null : target}
              onDone={() => setTarget(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PriceGroupForm({ group, onDone }: { group: AdminPriceGroup | null; onDone: () => void }) {
  const router = useRouter();
  const form = useForm<PriceGroupInput, unknown, PriceGroupOutput>({
    resolver: zodResolver(priceGroupSchema),
    defaultValues: group
      ? {
          id: group.id,
          name: group.name,
          description: group.description,
          tiers: group.tiers.map((tier) => ({
            id: tier.id,
            code: tier.code,
            label: tier.label,
            amount: tier.amount,
            unit: tier.unit,
            price: tier.price,
          })),
        }
      : { name: "", description: null, tiers: [{ ...EMPTY_PRICE_ROW, label: "" }] },
  });
  const { control, handleSubmit, setError, formState } = form;

  async function onSubmit(values: PriceGroupOutput) {
    const result = await savePriceGroup(values);
    if (!result.ok) {
      for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
        const message = messages[0];
        if (message) setError(key as FieldPath<PriceGroupInput>, { type: "server", message });
      }
      toast.error(result.error);
      return;
    }
    toast.success(group ? "Сетка сохранена" : "Сетка создана");
    onDone();
    router.refresh();
  }

  return (
    <Form {...form}>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <DialogHeader>
          <DialogTitle>{group ? "Сетка цен" : "Новая сетка цен"}</DialogTitle>
          <DialogDescription>
            Удалённый уровень пропадёт из калькулятора; старые ссылки на расчёт с ним перестанут его
            учитывать.
          </DialogDescription>
        </DialogHeader>

        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Название</FormLabel>
              <FormControl>
                <Input {...field} maxLength={120} placeholder="Например: Teatone" />
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
                  maxLength={400}
                  rows={2}
                  placeholder="Необязательно"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <Label>Уровни</Label>
          <VariantsTable
            control={control}
            name="tiers"
            labelPlaceholder="Чайник 600 мл"
            newCodeText="будет создан"
            addLabel="Уровень"
            minRows={1}
          />
        </div>

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
