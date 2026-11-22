import type { ReactElement } from "react";
import { File, FileArchive, FileSpreadsheet, FileText } from "lucide-react";
import { isSafeContentUrl } from "@/lib/content/shortcodes";

/**
 * `{{Документ: url | подпись}}` — карточка загрузки файла. URL только `/media/…`
 * или `https://` (иначе ничего не рендерится). `.pdf` — «Открыть» в новой вкладке,
 * остальное — «Скачать». Изоморфный компонент.
 */

function cleanPath(url: string): string {
  return url.split(/[?#]/)[0] ?? url;
}

/** Расширение файла без точки в нижнем регистре, либо "" */
function fileExtension(url: string): string {
  const name = cleanPath(url).split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function fileName(url: string): string {
  const name = cleanPath(url).split("/").pop() ?? "";
  try {
    return decodeURIComponent(name) || url;
  } catch {
    return name || url;
  }
}

/** Возвращает элемент, а не компонент — иконка не создаётся как компонент в рендере */
function iconFor(ext: string): ReactElement {
  const className = "size-5";
  switch (ext) {
    case "pdf":
    case "doc":
    case "docx":
    case "txt":
    case "rtf":
      return <FileText className={className} aria-hidden="true" />;
    case "xls":
    case "xlsx":
    case "csv":
      return <FileSpreadsheet className={className} aria-hidden="true" />;
    case "zip":
    case "rar":
    case "7z":
      return <FileArchive className={className} aria-hidden="true" />;
    default:
      return <File className={className} aria-hidden="true" />;
  }
}

export function DocumentEmbed({ url, label }: { url: string; label?: string | undefined }) {
  if (!isSafeContentUrl(url)) return null;

  const href = url.trim();
  const ext = fileExtension(href);
  const name = label && label.length > 0 ? label : fileName(href);
  const isPdf = ext === "pdf";

  return (
    <figure className="my-6">
      <div className="bg-card text-card-foreground flex items-center gap-3 rounded-lg border p-4 shadow-sm">
        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-md">
          {iconFor(ext)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          {ext.length > 0 ? <p className="text-subtle text-xs">{ext.toUpperCase()}</p> : null}
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          {...(isPdf ? {} : { download: true })}
          className="bg-primary text-primary-foreground hover:bg-primary-dark inline-flex h-9 shrink-0 items-center justify-center rounded-md px-4 text-sm font-medium shadow-xs transition-colors"
        >
          {isPdf ? "Открыть" : "Скачать"}
        </a>
      </div>
    </figure>
  );
}
