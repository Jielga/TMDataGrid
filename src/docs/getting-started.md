# Getting started

A React data grid built on TanStack Table v9 and Mantine. Always virtualized,
with resizable, reorderable, sortable, filterable, hideable and pinnable
columns.

`useTMDataGrid` creates the table, `TMDataGrid` provides it through context, and
the parts you render inside read what they need from that context.

## Installation

```bash
npm install @jielga/tmdatagrid
```

Peer dependencies: `react` and `react-dom` (19.1 or later), `@mantine/core`,
`@tanstack/react-table` (v9), `@tanstack/react-store`, `@tanstack/store`,
`@tanstack/react-virtual` and `@tabler/icons-react`. Editing adds
`@tanstack/react-form`.

The grid must be rendered inside a Mantine `MantineProvider`.

```tsx
import "@jielga/tmdatagrid/styles.css";
```

Import it once. A layered stylesheet is also published; see
[Styling](/docs/styling#the-stylesheet).

> **TanStack Table v9 is still in beta.** The grid is built against
> `^9.0.0-beta.21` and uses its feature-registry API, which beta releases may
> change without a major bump. Pin `@tanstack/react-table` and
> `@tanstack/table-core` to an exact version if you need reproducible installs.

## Your first grid

```demo
file: getting-started/Minimal.tsx
extraSources: data/employees.ts
```

Rows are virtualized by default. There is no option to switch it on.

```tsx
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
} from "@jielga/tmdatagrid";

type Employee = { id: number; firstName: string; age: number };

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("id", { header: "ID", meta: { type: "number" } }),
  columnHelper.accessor("firstName", { header: "First name" }),
  columnHelper.accessor("age", {
    header: "Age",
    meta: { type: "number", align: "right" },
  }),
]);

export function Employees({ data }: { data: Employee[] }) {
  const grid = useTMDataGrid({
    data,
    columns,
    getRowId: (row) => String(row.id),
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Table<Employee> />
    </TMDataGrid>
  );
}
```

Two things to get right from the start:

- **Define `columns` at module scope.** A new array on every render rebuilds the
  table's column model and discards the user's column widths and order.
- **Give the grid a bounded height.** `style={{ flex: 1, minHeight: 0 }}` inside
  a flex parent, or a fixed height. A virtualized grid has no content height to
  size itself from - see [Layout](/docs/styling#layout).

## Enabled by default

None of the behaviour below has to be switched on.

| Behaviour | Notes |
| --- | --- |
| [Virtualized rows](/docs/scrolling) | Always. Only rows in view are mounted, at any row count. |
| [Sorting](/docs/sorting) | Click a header; Shift+click to sort by a second. |
| [Filtering](/docs/filtering) | Per-column, with operators chosen by `meta.type`. |
| [Resizing](/docs/column-layout#sizing) | Drag a divider; double-click to fit the content. |
| [Reordering](/docs/column-layout#ordering) | Drag a header sideways, or use the column menu. |
| [Hiding and pinning](/docs/column-layout) | From the column menu, or the columns panel. |
| [Row selection](/docs/row-selection) | A checkbox column, and three other modes. |
| [Grouping](/docs/grouping) | **Group by** in any column menu. |
| The column menu | On hover, or right-click a header. Shows only the items that apply. |

Every control is bound to a capability check, so switching a feature off
through its TanStack option also removes the interface for it.

## Adding the chrome

The grid renders only the parts you put in it.

```demo
file: getting-started/ToolbarAndFooter.tsx
```

`Toolbar` and `Footer` are ordinary composition. See
[Grid anatomy](/docs/anatomy) for what each part is, and
[Toolbar](/docs/toolbar) for adding your own buttons among them.

## Where to go next

- **[Defining columns](/docs/columns)** - accessors, `meta.type`, and what each
  type configures.
- **[Grid anatomy](/docs/anatomy)** - the hook's return value, and every
  component you can render.
- **[Editing](/docs/editing)** - four modes, from single cells to a whole grid.
- **[Server-side data](/docs/server-side)** - when the server does the work.
- **[The playground](/playground)** - every feature at once, behind switches.

Press <kbd>Ctrl</kbd> <kbd>K</kbd> to search the documentation.
