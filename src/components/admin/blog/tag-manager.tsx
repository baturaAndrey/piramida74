"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { deleteTag, saveTag } from "@/lib/actions/blog-taxonomy";
import type { TagRow } from "@/lib/blog-admin/queries";
import { TAG_NAME_MAX } from "@/lib/validation/blog";
import { SlugField } from "./slug-field";

type Editing = { id?: string; name: string; slug: string; savedSlug?: string };

function TagDialog({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const [values, setValues] = useState<Editing>(editing);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    const res = await saveTag({ id: values.id, name: values.name, slug: values.slug });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      const next: Record<string, string> = {};
      for (const [key, messages] of Object.entries(res.fieldErrors ?? {})) {
        if (messages[0]) next[key] = messages[0];
      }
      setErrors(next);
      return;
    }
    toast.success(values.id ? "Тег сохранён" : "Тег создан");
    onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{values.id ? "Изменить тег" : "Новый тег"}</DialogTitle>
            <DialogDescription>Теги помогают фильтровать статьи в блоге.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="tag-name">Название</Label>
            <Input
              id="tag-name"
              value={values.name}
              maxLength={TAG_NAME_MAX}
              aria-invalid={errors.name ? true : undefined}
              onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
            />
            {errors.name ? <p className="text-destructive text-sm">{errors.name}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tag-slug">Slug</Label>
            <SlugField
              id="tag-slug"
              value={values.slug}
              onChange={(slug) => setValues((prev) => ({ ...prev, slug }))}
              source={values.name}
              entity="tag"
              ignoreId={values.id}
              savedSlug={values.savedSlug}
              invalid={Boolean(errors.slug)}
            />
            {errors.slug ? <p className="text-destructive text-sm">{errors.slug}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={pending || !values.name.trim() || !values.slug.trim()}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Сохранить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Теги блога: число статей, создание, переименование, удаление (снимается со статей каскадом). */
export function TagManager({ tags }: { tags: TagRow[] }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [query, setQuery] = useState("");

  function open(next: Editing) {
    setDialogKey((k) => k + 1);
    setEditing(next);
  }

  const q = query.trim().toLocaleLowerCase("ru-RU");
  const visible = q
    ? tags.filter((t) => t.name.toLocaleLowerCase("ru-RU").includes(q) || t.slug.includes(q))
    : tags;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск тега"
            aria-label="Поиск тега"
            className="pl-8"
          />
        </div>
        <Button type="button" onClick={() => open({ name: "", slug: "" })}>
          <Plus className="h-4 w-4" aria-hidden />
          Новый тег
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="text-right">Статей</TableHead>
              <TableHead>
                <span className="sr-only">Действия</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                  {tags.length === 0 ? "Тегов пока нет" : "Ничего не найдено"}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell className="font-medium">{tag.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {tag.slug}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{tag.articlesCount}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Изменить «${tag.name}»`}
                        onClick={() =>
                          open({ id: tag.id, name: tag.name, slug: tag.slug, savedSlug: tag.slug })
                        }
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            aria-label={`Удалить «${tag.name}»`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </Button>
                        }
                        title={`Удалить тег «${tag.name}»?`}
                        description={
                          tag.articlesCount > 0
                            ? `Тег будет снят со статей (${tag.articlesCount}). Сами статьи останутся.`
                            : "Тег не используется в статьях."
                        }
                        onConfirm={async () => {
                          const res = await deleteTag({ id: tag.id });
                          if (res.ok) toast.success("Тег удалён");
                          return res;
                        }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editing ? (
        <TagDialog key={dialogKey} editing={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}
