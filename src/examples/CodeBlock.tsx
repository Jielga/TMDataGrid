import {
  CodeHighlight,
  CodeHighlightTabs,
  type CodeHighlightTabsCode,
} from "@mantine/code-highlight";

/**
 * Every piece of code the site shows goes through here — demo sources, the
 * starter snippet, and the fenced blocks in the markdown docs — so they are
 * highlighted, copyable and themed the same way everywhere.
 *
 * The highlighter itself is registered once in `main.tsx`; this is only the
 * shape of the block.
 */

export type CodeBlockFile = CodeHighlightTabsCode;

/** Long enough to read the shape of a file, short enough not to own the page. */
const MAX_COLLAPSED_HEIGHT = 320;

export function CodeBlock({
  code,
  language = "tsx",
  collapsible = false,
}: {
  code: string;
  language?: string;
  /** Caps the height with an expand button. For the docs' short fences, off. */
  collapsible?: boolean;
}) {
  return (
    <CodeHighlight
      code={code.trimEnd()}
      language={language}
      radius="sm"
      withBorder
      withExpandButton={collapsible}
      defaultExpanded={!collapsible}
      maxCollapsedHeight={MAX_COLLAPSED_HEIGHT}
    />
  );
}

/**
 * The multi-file variant a demo uses when what it imports is worth reading
 * too — the shared data module, usually. The demo file is always first.
 */
export function CodeBlockTabs({ files }: { files: Array<CodeBlockFile> }) {
  return (
    <CodeHighlightTabs
      code={files.map((file) => ({ ...file, code: file.code.trimEnd() }))}
      radius="sm"
      withBorder
      withExpandButton
      maxCollapsedHeight={MAX_COLLAPSED_HEIGHT}
    />
  );
}
