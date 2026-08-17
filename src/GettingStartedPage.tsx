import { Button, Group, Stack, Text, Title } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { DocsMarkdown } from "./docs/DocsPage";
import classes from "./docs/DocsPage.module.css";
import gettingStartedDoc from "./docs/getting-started.md?raw";
import { ProjectStatus } from "./ProjectStatus";

/**
 * The hero owns the page's one h1, so the document's own title comes off
 * before rendering (`\r?` - the checkout is CRLF). The markdown keeps it
 * regardless - it is also read as a plain file, from the README and the
 * getting-started skill.
 */
const doc = gettingStartedDoc.replace(/^# .+\r?\n/, "");

/**
 * The front page: what the package is, how to install it, and where to go
 * next - the getting-started reference follows below, so "/" answers the
 * first five minutes without a single click.
 */
export function GettingStartedPage() {
  return (
    <div className={classes.scroller}>
      <article className={classes.article}>
        <Stack gap="md" mb="xl">
          <Title order={1} mb={0}>
            TMDataGrid
          </Title>
          <ProjectStatus />
          <Text c="dimmed" size="lg">
            A React data grid built on TanStack Table v9 and Mantine - always
            virtualized, with resizable, reorderable, sortable, filterable,
            hideable and pinnable columns.
          </Text>
          <Group gap="sm">
            <Button component={Link} to="/playground">
              Open the playground
            </Button>
            <Button component={Link} to="/docs" variant="default">
              Browse the docs
            </Button>
            <Button
              component="a"
              href="https://github.com/Jielga/TMDataGrid"
              variant="default"
            >
              GitHub
            </Button>
          </Group>
        </Stack>

        <DocsMarkdown source={doc} />
      </article>
    </div>
  );
}
