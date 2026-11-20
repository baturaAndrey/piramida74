"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ActionOutcome } from "@/components/admin/action-outcome";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { applyBulkPrice, type BulkPreview, previewBulkPrice } from "../_actions";
import { formatRub, formatRubDelta, plural } from "../_lib/labels";
import {
  BULK_AMOUNT_LIMIT,
  BULK_MAX_ROWS,
  BULK_PERCENT_MAX,
  BULK_PERCENT_MIN,
  type BulkPriceInput,
  bulkPriceSchema,
} from "../_schema";
import type { CategoryOption } from "../_queries";

const ALL = "__all__";

type ModeKind = "percent" | "amount";

export function BulkPriceForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const uid = useId();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [includeSubcategories, setIncludeSubcategories] = useState(true);
  const [kind, setKind] = useState<ModeKind>("percent");
  const [rawValue, setRawValue] = useState("");
  const [round, setRound] = useState(true);
  const [includePriceGroups, setIncludePriceGroups] = useState(true);
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [valueError, setValueError] = useState<string | null>(null);

  const selected = categories.find((category) => category.id === categoryId);

  /** Любое изменение параметров сбрасывает предпросмотр — «Применить» снова недоступна */
  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPreview(null);
      setValueError(null);
    };
  }

  function buildInput(): BulkPriceInput | null {
    const value = Number(rawValue.replace(",", "."));
    const input: BulkPriceInput = {
      categoryId,
      includeSubcategories: Boolean(selected?.hasChildren) && includeSubcategories,
      mode: { kind, value: rawValue.trim() === "" ? Number.NaN : value },
      round,
      includePriceGroups,
    };
    const parsed = bulkPriceSchema.safeParse(input);
    if (!parsed.success) {
      setValueError(parsed.error.issues[0]?.message ?? "Проверьте значение");
      return null;
    }
    return input;
  }

  async function handlePreview() {
    const input = buildInput();
    if (!input) return;
    setPreviewing(true);
    const result = await previewBulkPrice(input);
    setPreviewing(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPreview(result.data);
  }

  async function handleApply(): Promise<ActionOutcome> {
    const input = buildInput();
    if (!input) return { ok: false, error: "Проверьте параметры" };
    const result = await applyBulkPrice(input);
    if (result.ok) {
      const n = result.data.count;
      toast.success(`Изменено ${n} ${plural(n, ["цена", "цены", "цен"])}`);
      setPreview(null);
      router.refresh();
    }
    return result;
  }

  const count = preview?.rows.length ?? 0;
  const tooMany = count > BULK_MAX_ROWS;

  return (
    <div className="max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Параметры</CardTitle>
          <CardDescription>
            Меняются цены вариантов позиций (включая скрытые позиции) и, по желанию, уровни общих
            сеток цен.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor={`${uid}-scope`}>Область</Label>
            <Select
              value={categoryId ?? ALL}
              onValueChange={(value) => change(setCategoryId)(value === ALL ? null : value)}
            >
              <SelectTrigger id={`${uid}-scope`} className="w-full sm:w-96">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Всё меню</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <span className={cn(category.depth === 1 && "pl-4")}>{category.title}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected?.hasChildren ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={includeSubcategories}
                  onCheckedChange={(checked) => change(setIncludeSubcategories)(checked === true)}
                />
                Включая подкатегории
              </label>
            ) : null}
          </div>

          <div className="space-y-3">
            <Label>Как менять</Label>
            <RadioGroup
              value={kind}
              onValueChange={(value) => change(setKind)(value as ModeKind)}
              className="flex flex-col gap-3 sm:flex-row sm:gap-6"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="percent" />
                Процент
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="amount" />
                Фиксированная сумма
              </label>
            </RadioGroup>
            <div className="flex items-center gap-2">
              <Input
                id={`${uid}-value`}
                type="number"
                inputMode="decimal"
                step={kind === "percent" ? 0.5 : 1}
                min={kind === "percent" ? BULK_PERCENT_MIN : -BULK_AMOUNT_LIMIT}
                max={kind === "percent" ? BULK_PERCENT_MAX : BULK_AMOUNT_LIMIT}
                value={rawValue}
                onChange={(event) => change(setRawValue)(event.target.value)}
                placeholder={kind === "percent" ? "5 или −10" : "50 или −30"}
                aria-label={kind === "percent" ? "Изменение, %" : "Изменение, ₽"}
                aria-invalid={Boolean(valueError)}
                aria-describedby={`${uid}-value-hint`}
                className="w-40 tabular-nums"
              />
              <span className="text-muted-foreground text-sm">
                {kind === "percent" ? "%" : "₽"}
              </span>
            </div>
            <p id={`${uid}-value-hint`} className="text-muted-foreground text-xs">
              {kind === "percent"
                ? `От ${BULK_PERCENT_MIN} до +${BULK_PERCENT_MAX}%, шаг 0,5. Минус — снижение.`
                : `Целое число от −${BULK_AMOUNT_LIMIT} до +${BULK_AMOUNT_LIMIT} ₽. Минус — снижение.`}
            </p>
            {valueError ? <p className="text-destructive text-sm">{valueError}</p> : null}
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={round}
                onCheckedChange={(checked) => change(setRound)(checked === true)}
              />
              Округлять до 10 ₽
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includePriceGroups}
                onCheckedChange={(checked) => change(setIncludePriceGroups)(checked === true)}
              />
              Также менять общие сетки цен (price groups) в области
            </label>
          </div>

          <Button type="button" onClick={() => void handlePreview()} disabled={previewing}>
            {previewing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
            Показать изменения
          </Button>
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Изменится {count} {plural(count, ["цена", "цены", "цен"])}
            </CardTitle>
            <CardDescription>
              Рассмотрено цен в области: {preview.scanned}. Строки без изменения не показаны.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview.sharedGroups.length > 0 ? (
              <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <div className="space-y-1">
                  <p className="font-medium">Сетки цен используются и вне выбранной области:</p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {preview.sharedGroups.map((group) => (
                      <li key={group.name}>
                        «{group.name}» — ещё {group.outsideCategories}{" "}
                        {plural(group.outsideCategories, ["категория", "категории", "категорий"])} и{" "}
                        {group.outsideItems}{" "}
                        {plural(group.outsideItems, ["позиция", "позиции", "позиций"])}
                      </li>
                    ))}
                  </ul>
                  <p>Цены там тоже изменятся.</p>
                </div>
              </div>
            ) : null}

            {tooMany ? (
              <p className="text-destructive text-sm">
                За раз можно изменить не больше {BULK_MAX_ROWS} цен — сузьте область.
              </p>
            ) : null}

            {count > 0 ? (
              <div className="max-h-[60vh] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Позиция</TableHead>
                      <TableHead className="text-right">Было</TableHead>
                      <TableHead className="text-right">Стало</TableHead>
                      <TableHead className="text-right">Разница</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row) => {
                      const delta = row.newPrice - row.oldPrice;
                      return (
                        <TableRow key={`${row.kind}-${row.id}`}>
                          <TableCell className="whitespace-normal">
                            <span className="font-medium">{row.itemName}</span>
                            {row.label ? (
                              <span className="text-muted-foreground"> — {row.label}</span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatRub(row.oldPrice)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatRub(row.newPrice)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right tabular-nums",
                              delta > 0 ? "text-green-600" : "text-destructive"
                            )}
                          >
                            {formatRubDelta(delta)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Ни одна цена не изменится (например, из-за округления).
              </p>
            )}

            <ConfirmDialog
              trigger={
                <Button type="button" disabled={count === 0 || tooMany}>
                  Применить
                </Button>
              }
              title={`Изменить ${count} ${plural(count, ["цену", "цены", "цен"])}?`}
              description="Действие нельзя отменить автоматически. Цены будут пересчитаны на сервере по текущим данным."
              confirmLabel="Применить"
              destructive={false}
              onConfirm={handleApply}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
