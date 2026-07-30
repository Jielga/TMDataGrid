---
name: getting-started
description: >
  Set up TMDataGrid, a compound React data grid built on TanStack Table v9 and
  Mantine. Covers useTMDataGrid, the TMDataGrid root, context, the component
  catalog (Table, Footer, Toolbar, Spacer, SummaryCount, FilterButton,
  ColumnsButton, FilterPanel, FilterPills, ColumnsPanel), the size scale and the
  bounded-height layout requirement. Load when adding a grid, choosing which
  parts to render, or when rows do not appear.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '0.2.0'
sources:
  - 'Jielga/TMDataGrid:src/docs/getting-started.md'
  - 'Jielga/TMDataGrid:src/docs/components.md'
  - 'Jielga/TMDataGrid:src/tmdatagrid/components/TMDataGrid.tsx'
  - 'Jielga/TMDataGrid:src/tmdatagrid/core/sizes.ts'
---

# TMDataGrid — Getting started

`useTMDataGrid` creates the table, `TMDataGrid` provides it through context, and
the parts rendered inside read what they need from that context. Only the parts
you render exist, and only the features you enable have state: pagination is
opt-in via `enablePagination` — by default every row renders, virtualized.

## Install

```sh
npm install @jielga/tmdatagrid
```

Peer dependencies: `react` and `react-dom` (19.1+), `@mantine/core`,
`@tanstack/react-table` (v9), `@tanstack/react-store`, `@tanstack/store`,
`@tanstack/react-virtual`, `@tabler/icons-react`.

Import both stylesheets once, Mantine's first, and render inside a
`MantineProvider`:

```ts
import "@mantine/core/styles.css";
import "@jielga/tmdatagrid/styles.css";
```

## Setup

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

Spread the hook result (`{...grid}`) rather than assigning `table`, `ui` and
`features` individually.

## Defaults

| Behaviour | Notes |
| --- | --- |
| Virtualized rows | Always enabled, not configurable. Only rows in view are mounted. |
| Resizable columns | Drag the divider on a header's trailing edge. |
| Reorderable columns | Drag a header sideways, or use the column menu. |
| Sorting | Click a header, or use the column menu. |
| Column menu | On hover: sort, filter, pin, move, hide, manage columns. |
| Filter panel | Column, operator and value rows. |
| Column manager | Search, toggle, show/hide all, reset. |
| Row selection | Checkbox column pinned to the left, or click-to-select rows with `rowSelectionMode: "row"`. |
| Pagination | Off by default: all rows render, virtualized. Opt in with `enablePagination: true`. |
| Sizing | `size="xs"` to `size="xl"` scales rows, type and controls. |

Each is bound to a capability check — disabling the standard table or column
option also removes its interface. Column ordering (`enableColumnOrdering`) and
pagination (`enablePagination`) are the two switches the grid defines itself.
See the `features` skill.

## Layout

`TMDataGrid` renders a flex column with `overflow: hidden`. It needs a bounded
height, either `style={{ flex: 1, minHeight: 0 }}` inside a flex parent or a
fixed height. The table area then fills the remaining space.

Columns are fluid by default: each track is `minmax(minSize, flex fr)`. A column
takes a fixed pixel width once resized or pinned.

## Components

All read the grid from context and must be rendered inside `TMDataGrid`, except
`TMDataGrid.FilterPills`, which takes the grid as an `api` prop and can live
anywhere on the page. Order and presence are up to you — the root is a plain
flex column.

| Component | Props | Notes |
| --- | --- | --- |
| `TMDataGrid` | `table`, `ui`, `features`, `size`, `className`, `style` | Root. Provides context. `style` also takes CSS variables: `--dg-row-selected-bg`, `--dg-row-height`, `--dg-header-height`, `--dg-font-size`, `--dg-padding`. |
| `TMDataGrid.Table` | `onRowClick(row)` | Header, virtualized body, filter panel. `onRowClick` runs in addition to selection under `rowSelectionMode: "row"`. |
| `TMDataGrid.Footer` | `pageSizeOptions` (default `[10, 25, 50, 100]`), `pagination` render prop | Pagination controls. Renders nothing unless pagination is enabled. |
| `TMDataGrid.Toolbar` | `children` | Flex row above the grid. |
| `TMDataGrid.Spacer` | — | Pushes later toolbar items right. |
| `TMDataGrid.SummaryCount` | `children` | Visible rows out of total. |
| `TMDataGrid.FilterButton` | — | Toggles filter panel. Renders nothing if no column is filterable. |
| `TMDataGrid.ColumnsButton` | — | Opens column manager. Renders nothing if no column is hideable. |
| `TMDataGrid.FilterPanel` | — | Rendered by `.Table`; exported for custom layouts. Header close button, Escape, click-away, "Add filter" and "Clear all". |
| `TMDataGrid.ColumnsPanel` | — | Rendered by `.ColumnsButton`; exported for custom layouts. |
| `TMDataGrid.FilterPills` | `api`, `size` (default `"sm"`), `showClearAll` (default `true`), `onPillClick(columnId)`, `className` | One pill per active filter, ✕ to clear it. Takes the api as a prop, so it can be rendered outside the grid. Also exported as `TMDataGridFilterPills`. |

Pass the row type so `onRowClick` stays typed:

```tsx
<TMDataGrid.Table<Employee> onRowClick={(row) => open(row.original.id)} />
```

`TMDataGrid.Footer` reads totals from `table.getRowCount()`, which prefers
`options.rowCount`. `TMDataGrid.SummaryCount` uses `meta.totalRowCount` when
provided, otherwise the pre-filtered row count.

The Footer's `pagination` render prop replaces the built-in pager with your own
UI, fed by the distilled pagination API:

```tsx
<TMDataGrid.Footer
  pagination={(api) => (
    <Pagination
      total={api.pageCount}
      value={api.pageIndex + 1}
      onChange={(page) => api.setPageIndex(page - 1)}
    />
  )}
/>
```

`TMDataGridPaginationApi` carries `pageIndex`, `pageSize`, `pageCount`,
`rowCount`, `canPreviousPage`, `canNextPage` and the actions `setPageIndex`,
`setPageSize`, `previousPage`, `nextPage`, `firstPage`, `lastPage`. Outside the
Footer, `getTMDataGridPaginationApi(grid.table)` returns the same object.

## size

Standard Mantine scale. Controls row height, header height, font size and cell
padding, and selects the size of the Mantine controls the grid renders.

| `size` | Row height | Header height | Font size | Cell padding |
| --- | --- | --- | --- | --- |
| `xs` | 34px | 32px | `xs` | 6px |
| `sm` | 42px | 38px | `sm` | 8px |
| `md` | 52px | 44px | `sm` | 10px |
| `lg` | 62px | 52px | `md` | 14px |
| `xl` | 72px | 60px | `lg` | 18px |

The virtualizer needs row height as a number, so it cannot come from CSS alone.
`SIZE_ROW_HEIGHT` is the exported source of these values and the stylesheet
mirrors them. Set `meta.rowHeight` for a height outside the scale.

## Helpers

| Export | Description |
| --- | --- |
| `useTMDataGridContext()` | The enclosing grid context. Throws outside `TMDataGrid`. |
| `openColumnFilter(api, columnId)` | Adds an empty filter for a column and opens the panel. |
| `getColumnLabel(column)` | `meta.label`, a string header, or the column id. |
| `getColumnType(column)` | `meta.type`, defaulting to `"string"`. |
| `formatFilterLabel({ label, type, filter })` | The one-line filter description used on the pills. |
| `moveColumn({ table, columnId, targetId, side })` | Moves a column next to another. See the `features` skill. |
| `moveColumnByStep({ table, columnId, direction })` | Moves a column one position within its region. |
| `SELECT_COLUMN_ID` | Id of the generated checkbox column. |

## Common mistakes

### Columns or data defined during render

A new array on every render rebuilds the table's column model. Define `columns`
at module scope; keep `data` stable with `useMemo`.

```tsx
// Wrong — rebuilds the column model every render.
export function Employees({ data }: { data: Employee[] }) {
  const columns = columnHelper.columns([...]);
  const grid = useTMDataGrid({ data, columns });
}
```

### Root with no bounded height

The root is `overflow: hidden`. Without `flex: 1; minHeight: 0` in a flex parent
or an explicit height, the table area collapses and no rows are visible — there
is no error.

### Assigning the hook result field by field

`<TMDataGrid table={grid.table}>` omits `ui` and `features`. Panels stop opening
and feature toggles stop being reactive. Spread instead: `<TMDataGrid {...grid}>`.

### Expecting Footer to enable pagination

Rendering `TMDataGrid.Footer` does not switch pagination on — the option does.
With pagination off (the default) the Footer renders nothing and every row is
rendered, virtualized. Set `enablePagination: true` (or `manualPagination:
true` for server paging) to page the data and show the pager.
