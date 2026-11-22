"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2, Link2Off, Loader2, TriangleAlert, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { checkSlugAvailable } from "@/lib/actions/slug";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { SLUG_MAX, type SlugEntity } from "@/lib/validation/blog";

/**
 * Поле slug (порт из billiard-darom):
 *  • «цепочка замкнута» — slug следует за заголовком (`slugify(source)`);
 *  • ручной ввод размыкает цепочку; повторное замыкание сразу пересчитывает slug;
 *  • дебаунс-проверка уникальности через `checkSlugAvailable` (статьи и рубрики — общее
 *    пространство `/blog/<slug>`), устаревшие ответы отбрасываются по счётчику запросов.
 */

export type SlugFieldProps = {
  value: string;
  onChange: (slug: string) => void;
  /** Заголовок/имя, из которого строится slug, пока цепочка замкнута */
  source: string;
  entity: SlugEntity;
  /** id редактируемой записи — её собственный slug считается свободным */
  ignoreId?: string | undefined;
  /** Исходный slug сохранённой записи: при его смене показывается предупреждение о 301 */
  savedSlug?: string | undefined;
  /** Показывать ли предупреждение о 301 (статьи и рубрики) */
  redirectNotice?: boolean;
  /** Префикс адреса для подсказки, например `/blog/` */
  pathPrefix?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  onBlur?: () => void;
};

const CHECK_DEBOUNCE_MS = 350;

type Status =
  { kind: "idle" } | { kind: "checking" } | { kind: "free" } | { kind: "taken"; reason: string };

export function SlugField({
  value,
  onChange,
  source,
  entity,
  ignoreId,
  savedSlug,
  redirectNotice = false,
  pathPrefix,
  id,
  disabled = false,
  invalid = false,
  onBlur,
}: SlugFieldProps) {
  // Существующая запись — цепочка разомкнута, новая — следует за заголовком
  const [linked, setLinked] = useState(() => !savedSlug && value.trim().length === 0);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const seqRef = useRef(0);

  // Последние value/onChange — в ref, чтобы эффект синхронизации зависел только от source
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  useEffect(() => {
    onChangeRef.current = onChange;
    valueRef.current = value;
  });

  useEffect(() => {
    if (!linked) return;
    const next = slugify(source).slice(0, SLUG_MAX).replace(/-+$/, "");
    if (next !== valueRef.current) onChangeRef.current(next);
  }, [source, linked]);

  const trimmed = value.trim();
  const unchanged = Boolean(savedSlug) && trimmed === savedSlug;

  useEffect(() => {
    // Пустой или сохранённый slug не проверяем — статус выводится ниже без запроса
    if (!trimmed || unchanged) return;
    const seq = ++seqRef.current;
    const timer = window.setTimeout(() => {
      setStatus({ kind: "checking" });
      void checkSlugAvailable({ entity, slug: trimmed, ignoreId }).then((res) => {
        if (seq !== seqRef.current) return;
        if (!res.ok) {
          setStatus({ kind: "idle" });
          return;
        }
        setStatus(
          res.data.available
            ? { kind: "free" }
            : { kind: "taken", reason: res.data.reason ?? "Адрес занят" }
        );
      });
    }, CHECK_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [trimmed, unchanged, entity, ignoreId]);

  const shown: Status = !trimmed || unchanged ? { kind: "idle" } : status;

  function handleInput(raw: string) {
    if (linked) setLinked(false);
    // Живая транслитерация, но висящий дефис оставляем — пользователь продолжает слово
    const trailingHyphen = /-$/.test(raw) && !/-{2,}$/.test(raw);
    const cleaned = slugify(raw);
    const next = trailingHyphen && cleaned.length > 0 ? `${cleaned}-` : cleaned;
    onChange(next.slice(0, SLUG_MAX));
  }

  function toggleLink() {
    if (linked) {
      setLinked(false);
      return;
    }
    setLinked(true);
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(event) => handleInput(event.target.value)}
          onBlur={() => {
            // Висящий дефис на выходе из поля убираем
            if (/-$/.test(value)) onChange(value.replace(/-+$/, ""));
            onBlur?.();
          }}
          placeholder="adres-stranitsy"
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          maxLength={SLUG_MAX}
          className="pr-10 font-mono"
          aria-invalid={invalid || shown.kind === "taken" || undefined}
        />
        <button
          type="button"
          onClick={toggleLink}
          disabled={disabled}
          aria-pressed={linked}
          aria-label={
            linked
              ? "Slug следует за заголовком — нажмите, чтобы редактировать вручную"
              : "Slug редактируется вручную — нажмите, чтобы снова связать с заголовком"
          }
          title={linked ? "Связано с заголовком" : "Ручное редактирование"}
          className={cn(
            "text-muted-foreground absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md transition-colors outline-none",
            "hover:text-foreground focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "disabled:pointer-events-none disabled:opacity-50",
            linked && "text-primary"
          )}
        >
          {linked ? <Link2 className="h-4 w-4" /> : <Link2Off className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {pathPrefix && trimmed ? (
          <span className="text-muted-foreground font-mono">
            {pathPrefix}
            {trimmed}
          </span>
        ) : null}
        {shown.kind === "checking" ? (
          <span className="text-muted-foreground inline-flex items-center gap-1" role="status">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Проверяем…
          </span>
        ) : null}
        {shown.kind === "free" ? (
          <span className="text-success inline-flex items-center gap-1" role="status">
            <Check className="h-3 w-3" aria-hidden />
            Свободен
          </span>
        ) : null}
        {shown.kind === "taken" ? (
          <span className="text-destructive inline-flex items-center gap-1" role="status">
            <X className="h-3 w-3" aria-hidden />
            {shown.reason}
          </span>
        ) : null}
      </div>

      {redirectNotice && savedSlug && trimmed && !unchanged ? (
        <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          Смена slug создаст 301-редирект со старого адреса /blog/{savedSlug}
        </p>
      ) : null}
    </div>
  );
}
