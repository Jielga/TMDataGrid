# Defining columns

A column says where its value comes from, what kind of value it is, and how to
render it. Everything else - which filter operators it offers, which editor it
opens, how it sorts - follows from `meta.type` rather than being configured
again per feature.

## The column helper

`createTMDataGridColumnHelper<TData>()` returns a TanStack column helper bound
to the grid's feature set, which is what gives `meta` and `filterFn` their
correct types.

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
table's column model, and takes the reader's widths and order with it.

```demo
file: getting-started/ColumnDefinitions.tsx
```

An accessor may be a key of the row or a function over it. A function needs an
explicit `id`, and, because there is no key to name it, a `meta.label`, which is
what menus and the columns panel show.

## meta

`meta` carries what a TanStack column definition has no field for. What the
column **is** sits at the top level; what a stage **does** with it sits in that
stage's own namespace, `filter` and `edit`, named after the `filter` panel and
the `edit` engine you drive at runtime.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string` | String header, or column id | Name used in menus and the column manager. Required when `header` is a component. |
| `type` | `"string" \| "number" \| "boolean" \| "date" \| "select" \| "multiSelect"` | `"string"` | What the values are. Selects the filter operators, the filter control and the cell editor. |
| `options` | `TMDataGridOptionsSource` | - | The choices of a `select` / `multiSelect` column. See [Options](#options). |
| `flex` | `number` | `1` | Share of the remaining width. |
| `align` | `"left" \| "right" \| "center"` | `"left"` | Alignment, applied to both header and cells. |
| `autoSize` | `boolean` | `false` | Fit the column to its content once, after the first rows render. |
| `enableOrdering` | `boolean` | `true` | `false` keeps the column where it is. |
| `filter` | `TMDataGridColumnFilterOptions` | - | How this column filters. See [meta.filter](#metafilter). |
| `edit` | `TMDataGridColumnEditOptions` | - | How this column is edited. See [meta.edit](#metaedit). |

`type` and `options` stay at the top level because both stages read them: one
`type` picks the filter operators and the cell editor, and one `options` list
feeds the filter panel's dropdown and the select editor. Declaring either twice
is the bug the shared field exists to prevent.

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

A column that wants the defaults declares neither namespace: any column mapping
to a data path is editable once `editMode` is on, and every column filters by
its type.

`enableOrdering` and `autoSize` live in `meta` because they are the two
behaviours TanStack defines no column option for.

## Column types

`meta.type` declares what a column's values are, and the chrome follows: the
filter panel offers that type's operators and renders a matching value control -
a date input for `date`, a Yes/No dropdown for `boolean`, a multi-select of the
column's options for `select` and `multiSelect`. With editing on, the same
declaration picks the editor.

Dates may be `Date` instances or ISO `YYYY-MM-DD` strings in the data; the
comparison is by calendar day either way, and filter values always travel as ISO
strings. No `@mantine/dates` involved - the date control is the native
`<input type="date">`.

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

// Computed - `row` is set when a cell editor asks, absent for the filter
// panel, which is what row-dependent options key off:
meta: {
  type: "select",
  options: ({ row }) => citiesFor(row?.original.country),
}
```

`resolveColumnOptions({ table, column, row? })` normalises all three forms and is
exported for custom chrome; `optionsToComboboxData` turns the result into what
Mantine's `Select` and `MultiSelect` take, `group` fields included.

A select column that declares nothing still filters: the panel falls back to the
faceted values. Mantine's dropdowns are not virtualized, so very large sets want
the function form rather than `"faceted"`.

## Header groups

`columnHelper.group` nests columns under a shared header. The group is a header
row, not a column - the leaves keep all the behaviour.

```demo
file: getting-started/HeaderGroups.tsx
hint: Sort, filter and resize the leaves; the group header follows them.
```

Columns inside a group cannot be reordered, whatever `meta.enableOrdering` says:
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

Five lanes the grid adds for itself when a feature asks for them. All are
**system lanes**: fixed width, no column menu, no resize handle, never exported,
never hidden, and never listed in the columns panel.

| Id | Appears when | Where |
| --- | --- | --- |
| `ROW_NUMBER_COLUMN_ID` | `enableRowNumbers` | Outermost left, before everything. See [Row pinning and numbering](/docs/row-pinning#numbering-rows). |
| `SELECT_COLUMN_ID` | A checkbox selection mode | First, pinned left. See [Row selection](/docs/row-selection). |
| `GROUP_COLUMN_ID` | A column is grouped | Front, beside the checkbox lane. See [Grouping](/docs/grouping). |
| `DETAILS_COLUMN_ID` | `renderDetails` is set | Left, after checkbox and tree. See [Row details](/docs/row-details). |
| `EDIT_COLUMN_ID` | `editMode: "row"` | Appended, pinned right, and stays outside anything the user pins right. See [Editing](/docs/editing). |

Hiding one is not offered: each holds a control the grid needs - the row's
checkbox, its Save and Delete - or tracks a feature's state rather than a
setting of its own.

The checkbox lane cannot be moved, which is what anchors the left pinned region:
no column can be placed in front of it.

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
| `getColumnLabel` · `getColumnType` · `isControlColumn` | Exports | `(column) => …` | – | What the chrome uses to read a column. |
| `isGeneratedColumn` | Export | `(columnId) => boolean` | – | Whether the grid generated the column - the four control lanes plus the tree column. |
| `SELECT_COLUMN_ID` · `GROUP_COLUMN_ID` · `DETAILS_COLUMN_ID` · `EDIT_COLUMN_ID` · `ROW_NUMBER_COLUMN_ID` | Exports | `string` | – | Ids of the five generated lanes. |
