/**
 * The example tree: categories, the topics under them, and the demos each
 * topic shows.
 *
 * **All the prose lives here.** A demo file carries code and nothing else — no
 * headings, no explanation — so the source panel shows what you would actually
 * paste. One line of description per demo is the budget; anything longer
 * belongs in the docs page the topic links to.
 */

import type { DemoBlockDemo } from "./DemoBlock";

/** A demo on an example-tree page always carries its own title and blurb. */
export type ExampleDemo = DemoBlockDemo & {
  title: string;
  description: string;
};

export type ExampleTopic = {
  /** Route param — `/examples/{id}`. */
  id: string;
  category: ExampleCategory;
  label: string;
  description: string;
  /** The reference page this topic demonstrates. */
  docs?: string;
  demos: Array<ExampleDemo>;
};

export const EXAMPLE_CATEGORIES = [
  "Getting started",
  "Columns",
  "Rows",
  "Cells",
  "Data",
  "Editing",
  "Customization",
] as const;

export type ExampleCategory = (typeof EXAMPLE_CATEGORIES)[number];

/** Editing demos need room for an open editor and its validation message. */
const EDITING_DEMO_HEIGHT = 440;

const EMPLOYEES = "data/employees.ts";
const EMPLOYEE_COLUMNS = "data/employeeColumns.tsx";
const ORDERS = "data/orders.ts";

export const EXAMPLE_TOPICS: Array<ExampleTopic> = [
  // ── Getting started ──────────────────────────────────────────────────────
  {
    id: "basic-grid",
    category: "Getting started",
    label: "Basic grid",
    description:
      "The smallest grid that works, and what each piece of chrome adds to it.",
    docs: "getting-started",
    demos: [
      {
        file: "getting-started/Minimal.tsx",
        title: "Minimal",
        description:
          "Data, columns and a table. Every row is virtualized without asking.",
        extraSources: [EMPLOYEES],
      },
      {
        file: "getting-started/ToolbarAndFooter.tsx",
        title: "Toolbar and footer",
        description:
          "Only the parts you render exist — add them one at a time and watch what each brings.",
      },
    ],
  },
  {
    id: "density-and-layout",
    category: "Getting started",
    label: "Density and layout",
    description:
      "The size scale, and how the grid fills the space you give it.",
    docs: "components",
    demos: [
      {
        file: "getting-started/DensityAndLayout.tsx",
        title: "Size and layout",
        description:
          "xs through xl drive row height and control size together; the grid fills a flex parent that remembers to set minHeight: 0.",
      },
    ],
  },

  // ── Columns ──────────────────────────────────────────────────────────────

  // ── Rows ─────────────────────────────────────────────────────────────────

  // ── Cells ────────────────────────────────────────────────────────────────
  {
    id: "cell-selection",
    category: "Cells",
    label: "Cell selection and export",
    description:
      "A cell cursor, block selection, and getting the values out.",
    docs: "features",
    demos: [
      {
        file: "cells/CellSelection.tsx",
        title: "Cell cursor and ranges",
        description:
          "Arrows move the cursor, drag or Shift+arrows select a block — and the whole grid is still one tab stop.",
        hint:
          "Tab into the grid, then arrows to move · Shift+arrows or drag to select a block. However many cells it holds, the whole grid is one tab stop.",
      },
      {
        file: "cells/CopyAndExport.tsx",
        title: "Copy and export",
        description:
          "Ctrl+C writes the selected block Excel-shaped; exportGridToCsv takes every filtered row instead.",
        hint:
          "Select a block and press Ctrl+C — it pastes into Excel as cells, not as one string.",
      },
    ],
  },

  // ── Data ─────────────────────────────────────────────────────────────────
  {
    id: "pagination",
    category: "Data",
    label: "Pagination",
    description: "The built-in pager, and replacing it with your own.",
    docs: "features",
    demos: [
      {
        file: "data/Pagination.tsx",
        title: "Pagination",
        description:
          "Opt in with enablePagination, then either take the footer as it comes or render your own pager over the same API.",
        extraSources: [EMPLOYEE_COLUMNS],
      },
    ],
  },
  {
    id: "quick-search",
    category: "Data",
    label: "Quick search",
    description: "One box over every column, and marking what it matched.",
    docs: "features",
    demos: [
      {
        file: "data/QuickSearch.tsx",
        title: "Search and highlighting",
        description:
          "Fuzzy forgives typos and orders by match quality; match highlighting marks the hits in place.",
        hint:
          "Try “Stckholm” — fuzzy finds it, contains does not.",
        extraSources: [EMPLOYEE_COLUMNS],
      },
    ],
  },
  {
    id: "persistence",
    category: "Data",
    label: "Persistence",
    description:
      "Keeping layout and filters across reloads, one slice at a time.",
    docs: "use-tm-data-grid",
    demos: [
      {
        file: "data/Persistence.tsx",
        title: "Persisted state",
        description:
          "Two keys, two lifetimes: settings survive forever, and only the data slices you name come back.",
        hint:
          "Sort, filter and hide a column, then reload the page. It all comes back; the page index does not.",
        extraSources: [EMPLOYEE_COLUMNS],
      },
    ],
  },
  {
    id: "server-side",
    category: "Data",
    label: "Server-side data",
    description:
      "When the client holds one page and the server does the work.",
    docs: "server-side",
    demos: [
      {
        file: "data/ServerSide.tsx",
        title: "Manual pagination, sorting and filtering",
        description:
          "Hand each of the three to the server, tell the grid the true row count, and let it stop doing them itself.",
        hint:
          "Sorting, searching and paging are all round trips against a server with 500 ms of latency.",
        extraSources: [ORDERS],
      },
    ],
  },
  {
    id: "infinite-scroll",
    category: "Data",
    label: "Infinite scroll",
    description: "Pages fetched as the scroll approaches the end.",
    docs: "server-side",
    demos: [
      {
        file: "data/InfiniteScroll.tsx",
        title: "Infinite scroll",
        description:
          "onReachEnd fires rows early and latches per row count, so a pending fetch is never asked twice.",
        hint:
          "Scroll to the bottom and keep going — 100 rows arrive at a time and the scroll position holds.",
        extraSources: [ORDERS],
        height: 460,
      },
    ],
  },
  {
    id: "loading-empty",
    category: "Data",
    label: "Loading and empty states",
    description: "The four ways a grid can have nothing to show.",
    docs: "components",
    demos: [
      {
        file: "data/LoadingAndEmpty.tsx",
        title: "Loading and empty",
        description:
          "meta.loading owns the first load; renderEmptyState owns the rest, and hasActiveFilters says which emptiness it is.",
        hint:
          "Switch to loaded, then search for something that cannot match, to see the other branch.",
        extraSources: [EMPLOYEE_COLUMNS],
      },
    ],
  },

  // ── Editing ──────────────────────────────────────────────────────────────
  {
    id: "cell-editing",
    category: "Editing",
    label: "Cell editing",
    description:
      "Editing one cell at a time, and deciding which cells may be edited.",
    docs: "editing",
    demos: [
      {
        file: "editing/CellEditing.tsx",
        title: "cell and cellConfirm",
        description:
          "Double-click, Enter, F2 or just type. cell commits on blur; cellConfirm waits to be told.",
        hint:
          "Double-click a cell — or press Enter, F2, or just start typing on it.",
        height: EDITING_DEMO_HEIGHT,
      },
      {
        file: "editing/EditableGating.tsx",
        title: "Which cells edit",
        description:
          "meta.editable closes a column or tests the row; isRowEditable closes a whole row at once.",
        hint:
          "ID never edits · Salary refuses on Terminated rows · rows under 25 are closed entirely · Full name is computed but writes to Last name.",
        height: EDITING_DEMO_HEIGHT,
      },
    ],
  },
  {
    id: "row-batch-editing",
    category: "Editing",
    label: "Row and batch editing",
    description: "Committing a whole row, or a whole grid, in one go.",
    docs: "editing",
    demos: [
      {
        file: "editing/RowEditing.tsx",
        title: "Row editing",
        description:
          "The pencil opens every cell of the row and ✓ saves them as one commit — where a cross-field rule can finally live.",
        hint:
          "Put a Sales row over 60 000 kr and Save will tell you why it will not.",
        height: EDITING_DEMO_HEIGHT,
      },
      {
        file: "editing/BatchEditing.tsx",
        title: "Batch editing",
        description:
          "Nothing commits until Save: edits, added rows and deletions all arrive in a single call.",
        hint:
          "Edit cells, add rows in the sticky entry block, mark deletions with the trash — nothing leaves the grid until Save.",
        height: EDITING_DEMO_HEIGHT,
      },
    ],
  },
  {
    id: "editors-validation",
    category: "Editing",
    label: "Editors and validation",
    description:
      "The editor each type opens, writing your own, and rejecting bad input.",
    docs: "editing",
    demos: [
      {
        file: "editing/EditorsAndValidation.tsx",
        title: "Editors and validation",
        description:
          "One column per built-in editor, one custom editor over the live field API, and a Zod schema per column.",
        hint:
          "Type a single letter into String, or 5 into Number, to see validation refuse.",
        height: EDITING_DEMO_HEIGHT,
      },
    ],
  },

  // ── Customization ────────────────────────────────────────────────────────
  {
    id: "toolbar-localization",
    category: "Customization",
    label: "Toolbar and localization",
    description: "Filling the toolbar yourself, and changing every string.",
    docs: "components",
    demos: [
      {
        file: "customization/ToolbarComposition.tsx",
        title: "Toolbar composition",
        description:
          "The toolbar is plain composition — your actions sit beside the built-ins, and Spacer decides what goes right.",
        extraSources: [EMPLOYEE_COLUMNS],
      },
      {
        file: "customization/Localization.tsx",
        title: "Localization",
        description:
          "One option, one dictionary. The Swedish preset is complete; an override merges over the English base.",
        extraSources: [EMPLOYEE_COLUMNS],
      },
    ],
  },
  {
    id: "styling",
    category: "Customization",
    label: "Styling",
    description: "The CSS variables the grid reads, and where to set them.",
    docs: "components",
    demos: [
      {
        file: "customization/Styling.tsx",
        title: "CSS variables",
        description:
          "Selection tint, striping, row height and header background are variables — set them per grid, per row, or in your theme.",
        hint:
          "Every value the controls change is a CSS variable set on the grid element.",
        extraSources: [EMPLOYEE_COLUMNS],
      },
    ],
  },
];

export function findExampleTopic(id: string): ExampleTopic | undefined {
  return EXAMPLE_TOPICS.find((topic) => topic.id === id);
}

/**
 * The tree the sidebar and the index page both render.
 *
 * Empty categories are left out: as topics migrate to documentation pages a
 * category empties, and an expandable nav group that opens onto nothing is
 * worse than no group at all.
 */
export function exampleTopicsByCategory(): Array<{
  category: ExampleCategory;
  topics: Array<ExampleTopic>;
}> {
  return EXAMPLE_CATEGORIES.map((category) => ({
    category,
    topics: EXAMPLE_TOPICS.filter((topic) => topic.category === category),
  })).filter((group) => group.topics.length > 0);
}
