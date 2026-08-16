import columnLayoutDoc from "./column-layout.md?raw";
import columnsDoc from "./columns.md?raw";
import componentsDoc from "./components.md?raw";
import editingDoc from "./editing.md?raw";
import featuresDoc from "./features.md?raw";
import filteringDoc from "./filtering.md?raw";
import gettingStartedDoc from "./getting-started.md?raw";
import groupingDoc from "./grouping.md?raw";
import rowDetailsDoc from "./row-details.md?raw";
import rowInteractionDoc from "./row-interaction.md?raw";
import rowPinningDoc from "./row-pinning.md?raw";
import rowSelectionDoc from "./row-selection.md?raw";
import rowStylingDoc from "./row-styling.md?raw";
import serverSideDoc from "./server-side.md?raw";
import sortingDoc from "./sorting.md?raw";
import summaryRowDoc from "./summary-row.md?raw";
import testingDoc from "./testing.md?raw";
import useTMDataGridDoc from "./use-tm-data-grid.md?raw";

export type DocsPageEntry = {
  id: string;
  label: string;
  description: string;
  source: string;
};

/** Ordered as they appear in the sidebar. */
export const DOCS_PAGES: DocsPageEntry[] = [
  // Served at "/" as the front page, not under /docs — the router redirects
  // /docs/getting-started there. It stays in this list so example topics can
  // keep referencing it and the docs-link tests keep covering its source.
  {
    id: "getting-started",
    label: "Getting started",
    description: "Structure and defaults",
    source: gettingStartedDoc,
  },
  {
    id: "use-tm-data-grid",
    label: "useTMDataGrid",
    description: "Options, meta and persistence",
    source: useTMDataGridDoc,
  },
  {
    id: "components",
    label: "Components",
    description: "Props for every component",
    source: componentsDoc,
  },
  {
    id: "columns",
    label: "Defining columns",
    description: "Accessors, meta and column types",
    source: columnsDoc,
  },
  {
    id: "sorting",
    label: "Sorting",
    description: "Single and multi-column",
    source: sortingDoc,
  },
  {
    id: "filtering",
    label: "Filtering",
    description: "Operators, panel and controls",
    source: filteringDoc,
  },
  {
    id: "column-layout",
    label: "Visibility, pinning and size",
    description: "Arranging the columns",
    source: columnLayoutDoc,
  },
  {
    id: "features",
    label: "Features",
    description: "Enabling and disabling behaviour",
    source: featuresDoc,
  },
  // Pages that carry their own demos, split out of the old features page.
  // The examples tree no longer has a topic for any of them — the demo
  // stands beside the prose that explains it.
  {
    id: "row-selection",
    label: "Row selection",
    description: "Four modes, and reading the selection",
    source: rowSelectionDoc,
  },
  {
    id: "row-details",
    label: "Row details",
    description: "A panel under an expanded row",
    source: rowDetailsDoc,
  },
  {
    id: "grouping",
    label: "Grouping",
    description: "Trees, aggregation and the pager",
    source: groupingDoc,
  },
  {
    id: "summary-row",
    label: "Summary row",
    description: "Totals along the bottom edge",
    source: summaryRowDoc,
  },
  {
    id: "row-pinning",
    label: "Row pinning and numbering",
    description: "Sticky rows, and a gutter that counts",
    source: rowPinningDoc,
  },
  {
    id: "row-interaction",
    label: "Clicks and context menus",
    description: "Reacting to the body",
    source: rowInteractionDoc,
  },
  {
    id: "row-styling",
    label: "Row styling",
    description: "Colouring rows by their data",
    source: rowStylingDoc,
  },
  {
    id: "editing",
    label: "Editing",
    description: "Modes, editors and validation",
    source: editingDoc,
  },
  {
    id: "server-side",
    label: "Server-side",
    description: "Manual pagination and filtering",
    source: serverSideDoc,
  },
  {
    id: "testing",
    label: "Testing",
    description: "Part hooks, roles and Playwright",
    source: testingDoc,
  },
];

export function findDocsPage(id: string): DocsPageEntry | undefined {
  return DOCS_PAGES.find((page) => page.id === id);
}
