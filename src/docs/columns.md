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
| `type` | `"string" \| "number" \| "boolean" \| "date" \| "select" \| "multiSelect"` | `"string"` | Determines which filter operators and value controls are offered — and, with editing on, which editor the cell opens. |
| `options` | `TMDataGridOptionsSource` | — | The choices of a `select` / `multiSelect` column. See [Column types](#columns). |
| `flex` | `number` | `1` | Share of the remaining width. |
| `align` | `"left" \| "right" \| "center"` | `"left"` | Alignment applied to both header and cells. |
| `enableOrdering` | `boolean` | `true` | `false` keeps the column where it is. |
| `defaultFilterOperator` | `TMDataGridFilterOperator` | The type's default | The operator a fresh filter on this column starts with — a salary column can open on `"between"`. Must be one of the type's own operators. |

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

## Column types

`meta.type` declares what a column's values are, and the chrome follows: the
filter panel offers the type's operators and renders a matching value control —
a date input for `date`, a Yes/No dropdown for `boolean` (labels from the
dictionary), a multi-select of the column's options for `select` and
`multiSelect`.

Dates may be `Date` instances or ISO `YYYY-MM-DD` strings in the data; the
comparison is by calendar day either way, and filter values always travel as
ISO strings. No `@mantine/dates` involved — the date control is the native
`<input type="date">`.

### Options

`select` and `multiSelect` columns declare their choices once, in
`meta.options`, and every consumer of them — the filter panel today, the cell
editor once editing is on — reads the same source:

```tsx
// A fixed set, strings or full options:
meta: {
  type: "select",
  options: [
    "Pending",
    { value: "Paid", label: "Paid in full", color: "green" },
  ],
}

// The distinct values present in the data (low-cardinality columns):
meta: { type: "select", options: "faceted" }

// Computed — `row` is set when a cell editor asks, absent for the filter
// panel, which is what row-dependent options key off:
meta: {
  type: "select",
  options: ({ row }) => citiesFor(row?.original.country),
}
```

`resolveColumnOptions({ table, column, row? })` normalises all three forms and
is exported for custom chrome; `optionsToComboboxData` turns the result into
what Mantine's `Select`/`MultiSelect` take, `group` fields included. A select
column that declares nothing still filters: the panel falls back to the faceted
values. Mantine's dropdowns are not virtualized, so very large sets want the
function form rather than `"faceted"`.

## Row number column

Under `enableRowNumbers: true` a gutter with the id `ROW_NUMBER_COLUMN_ID`
(`"__rowNumber__"`) sits outermost left, before every other lane, numbering
the current view: sorting and filtering renumber, pagination continues the
count across pages, and group rows take no number — they are headings over
the rows being counted. It is a system lane like the ones below — fixed
width, no menu, never exported — and its visibility follows the option, so
the columns panel does not list it.

## Checkbox column

Under `selectionMode: "checkbox"` (the default) or `"checkboxAndHighlight"`,
and unless `enableRowSelection` is `false`, a column with the id
`SELECT_COLUMN_ID` is added as the first column and pinned to the left. It is listed as "Checkbox selection" in the column manager and can be
hidden like any other column. It is a system lane: as wide as the box it holds
(36px at every size scale), with no column menu and no resize handle, and it
cannot be sorted, filtered, resized, re-pinned or moved.

Because it cannot be moved, it also anchors the left pinned region: no column
can be placed in front of it.

## Edit column

Under `editMode: "row"` a column with the id `EDIT_COLUMN_ID` is appended and
pinned to the right — the row's pencil, and its Save/Cancel while the edit is
open. A system lane like the checkbox column, mirrored to the other edge: not
sortable, filterable, resizable or movable. See [Editing](#editing).

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
  value: string | ReadonlyArray<string>;
};
```

The filter model is therefore plain JSON, which allows it to be forwarded to a
server without transformation — dates as ISO strings, booleans as `"true"` /
`"false"`, and an array only under `isAnyOf` / `isNoneOf` (the set the cell is
tested against) and `between` (a `[min, max]` pair, an empty string leaving
that end open). See [Server-side](#server-side).

### Operators

| Operator | Label | Column type |
| --- | --- | --- |
| `contains` | contains | `string` |
| `equals` | equals | `string`, `number`, `boolean`, `date` |
| `notEquals` | does not equal | `string`, `number`, `boolean`, `date` |
| `startsWith` | starts with | `string` |
| `endsWith` | ends with | `string` |
| `greaterThan` | is greater than | `number` |
| `greaterThanOrEqual` | is greater than or equal to | `number` |
| `lessThan` | is less than | `number` |
| `lessThanOrEqual` | is less than or equal to | `number` |
| `between` | is between | `number`, `date` |
| `before` | is before | `date` |
| `after` | is after | `date` |
| `onOrBefore` | is on or before | `date` |
| `onOrAfter` | is on or after | `date` |
| `isAnyOf` | is any of | `select`, `multiSelect` |
| `isNoneOf` | is none of | `select`, `multiSelect` |
| `isEmpty` | is empty | every type |
| `isNotEmpty` | is not empty | every type |

`meta.type` selects the list. String comparisons are case-insensitive; date
comparisons are by calendar day, and `equals` on a `date` column plays the role
of "is". On a `multiSelect` column — whose cells hold arrays — `isAnyOf` is an
intersection test and `isNoneOf` its complement; an empty cell array counts as
empty for `isEmpty`. `between` is inclusive at both ends; the panel renders a
From/To pair, and either end may stay empty to leave the interval open on that
side.

A filter with an empty value remains in state so the panel continues to display
its row while the user types. It matches all rows, does not activate the filter
indicator in the header and gets no pill in
[`TMDataGrid.FilterPills`](#components). Use `isFilterActive(value)` to test for
this.

To give a column its own matching logic, set `filterFn` on the column
definition. The grid only provides `"tmDataGrid"` as the default.
