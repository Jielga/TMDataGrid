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

Rows are virtualized by default.

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

Define `columns` at module scope. A new array on every render rebuilds the
column model and resets the user's column widths and order.

Give the grid a bounded height: `style={{ flex: 1, minHeight: 0 }}` inside a
flex parent, or a fixed height. See [Layout](/docs/styling#layout).

## Adding a toolbar and footer

```tsx
<TMDataGrid {...grid}>
  <TMDataGrid.Toolbar>
    <TMDataGrid.SummaryCount />
    <TMDataGrid.Menu>
      <TMDataGrid.Menu.Columns />
    </TMDataGrid.Menu>
  </TMDataGrid.Toolbar>
  <TMDataGrid.Table />
  <TMDataGrid.Footer pageSizeOptions={[10, 25, 50]} />
</TMDataGrid>
```

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
