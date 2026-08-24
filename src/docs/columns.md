# Defining columns

A column declares where its value comes from, what kind of value it is, and how
to render it. Which filter operators it offers, which editor it opens and how
it sorts all follow from `meta.type`.

## The column helper

`createTMDataGridColumnHelper<TData>()` returns a TanStack column helper bound
to the grid's feature set, so that `meta` and `filterFn` are correctly typed.

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

**Define columns at module scope.** A new array on every render rebuilds the
table's column model and discards the user's column widths and order.

```demo
file: getting-started/ColumnDefinitions.tsx
```

An accessor may be a key of the row or a function over it. A function needs an
explicit `id`, and a `meta.label` for the name shown in menus and the columns
panel.

## meta

`meta` carries what a TanStack column definition has no field for. What the
column is sits at the top level; what the filter panel and the edit engine do
with it sits in the `filter` and `edit` namespaces.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string` | String header, or column id | Name used in menus and the column manager. Required when `header` is a component. |
| `type` | `"string" \| "number" \| "boolean" \| "date" \| "select" \| "multiSelect"` | `"string"` | What the values are. Selects the filter operators, the filter control and the cell editor. |
| `options` | `TMDataGridOptionsSource` | - | The choices of a `select` / `multiSelect` column. See [Options](#options). |
| `flex` | `number` | `1` | Share of the remaining width. |
| `align` | `"left" \| "right" \| "center"` | `"left"` | Alignment, applied to both header and cells. |
| `autoSize` | `boolean` | `false` | Fit the column to its content once, on the render its first cells appear in. |
| `enableOrdering` | `boolean` | `true` | `false` keeps the column where it is. |
| `filter` | `TMDataGridColumnFilterOptions` | - | How this column filters. See [meta.filter](#metafilter). |
| `edit` | `TMDataGridColumnEditOptions` | - | How this column is edited. See [meta.edit](#metaedit). |

### meta.filter

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultOperator` | `TMDataGridFilterOperator` | The type's default | The operator a fresh filter starts with. See [Filtering](/docs/filtering#operators). |
| `control` | `TMDataGridFilterControlComponent` | By type and operator | Replaces the filter panel's value control. See [Filtering](/docs/filtering#replacing-the-value-control). |

```tsx
meta: {
  type: "number",
  filter: { defaultOperator: "between", control: DgRangeSliderFilter },
}
```

### meta.edit

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean \| (row) => boolean` | `true` | Whether cells in this column may be edited. See [Editing](/docs/editing#which-cells-edit). |
| `field` | `string` | The `accessorKey` | The data path an edit writes to, for a column built on `accessorFn`. |
| `editor` | `TMDataGridEditorComponent` | By `type` | Replaces the cell editor. See [Editors](/docs/editors#writing-your-own). |
| `validate` | `TMDataGridFieldValidate` | - | Per-cell validation. See [Validation](/docs/editors#validation). |
| `mapValue` | `TMDataGridEditValueMap` | - | Maps each value an editor writes. See [Mapping the value](/docs/editors#mapping-the-value-as-it-is-typed). |

```tsx
meta: {
  type: "string",
  edit: {
    enabled: (row) => row.original.status !== "Terminated",
    validate: z.string().min(2, "At least two characters"),
    mapValue: ({ value }) =>
      typeof value === "string" ? value.toUpperCase() : value,
  },
}
```

Omit both namespaces to get the defaults: any column mapping to a data path is
editable once `editing` is set, and every column filters by its type.

## Column types

`meta.type` declares what a column's values are. The filter panel offers that
type's operators and renders a matching value control: a date input for `date`,
a Yes/No dropdown for `boolean`, a multi-select of the column's options for
`select` and `multiSelect`. With editing on, the same declaration picks the
editor.

Dates may be `Date` instances or ISO `YYYY-MM-DD` strings in the data; the
comparison is by calendar day either way, and filter values always travel as ISO
strings. The date control is the native `<input type="date">`; `@mantine/dates`
is not used.

### Options

`select` and `multiSelect` columns declare their choices once, in `meta.options`,
and every consumer of them (the filter panel, the cell editor) reads the same
source:

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

// Computed. `row` is set when a cell editor asks and absent for the filter
// panel, so row-dependent options can branch on it:
meta: {
  type: "select",
  options: ({ row }) => citiesFor(row?.original.country),
}
```

`resolveColumnOptions({ table, column, row? })` normalises all three forms and is
exported for custom controls; `optionsToComboboxData` turns the result into what
Mantine's `Select` and `MultiSelect` take, `group` fields included.

A select column that declares no options still filters: the panel falls back to
the faceted values. Mantine's dropdowns are not virtualized, so use the function
form for very large sets.

## Header groups

`columnHelper.group` nests columns under a shared header. The group is a header
row, not a column - the leaves keep all the behaviour.

```demo
file: getting-started/HeaderGroups.tsx
hint: Sort, filter and resize the leaves; the group header follows them.
```

Columns inside a group cannot be reordered, regardless of `meta.enableOrdering`:
`columnOrder` sequences leaf columns, so moving one would leave the group header
spanning columns that no longer belong to it.

## Per-column feature switches

Standard TanStack column options. Each removes the corresponding interface for
that column alone.

| Option | Effect when `false` |
| --- | --- |
| `enableSorting` | No sort indicator and no sort menu items. See [Sorting](/docs/sorting). |
| `enableColumnFilter` | No filter menu item, and no entry in the panel's column list. |
| `enableHiding` | No hide menu item, and no checkbox in the column manager. |
| `enablePinning` | No pin menu items. |
| `enableResizing` | The divider stays as a separator but cannot be dragged. |
| `meta.enableOrdering` | No header dragging and no move menu items. |

Sizing, pinning, ordering and visibility are covered on
[Visibility, pinning, ordering and size](/docs/column-layout).

## The generated columns

Five lanes the grid adds when a feature needs them. All are **system lanes**:
fixed width, no column menu, no resize handle, never exported, never hidden and
never listed in the columns panel.

| Id | Appears when | Where |
| --- | --- | --- |
| `ROW_NUMBER_COLUMN_ID` | `enableRowNumbers` | Outermost left, before everything. See [Row pinning and numbering](/docs/row-pinning#numbering-rows). |
| `SELECT_COLUMN_ID` | A checkbox selection mode | First, pinned left. See [Row selection](/docs/row-selection). |
| `GROUP_COLUMN_ID` | A column is grouped | Front, beside the checkbox lane. See [Grouping](/docs/grouping). |
| `DETAILS_COLUMN_ID` | `renderDetails` is set | Left, after checkbox and tree. See [Row details](/docs/row-details). |
| `EDIT_COLUMN_ID` | `editing.mode: "row"` or `"draft"`, or `editing.onRowDelete` | Appended, pinned right, and stays outside anything the user pins right. See [Editing](/docs/editing). |

The checkbox lane cannot be moved: it anchors the left pinned region, and no
column can be placed in front of it.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `createTMDataGridColumnHelper` | Export | `<TData>() => helper` | – | A TanStack column helper typed against the grid's features. |
| `meta.label` | Column meta | `string` | Header or id | Name in menus and the columns panel. |
| `meta.type` | Column meta | six types | `"string"` | What the values are; drives filters and editors. |
| `meta.options` | Column meta | array \| `"faceted"` \| `(args) => …` | – | The choices of an option column. |
| `meta.align` | Column meta | `"left" \| "right" \| "center"` | `"left"` | Header and cell alignment. |
| `meta.filter` | Column meta | `TMDataGridColumnFilterOptions` | – | How the column filters: `defaultOperator`, `control`. |
| `meta.edit` | Column meta | `TMDataGridColumnEditOptions` | – | How the column edits: `enabled`, `field`, `editor`, `validate`, `mapValue`. |
| `resolveColumnOptions` | Export | `({ table, column, row? }) => options` | – | Normalises all three `meta.options` forms. |
| `optionsToComboboxData` | Export | `(options) => ComboboxData` | – | Options as Mantine `Select` data. |
| `getColumnLabel` · `getColumnType` · `isControlColumn` | Exports | `(column) => …` | – | How the built-in controls read a column. |
| `isGeneratedColumn` | Export | `(columnId) => boolean` | – | Whether the grid generated the column - the four control lanes plus the tree column. |
| `SELECT_COLUMN_ID` · `GROUP_COLUMN_ID` · `DETAILS_COLUMN_ID` · `EDIT_COLUMN_ID` · `ROW_NUMBER_COLUMN_ID` | Exports | `string` | – | Ids of the five generated lanes. |
