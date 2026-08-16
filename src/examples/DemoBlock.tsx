import { Box, Button, Collapse, Group, Paper, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { CodeBlockTabs, type CodeBlockFile } from "./CodeBlock";
import { loadDemo, loadSharedSource } from "./demoRegistry";

/**
 * The frame around one demo: what it is, the thing itself, and the source that
 * produced it.
 *
 * Deliberately dumb. Controls a demo needs — a mode switch, a toggle — live
 * inside the demo component, so they appear in the source the reader copies
 * rather than in a frame that quietly makes the demo work.
 */

/** Tall enough for a header, a handful of rows and a footer. */
export const DEFAULT_DEMO_HEIGHT = 380;

export type DemoBlockDemo = {
  /** Path under `demos/`. Identifies both the component and its source. */
  file: string;
  /**
   * Only on an example-tree page. Inside a docs page the heading above the
   * demo names it and the paragraph before it is the description, so both are
   * left off rather than said twice.
   */
  title?: string;
  description?: string;
  /**
   * What to *do* — "Shift+click a second header", "try Stckholm". Lives beside
   * the demo rather than in it, so the source stays code you would paste.
   */
  hint?: string;
  /**
   * Further files to show as tabs beside the demo — the shared modules it
   * imports, so nothing it depends on is hidden. Paths under `src/examples/`.
   */
  extraSources?: Array<string>;
  /** Height of the live area. Defaults to {@link DEFAULT_DEMO_HEIGHT}. */
  height?: number;
};

const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

const languageOf = (path: string) => (path.endsWith(".tsx") ? "tsx" : "ts");

export function DemoBlock({ demo }: { demo: DemoBlockDemo }) {
  const [showCode, setShowCode] = useState(false);
  const { Component, source } = loadDemo(demo.file);
  const titled = demo.title !== undefined || demo.description !== undefined;

  const files: Array<CodeBlockFile> = [
    {
      fileName: fileName(demo.file),
      language: "tsx",
      code: source,
    },
    ...(demo.extraSources ?? []).map((path) => ({
      fileName: fileName(path),
      language: languageOf(path),
      code: loadSharedSource(path),
    })),
  ];

  return (
    <Stack gap="xs">
      {/* On a docs page there is no title to sit opposite, so the button
          keeps the right edge on its own. */}
      <Group justify={titled ? "space-between" : "flex-end"} align="flex-end" wrap="nowrap" gap="md">
        {titled && (
          <Stack gap={2}>
            <Text fw={600}>{demo.title}</Text>
            <Text size="sm" c="dimmed">
              {demo.description}
            </Text>
          </Stack>
        )}
        <Button
          size="compact-sm"
          variant={showCode ? "light" : "subtle"}
          onClick={() => setShowCode((open) => !open)}
          aria-expanded={showCode}
        >
          {showCode ? "Hide code" : "Code"}
        </Button>
      </Group>

      {demo.hint && (
        <Text size="sm" c="dimmed" fs="italic">
          {demo.hint}
        </Text>
      )}

      {/* Fixed height so the page does not resize itself as demos mount, and
          so every grid on the site is judged at the same size. */}
      <Paper
        withBorder
        radius="sm"
        p="sm"
        h={demo.height ?? DEFAULT_DEMO_HEIGHT}
        style={{ display: "flex", flexDirection: "column", minHeight: 0 }}
      >
        <Component />
      </Paper>

      <Collapse expanded={showCode}>
        {/* Mounted only once opened: highlighting a file nobody asked to see
            is the one cost worth not paying on every page. */}
        {showCode && (
          <Box pt={4}>
            <CodeBlockTabs files={files} />
          </Box>
        )}
      </Collapse>
    </Stack>
  );
}
