---
name: columns
description: >
  Define TMDataGrid columns with createTMDataGridColumnHelper: column meta
  (label, type, flex, align, enableOrdering), fluid minmax sizing versus fixed
  width, minSize and maxSize, per-column
  enableSorting/enableColumnFilter/enableHiding/enablePinning/ enableResizing,
  the generated SELECT_COLUMN_ID checkbox column, and the shared filter function
  with its operator list and isFilterActive. Load when adding or changing
  columns, controlling widths, or wiring column filters.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '0.1.0'
sources:
  - 'Jielga/TMDataGrid:src/docs/columns.md'
  - 'Jielga/TMDataGrid:src/tmdatagrid/core/filterOperators.ts'
  - 'Jielga/TMDataGrid:src/tmdatagrid/core/columnUtils.ts'
---

# TMDataGrid — Columns

`createTMDataGridColumnHelper<TData>()` returns a TanStack column helper bound to
the grid feature set, which gives `meta` and `filterFn` their correct types.

```tsx
import { createTMDataGridColumnHelper } from "@jielga/tmdatagrid";

const columnHelper = createTMDataGridColumnHelper<Employee>();

const columns = columnHelper.columns([
  columnHelper.accessor("salary", {
    header: "Salary",
    minSize: 130,
    meta: { type: "number", align: "right" },
    cell: (info) => formatSek(info.getValue()),
  }),
  columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
    id: "fullName",
    header: "Full name",
    meta: { label: "Full name" },
  }),
]);
```

Define columns at module scope. A new array on every render rebuilds the table's
column model.

## meta

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string` | String header, or column id | Name used in menus and the column manager. Required when `header` is a component. |
| `type` | `"string" \| "number"` | `"string"` | Determines which filter operators are offered. |
| `flex` | `number` | `1` | Share of the remaining width. |
| `align` | `"left" \| "right" \| "center"` | `"left"` | Applied to both header and cells. |
| `enableOrdering` | `boolean` | `true` | `false` keeps the column where it is. |

`enableOrdering` lives in `meta` because column ordering is the one feature
TanStack defines no column option for. See the `features` skill.

## Sizing

Columns are fluid. Each track is `minmax(minSize, flex fr)`.

| Option | Effect |
| --- | --- |
| `minSize` | Minimum width, and the column's contribution to the grid minimum width. Defaults to `80`. |
| `meta.flex` | Share of the remaining width. |
| `minSize === maxSize` | Fixed width. The column is never fluid. |
| `size` | Applied once the column becomes fixed by resizing or pinning. |

A column switches to a fixed pixel width when resized or pinned. Pinning requires
it because sticky offsets are calculated from `getSize()`, which cannot resolve
an `fr` value. The grid stores the column's rendered width in `columnSizing` at
the moment it is pinned, so its width does not change.

```tsx
// Fixed 64px action column that never flexes.
columnHelper.display({
  id: "actions",
  minSize: 64,
  maxSize: 64,
  cell: (info) => <RowMenu id={info.row.original.id} />,
});
```

## Column-level feature options

Standard TanStack column options. Each also removes the corresponding interface.

| Option | Effect when `false` |
| --- | --- |
| `enableSorting` | No sort indicator and no sort menu items. |
| `enableColumnFilter` | No filter menu item. Excluded from the filter panel column list. |
| `enableHiding` | No hide menu item. Checkbox disabled in the column manager. |
| `enablePinning` | No pin menu items. |
| `enableResizing` | The divider is displayed but cannot be dragged. |

`meta.enableOrdering: false` belongs to the same set and removes the column's
header dragging and move menu items. A column inside a header group is never
movable whatever it says, because `columnOrder` sequences leaf columns.

A column whose menu has no remaining items renders no menu button.

## Checkbox column

Unless `enableRowSelection` is `false` or `rowSelectionMode` is `"row"`, a column
with the id `SELECT_COLUMN_ID` is added as the first column and pinned to the
left. It is listed as "Checkbox selection" in the column manager and can be
hidden like any other column. It has no column menu and cannot be sorted,
filtered, resized, re-pinned or moved.

Because it cannot be moved, it also anchors the left pinned region: no column
can be placed in front of it.

## Filtering

All columns share one filter function. The operator lives in the filter value
rather than being selected through `filterFn`:

```ts
type TMDataGridFilterValue = {
  operator: TMDataGridFilterOperator;
  value: string;
};
```

The filter model is therefore plain JSON and can be forwarded to a server without
transformation. See the `server-side` skill.

### Operators

| Operator | Label | Column type |
| --- | --- | --- |
| `contains` | contains | `string` |
| `equals` | equals | `string`, `number` |
| `notEquals` | does not equal | `string`, `number` |
| `startsWith` | starts with | `string` |
| `endsWith` | ends with | `string` |
| `greaterThan` | is greater than | `number` |
| `greaterThanOrEqual` | is greater than or equal to | `number` |
| `lessThan` | is less than | `number` |
| `lessThanOrEqual` | is less than or equal to | `number` |
| `isEmpty` | is empty | `string`, `number` |
| `isNotEmpty` | is not empty | `string`, `number` |

`meta.type` selects the list. String comparisons are case-insensitive.
`FILTER_OPERATOR_LABELS` maps operators to their labels.

To give a column its own matching logic, set `filterFn` on the column definition.
The grid only provides `"tmDataGrid"` as the default.

## Common mistakes

### Component header without meta.label

`getColumnLabel(column)` falls back to a *string* header, then the column id.
When `header` is a component there is no string to fall back to, so the column
manager and column menus show the raw id (`"fullName"`) instead of a name.

```tsx
// Wrong — menus show "fullName".
columnHelper.accessor("fullName", { header: () => <Icon /> });

// Right.
columnHelper.accessor("fullName", {
  header: () => <Icon />,
  meta: { label: "Full name" },
});
```

### Treating an empty filter as no filter

A filter with an empty value stays in state so the panel keeps showing its row
while the user types. It matches all rows and does not light up the header
indicator. Test with `isFilterActive(value)` rather than checking for presence:

```ts
import { isFilterActive } from "@jielga/tmdatagrid";

const active = columnFilters.filter((filter) => isFilterActive(filter.value));
```

### Numeric operators on a column without meta.type

`getColumnType(column)` defaults to `"string"`, so a numeric column that omits
`meta: { type: "number" }` offers only the string operators — `greaterThan` and
the other comparisons never appear in the panel, and comparisons run as text.

### Setting size to control width

`size` is only applied once the column becomes fixed by resizing or pinning.
On a fluid column it is ignored; the track is `minmax(minSize, flex fr)`. Use
`minSize` for a floor and `meta.flex` for the share, or `minSize === maxSize`
for a genuinely fixed column.
