"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { SortableList } from "@/components/admin/sortable-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { PenaltyItem } from "@/lib/schema";
import type { PenaltyKind } from "@/lib/schema/enums";
import { deletePenalty, reorderPenalties, savePenalty } from "../_actions";
import { PENALTY_KIND_LABELS, pluralRu } from "../_lib/labels";

const PENALTY_KINDS: PenaltyKind[] = ["dishware", "property"];
const MAX_NAME_LENGTH = 200;

type PenaltiesTabProps = { penalties: PenaltyItem[] };

export function PenaltiesTab({ penalties }: PenaltiesTabProps) {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Строки редактируются на месте. Отметка «от» выводит цену на сайте как «от 500 ₽».
      </p>
      {PENALTY_KINDS.map((kind) => (
        <PenaltyListCard key={kind} kind={kind} items={penalties.filter((p) => p.kind === kind)} />
      ))}
    </div>
  );
}

/** Значения строки в редакторе; цена — строка, чтобы поле можно было очистить */
type RowDraft = { name: string; price: string; priceIsMinimum: boolean; isActive: boolean };

const toDraft = (p: PenaltyItem): RowDraft => ({
  name: p.name,
  price: String(p.price),
  priceIsMinimum: p.priceIsMinimum,
  isActive: p.isActive,
});

const EMPTY_DRAFT: RowDraft = { name: "", price: "", priceIsMinimum: false, isActive: true };

/** Целое число ≥ 0 или null, если поле заполнено неверно */
function parsePrice(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,7}$/.test(trimmed)) return null;
  return Number(trimmed);
}

function isDraftValid(d: RowDraft): boolean {
  const name = d.name.trim();
  return name.length > 0 && name.length <= MAX_NAME_LENGTH && parsePrice(d.price) !== null;
}

/** Ключ строки меняется вместе с сохранёнными значениями — после refresh редактор сбрасывается */
const rowKey = (p: PenaltyItem) => `${p.id}:${p.name}:${p.price}:${p.priceIsMinimum}:${p.isActive}`;

function PenaltyListCard({ kind, items }: { kind: PenaltyKind; items: PenaltyItem[] }) {
  const router = useRouter();
  const searchId = useId();
  const [query, setQuery] = useState("");
  // Черновые (несохранённые) строки — у них ещё нет id
  const [drafts, setDrafts] = useState<number[]>([]);
  const [nextDraftKey, setNextDraftKey] = useState(1);

  const normalized = query.trim().toLocaleLowerCase("ru-RU");
  const filtered = normalized
    ? items.filter((p) => p.name.toLocaleLowerCase("ru-RU").includes(normalized))
    : items;
  const title = PENALTY_KIND_LABELS[kind];

  function addDraft() {
    setDrafts((d) => [nextDraftKey, ...d]);
    setNextDraftKey((k) => k + 1);
  }

  const removeDraft = (key: number) => setDrafts((d) => d.filter((k) => k !== key));

  async function reorder(ids: string[]) {
    const result = await reorderPenalties({ kind, ids });
    if (result.ok) router.refresh();
    return result;
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>
              {items.length} {pluralRu(items.length, ["позиция", "позиции", "позиций"])}
            </CardDescription>
          </div>
          <Button variant="outline" onClick={addDraft} className="shrink-0">
            <Plus className="h-4 w-4" aria-hidden />
            Добавить позицию
          </Button>
        </div>
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">
            Поиск по разделу «{title}»
          </label>
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            id={searchId}
            type="search"
            placeholder="Поиск по названию"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {normalized ? (
          <p className="text-muted-foreground text-xs">
            Пока включён поиск, порядок строк менять нельзя.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {drafts.length > 0 ? (
          <ul className="space-y-2">
            {drafts.map((key) => (
              <li key={key}>
                <NewPenaltyRow kind={kind} onDone={() => removeDraft(key)} />
              </li>
            ))}
          </ul>
        ) : null}
        {filtered.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            {normalized ? "Ничего не найдено" : "Позиций нет"}
          </p>
        ) : (
          <SortableList
            items={filtered}
            onReorder={reorder}
            // Порядок подмножества нельзя корректно сохранить — перестановка только по полному списку
            disabled={normalized.length > 0}
            renderItem={(item, { dragHandle }) => (
              <PenaltyRow key={rowKey(item)} item={item} dragHandle={dragHandle} />
            )}
          />
        )}
      </CardContent>
    </Card>
  );
}

/** Поля строки: название, цена, «от», активность. Кнопки передаются через `actions`. */
function PenaltyFields({
  value,
  onChange,
  dragHandle,
  actions,
  disabled,
}: {
  value: RowDraft;
  onChange: (next: RowDraft) => void;
  dragHandle?: ReactNode;
  actions: ReactNode;
  disabled: boolean;
}) {
  const uid = useId();
  const priceInvalid = value.price.trim() !== "" && parsePrice(value.price) === null;
  return (
    <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg border p-2 sm:flex-nowrap">
      {dragHandle ?? <span className="hidden size-8 shrink-0 sm:block" aria-hidden />}
      <Input
        aria-label="Название"
        value={value.name}
        maxLength={MAX_NAME_LENGTH}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        className="min-w-0 flex-1 basis-[calc(100%-2.5rem)] sm:basis-auto"
      />
      <Input
        aria-label="Цена, ₽"
        inputMode="numeric"
        placeholder="₽"
        value={value.price}
        disabled={disabled}
        aria-invalid={priceInvalid}
        onChange={(e) => onChange({ ...value, price: e.target.value })}
        className="w-28 tabular-nums"
      />
      <div className="flex items-center gap-1.5">
        <Checkbox
          id={`${uid}-min`}
          checked={value.priceIsMinimum}
          disabled={disabled}
          onCheckedChange={(c) => onChange({ ...value, priceIsMinimum: c === true })}
        />
        <label htmlFor={`${uid}-min`} className="text-sm">
          от
        </label>
      </div>
      <Switch
        checked={value.isActive}
        disabled={disabled}
        onCheckedChange={(isActive) => onChange({ ...value, isActive })}
        aria-label={value.isActive ? "Показывается на сайте" : "Скрыта с сайта"}
        className="mx-1"
      />
      <div className="ml-auto flex items-center">{actions}</div>
    </div>
  );
}

function PenaltyRow({ item, dragHandle }: { item: PenaltyItem; dragHandle: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<RowDraft>(() => toDraft(item));

  const initial = toDraft(item);
  const dirty =
    draft.name !== initial.name ||
    draft.price.trim() !== initial.price ||
    draft.priceIsMinimum !== initial.priceIsMinimum ||
    draft.isActive !== initial.isActive;
  const canSave = dirty && isDraftValid(draft) && !isPending;

  function save() {
    const price = parsePrice(draft.price);
    if (price === null) return;
    startTransition(async () => {
      const result = await savePenalty({
        id: item.id,
        kind: item.kind,
        name: draft.name,
        price,
        priceIsMinimum: draft.priceIsMinimum,
        isActive: draft.isActive,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Сохранено");
      router.refresh();
    });
  }

  async function remove() {
    const result = await deletePenalty({ id: item.id });
    if (result.ok) {
      toast.success("Позиция удалена");
      router.refresh();
    }
    return result;
  }

  return (
    <PenaltyFields
      value={draft}
      onChange={setDraft}
      dragHandle={dragHandle}
      disabled={isPending}
      actions={
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={save}
            disabled={!canSave}
            aria-label={`Сохранить «${item.name}»`}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Check className="h-4 w-4" aria-hidden />
            )}
          </Button>
          <ConfirmDialog
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive"
                disabled={isPending}
                aria-label={`Удалить «${item.name}»`}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            }
            title={`Удалить «${item.name}»?`}
            description="Позиция исчезнет из прайса штрафов. Действие нельзя отменить."
            onConfirm={remove}
          />
        </>
      }
    />
  );
}

function NewPenaltyRow({ kind, onDone }: { kind: PenaltyKind; onDone: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<RowDraft>(EMPTY_DRAFT);
  const canSave = isDraftValid(draft) && !isPending;

  function save() {
    const price = parsePrice(draft.price);
    if (price === null) return;
    startTransition(async () => {
      const result = await savePenalty({
        kind,
        name: draft.name,
        price,
        priceIsMinimum: draft.priceIsMinimum,
        isActive: draft.isActive,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Позиция добавлена");
      onDone();
      router.refresh();
    });
  }

  return (
    <PenaltyFields
      value={draft}
      onChange={setDraft}
      disabled={isPending}
      actions={
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={save}
            disabled={!canSave}
            aria-label="Сохранить новую позицию"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Check className="h-4 w-4" aria-hidden />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDone}
            disabled={isPending}
            aria-label="Отменить добавление"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </>
      }
    />
  );
}
