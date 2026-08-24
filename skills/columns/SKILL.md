---
name: columns
description: >
  Define and arrange TMDataGrid columns. Covers createTMDataGridColumnHelper,
  every column meta field (label, type, options, flex, align, autoSize,
  enableOrdering, and the meta.filter and meta.edit namespaces holding
  defaultOperator, control, enabled, field, editor, validate and mapValue), the
  six column types, fluid minmax sizing versus fixed width with minSize /
  maxSize / size, autosizing and autosizeColumn, hiding through enableHiding and
  the columns panel, pinning and why a pinned column becomes fixed-width,
  ordering with enableColumnOrdering, meta.enableOrdering, moveColumn,
  moveColumnByStep, getStepTargetColumn and the pinned regions, resetSettings,
  sorting with multi-sort through isMultiSortEvent and a custom sortFn, and the
  generated lanes. Load when adding or changing columns, controlling widths,
  hiding, pinning, reordering or sorting them.
metadata:
  type: core
  library: '@jielga/tmdatagrid'
  library_version: '2.0.0-beta.1'
sources:
  - 'Jielga/TMDataGrid:src/docs/columns.md'
  - 'Jielga/TMDataGrid:src/docs/column-layout.md'
  - 'Jielga/TMDataGrid:src/docs/sorting.md'
  - 'Jielga/TMDataGrid:src/tmdatagrid/core/columnUtils.ts'
  - 'Jielga/TMDataGrid:src/tmdatagrid/core/columnOrdering.ts'
  - 'Jielga/TMDataGrid:src/tmdatagrid/core/autosize.ts'
---

# TMDataGrid - Columns

`createTMDataGridColumnHelper<TData>()` returns a TanStack column helper bound to
the grid's feature set, which is what gives `meta` and `filterFn` their correct
types.

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
| `type` | `TMDataGridColumnType` | `"string"` | Picks the filter operators, and the cell editor once editing is on. |
| `options` | `TMDataGridOptionsSource` | – | Choices for a `select` / `multiSelect` column: an array, `"faceted"`, or a function. One declaration feeds the filter panel and the editor. |
| `flex` | `number` | `1` | Share of the remaining width. |
| `align` | `"left" \| "right" \| "center"` | `"left"` | Applied to both header and cells. |
| `autoSize` | `boolean` | `false` | Size to the widest mounted content once, after the first rows render. |
| `enableOrdering` | `boolean` | `true` | `false` keeps the column where it is. |
| `filter` | `TMDataGridColumnFilterOptions` | – | How this column filters. See below. |
| `edit` | `TMDataGridColumnEditOptions` | – | How this column is edited. See below. |

What the column **is** stays flat; what the filter panel and the edit engine do
with it sits in their namespaces. `type` and `options` are read by both stages,
which is why they are in neither.

`meta.filter`:

| Field | Type | Default | What it does |
| --- | --- | --- | --- |
| `defaultOperator` | `TMDataGridFilterOperator` | The type's default | The operator a fresh filter on this column starts with. |
| `control` | `TMDataGridFilterControlComponent` | By `meta.type` | Replaces the value control in this column's filter row. Module scope. |

`meta.edit`:

| Field | Type | Default | What it does |
| --- | --- | --- | --- |
| `enabled` | `boolean \| ((row) => boolean)` | editable where a field maps | Whether this column's cells edit. |
| `field` | `string` | The `accessorKey` | The data path an edit writes to. The only way an `accessorFn` column edits. |
| `editor` | `TMDataGridEditorComponent` | By `meta.type` | Replaces the cell editor. Module scope. |
| `validate` | `TMDataGridFieldValidate` | – | Field-level validation. A bare schema means `onChange`. |
| `mapValue` | `TMDataGridEditValueMap` | – | Maps each value an editor writes, on every keystroke. |

```tsx
meta: {
  type: "number",
  filter: { defaultOperator: "between", control: DgRangeSliderFilter },
  edit: { enabled: (row) => !row.original.locked },
}
```

`enableOrdering` lives in `meta` because column ordering is the one feature
TanStack defines no column option for. `meta.edit` only acts once `editing` is
set: see the `editing` skill. `meta.filter` belongs to the `filtering` skill.

### Column types

`meta.type` is one of `"string"`, `"number"`, `"boolean"`, `"date"`,
`"select"`, `"multiSelect"`. It decides three things at once: the operators the
filter panel offers, the control that filter row renders, and the editor a cell
opens. `select` and `multiSelect` read their choices from `meta.options`.

```tsx
columnHelper.accessor("hired", { header: "Hired", meta: { type: "date" } });
columnHelper.accessor("department", {
  header: "Department",
  meta: { type: "select", options: ["Engineering", "Sales", "Support"] },
});
```

Dates travel as ISO `YYYY-MM-DD` strings and booleans as `"true"` / `"false"`,
so the filter model stays plain JSON whatever the type.

## Sizing

Columns are fluid. Each track is `minmax(minSize, flex fr)`.

| Option | Effect |
| --- | --- |
| `minSize` | Minimum width, and the column's contribution to the grid minimum width. Defaults to `80`. |
| `meta.flex` | Share of the remaining width. Defaults to `1`. |
| `minSize === maxSize` | Fixed width. The column is never fluid. |
| `size` | Applied once the column becomes fixed by resizing or pinning. |

```tsx
// Fixed 64px action column that never flexes.
columnHelper.display({
  id: "actions",
  minSize: 64,
  maxSize: 64,
  cell: (info) => <RowMenu id={info.row.original.id} />,
});
```

Double-clicking a resize divider autosizes the column to its widest **mounted**
content - under virtualization the unmounted rows do not exist to be measured,
so the width fits the visible window plus overscan. The result is clamped to
`minSize`/`maxSize` and written into `columnSizing`, so it persists and a later
drag takes over. `meta.autoSize: true` runs it once after the first rows render,
unless a persisted or user-set width already covers the column, and
`autosizeColumn({ table, columnId, container })` is exported for menus and
consumer code.

## Hiding, pinning and ordering

All three write state that persists together, so a grid comes back arranged the
way it was left. `resetSettings()` from the hook clears visibility, order,
pinning and widths in one go, and the columns panel offers it as **Reset
layout**.

**Hiding** is `columnVisibility`, driven by "Hide column" in a column menu and by
`TMDataGrid.ColumnsButton` with the panel behind it.

**Pinning** is "Pin to left" / "Pin to right" in the column menu. A pinned
column also becomes fixed-width: sticky offsets are computed from `getSize()`,
which cannot resolve an `fr` value, so the grid stores the rendered width in
`columnSizing` at the moment it is pinned and nothing jumps.

**Ordering** is header dragging plus "Move left" / "Move right". A column can
only move **within its own pinned region** - pinning splits the grid into left,
centre and right, then `columnOrder` sequences the centre while
`columnPinning.left` and `.right` sequence the pinned lanes. Unpin a column
first to move it out of one. A neighbour that cannot move acts as a wall rather
than being stepped over, and columns inside a header group are not movable in
either direction, because `columnOrder` sequences leaf columns.

```tsx
import { moveColumn, moveColumnByStep } from "@jielga/tmdatagrid";

moveColumn({ table, columnId: "salary", targetId: "age", side: "before" });
moveColumnByStep({ table, columnId: "salary", direction: 1 });
```

Both are no-ops for a move that is not allowed, including one across regions.
`getStepTargetColumn({ table, columnId, direction })` returns the column a step
would swap with, or `null` at a region edge - what the menu items use to disable
themselves.

`columnOrder` is stored as the **complete** leaf order, hidden and pinned
columns included, so a column keeps its position when it is later shown or
unpinned. A column added to the definitions later is not in the stored order and
is appended at the end until it is moved.

## Sorting

On by default: click a header to sort, again to reverse, a third time to clear.
Shift+click a second header **adds** it to the sort, and each sorted header then
shows its priority beside the arrow. A plain click still replaces the whole
sort.

This is TanStack's own `isMultiSortEvent`, so `enableMultiSort`,
`maxMultiSortColCount` and a custom `isMultiSortEvent` pass straight through:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  maxMultiSortColCount: 3,
  isMultiSortEvent: (event) => event.ctrlKey,
  initialState: { sorting: [{ id: "lastName", desc: false }] },
});
```

`sortFn` on a column takes any registered name or a
`(rowA, rowB, columnId) => number` function - v9's name for what v8 called
`sortingFn`, and a rename an agent will reproduce wrongly from memory. Sorting writes
TanStack's `sorting` state, an array of `{ id, desc }` in priority order. It is
a **data** slice, persisted under `dataKey`, while the column layout below is a
settings slice under `settingsKey`.

## Column-level feature options

Standard TanStack column options. Each also removes the corresponding interface.

| Option | Effect when `false` |
| --- | --- |
| `enableSorting` | No sort indicator, no sort menu items, no click-to-sort. |
| `enableColumnFilter` | No filter menu item. Excluded from the filter panel's column list. |
| `enableHiding` | No hide menu item. Checkbox disabled in the column manager. |
| `enablePinning` | No pin menu items. |
| `enableResizing` | The divider is displayed but cannot be dragged. |
| `enableGrouping` | No "Group by" menu item. |

`meta.enableOrdering: false` belongs to the same set. A column whose menu has no
remaining items renders no menu button and takes no right-click, so the
browser's own menu comes up there instead.

## The generated lanes

The grid prepends and appends lanes of its own, in this order: row number,
checkbox, tree, details, your columns, edit. Each appears only when its feature
asks for it.

| Lane | Id | Appears when |
| --- | --- | --- |
| Row number | `ROW_NUMBER_COLUMN_ID` | `enableRowNumbers: true` |
| Checkbox | `SELECT_COLUMN_ID` | Selection is on and the mode has checkboxes |
| Tree | `GROUP_COLUMN_ID` | A column is grouped |
| Details | `DETAILS_COLUMN_ID` | `renderDetails` is set |
| Edit | `EDIT_COLUMN_ID` | Row mode, draft mode, or `editing.onRowDelete` |

They are structural: fixed width, no column menu, and they cannot be sorted,
filtered, resized, re-pinned or moved. The checkbox lane anchors the left pinned
region, so no column can be placed in front of it. `isControlColumn(column)`
identifies them.

## Common mistakes

### CRITICAL Setting `size` to control width

`size` is only applied once the column becomes fixed by resizing or pinning. On
a fluid column it is ignored - the track is `minmax(minSize, flex fr)` - so a
column given `size: 200` renders at whatever the flex share works out to, and
the number looks like it did nothing.

Wrong:

```tsx
columnHelper.accessor("email", { header: "Email", size: 200 });
```

Correct:

```tsx
// A floor plus a share, or minSize === maxSize for a genuinely fixed column.
columnHelper.accessor("email", {
  header: "Email",
  minSize: 200,
  meta: { flex: 2 },
});
```

Source: `src/docs/column-layout.md` (Sizing).

### CRITICAL A component header without `meta.label`

`getColumnLabel(column)` falls back to a *string* header, then to the column id.
When `header` is a component there is no string to fall back to, so the column
manager, the filter panel and every column menu show the raw id.

Wrong:

```tsx
columnHelper.accessor("fullName", { header: () => <Icon /> });
```

Correct:

```tsx
columnHelper.accessor("fullName", {
  header: () => <Icon />,
  meta: { label: "Full name" },
});
```

Source: `src/tmdatagrid/core/columnUtils.ts`.

### HIGH A numeric column without `meta.type`

`getColumnType(column)` defaults to `"string"`, so a numeric column that omits
`meta: { type: "number" }` offers only the string operators, and comparisons run
as text - `"9"` above `"10"`. The column still sorts and filters, which is why
it is easy to miss.

Source: `src/tmdatagrid/core/filterOperators.ts`.

### HIGH Expecting a move across pinned regions to work

`moveColumn` and header dragging are no-ops across regions, silently. A column
pinned left cannot be dropped in the centre until it is unpinned, and code that
assumes the move happened goes on to read an order that never changed.

Correct:

```tsx
table.getColumn("salary")?.pin(false);
moveColumn({ table, columnId: "salary", targetId: "age", side: "before" });
```

Source: `src/docs/column-layout.md` (Regions).

### HIGH Reaching for the v8 name of a v9 option

TanStack v9 renamed the column comparator to `sortFn`. `sortingFn` is not an
error the compiler catches in every position - it is simply an unknown key on
the column definition, so the column keeps its automatic comparator and the
custom ordering never appears.

Wrong:

```tsx
columnHelper.accessor("priority", { header: "Priority", sortingFn: byRank });
```

Correct:

```tsx
columnHelper.accessor("priority", { header: "Priority", sortFn: byRank });
```

Source: `@tanstack/table-core` `rowSortingFeature.types.d.ts`, and
`src/tmdatagrid/useTMDataGrid.tsx` (the registered `sortFns`).

### MEDIUM Expecting autosize to measure every row

Autosizing fits the **mounted** rows plus overscan, not every row, because
virtualization leaves the rest with no DOM to measure. A column autosized at the
top of a long list can be too narrow for a value further down.

Source: `src/docs/column-layout.md` (Autosizing).

### MEDIUM Reordering a column inside a header group

`columnOrder` sequences leaf columns, so moving one out of its group would leave
the group header spanning columns that no longer belong to it. Grouped-header
columns are therefore immovable in both directions, whatever `meta.enableOrdering`
says.

Source: `src/docs/column-layout.md` (Regions).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `createTMDataGridColumnHelper` | Export | `<TData>() => helper` | – | The typed column helper. |
| `minSize` / `maxSize` / `size` | Column options | `number` | `80` / – / – | Width bounds, and the fixed width once one applies. |
| `enableSorting` · `enableColumnFilter` · `enableHiding` · `enablePinning` · `enableResizing` · `enableGrouping` | Column options | `boolean` | `true` | Per-column switches, each removing its interface. |
| `enableColumnOrdering` | Option | `boolean` | `true` | Header dragging and the move menu items. Grid-defined. |
| `enableMultiSort` · `maxMultiSortColCount` · `isMultiSortEvent` | Table options | – | Shift held | Multi-column sorting. |
| `sortFn` | Column option | name or `(rowA, rowB, columnId) => number` | `"auto"` | The comparator for one column. Not v8's `sortingFn`. |
| `initialState.columnOrder` · `.columnPinning` · `.columnVisibility` · `.columnSizing` | Table options | – | – | Layout at mount. Settings slices, persisted under `settingsKey`. |
| `initialState.sorting` | Table option | `Array<{ id, desc }>` | `[]` | Sort at mount. A data slice, persisted under `dataKey`. |
| `resetSettings` | Hook return | `() => void` | – | Clears visibility, order, pinning and widths. |
| `moveColumn` | Export | `({ table, columnId, targetId, side }) => void` | – | Moves a column beside another. |
| `moveColumnByStep` | Export | `({ table, columnId, direction }) => void` | – | Moves it one place. |
| `getStepTargetColumn` | Export | `(args) => Column \| null` | – | What a step would swap with, or `null` at a region edge. |
| `getColumnRegion` | Export | `(column) => "left" \| "center" \| "right"` | – | Which pinned region a column is in. |
| `isColumnReorderable` | Export | `(column, features) => boolean` | – | Whether this column may move at all. |
| `autosizeColumn` | Export | `({ table, columnId, container }) => void` | – | Fits a column to its mounted content. |
| `measureColumnContentWidth` | Export | `(args) => number` | – | The measurement behind it. |
| `getColumnLabel` · `getColumnType` · `getColumnDefaultOperator` · `isControlColumn` | Exports | – | – | What the built-in controls read off a column. |
| `SELECT_COLUMN_ID` · `GROUP_COLUMN_ID` · `DETAILS_COLUMN_ID` · `EDIT_COLUMN_ID` · `ROW_NUMBER_COLUMN_ID` | Exports | ids | – | The generated lanes. |
| `TMDataGrid.ColumnsButton` · `TMDataGrid.ColumnsPanel` | Components | – | – | Manage columns, and Reset layout. |

See also: the `filtering` skill for operators and filter controls, the `editing`
skill for the editing meta fields, and the `grouping` skill for what grouping
does to a column.
