"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, FolderPlus, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ActionOutcome } from "@/components/admin/action-outcome";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { SortableList, type SortableItemContext } from "@/components/admin/sortable-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { deleteCategory, reorderCategories, toggleCategory } from "../_actions";
import { CategoryDialog, type CategoryDialogState } from "./category-dialog";
import { ActiveToggle } from "./items-list";
import type { AdminCategory } from "../_queries";

export type CategoryTreeProps = {
  tree: AdminCategory[];
  selectedId: string | null;
  priceGroups: { id: string; name: string }[];
};

/** Дерево категорий (2 уровня): сортировка внутри родителя, активность, действия. */
export function CategoryTree({ tree, selectedId, priceGroups }: CategoryTreeProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<CategoryDialogState | null>(null);
  const topLevel = tree.map((category) => ({ id: category.id, title: category.title }));

  async function handleDelete(category: AdminCategory): Promise<ActionOutcome> {
    const result = await deleteCategory({ id: category.id });
    if (result.ok) {
      toast.success("Категория удалена");
      // Удалённая категория была выбрана — переходим к категории по умолчанию
      if (category.id === selectedId) router.replace("/admin/menu");
      router.refresh();
    }
    return result;
  }

  function renderRow(category: AdminCategory, ctx: SortableItemContext, depth: 0 | 1) {
    const selected = category.id === selectedId;
    return (
      <div className="space-y-1">
        <div
          className={cn(
            "flex items-center gap-1 rounded-md border px-1 py-1",
            selected ? "border-primary/40 bg-accent" : "bg-card",
            !category.isActive && "opacity-70"
          )}
        >
          {ctx.dragHandle}
          <Link
            href={`/admin/menu?cat=${category.id}`}
            aria-current={selected ? "page" : undefined}
            className="focus-visible:ring-ring/50 min-w-0 flex-1 rounded-sm py-1 focus-visible:ring-[3px] focus-visible:outline-none"
          >
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "truncate text-sm",
                  depth === 0 ? "font-medium" : "",
                  !category.isActive && "text-muted-foreground line-through"
                )}
              >
                {category.title}
              </span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {category.itemCount}
              </span>
            </span>
            {category.priceGroupName ? (
              <Badge variant="secondary" className="mt-1 max-w-full truncate font-normal">
                сетка цен: {category.priceGroupName}
              </Badge>
            ) : null}
          </Link>
          <ActiveToggle
            checked={category.isActive}
            onToggle={(isActive) => toggleCategory({ id: category.id, isActive })}
            label={`Показывать категорию «${category.title}»`}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Действия">
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setDialog({ mode: "edit", category })}>
                <Pencil aria-hidden />
                Изменить
              </DropdownMenuItem>
              {depth === 0 ? (
                <DropdownMenuItem
                  onSelect={() => setDialog({ mode: "create", parentId: category.id })}
                >
                  <FolderPlus aria-hidden />
                  Добавить подкатегорию
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={ctx.moveUp} disabled={!ctx.canMoveUp}>
                <ArrowUp aria-hidden />
                Выше
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={ctx.moveDown} disabled={!ctx.canMoveDown}>
                <ArrowDown aria-hidden />
                Ниже
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <ConfirmDialog
                trigger={
                  // preventDefault: меню не закрывается сразу, иначе вместе с ним размонтируется диалог
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={(event) => event.preventDefault()}
                  >
                    <Trash2 aria-hidden />
                    Удалить
                  </DropdownMenuItem>
                }
                title={`Удалить категорию «${category.title}»?`}
                description="Удалить можно только пустую категорию: без позиций и подкатегорий."
                onConfirm={() => handleDelete(category)}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {depth === 0 && category.children.length > 0 ? (
          <SortableList
            items={category.children}
            className="ml-5 space-y-1 border-l pl-2"
            onReorder={(ids) => reorderCategories({ parentId: category.id, ids })}
            renderItem={(child, childCtx) => renderRow(child, childCtx, 1)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Категории</h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setDialog({ mode: "create", parentId: null })}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Категория
        </Button>
      </div>

      {tree.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          Категорий пока нет
        </p>
      ) : (
        <SortableList
          items={tree}
          className="space-y-1"
          onReorder={(ids) => reorderCategories({ parentId: null, ids })}
          renderItem={(category, ctx) => renderRow(category, ctx, 0)}
        />
      )}

      <CategoryDialog
        state={dialog}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        topLevel={topLevel}
        priceGroups={priceGroups}
      />
    </div>
  );
}
