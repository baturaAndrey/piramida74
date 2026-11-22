"use client";

import { useState } from "react";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTagInline } from "@/lib/actions/blog-taxonomy";
import { cn } from "@/lib/utils";
import { ARTICLE_TAGS_MAX, TAG_NAME_MAX } from "@/lib/validation/blog";

export type TagPickerOption = { id: string; name: string; slug: string };

export type TagPickerProps = {
  options: TagPickerOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

/** Сколько невыбранных тегов показывать без поиска */
const VISIBLE_LIMIT = 40;

/** Мультивыбор тегов бейджами-переключателями + создание нового тега «на лету». */
export function TagPicker({ options, value, onChange, disabled = false }: TagPickerProps) {
  // Созданные в этой форме теги добавляются к списку с сервера
  const [created, setCreated] = useState<TagPickerOption[]>([]);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [pending, setPending] = useState(false);

  const all = [...options, ...created.filter((c) => !options.some((o) => o.id === c.id))];
  const selected = new Set(value);
  const q = query.trim().toLocaleLowerCase("ru-RU");
  const matches = all.filter(
    (tag) => !q || tag.name.toLocaleLowerCase("ru-RU").includes(q) || tag.slug.includes(q)
  );
  // Выбранные всегда видны; остальные — по поиску и с ограничением
  const visible = [
    ...matches.filter((t) => selected.has(t.id)),
    ...matches.filter((t) => !selected.has(t.id)).slice(0, VISIBLE_LIMIT),
  ];
  const atLimit = value.length >= ARTICLE_TAGS_MAX;

  function toggle(id: string) {
    if (selected.has(id)) {
      onChange(value.filter((v) => v !== id));
      return;
    }
    if (atLimit) {
      toast.error(`Не больше ${ARTICLE_TAGS_MAX} тегов`);
      return;
    }
    onChange([...value, id]);
  }

  async function create() {
    const name = newName.trim();
    if (!name) return;
    setPending(true);
    const res = await createTagInline({ name });
    setPending(false);
    if (!res.ok) {
      toast.error(res.fieldErrors?.name?.[0] ?? res.error);
      return;
    }
    const tag = { id: res.data.id, name: res.data.name, slug: res.data.slug };
    setCreated((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]));
    if (!selected.has(tag.id) && !atLimit) onChange([...value, tag.id]);
    setNewName("");
    toast.success(
      res.data.created ? `Тег «${tag.name}» создан` : `Тег «${tag.name}» уже был — выбран`
    );
  }

  return (
    <div className="space-y-3">
      {all.length > 0 ? (
        <div className="relative max-w-xs">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
            placeholder="Найти тег"
            aria-label="Найти тег"
            className="pl-8"
            disabled={disabled}
          />
        </div>
      ) : null}

      {visible.length > 0 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Теги статьи">
          {visible.map((tag) => {
            const isOn = selected.has(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggle(tag.id)}
                disabled={disabled}
                aria-pressed={isOn}
                className="focus-visible:ring-ring/50 rounded-full focus-visible:ring-[3px] focus-visible:outline-none disabled:opacity-50"
              >
                <Badge
                  variant={isOn ? "default" : "outline"}
                  className={cn("cursor-pointer gap-1", !isOn && "hover:bg-accent")}
                >
                  {isOn ? <Check className="h-3 w-3" aria-hidden /> : null}
                  {tag.name}
                </Badge>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {all.length === 0 ? "Тегов пока нет — создайте первый." : "Ничего не найдено."}
        </p>
      )}

      <div className="flex max-w-md gap-2">
        <Input
          value={newName}
          maxLength={TAG_NAME_MAX}
          placeholder="Новый тег"
          aria-label="Новый тег"
          disabled={disabled || pending}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void create();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || pending || !newName.trim()}
          onClick={() => void create()}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          Добавить
        </Button>
      </div>
      <p className="text-muted-foreground text-xs tabular-nums">
        Выбрано: {value.length} из {ARTICLE_TAGS_MAX}
      </p>
    </div>
  );
}
