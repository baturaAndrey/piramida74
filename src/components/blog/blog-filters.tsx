"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * Фильтры блога: кнопка «Фильтры» + боковая панель с чекбоксами «Рубрики» и «Теги».
 * Черновой выбор берётся из URL при открытии; «Показать статьи» пишет его в URL
 * (`/blog?rubric=a,b&tag=c`, `page` сбрасывается), «Сбросить» → `/blog`.
 * Активные фильтры — удаляемые «пилюли» под кнопкой.
 *
 * Читает `useSearchParams` → страница обязана обернуть компонент в `<Suspense>`.
 */

type FacetOption = { slug: string; name: string; count: number };

type BlogFiltersProps = {
  rubrics: FacetOption[];
  tags: FacetOption[];
};

/** `a,b , a` → `["a", "b"]` */
function parseFacet(value: string | null): string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ];
}

/** Ссылка на хаб с фильтрами; `page` всегда сбрасывается. */
function blogHref(rubricSlugs: string[], tagSlugs: string[]): string {
  const params = new URLSearchParams();
  if (rubricSlugs.length > 0) params.set("rubric", rubricSlugs.join(","));
  if (tagSlugs.length > 0) params.set("tag", tagSlugs.join(","));
  const qs = params.toString();
  return qs ? `/blog?${qs}` : "/blog";
}

function toggle(list: string[], slug: string): string[] {
  return list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
}

function FacetSection({
  title,
  idPrefix,
  options,
  selected,
  onToggle,
}: {
  title: string;
  idPrefix: string;
  options: FacetOption[];
  selected: string[];
  onToggle: (slug: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div
      role="group"
      aria-labelledby={`${idPrefix}-title`}
      className="border-b py-4 last:border-b-0"
    >
      <h3 id={`${idPrefix}-title`} className="mb-3 text-base font-semibold">
        {title}
      </h3>
      <div className="flex flex-col gap-3">
        {options.map((option) => {
          const id = `${idPrefix}-${option.slug}`;
          return (
            <div key={option.slug} className="flex items-center gap-3">
              <Checkbox
                id={id}
                checked={selected.includes(option.slug)}
                onCheckedChange={() => onToggle(option.slug)}
              />
              <Label htmlFor={id} className="flex-1 cursor-pointer font-normal">
                {option.name}
              </Label>
              <span className="text-subtle text-xs tabular-nums">{option.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BlogFilters({ rubrics, tags }: BlogFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedRubrics = parseFacet(searchParams.get("rubric"));
  const selectedTags = parseFacet(searchParams.get("tag"));
  const activeCount = selectedRubrics.length + selectedTags.length;

  const [open, setOpen] = useState(false);
  const [draftRubrics, setDraftRubrics] = useState<string[]>([]);
  const [draftTags, setDraftTags] = useState<string[]>([]);

  const handleOpenChange = (next: boolean) => {
    // Черновик пересобирается из URL при каждом открытии
    if (next) {
      setDraftRubrics(selectedRubrics);
      setDraftTags(selectedTags);
    }
    setOpen(next);
  };

  const navigate = (href: string) => router.replace(href, { scroll: false });

  const apply = () => {
    navigate(blogHref(draftRubrics, draftTags));
    setOpen(false);
  };

  const reset = () => {
    setDraftRubrics([]);
    setDraftTags([]);
    navigate("/blog");
    setOpen(false);
  };

  const pills = [
    ...selectedRubrics.map((slug) => ({
      facet: "rubric" as const,
      slug,
      name: rubrics.find((r) => r.slug === slug)?.name ?? slug,
    })),
    ...selectedTags.map((slug) => ({
      facet: "tag" as const,
      slug,
      name: tags.find((t) => t.slug === slug)?.name ?? slug,
    })),
  ];

  const removePill = (facet: "rubric" | "tag", slug: string) =>
    navigate(
      blogHref(
        facet === "rubric" ? selectedRubrics.filter((s) => s !== slug) : selectedRubrics,
        facet === "tag" ? selectedTags.filter((s) => s !== slug) : selectedTags
      )
    );

  if (rubrics.length === 0 && tags.length === 0 && pills.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <Button
          type="button"
          variant="outline"
          className="relative self-start"
          onClick={() => handleOpenChange(true)}
          aria-haspopup="dialog"
        >
          <SlidersHorizontal aria-hidden="true" />
          Фильтры
          {activeCount > 0 && (
            <span className="bg-primary text-primary-foreground ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums">
              {activeCount}
            </span>
          )}
        </Button>

        <SheetContent
          side="right"
          className="bg-card w-[420px] max-w-[92vw] gap-0 sm:max-w-[420px]"
        >
          <SheetHeader className="border-b">
            <SheetTitle className="text-xl">Фильтры</SheetTitle>
            <SheetDescription>Выберите рубрики и теги статей</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4">
            <FacetSection
              title="Рубрики"
              idPrefix="blog-rubric"
              options={rubrics}
              selected={draftRubrics}
              onToggle={(slug) => setDraftRubrics((cur) => toggle(cur, slug))}
            />
            <FacetSection
              title="Теги"
              idPrefix="blog-tag"
              options={tags}
              selected={draftTags}
              onToggle={(slug) => setDraftTags((cur) => toggle(cur, slug))}
            />
          </div>

          <SheetFooter className="flex-row border-t">
            <Button type="button" variant="ghost" onClick={reset}>
              Сбросить
            </Button>
            <Button type="button" className="hover:bg-primary-dark flex-1" onClick={apply}>
              Показать статьи
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {pills.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Активные фильтры">
          {pills.map((pill) => (
            <li key={`${pill.facet}:${pill.slug}`}>
              <span className="border-primary bg-accent text-accent-foreground inline-flex h-8 items-center gap-1 rounded-full border pr-1 pl-3 text-sm font-medium">
                {pill.name}
                <button
                  type="button"
                  onClick={() => removePill(pill.facet, pill.slug)}
                  aria-label={`Убрать фильтр «${pill.name}»`}
                  className="hover:bg-primary/10 inline-flex size-6 items-center justify-center rounded-full transition-colors"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
