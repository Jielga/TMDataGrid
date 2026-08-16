import { Box, Table, Typography } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useEffect, type ComponentPropsWithoutRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "../examples/CodeBlock";
import { DemoBlock } from "../examples/DemoBlock";
import { parseDemoFence } from "./demoFence";
import { DocsToc } from "./DocsToc";
import { headingSlug } from "./headings";
import classes from "./DocsPage.module.css";

/** ```tsx → "tsx". Anything unrecognised falls back to plain text. */
function languageFromClassName(className: string | undefined): string {
  const match = /language-(\w+)/.exec(className ?? "");
  return match ? match[1] : "text";
}

/**
 * Headings carry their slug as an id. Without this every `#anchor` on the
 * site is dead — react-markdown emits no ids of its own, which is how the
 * docs accumulated 18 links pointing at nothing.
 */
function heading(level: 2 | 3 | 4) {
  const Tag = `h${level}` as const;
  return ({ children, ...props }: ComponentPropsWithoutRef<"h2">) => (
    <Tag id={headingSlug(children)} {...props}>
      {children}
    </Tag>
  );
}

/**
 * The markdown renderer every prose page shares — the docs routes and the
 * getting-started front page. Mantine's `Typography` styles the raw HTML that
 * react-markdown emits, so the markdown stays plain — no MDX, no component
 * imports in the content.
 */
export function DocsMarkdown({ source }: { source: string }) {
  return (
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
            // ```demo is a live example standing where the prose that
            // explains it is, rather than on a page of its own.
            //
            // Typography margins reach its own elements, not a component, so
            // the demo sets its own — without it the Code button rides up
            // against the snippet above and reads as belonging to it.
            if (className === "language-demo") {
              return (
                <Box my="xl">
                  <DemoBlock demo={parseDemoFence(String(children))} />
                </Box>
              );
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
          h2: heading(2),
          h3: heading(3),
          h4: heading(4),
          // A root-relative link points somewhere else on this site, so it
          // goes through the router: client-side navigation, and the
          // deploy base path (the site lives under /TMDataGrid/ on GitHub
          // Pages) handled by the router rather than by hand. Anything
          // else — an external URL, an in-page anchor — is left alone.
          a: ({ href, children, ...props }: ComponentPropsWithoutRef<"a">) => {
            if (!href?.startsWith("/")) {
              return (
                <a href={href} {...props}>
                  {children}
                </a>
              );
            }
            // `/docs/grouping#aggregation` — the router wants the two halves
            // apart, and passing the whole string as `to` would look for a
            // route with a hash in its path.
            const [to, hash] = href.split("#");
            return (
              <Link to={to} hash={hash} {...props}>
                {children}
              </Link>
            );
          },
        }}
      >
        {source}
      </Markdown>
    </Typography>
  );
}

/**
 * Renders a documentation page: the markdown in the docs measure, with the
 * table of contents beside it where the viewport is wide enough.
 *
 * The rail is inside the scroller rather than outside it so that `position:
 * sticky` has this scroll container to stick within — and so an anchor jump
 * scrolls the article under a rail that stays put.
 */
export function DocsPage({ source }: { source: string }) {
  // A pasted `/docs/grouping#aggregation` asks the browser to scroll to an
  // element React has not rendered yet. Chromium usually retries once the
  // document settles; this makes it certain, and covers the router
  // navigating between pages without a document load at all.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, [source]);

  return (
    <div className={classes.scroller}>
      <div className={classes.layout}>
        <article className={classes.article}>
          <DocsMarkdown source={source} />
        </article>
        <DocsToc source={source} />
      </div>
    </div>
  );
}
