import anatomyDoc from "./anatomy.md?raw";
import cellSelectionDoc from "./cell-selection.md?raw";
import columnLayoutDoc from "./column-layout.md?raw";
import columnsDoc from "./columns.md?raw";
import editingDoc from "./editing.md?raw";
import editorsDoc from "./editors.md?raw";
import filteringDoc from "./filtering.md?raw";
import gettingStartedDoc from "./getting-started.md?raw";
import groupingDoc from "./grouping.md?raw";
import loadingAndEmptyDoc from "./loading-and-empty.md?raw";
import localizationDoc from "./localization.md?raw";
import paginationDoc from "./pagination.md?raw";
import persistenceDoc from "./persistence.md?raw";
import quickSearchDoc from "./quick-search.md?raw";
import rowDetailsDoc from "./row-details.md?raw";
import rowInteractionDoc from "./row-interaction.md?raw";
import rowPinningDoc from "./row-pinning.md?raw";
import rowSelectionDoc from "./row-selection.md?raw";
import rowStylingDoc from "./row-styling.md?raw";
import scrollingDoc from "./scrolling.md?raw";
import serverSideDoc from "./server-side.md?raw";
import sortingDoc from "./sorting.md?raw";
import stylingDoc from "./styling.md?raw";
import summaryRowDoc from "./summary-row.md?raw";
import testingDoc from "./testing.md?raw";
import toolbarDoc from "./toolbar.md?raw";
import useTMDataGridDoc from "./use-tm-data-grid.md?raw";

/**
 * One page per topic: the prose, the demos that show it, and the reference
 * table for everything that page owns. There is no second tree — a demo lives
 * inside the page that explains it, named by a ```demo fence.
 */

export const DOCS_SECTIONS = [
  "Start here",
  "Columns",
  "Rows",
  "Cells and editing",
  "Data",
  "Appearance",
  "Reference",
] as const;

export type DocsSection = (typeof DOCS_SECTIONS)[number];

export type DocsPageEntry = {
  id: string;
  section: DocsSection;
  label: string;
  description: string;
  source: string;
};

/** Ordered as they appear in the sidebar. */
export const DOCS_PAGES: DocsPageEntry[] = [
  // Served at "/" as the front page, not under /docs — the router redirects
  // /docs/getting-started there. It stays in this list so the search indexes
  // it and the nav can order it with the rest.
  {
    id: "getting-started",
    section: "Start here",
    label: "Getting started",
    description: "Install, and your first grid",
    source: gettingStartedDoc,
  },
  {
    id: "anatomy",
    section: "Start here",
    label: "Grid anatomy",
    description: "The hook, the parts, and what returns what",
    source: anatomyDoc,
  },

  {
    id: "columns",
    section: "Columns",
    label: "Defining columns",
    description: "Accessors, meta and column types",
    source: columnsDoc,
  },
  {
    id: "sorting",
    section: "Columns",
    label: "Sorting",
    description: "Single and multi-column",
    source: sortingDoc,
  },
  {
    id: "filtering",
    section: "Columns",
    label: "Filtering",
    description: "Operators, the panel and custom controls",
    source: filteringDoc,
  },
  {
    id: "column-layout",
    section: "Columns",
    label: "Visibility, pinning and size",
    description: "Arranging the columns",
    source: columnLayoutDoc,
  },

  {
    id: "row-selection",
    section: "Rows",
    label: "Row selection",
    description: "Four modes, and reading the selection",
    source: rowSelectionDoc,
  },
  {
    id: "row-details",
    section: "Rows",
    label: "Row details",
    description: "A panel under an expanded row",
    source: rowDetailsDoc,
  },
  {
    id: "grouping",
    section: "Rows",
    label: "Grouping",
    description: "Trees, aggregation and the pager",
    source: groupingDoc,
  },
  {
    id: "summary-row",
    section: "Rows",
    label: "Summary row",
    description: "Totals along the bottom edge",
    source: summaryRowDoc,
  },
  {
    id: "row-pinning",
    section: "Rows",
    label: "Pinning and numbering",
    description: "Sticky rows, and a gutter that counts",
    source: rowPinningDoc,
  },
  {
    id: "row-interaction",
    section: "Rows",
    label: "Clicks and context menus",
    description: "Reacting to the body",
    source: rowInteractionDoc,
  },
  {
    id: "row-styling",
    section: "Rows",
    label: "Row styling",
    description: "Colouring rows by their data",
    source: rowStylingDoc,
  },

  {
    id: "cell-selection",
    section: "Cells and editing",
    label: "Cell selection",
    description: "A cursor, ranges, copy and export",
    source: cellSelectionDoc,
  },
  {
    id: "editing",
    section: "Cells and editing",
    label: "Editing",
    description: "Four modes, and which cells edit",
    source: editingDoc,
  },
  {
    id: "editors",
    section: "Cells and editing",
    label: "Editors and validation",
    description: "The control a cell opens, and its rules",
    source: editorsDoc,
  },

  {
    id: "pagination",
    section: "Data",
    label: "Pagination",
    description: "Three modes, and your own pager",
    source: paginationDoc,
  },
  {
    id: "quick-search",
    section: "Data",
    label: "Quick search",
    description: "One box, fuzzy, with highlighting",
    source: quickSearchDoc,
  },
  {
    id: "persistence",
    section: "Data",
    label: "Persistence",
    description: "Layout and filters across reloads",
    source: persistenceDoc,
  },
  {
    id: "server-side",
    section: "Data",
    label: "Server-side data",
    description: "Manual paging, sorting and filtering",
    source: serverSideDoc,
  },
  {
    id: "loading-and-empty",
    section: "Data",
    label: "Loading and empty",
    description: "The four ways to have nothing to show",
    source: loadingAndEmptyDoc,
  },
  {
    id: "scrolling",
    section: "Data",
    label: "Scrolling",
    description: "Virtualization, overscan and edges",
    source: scrollingDoc,
  },

  {
    id: "styling",
    section: "Appearance",
    label: "Size and styling",
    description: "The scale, and every CSS variable",
    source: stylingDoc,
  },
  {
    id: "toolbar",
    section: "Appearance",
    label: "Toolbar",
    description: "Composition, and buttons of your own",
    source: toolbarDoc,
  },
  {
    id: "localization",
    section: "Appearance",
    label: "Localization",
    description: "Every string, in any language",
    source: localizationDoc,
  },

  {
    id: "use-tm-data-grid",
    section: "Reference",
    label: "useTMDataGrid",
    description: "The complete option list",
    source: useTMDataGridDoc,
  },
  {
    id: "testing",
    section: "Reference",
    label: "Testing",
    description: "Part hooks, roles and Playwright",
    source: testingDoc,
  },
];

export function findDocsPage(id: string): DocsPageEntry | undefined {
  return DOCS_PAGES.find((page) => page.id === id);
}

/** Where a page lives. Getting started is the front page, not a /docs route. */
export function docsPageHref(page: DocsPageEntry): string {
  return page.id === "getting-started" ? "/" : `/docs/${page.id}`;
}

function group(pages: Array<DocsPageEntry>) {
  return DOCS_SECTIONS.map((section) => ({
    section,
    pages: pages.filter((page) => page.section === section),
  })).filter((entry) => entry.pages.length > 0);
}

/**
 * The index page lists everything, Getting started included — it is a
 * directory of the documentation, and leaving out the page people want first
 * would be a strange directory.
 */
export function docsIndexSections() {
  return group(DOCS_PAGES);
}

/**
 * The sidebar's collapsible groups. "Start here" is left out because its pages
 * are pinned at the top of the nav as plain links: a group that opens onto one
 * entry is a click for nothing.
 */
export function docsNavSections() {
  return group(DOCS_PAGES.filter((page) => page.section !== "Start here"));
}

/** The pages pinned above the groups, in order. */
export const DOCS_NAV_TOP = DOCS_PAGES.filter(
  (page) => page.section === "Start here",
);
