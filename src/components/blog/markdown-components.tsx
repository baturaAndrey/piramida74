import { BookOpen } from "lucide-react";
import { Callout } from "@/components/blog/callout";
import { TOC_ANCHOR } from "@/lib/content/markdown";
import { isSafeContentUrl } from "@/lib/content/shortcodes";
import type { Components } from "react-markdown";

/**
 * Общая карта компонентов `react-markdown` для тела статьи и био автора.
 *
 * БЕЗОПАСНОСТЬ: используется **без `rehype-raw`** — HTML из текста экранируется.
 * `urlTransform` react-markdown по умолчанию не отключается (он уже вырезает
 * `javascript:`/`data:`); дополнительно ссылки и картинки проверяются здесь.
 *
 * Изоморфный модуль: годится и для серверного рендера, и для клиентского предпросмотра.
 */

/** Фабрика уникальных id заголовков (общая для всех Markdown-прогонов тела). */
export type HeadingIdFn = (children: React.ReactNode) => string;

/** Разрешённые ссылки: относительные, якоря, https/http, mailto, tel. */
const SAFE_LINK = /^(?:https?:\/\/|mailto:|tel:|\/(?!\/)|#|\?)/i;

function BackToToc() {
  return (
    <a
      href={`#${TOC_ANCHOR}`}
      className="text-primary hover:text-primary-dark mb-2 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
    >
      <BookOpen className="h-4 w-4" aria-hidden="true" />
      Перейти к оглавлению
    </a>
  );
}

const H2_CLASS = "mt-10 mb-4 scroll-mt-28 text-2xl font-semibold md:text-3xl";

/**
 * Карта компонентов. `headingId` даёт заголовкам якоря (тело статьи); без него
 * заголовки без id. `firstHeadingId` скрывает «Перейти к оглавлению» перед первым
 * заголовком; `null`/`undefined` — ссылок нет вовсе (оглавление выключено).
 */
export function markdownComponents(
  headingId?: HeadingIdFn,
  firstHeadingId?: string | null
): Components {
  const idProps = (children: React.ReactNode): { id?: string } =>
    headingId !== undefined ? { id: headingId(children) } : {};

  return {
    // `remarkCallout` превращает директивы в `<div data-callout>`
    div: ({ children, ...props }) => {
      const variant = (props as Record<string, unknown>)["data-callout"];
      return variant !== undefined ? (
        <Callout variant={variant}>{children}</Callout>
      ) : (
        <div>{children}</div>
      );
    },
    // H1 страницы — заголовок статьи, поэтому `#` в теле понижается до H2
    // Без id: `extractHeadings` не включает H1, иначе нумерация id разошлась бы с оглавлением
    h1: ({ children }) => <h2 className={H2_CLASS}>{children}</h2>,
    h2: ({ children }) => {
      const { id } = idProps(children);
      const showBackLink =
        id !== undefined && typeof firstHeadingId === "string" && id !== firstHeadingId;
      return (
        <>
          {showBackLink && <BackToToc />}
          <h2 {...(id !== undefined ? { id } : {})} className={H2_CLASS}>
            {children}
          </h2>
        </>
      );
    },
    h3: ({ children }) => (
      <h3
        {...idProps(children)}
        className="mt-8 mb-3 scroll-mt-28 text-xl font-semibold md:text-2xl"
      >
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 {...idProps(children)} className="mt-6 mb-2 scroll-mt-28 text-lg font-semibold">
        {children}
      </h4>
    ),
    h5: ({ children }) => (
      <h5 {...idProps(children)} className="mt-6 mb-2 scroll-mt-28 text-base font-semibold">
        {children}
      </h5>
    ),
    h6: ({ children }) => (
      <h6
        {...idProps(children)}
        className="text-subtle mt-6 mb-2 scroll-mt-28 text-sm font-semibold"
      >
        {children}
      </h6>
    ),
    p: ({ children }) => <p className="text-body-lg mb-4">{children}</p>,
    ul: ({ children }) => (
      <ul className="text-body-lg mb-4 ml-6 list-disc space-y-1.5">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="text-body-lg mb-4 ml-6 list-decimal space-y-1.5">{children}</ol>
    ),
    li: ({ children }) => <li>{children}</li>,
    a: ({ children, href }) => {
      // Пустой href — результат фильтра react-markdown (`javascript:` и т. п.)
      if (typeof href !== "string" || !SAFE_LINK.test(href)) return <span>{children}</span>;
      const external = /^https?:\/\//i.test(href);
      return (
        <a
          href={href}
          className="text-primary hover:text-primary-dark underline underline-offset-2 transition-colors"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {children}
        </a>
      );
    },
    img: ({ src, alt }) =>
      typeof src === "string" && isSafeContentUrl(src) ? (
        // Не next/image: картинки из медиатеки уже нарезаны, внешние — без remotePatterns
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={typeof alt === "string" ? alt : ""}
          loading="lazy"
          decoding="async"
          className="mx-auto my-4 h-auto max-w-full rounded-lg border"
        />
      ) : null,
    blockquote: ({ children }) => (
      <blockquote className="border-primary text-subtle my-4 border-l-4 pl-4 italic">
        {children}
      </blockquote>
    ),
    code: ({ children }) => (
      <code className="bg-muted rounded-sm px-1.5 py-0.5 font-mono text-sm">{children}</code>
    ),
    pre: ({ children }) => (
      <pre className="bg-muted my-4 overflow-x-auto rounded-md border p-4 text-sm leading-5">
        {children}
      </pre>
    ),
    hr: () => <hr className="my-8" />,
    table: ({ children }) => (
      <div className="my-4 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-row-alt">{children}</thead>,
    th: ({ children }) => (
      <th className="border-b px-3 py-2 text-left font-semibold">{children}</th>
    ),
    td: ({ children }) => <td className="border-b px-3 py-2 align-top">{children}</td>,
  };
}
