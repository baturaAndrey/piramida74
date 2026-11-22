"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ImageIcon, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { SortableList } from "@/components/admin/sortable-list";
import { Picture } from "@/components/media/picture";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { deleteRubric, reorderRubrics, saveRubric } from "@/lib/actions/blog-taxonomy";
import type { MediaDto } from "@/lib/admin/media-dto";
import type { RubricRow } from "@/lib/blog-admin/queries";
import { RUBRIC_DESCRIPTION_MAX, RUBRIC_NAME_MAX } from "@/lib/validation/blog";
import { SlugField } from "./slug-field";

type Editing = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  imageMediaId: string | null;
  image: MediaDto | null;
  savedSlug?: string;
};

const EMPTY: Editing = { name: "", slug: "", description: "", imageMediaId: null, image: null };

/** «1 статья», «3 статьи», «5 статей» */
function articlesWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "статья";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "статьи";
  return "статей";
}

function firstErrors(fieldErrors: Record<string, string[]> | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors ?? {})) {
    if (messages[0]) result[key] = messages[0];
  }
  return result;
}

function RubricDialog({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const [values, setValues] = useState<Editing>(editing);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    const res = await saveRubric({
      id: values.id,
      name: values.name,
      slug: values.slug,
      description: values.description,
      imageMediaId: values.imageMediaId,
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      setErrors(firstErrors(res.fieldErrors));
      return;
    }
    toast.success(values.id ? "Рубрика сохранена" : "Рубрика создана");
    onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{values.id ? "Изменить рубрику" : "Новая рубрика"}</DialogTitle>
            <DialogDescription>
              Рубрика открывается по адресу /blog/&lt;slug&gt; — тот же адресный ряд, что у статей.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rubric-name">Название</Label>
            <Input
              id="rubric-name"
              value={values.name}
              maxLength={RUBRIC_NAME_MAX}
              aria-invalid={errors.name ? true : undefined}
              onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
            />
            {errors.name ? <p className="text-destructive text-sm">{errors.name}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rubric-slug">Адрес (slug)</Label>
            <SlugField
              id="rubric-slug"
              value={values.slug}
              onChange={(slug) => setValues((prev) => ({ ...prev, slug }))}
              source={values.name}
              entity="rubric"
              ignoreId={values.id}
              savedSlug={values.savedSlug}
              redirectNotice
              pathPrefix="/blog/"
              invalid={Boolean(errors.slug)}
            />
            {errors.slug ? <p className="text-destructive text-sm">{errors.slug}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rubric-description">Описание</Label>
            <Textarea
              id="rubric-description"
              value={values.description}
              rows={3}
              maxLength={RUBRIC_DESCRIPTION_MAX}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, description: event.target.value }))
              }
            />
            <p className="text-muted-foreground text-xs tabular-nums">
              {values.description.length}/{RUBRIC_DESCRIPTION_MAX}
            </p>
            {errors.description ? (
              <p className="text-destructive text-sm">{errors.description}</p>
            ) : null}
          </div>
          <ImageUploadField
            value={values.imageMediaId}
            initialAsset={values.image}
            onChange={(imageMediaId, image) =>
              setValues((prev) => ({ ...prev, imageMediaId, image }))
            }
            folder="rubrics"
            label="Изображение рубрики"
            aspect={16 / 9}
          />
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

/** Рубрики блога: порядок перетаскиванием, создание/правка в диалоге, удаление пустых. */
export function RubricManager({ rubrics }: { rubrics: RubricRow[] }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  // Счётчик пересоздаёт диалог при каждом открытии — состояние формы не «прилипает»
  const [dialogKey, setDialogKey] = useState(0);

  function open(next: Editing) {
    setDialogKey((k) => k + 1);
    setEditing(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => open(EMPTY)}>
          <Plus className="h-4 w-4" aria-hidden />
          Новая рубрика
        </Button>
      </div>

      {rubrics.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            Рубрик пока нет. Создайте первую — например «Правила» или «Тренировки».
          </CardContent>
        </Card>
      ) : (
        <SortableList
          items={rubrics}
          onReorder={(ids) => reorderRubrics({ ids })}
          renderItem={(rubric, ctx) => (
            <Card className="py-0">
              <CardContent className="flex items-center gap-3 p-3">
                {ctx.dragHandle}
                <div className="bg-muted relative hidden h-12 w-20 shrink-0 overflow-hidden rounded-md sm:block">
                  {rubric.image ? (
                    <Picture
                      asset={rubric.image}
                      sizes="80px"
                      alt=""
                      className="h-full w-full object-cover"
                      pictureClassName="block h-full w-full"
                    />
                  ) : (
                    <ImageIcon
                      className="text-muted-foreground absolute inset-0 m-auto h-4 w-4"
                      aria-hidden
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{rubric.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    <span className="font-mono">/blog/{rubric.slug}</span> · {rubric.articlesCount}{" "}
                    {articlesWord(rubric.articlesCount)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Выше"
                    disabled={!ctx.canMoveUp}
                    onClick={ctx.moveUp}
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Ниже"
                    disabled={!ctx.canMoveDown}
                    onClick={ctx.moveDown}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Изменить «${rubric.name}»`}
                    onClick={() =>
                      open({
                        id: rubric.id,
                        name: rubric.name,
                        slug: rubric.slug,
                        savedSlug: rubric.slug,
                        description: rubric.description ?? "",
                        imageMediaId: rubric.imageMediaId,
                        image: rubric.image,
                      })
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
                        aria-label={`Удалить «${rubric.name}»`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    }
                    title={`Удалить рубрику «${rubric.name}»?`}
                    description={
                      rubric.articlesCount > 0
                        ? `В рубрике ${rubric.articlesCount} ${articlesWord(rubric.articlesCount)} — сначала перенесите их в другую рубрику.`
                        : "Адрес рубрики начнёт отдавать 404."
                    }
                    onConfirm={async () => {
                      const res = await deleteRubric({ id: rubric.id });
                      if (res.ok) toast.success("Рубрика удалена");
                      return res;
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        />
      )}

      {editing ? (
        <RubricDialog key={dialogKey} editing={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}
