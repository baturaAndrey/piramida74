import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Текст политики/согласия для `PolicyDialog`. Серверный компонент: Markdown рендерится на
 * сервере и передаётся в клиентский диалог готовой разметкой, поэтому react-markdown
 * (≈ 150 КБ) не попадает в клиентский бандл страниц с футером.
 */

/** Типографика юридического текста в стиле сайта */
const MARKDOWN_COMPONENTS: Components = {
  h1: ({ node: _node, ...props }) => (
    <h2 className="mt-6 mb-3 text-xl font-semibold first:mt-0" {...props} />
  ),
  h2: ({ node: _node, ...props }) => (
    <h3 className="mt-6 mb-3 text-lg font-semibold first:mt-0" {...props} />
  ),
  h3: ({ node: _node, ...props }) => (
    <h4 className="mt-4 mb-2 text-base font-semibold" {...props} />
  ),
  p: ({ node: _node, ...props }) => (
    <p className="mb-3 text-sm leading-relaxed md:text-base" {...props} />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 text-sm md:text-base" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm md:text-base" {...props} />
  ),
  li: ({ node: _node, ...props }) => <li className="leading-relaxed" {...props} />,
  a: ({ node: _node, ...props }) => (
    <a className="text-primary underline" target="_blank" rel="noopener noreferrer" {...props} />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: ({ node: _node, ...props }) => (
    <th className="border px-2 py-1 text-left font-semibold" {...props} />
  ),
  td: ({ node: _node, ...props }) => <td className="border px-2 py-1 align-top" {...props} />,
};

export function PolicyDocument({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
      {markdown}
    </ReactMarkdown>
  );
}
