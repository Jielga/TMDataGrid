import { Table, Typography } from "@mantine/core";
import type { ComponentPropsWithoutRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import classes from "./DocsPage.module.css";

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
            }}
          >
            {source}
          </Markdown>
        </Typography>
      </article>
    </div>
  );
}
