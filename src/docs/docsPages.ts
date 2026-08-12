import columnsDoc from "./columns.md?raw";
import componentsDoc from "./components.md?raw";
import editingDoc from "./editing.md?raw";
import featuresDoc from "./features.md?raw";
import gettingStartedDoc from "./getting-started.md?raw";
import serverSideDoc from "./server-side.md?raw";
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
    label: "Columns",
    description: "Definitions, sizing and filters",
    source: columnsDoc,
  },
  {
    id: "features",
    label: "Features",
    description: "Enabling and disabling behaviour",
    source: featuresDoc,
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
