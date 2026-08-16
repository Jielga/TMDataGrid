import { isValidElement, type ReactNode } from "react";

/**
 * Heading slugs, shared by the renderer that stamps the `id` and the table of
 * contents that links to it. One function, so a link in the rail cannot drift
 * from the anchor it points at.
 */

/**
 * The text of a rendered node. Headings carry inline markdown — react-markdown
 * hands `## The engine — \`api.edit\`` over as `["The engine — ", <code/>]`, and
 * joining that array would slug the element as "[object Object]".
 */
function nodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(nodeText).join("");
  }
  if (isValidElement(node)) {
    return nodeText((node.props as { children?: ReactNode }).children);
  }
  return "";
}

/** "Grouping suspends pagination" → "grouping-suspends-pagination". */
export function headingSlug(children: ReactNode): string {
  return nodeText(children)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export type DocsHeading = {
  /** 2 or 3 — h1 is the page title, h4 is too fine to list. */
  level: 2 | 3;
  text: string;
  slug: string;
};

/** Inline markdown, as text: `code` → code, [label](href) → label. */
function plainText(heading: string): string {
  return heading.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[`*_]/g, "");
}

/**
 * The `##` and `###` headings of a markdown source, in order.
 *
 * Fenced blocks come out first: a `# comment` inside a ```bash fence sits at
 * the start of its line and is otherwise indistinguishable from a heading.
 */
export function extractHeadings(source: string): Array<DocsHeading> {
  const prose = source.replace(/^```[\s\S]*?^```/gm, "");

  return [...prose.matchAll(/^(#{2,3}) +(.+?)\s*$/gm)].map((match) => {
    const text = plainText(match[2]);
    return {
      level: match[1].length as 2 | 3,
      text,
      // Slugged from the same text the renderer ends up with, so the rail's
      // href and the heading's id agree.
      slug: headingSlug(text),
    };
  });
}
