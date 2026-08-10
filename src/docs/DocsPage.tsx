import { Table, Typography } from "@mantine/core";
import type { ComponentPropsWithoutRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "../examples/CodeBlock";
import classes from "./DocsPage.module.css";

/** ```tsx → "tsx". Anything unrecognised falls back to plain text. */
function languageFromClassName(className: string | undefined): string {
  const match = /language-(\w+)/.exec(className ?? "");
  return match ? match[1] : "text";
}

/**
 * Renders a documentation page. Mantine's `Typography` styles the raw HTML that
 * react-markdown emits, so the markdown stays plain — no MDX, no component
 * imports in the content.
 */
export function DocsPage({ source }: { source: string }) {
  return (
    <div className={classes.scroller}>
      <article className={classes.article}>
        <Typography>
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Mantine's Table gets the borders and spacing right, and gives
              // wide prop tables their own horizontal scroll.
              table: (props: ComponentPropsWithoutRef<"table">) => (
                <Table.ScrollContainer minWidth={520} type="native">
                  <Table striped withTableBorder withColumnBorders {...props} />
                </Table.ScrollContainer>
              ),
              // Fenced blocks go through the same highlighter the examples
              // use, so docs and demos show code identically — and every
              // snippet in the docs gets a copy button.
              code: ({
                className,
                children,
                ...props
              }: ComponentPropsWithoutRef<"code">) => {
                // Inline code has no language class; only fences do.
                if (!className?.startsWith("language-")) {
                  return <code {...props}>{children}</code>;
                }
                return (
                  <CodeBlock
                    code={String(children)}
                    language={languageFromClassName(className)}
                  />
                );
              },
              // react-markdown wraps a fence in <pre><code>; the block brings
              // its own, so this one would nest a scroller inside a scroller.
              pre: ({ children }: ComponentPropsWithoutRef<"pre">) => (
                <>{children}</>
              ),
              // Root-relative links in the markdown must respect the deploy
              // base path (the site lives under /TMDataGrid/ on GitHub Pages).
              a: ({ href, ...props }: ComponentPropsWithoutRef<"a">) => (
                <a
                  href={
                    href?.startsWith("/")
                      ? import.meta.env.BASE_URL + href.slice(1)
                      : href
                  }
                  {...props}
                />
              ),
            }}
          >
            {source}
          </Markdown>
        </Typography>
      </article>
    </div>
  );
}
