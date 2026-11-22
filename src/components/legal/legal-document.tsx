import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Container } from "@/components/site/container";
import { TZ } from "@/lib/dates";

type LegalDocumentProps = {
  title: string;
  version: string;
  publishedAt: Date | string;
  /** Markdown с уже подставленными реквизитами — выводится как есть */
  markdown: string;
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeZone: TZ });

const isExternal = (href?: string) => !!href && /^https?:\/\//.test(href);

const H1_LINE_RE = /^#[ \t]+(.+?)[ \t#]*$/gm;

/**
 * Тело документа содержит `# Заголовок`, который страница уже выводит как <h1>.
 * Убираем первую такую строку, если её текст совпадает с заголовком, чтобы он не дублировался.
 */
function stripTitleHeading(markdown: string, title: string): string {
  const wanted = title.trim().toLowerCase();
  for (const m of markdown.matchAll(H1_LINE_RE)) {
    if (m[1]?.trim().toLowerCase() === wanted) {
      return markdown.slice(0, m.index) + markdown.slice(m.index + m[0].length);
    }
  }
  return markdown;
}

/**
 * Разметка Markdown юр. документа. Без `rehype-raw`: HTML в тексте экранируется,
 * а не выполняется. `node` отбрасывается, чтобы не попасть в DOM-атрибуты.
 */
const markdownComponents: Components = {
  // Прочие `#`-заголовки в теле понижаются до h2: <h1> на странице — только заголовок документа.
  h1: ({ node: _node, ...props }) => (
    <h2
      className="text-foreground mt-8 mb-3 scroll-mt-24 text-xl font-semibold md:text-2xl"
      {...props}
    />
  ),
  h2: ({ node: _node, ...props }) => (
    <h2
      className="text-foreground mt-8 mb-3 scroll-mt-24 text-xl font-semibold md:text-2xl"
      {...props}
    />
  ),
  h3: ({ node: _node, ...props }) => (
    <h3 className="text-foreground mt-8 mb-3 scroll-mt-24 text-lg font-semibold" {...props} />
  ),
  p: ({ node: _node, ...props }) => <p className="mb-4 leading-7" {...props} />,
  ul: ({ node: _node, ...props }) => (
    <ul className="mb-4 list-disc space-y-1 pl-6 leading-7" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="mb-4 list-decimal space-y-1 pl-6 leading-7" {...props} />
  ),
  li: ({ node: _node, ...props }) => <li className="pl-1" {...props} />,
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="bg-muted text-muted-foreground mb-6 rounded-md border px-4 py-3 text-sm [&>p]:mb-0"
      {...props}
    />
  ),
  a: ({ node: _node, href, ...props }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-2"
      {...(isExternal(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...props}
    />
  ),
  strong: ({ node: _node, ...props }) => (
    <strong className="text-foreground font-semibold" {...props} />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="bg-card mb-4 overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: ({ node: _node, ...props }) => (
    <th className="text-foreground border-b px-3 py-2 text-left font-semibold" {...props} />
  ),
  td: ({ node: _node, ...props }) => <td className="border-b px-3 py-2 align-top" {...props} />,
};

/** Юридический документ: заголовок, версия/дата публикации и Markdown-тело. */
export function LegalDocument({ title, version, publishedAt, markdown }: LegalDocumentProps) {
  const date = new Date(publishedAt);
  return (
    <Container className="py-8">
      <article className="mx-auto max-w-3xl">
        <header className="mb-8 space-y-2">
          <h1 className="text-h1 text-foreground font-semibold">{title}</h1>
          <p className="text-muted-foreground text-sm">
            Версия {version} от{" "}
            <time dateTime={date.toISOString()}>{dateFormatter.format(date)}</time>
          </p>
        </header>
        <div className="text-foreground/90 text-base">
          <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {stripTitleHeading(markdown, title)}
          </Markdown>
        </div>
      </article>
    </Container>
  );
}

/** Скелетон страницы юр. документа на время загрузки. */
export function LegalDocumentSkeleton() {
  return (
    <Container className="py-8" aria-busy="true" aria-label="Загрузка документа">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="bg-muted h-10 w-3/4 animate-pulse rounded-md" />
        <div className="bg-muted h-4 w-48 animate-pulse rounded-md" />
        <div className="space-y-3 pt-6">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="bg-muted h-4 w-full animate-pulse rounded-md" />
          ))}
          <div className="bg-muted h-4 w-2/3 animate-pulse rounded-md" />
        </div>
      </div>
    </Container>
  );
}
