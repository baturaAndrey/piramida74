/**
 * `remarkCallout` — спутник `remark-directive`: контейнерные директивы
 * `:::info|success|warning|accent … :::` превращаются в `<div data-callout="…">`,
 * а `markdown-components.tsx` подменяет такой `div` на `<Callout>`. Прочие
 * директивы не трогаются.
 *
 * Дерево директив неглубокое (блочный уровень), поэтому обход ручной — без
 * зависимости от `unist-util-visit`. Изоморфный модуль (без React и `next/*`).
 */

const CALLOUT_NAMES = new Set(["info", "success", "warning", "accent"]);

/** Минимальная структурная модель mdast-узла, достаточная для плагина. */
interface DirectiveNode {
  type: string;
  name?: string;
  children?: DirectiveNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
}

interface RootLike {
  children?: DirectiveNode[];
}

function transformNode(node: DirectiveNode): void {
  if (
    node.type === "containerDirective" &&
    typeof node.name === "string" &&
    CALLOUT_NAMES.has(node.name)
  ) {
    const data = node.data ?? (node.data = {});
    data.hName = "div";
    data.hProperties = { ...(data.hProperties ?? {}), "data-callout": node.name };
  }

  if (node.children) {
    for (const child of node.children) transformNode(child);
  }
}

/** Использование: `remarkPlugins={[remarkDirective, remarkCallout]}` (после директив). */
export function remarkCallout() {
  return (tree: RootLike): void => {
    if (!tree.children) return;
    for (const child of tree.children) transformNode(child);
  };
}
