# Getting started

TMDataGrid is a compound component built on TanStack Table v9. `useTMDataGrid`
creates the table, `TMDataGrid` provides it through context, and the parts
rendered inside read what they need from that context.

## Usage

```tsx
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
} from "./tmdatagrid";

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

## Default behaviour

| Behaviour | Notes |
| --- | --- |
| Virtualized rows | Always enabled. Only rows in view are mounted. |
| Resizable columns | Drag the divider on a header's trailing edge. |
| Sorting | Click a header, or use the column menu. |
| Column menu | Appears on hover: sort, filter, pin, hide, manage columns. |
| Filter panel | Column, operator and value rows. |
| Column manager | Search, toggle, show/hide all, reset. |
| Row selection | Checkbox column pinned to the left. |
| Pagination | Rendered by `TMDataGrid.Footer`. |
| Sizing | `size="xs"` to `size="xl"` scales rows, type and controls. |

Each of these is controlled by a TanStack capability check. Disabling a feature
through the standard table options also removes its interface. See
[Features](#features).

## Layout

`TMDataGrid` renders a flex column with `overflow: hidden`. Give it a bounded
height, either `style={{ flex: 1, minHeight: 0 }}` inside a flex parent or a
fixed height, and the table area fills the remaining space.

Columns are fluid by default. Each track is `minmax(minSize, flex fr)`, so the
grid fills the available width. A column takes a fixed pixel width once it is
resized or pinned.
