# Columns

## Column helper

`createTMDataGridColumnHelper<TData>()` returns a TanStack column helper bound
to the grid feature set, which gives `meta` and `filterFn` their correct types.

```tsx
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

Define columns at module scope. A new array on every render rebuilds the
table's column model.

## meta

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string` | String header, or column id | Name used in menus and the column manager. Required when `header` is a component. |
| `type` | `"string" \| "number"` | `"string"` | Determines which filter operators are offered. |
| `flex` | `number` | `1` | Share of the remaining width. |
| `align` | `"left" \| "right" \| "center"` | `"left"` | Alignment applied to both header and cells. |
| `enableOrdering` | `boolean` | `true` | `false` keeps the column where it is. |

`enableOrdering` lives in `meta` because column ordering is the one feature
TanStack defines no column option for. See [Features](#features).

## Sizing

Columns are fluid. Each track is `minmax(minSize, flex fr)`.

| Column option | Effect |
| --- | --- |
| `minSize` | Minimum width, and the column's contribution to the grid minimum width. Defaults to `80`. |
| `meta.flex` | Share of the remaining width. |
| `minSize === maxSize` | Fixed width. The column is never fluid. |
| `size` | Applied once the column becomes fixed by resizing or pinning. |

A column switches to a fixed pixel width when it is resized or pinned. Pinning
requires it because sticky offsets are calculated from `getSize()`, which cannot
resolve an `fr` value. The grid stores the column's rendered width in
`columnSizing` at the moment it is pinned so its width does not change.

## Column-level feature options

Standard TanStack column options. Each one also removes the corresponding
interface.

| Option | Effect when `false` |
| --- | --- |
| `enableSorting` | No sort indicator and no sort menu items. |
| `enableColumnFilter` | No filter menu item. The column is excluded from the filter panel column list. |
| `enableHiding` | No hide menu item. The checkbox is disabled in the column manager. |
| `enablePinning` | No pin menu items. |
| `enableResizing` | The divider is displayed but cannot be dragged. |

`meta.enableOrdering: false` belongs to the same set and removes the column's
header dragging and move menu items.

A column inside a header group is never movable, whatever `meta.enableOrdering`
says: `columnOrder` sequences leaf columns, so moving one would leave the group
header spanning columns that no longer belong to it.

## Checkbox column

Unless `enableRowSelection` is `false` or `rowSelectionMode` is `"row"`, a column
with the id `SELECT_COLUMN_ID` is added as the first column and pinned to the
left. It is listed as "Checkbox selection" in the column manager and can be
hidden like any other column. It is a system lane: as wide as the box it holds
(36px at every size scale), with no column menu and no resize handle, and it
cannot be sorted, filtered, resized, re-pinned or moved.

Because it cannot be moved, it also anchors the left pinned region: no column
can be placed in front of it.

## Details column

Setting `renderDetails` adds a column with the id `DETAILS_COLUMN_ID`, pinned to
the left after the checkbox and tree columns. Its cells hold the chevron that
opens a row's panel, and its header expands and collapses every panel.

A system lane like the checkbox column, and laid out the same way. Unlike it,
this one cannot be hidden either: a panel with no way to open it is worse than a
lane taking 36px. See [Features](#features).

## Filtering

All columns share one filter function. The operator is stored in the filter
value rather than selected through `filterFn`:

```ts
type TMDataGridFilterValue = {
  operator: TMDataGridFilterOperator;
  value: string;
};
```

The filter model is therefore plain JSON, which allows it to be forwarded to a
server without transformation. See [Server-side](#server-side).

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

A filter with an empty value remains in state so the panel continues to display
its row while the user types. It matches all rows, does not activate the filter
indicator in the header and gets no pill in
[`TMDataGrid.FilterPills`](#components). Use `isFilterActive(value)` to test for
this.

To give a column its own matching logic, set `filterFn` on the column
definition. The grid only provides `"tmDataGrid"` as the default.
