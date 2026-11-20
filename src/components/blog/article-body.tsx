import { RichText } from "@/components/blog/rich-text";
import { extractHeadings, slugifyHeading, uniqueHeadingId } from "@/lib/content/markdown";

/**
 * Тело статьи с якорями заголовков для оглавления. id строятся теми же
 * `slugifyHeading` + `uniqueHeadingId` в порядке документа, что и в
 * `extractHeadings`, поэтому ссылки TOC совпадают с заголовками.
 *
 * Синхронный и изоморфный — используется в клиентском предпросмотре админки.
 */

/** Видимый текст React-дерева заголовка. */
function nodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: React.ReactNode } }).props;
    return nodeText(props?.children);
  }
  return "";
}

type ArticleBodyProps = {
  body: string;
  /** false — без ссылок «Перейти к оглавлению» (оглавление не выводится) */
  withToc?: boolean;
  className?: string;
};

export function ArticleBody({ body, withToc = true, className }: ArticleBodyProps) {
  // Набор создаётся на каждый рендер — id совпадают с extractHeadings(body)
  const seen = new Set<string>();
  const headingId = (children: React.ReactNode): string =>
    uniqueHeadingId(slugifyHeading(nodeText(children).replace(/\s+/g, " ").trim()), seen);

  const firstHeadingId = withToc ? (extractHeadings(body)[0]?.id ?? null) : null;

  return (
    <RichText
      source={body}
      headingId={headingId}
      firstHeadingId={firstHeadingId}
      {...(className !== undefined ? { className } : {})}
    />
  );
}
