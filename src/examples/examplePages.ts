/**
 * The example tree: categories, the topics under them, and the demos each
 * topic shows.
 *
 * **All the prose lives here.** A demo file carries code and nothing else — no
 * headings, no explanation — so the source panel shows what you would actually
 * paste. One line of description per demo is the budget; anything longer
 * belongs in the docs page the topic links to.
 */

export type ExampleDemo = {
  /** Path under `demos/`. Identifies both the component and its source. */
  file: string;
  title: string;
  /** One line. What this demo teaches that the others do not. */
  description: string;
  /**
   * What to *do* — "Shift+click a second header", "try Stckholm". Lives here
   * rather than in the demo so the source stays code you would actually paste.
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

/** Tall enough for a header, a handful of rows and a footer. */
export const DEFAULT_DEMO_HEIGHT = 380;

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
    id: "column-definitions",
    category: "Getting started",
    label: "Column definitions",
    description:
      "Accessors, cell renderers, the six column types, alignment and sizing.",
    docs: "columns",
    demos: [
      {
        file: "getting-started/ColumnDefinitions.tsx",
        title: "Defining columns",
        description:
          "Key and computed accessors, a custom cell, and one column per meta.type — open a filter on each to see what the type decided.",
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
  {
    id: "sorting",
    category: "Columns",
    label: "Sorting",
    description: "Single and multi-column sorting, and where the state lives.",
    docs: "features",
    demos: [
      {
        file: "columns/Sorting.tsx",
        title: "Sorting",
        description:
          "Click to sort, Shift+click to append — the badge is the priority. One column opts out entirely.",
        hint:
          "Click a header to sort, Shift+click a second to append — the badge beside the arrow is its priority.",
      },
    ],
  },
  {
    id: "filtering",
    category: "Columns",
    label: "Filtering",
    description:
      "The filter panel, the operators each type offers, and driving filters from your own UI.",
    docs: "columns",
    demos: [
      {
        file: "columns/Filtering.tsx",
        title: "Filtering",
        description:
          "Every column type offers its own operators; salary opens on between because it says so in meta.",
      },
      {
        file: "columns/FilterPills.tsx",
        title: "Filters outside the grid",
        description:
          "FilterPills takes the grid as a prop rather than from context, so active filters can live in a page header.",
      },
    ],
  },
  {
    id: "filter-controls",
    category: "Columns",
    label: "Filter controls",
    description:
      "Replacing the value input a filter opens with — built in, or your own.",
    docs: "columns",
    demos: [
      {
        file: "columns/BuiltInFilterControls.tsx",
        title: "Built-in controls",
        description:
          "A slider for a range, a calendar for dates, suggestions for free text, three states for a boolean.",
        hint:
          "Open the filter panel and compare each row's control with the plain input the other demos show.",
      },
      {
        file: "columns/CustomFilterControl.tsx",
        title: "A control of your own",
        description:
          "meta.filterControl takes a component: read the operator and value, write a new one back.",
        hint:
          "Open the filter panel: Status offers chips, every other column the built-in control.",
      },
    ],
  },
  {
    id: "column-layout",
    category: "Columns",
    label: "Visibility, pinning and ordering",
    description:
      "Hiding columns, pinning them to an edge, reordering them, and putting it all back.",
    docs: "features",
    demos: [
      {
        file: "columns/ColumnLayout.tsx",
        title: "Column layout",
        description:
          "Drag a header to reorder, pin from the menu, hide in the columns panel — and Reset layout clears the lot.",
        hint:
          "Drag a header to reorder · pin or hide from a column menu · drag a divider to resize, or double-click it to fit the content.",
      },
    ],
  },

  // ── Rows ─────────────────────────────────────────────────────────────────
  {
    id: "row-selection",
    category: "Rows",
    label: "Row selection",
    description: "The four selection modes, and reading what is selected.",
    docs: "features",
    demos: [
      {
        file: "rows/SelectionModes.tsx",
        title: "Selection modes",
        description:
          "Checkbox, row, both, or highlight-only — and what enableMultiRowSelection does to each.",
      },
      {
        file: "rows/SelectionState.tsx",
        title: "Acting on a selection",
        description:
          "Subscribe to the table store and the toolbar becomes a bulk-action bar.",
      },
    ],
  },
  {
    id: "row-details",
    category: "Rows",
    label: "Row details",
    description: "A panel under an expanded row, at whatever height it needs.",
    docs: "features",
    demos: [
      {
        file: "rows/DetailsPanel.tsx",
        title: "Details panel",
        description:
          "Setting renderDetails is what turns the lane on; every panel is measured, so they can differ in height.",
        hint:
          "Expand a few rows — the panels differ in height, and each one is measured.",
        height: 460,
      },
    ],
  },
  {
    id: "grouping",
    category: "Rows",
    label: "Grouping and summary",
    description:
      "Grouping rows, aggregating a column per group, and totalling the grid.",
    docs: "features",
    demos: [
      {
        file: "rows/Grouping.tsx",
        title: "Grouping and aggregation",
        description:
          "Group by from any column menu. Only the columns told how to aggregate fill in — the rest stay blank.",
        hint:
          "“Group by …” lives in every column menu. Group by Location as well and the tree nests.",
      },
      {
        file: "rows/SummaryRow.tsx",
        title: "Summary row",
        description:
          "A column footer summons the sticky bottom row; aggregateColumn totals every filtered row, all pages.",
      },
    ],
  },
  {
    id: "row-pinning",
    category: "Rows",
    label: "Pinning and numbering",
    description: "Sticky rows at the edges, and a gutter that counts.",
    docs: "features",
    demos: [
      {
        file: "rows/PinningAndNumbers.tsx",
        title: "Pinned rows and row numbers",
        description:
          "Pin a row to either edge and the body scrolls beneath it; the number lane follows the view, not the data.",
        hint:
          "Right-click a row to pin it to either edge, then scroll.",
      },
    ],
  },
  {
    id: "row-styling",
    category: "Rows",
    label: "Styling and interaction",
    description:
      "Colouring rows by their data, and reacting to clicks on rows and cells.",
    docs: "components",
    demos: [
      {
        file: "rows/RowStyling.tsx",
        title: "Row styling",
        description:
          "Set --row-bg rather than background, and hover, selection and pinned cells keep working on top of it.",
        hint:
          "Select and hover a coloured row — both still read through the row background.",
      },
      {
        file: "rows/ClickAndContextMenu.tsx",
        title: "Clicks and context menus",
        description:
          "Row, cell and double-click handlers compose with what the click already does; right-click fills a menu the grid opens.",
        hint:
          "Click, double-click and right-click anywhere in the body.",
      },
    ],
  },

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

/** The tree the sidebar and the index page both render. */
export function exampleTopicsByCategory(): Array<{
  category: ExampleCategory;
  topics: Array<ExampleTopic>;
}> {
  return EXAMPLE_CATEGORIES.map((category) => ({
    category,
    topics: EXAMPLE_TOPICS.filter((topic) => topic.category === category),
  }));
}
