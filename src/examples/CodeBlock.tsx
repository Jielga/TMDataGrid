import {
  CodeHighlight,
  CodeHighlightTabs,
  type CodeHighlightTabsCode,
} from "@mantine/code-highlight";
import { useComputedColorScheme } from "@mantine/core";

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

/**
 * Theme and surface together, because contrast is a property of the pair.
 *
 * The theme is named rather than left to Mantine's `light`/`dark` shorthand:
 * the shorthand selects Mantine's own bundled themes, which render comments at
 * #676867 on a #2e2e2e background — 2.4:1, where normal text wants 4.5:1. The
 * adapter only substitutes a bundled theme for the literal strings "light" and
 * "dark", so any other value reaches shiki as a theme name; both are
 * registered in `main.tsx`.
 *
 * The `-default` variants are GitHub's current themes. The older `github-dark`
 * puts comments at #6a737d, 3.9:1 even on its own background — and these demo
 * files are largely comments.
 *
 * `bg` rather than the `background` prop, which only sets `--ch-background`:
 * the tabs variant paints no surface of its own and lets the page show
 * through, which is how a token designed for #0d1117 ended up at 3.2:1 on the
 * page's #242424. On the surfaces set here the worst token measures 6.2:1 in
 * dark and 4.6:1 in light.
 *
 * `getInitialValueInEffect: false` resolves the scheme during the first render
 * rather than in an effect after it, so a block never paints its light palette
 * on a dark page before correcting itself.
 */
function useCodeTheme(): { codeColorScheme: string; bg: string } {
  const colorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: false,
  });

  return colorScheme === "dark"
    ? { codeColorScheme: "github-dark-default", bg: "#0d1117" }
    : { codeColorScheme: "github-light-default", bg: "#ffffff" };
}

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
  const theme = useCodeTheme();

  return (
    <CodeHighlight
      {...theme}
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
  const theme = useCodeTheme();

  return (
    <CodeHighlightTabs
      {...theme}
      code={files.map((file) => ({ ...file, code: file.code.trimEnd() }))}
      radius="sm"
      withBorder
      withExpandButton
      maxCollapsedHeight={MAX_COLLAPSED_HEIGHT}
    />
  );
}
