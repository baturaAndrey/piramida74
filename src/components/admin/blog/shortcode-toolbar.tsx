"use client";

import { useState, type ComponentType, type FormEvent, type RefObject } from "react";
import {
  Bold,
  FileText,
  Heading2,
  Heading3,
  ImagePlus,
  Info,
  Italic,
  Lightbulb,
  Link as LinkIcon,
  List,
  Sparkles,
  TriangleAlert,
  Video,
} from "lucide-react";
import { MediaPicker } from "@/components/admin/media-picker";
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
import { Separator } from "@/components/ui/separator";
import type { MediaDto } from "@/lib/admin/media-dto";
import { isSafeContentUrl } from "@/lib/content/shortcodes";
import { resolveVideoSource } from "@/lib/content/video-url";
import { mediaUrl } from "@/lib/media/url";

/**
 * Панель вставок над Markdown-текстом статьи (порт из billiard-darom без товаров/коллекций).
 * Вставка идёт в позицию курсора `targetRef`; каретка восстанавливается после рендера.
 */

export type ShortcodeToolbarProps = {
  value: string;
  onChange: (next: string) => void;
  targetRef: RefObject<HTMLTextAreaElement | null>;
  disabled?: boolean | undefined;
};

type Splice = { next: string; selStart: number; selEnd: number };

/** Вставка `snippet` вместо выделения (или в конец, если textarea недоступна). */
export function spliceAtCursor(
  value: string,
  snippet: string,
  textarea: HTMLTextAreaElement | null
): Splice {
  if (!textarea) {
    const pad = value.length > 0 && !value.endsWith("\n") ? "\n" : "";
    const next = `${value}${pad}${snippet}`;
    return { next, selStart: next.length, selEnd: next.length };
  }
  const start = textarea.selectionStart ?? value.length;
  const end = textarea.selectionEnd ?? value.length;
  const next = value.slice(0, start) + snippet + value.slice(end);
  const caret = start + snippet.length;
  return { next, selStart: caret, selEnd: caret };
}

/** Обёртка выделения: `**текст**`; без выделения вставляется заглушка и выделяется. */
function wrapSelection(
  value: string,
  textarea: HTMLTextAreaElement | null,
  before: string,
  after: string,
  placeholder: string
): Splice {
  const start = textarea?.selectionStart ?? value.length;
  const end = textarea?.selectionEnd ?? value.length;
  const selected = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  const selStart = start + before.length;
  return { next, selStart, selEnd: selStart + selected.length };
}

/** Префикс для каждой строки выделения (заголовки, список); начинает с новой строки. */
function prefixLines(
  value: string,
  textarea: HTMLTextAreaElement | null,
  prefix: string,
  placeholder: string
): Splice {
  const start = textarea?.selectionStart ?? value.length;
  const end = textarea?.selectionEnd ?? value.length;
  // Расширяем до начала строки, чтобы префикс встал в её начало
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const selected = value.slice(lineStart, end) || placeholder;
  const replaced = selected
    .split("\n")
    .map((line) => `${prefix}${line.replace(/^(#{1,6}\s+|[-*]\s+)/, "")}`)
    .join("\n");
  const next = value.slice(0, lineStart) + replaced + value.slice(end);
  return { next, selStart: lineStart, selEnd: lineStart + replaced.length };
}

/** Блок с пустыми строками вокруг — шорткоды и врезки должны стоять отдельным абзацем. */
function asBlock(value: string, textarea: HTMLTextAreaElement | null, block: string): string {
  const start = textarea?.selectionStart ?? value.length;
  const end = textarea?.selectionEnd ?? value.length;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const lead =
    before.length === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const trail =
    after.length === 0 || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  return `${lead}${block}${trail}`;
}

const CALLOUTS = [
  { variant: "info", label: "Инфо", icon: Info },
  { variant: "success", label: "Совет", icon: Lightbulb },
  { variant: "warning", label: "Внимание", icon: TriangleAlert },
  { variant: "accent", label: "Акцент", icon: Sparkles },
] as const;

const VIDEO_ERROR = "Поддерживаются VK Видео и Rutube (vk.ru, vkvideo.ru, vk.com, rutube.ru)";
const DOCUMENT_ERROR = "Ссылка должна начинаться с https:// или /media/";

type OpenDialog = "video" | "document" | "link" | "media" | null;

/** Имя файла без расширения — запасной alt */
function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

/** Квадратные скобки в alt/подписи ломают Markdown-синтаксис картинки */
function cleanLabel(text: string): string {
  return text
    .replace(/[[\]{}|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ToolButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  text,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean | undefined;
  text?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size={text ? "sm" : "icon"}
      className={text ? "h-8" : "size-8"}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {text ? <span>{text}</span> : null}
    </Button>
  );
}

export function ShortcodeToolbar({ value, onChange, targetRef, disabled }: ShortcodeToolbarProps) {
  const [open, setOpen] = useState<OpenDialog>(null);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);

  function commit(result: Splice) {
    onChange(result.next);
    // Каретку/выделение восстанавливаем после того, как React применит новое значение
    requestAnimationFrame(() => {
      const el = targetRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(result.selStart, result.selEnd);
    });
  }

  function insertBlock(block: string) {
    const textarea = targetRef.current;
    commit(spliceAtCursor(value, asBlock(value, textarea, block), textarea));
  }

  function openDialog(kind: Exclude<OpenDialog, null>) {
    const el = targetRef.current;
    // Выделенный текст — подпись ссылки/документа по умолчанию
    const selected = el ? value.slice(el.selectionStart, el.selectionEnd) : "";
    setUrl("");
    setCaption(kind === "link" || kind === "document" ? selected : "");
    setError(null);
    setOpen(kind);
  }

  function closeDialog() {
    setOpen(null);
  }

  function submitDialog(event: FormEvent) {
    event.preventDefault();
    // Диалог в портале, но submit всплывает по React-дереву в форму статьи
    event.stopPropagation();
    const trimmed = url.trim();
    if (open === "video") {
      if (!resolveVideoSource(trimmed)) {
        setError(VIDEO_ERROR);
        return;
      }
      insertBlock(`{{Видео: ${trimmed}}}`);
    } else if (open === "document") {
      if (!isSafeContentUrl(trimmed)) {
        setError(DOCUMENT_ERROR);
        return;
      }
      const label = cleanLabel(caption);
      insertBlock(label ? `{{Документ: ${trimmed} | ${label}}}` : `{{Документ: ${trimmed}}}`);
    } else if (open === "link") {
      // Внутренний путь `/…` допустим, протокол-относительный `//host` — нет
      if (!isSafeContentUrl(trimmed) && !/^\/(?!\/)/.test(trimmed)) {
        setError("Ссылка должна начинаться с https:// или /");
        return;
      }
      const text = cleanLabel(caption) || trimmed;
      const textarea = targetRef.current;
      commit(spliceAtCursor(value, `[${text}](${trimmed})`, textarea));
    }
    closeDialog();
  }

  function insertImages(assets: MediaDto[]) {
    const snippets = assets
      .map((asset) => {
        const src = mediaUrl(asset, 1280, "webp");
        if (!src) return null;
        const alt = cleanLabel(asset.alt || baseName(asset.originalName));
        return `![${alt}](${src})`;
      })
      .filter((s): s is string => s !== null);
    if (snippets.length > 0) insertBlock(snippets.join("\n\n"));
  }

  const textarea = () => targetRef.current;

  return (
    <div className="bg-muted/40 flex flex-wrap items-center gap-1 rounded-md border p-1">
      <ToolButton
        label="Заголовок H2"
        icon={Heading2}
        disabled={disabled}
        onClick={() => commit(prefixLines(value, textarea(), "## ", "Заголовок"))}
      />
      <ToolButton
        label="Заголовок H3"
        icon={Heading3}
        disabled={disabled}
        onClick={() => commit(prefixLines(value, textarea(), "### ", "Подзаголовок"))}
      />
      <ToolButton
        label="Жирный"
        icon={Bold}
        disabled={disabled}
        onClick={() => commit(wrapSelection(value, textarea(), "**", "**", "жирный текст"))}
      />
      <ToolButton
        label="Курсив"
        icon={Italic}
        disabled={disabled}
        onClick={() => commit(wrapSelection(value, textarea(), "*", "*", "курсив"))}
      />
      <ToolButton
        label="Список"
        icon={List}
        disabled={disabled}
        onClick={() => commit(prefixLines(value, textarea(), "- ", "пункт списка"))}
      />
      <ToolButton
        label="Ссылка"
        icon={LinkIcon}
        disabled={disabled}
        onClick={() => openDialog("link")}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolButton
        label="Картинка из медиатеки"
        icon={ImagePlus}
        text="Картинка"
        disabled={disabled}
        onClick={() => setOpen("media")}
      />
      <ToolButton
        label="Видео VK или Rutube"
        icon={Video}
        text="Видео"
        disabled={disabled}
        onClick={() => openDialog("video")}
      />
      <ToolButton
        label="Документ по ссылке"
        icon={FileText}
        text="Документ"
        disabled={disabled}
        onClick={() => openDialog("document")}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      <span className="text-muted-foreground px-1 text-xs">Врезка:</span>
      {CALLOUTS.map(({ variant, label, icon }) => (
        <ToolButton
          key={variant}
          label={`Врезка «${label}»`}
          icon={icon}
          disabled={disabled}
          onClick={() => {
            const el = targetRef.current;
            const selected = el ? value.slice(el.selectionStart, el.selectionEnd).trim() : "";
            insertBlock(`:::${variant}\n${selected || "Текст врезки"}\n:::`);
          }}
        />
      ))}

      <MediaPicker
        open={open === "media"}
        onOpenChange={(next) => setOpen(next ? "media" : null)}
        onSelect={insertImages}
        multiple
        folder="blog"
      />

      <Dialog
        open={open === "video" || open === "document" || open === "link"}
        onOpenChange={(next) => {
          if (!next) closeDialog();
        }}
      >
        <DialogContent>
          <form onSubmit={submitDialog} className="space-y-4" noValidate>
            <DialogHeader>
              <DialogTitle>
                {open === "video"
                  ? "Вставить видео"
                  : open === "document"
                    ? "Вставить документ"
                    : "Вставить ссылку"}
              </DialogTitle>
              <DialogDescription>
                {open === "video"
                  ? "Ссылка на ролик VK Видео или Rutube."
                  : open === "document"
                    ? "Ссылка https:// на файл (PDF, таблица) или адрес /media/… из медиатеки."
                    : "Адрес страницы: https://… или путь на сайте, например /tournaments."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="shortcode-url">Ссылка</Label>
              <Input
                id="shortcode-url"
                value={url}
                inputMode="url"
                autoComplete="off"
                placeholder={open === "video" ? "https://vkvideo.ru/video-123_456" : "https://"}
                aria-invalid={error ? true : undefined}
                onChange={(event) => {
                  setUrl(event.target.value);
                  setError(null);
                }}
              />
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
            </div>
            {open === "document" || open === "link" ? (
              <div className="space-y-2">
                <Label htmlFor="shortcode-caption">
                  {open === "document" ? "Подпись" : "Текст ссылки"}
                </Label>
                <Input
                  id="shortcode-caption"
                  value={caption}
                  maxLength={200}
                  onChange={(event) => setCaption(event.target.value)}
                />
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Отмена
              </Button>
              <Button type="submit" disabled={!url.trim()}>
                Вставить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
