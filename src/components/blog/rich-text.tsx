import ReactMarkdown from "react-markdown";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import { DocumentEmbed } from "@/components/blog/document-embed";
import { markdownComponents, type HeadingIdFn } from "@/components/blog/markdown-components";
import { VideoEmbed } from "@/components/blog/video-embed";
import { remarkCallout } from "@/lib/content/remark-callout";
import { parseRichText } from "@/lib/content/shortcodes";
import { cn } from "@/lib/utils";

/** `remarkCallout` должен идти после `remark-directive` */
const REMARK_PLUGINS = [remarkGfm, remarkDirective, remarkCallout];

type RichTextProps = {
  /** Markdown с шорткодами `{{Видео: …}}` / `{{Документ: …}}` */
  source: string;
  /** Фабрика id заголовков (оглавление статьи); общая для всех прогонов */
  headingId?: HeadingIdFn;
  /** id первого заголовка — перед ним нет «Перейти к оглавлению» */
  firstHeadingId?: string | null;
  className?: string;
};

/**
 * Рендер Markdown-тела с шорткодами: чередование `<ReactMarkdown>` и
 * `<VideoEmbed>`/`<DocumentEmbed>` в колонке `gap-8`.
 * Синхронный и изоморфный (используется в клиентском предпросмотре админки).
 * Без `rehype-raw`: HTML из текста экранируется.
 */
export function RichText({ source, headingId, firstHeadingId, className }: RichTextProps) {
  const segments = parseRichText(source);
  if (segments.length === 0) return null;

  // Одна карта на всё тело: `seen` фабрики id общий для всех Markdown-прогонов
  const components = markdownComponents(headingId, firstHeadingId);

  return (
    <div className={cn("text-foreground flex min-w-0 flex-col gap-8", className)}>
      {segments.map((segment, i) => {
        // Сегменты детерминированно выводятся из source и не переставляются
        const key = `${segment.kind}-${i}`;
        if (segment.kind === "markdown") {
          return (
            <div key={key} className="min-w-0">
              <ReactMarkdown components={components} remarkPlugins={REMARK_PLUGINS}>
                {segment.text}
              </ReactMarkdown>
            </div>
          );
        }
        const { token } = segment;
        return token.type === "video" ? (
          <VideoEmbed key={key} url={token.url} />
        ) : (
          <DocumentEmbed key={key} url={token.url} label={token.label} />
        );
      })}
    </div>
  );
}
