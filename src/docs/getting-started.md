# Getting started

> **Live examples:** [Basic grid](/examples/basic-grid) · [Defining columns](/docs/columns) · [Density and layout](/examples/density-and-layout)

TMDataGrid is a compound component built on TanStack Table v9. `useTMDataGrid`
creates the table, `TMDataGrid` provides it through context, and the parts
rendered inside read what they need from that context.

## Installation

```bash
npm install @jielga/tmdatagrid
```

Peer dependencies: `react` and `react-dom` (19.1 or later), `@mantine/core`,
`@tanstack/react-table` (v9), `@tanstack/react-store`, `@tanstack/store`,
`@tanstack/react-virtual` and `@tabler/icons-react`.

> **TanStack Table v9 is still in beta.** The grid is built against
> `^9.0.0-beta.21` and uses its feature-registry API, which beta releases may
> change without a major bump. Pin `@tanstack/react-table` and
> `@tanstack/table-core` to an exact version if you need reproducible installs.

The grid must be rendered inside a Mantine `MantineProvider`.

## Usage

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
    enablePagination: true,
  });

  return (
    <TMDataGrid {...grid} size="md" style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Toolbar>
        <TMDataGrid.SummaryCount />
        <TMDataGrid.Spacer />
        <TMDataGrid.FilterButton />
        <TMDataGrid.ColumnsButton />
      </TMDataGrid.Toolbar>

      <TMDataGrid.Table<Employee> />

      <TMDataGrid.Footer />
    </TMDataGrid>
  );
}
```

Define `columns` at module scope. A new array on every render rebuilds the
table's column model.

## Styles

The package ships one stylesheet, in two forms:

```tsx
import "@jielga/tmdatagrid/styles.css";
// or, inside a named cascade layer:
import "@jielga/tmdatagrid/styles.layer.css";
```

The layered form puts every rule in `@layer tmdatagrid`, so your own
stylesheet can state the cascade order instead of fighting specificity:

```css
@layer mantine, tmdatagrid, app;
```

Mantine ships the same pair (`@mantine/core/styles.layer.css`), so the two
compose. The layer name `tmdatagrid` is stable API.

## Default behaviour

| Behaviour | Notes |
| --- | --- |
| Virtualized rows | Always enabled. Only rows in view are mounted. |
| Resizable columns | Drag the divider on a header's trailing edge. |
| Reorderable columns | Drag a header sideways, or use the column menu. |
| Sorting | Click a header, or use the column menu. |
| Column menu | Appears on hover, or right-click the header: sort, filter, pin, move, hide, manage columns. |
| Filter panel | Column, operator and value rows. |
| Column manager | Search, toggle, show/hide all, reset. |
| Row selection | Checkbox column pinned to the left, or `selectionMode: "row"` (click to select), `"highlight"` / `"checkboxAndHighlight"` (click highlights one row for master–detail). |
| Pagination | Off by default: all rows render, virtualized. Opt in with `enablePagination: true`; `TMDataGrid.Footer` renders the pager. |
| Sizing | `size="xs"` to `size="xl"` scales rows, type and controls. |

Each of these is controlled by a capability check. Disabling a feature through
the standard table options also removes its interface. See
[Features](/docs/features).

## Layout

`TMDataGrid` renders a flex column with `overflow: hidden`. Give it a bounded
height, either `style={{ flex: 1, minHeight: 0 }}` inside a flex parent or a
fixed height, and the table area fills the remaining space.

Columns are fluid by default. Each track is `minmax(minSize, flex fr)`, so the
grid fills the available width. A column takes a fixed pixel width once it is
resized or pinned.
