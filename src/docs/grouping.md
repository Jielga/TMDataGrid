# Grouping

Grouping collapses the rows into a tree: one row per distinct value, with the
records that share it folded underneath. Use it when the interesting unit is
the category rather than the record — headcount per department, orders per
customer — and the reader wants to open one and look inside.

It is on by default. Nothing changes until a column is grouped, and the reader
does that from **Group by …** in any column menu.

```tsx
const grid = useTMDataGrid({ data, columns });
```

To open already grouped, seed the state:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  initialState: { grouping: ["department"] },
});
```

```demo
file: rows/Grouping.tsx
hint: “Group by …” lives in every column menu. Group by Location as well and the tree nests.
```

## What grouping does to the grid

Grouping a column **removes it** — its values have moved into the tree lane —
and a generated **Group** column appears at the front, pinned beside the
checkbox lane. Each group row shows its value, how many records are under it,
and a chevron. Group again from a second column's menu to nest.

Because a grouped column is no longer in the grid, **Ungroup** lives on the
tree column's menu, one item per grouped column. **Expand all groups** and
**Collapse all groups** are in every column menu while a grouping is active.

To keep a grouped column in the grid instead of removing it, pass
`groupedColumnMode: "reorder"` — TanStack's own default, which moves grouped
columns to the front rather than taking them out.

## Aggregation

Off unless asked for. A grouped grid is a tree, not a summary: a group row
leaves every cell blank except the tree lane. Give a column an `aggregationFn`
and it fills in.

```tsx
columnHelper.accessor("salary", {
  header: "Salary",
  aggregationFn: "sum",
  meta: { type: "number", align: "right" },
});
```

`"sum"`, `"min"`, `"max"`, `"extent"`, `"mean"`, `"median"`, `"unique"`,
`"uniqueCount"` and `"count"` are registered, as is `"auto"` — which picks
`sum` for numbers and `extent` for dates. A function is accepted too. Pass
`aggregatedCell` to render the group row's value differently from the data
rows.

> TanStack's grouping feature defaults every column to `aggregationFn: "auto"`.
> The grid clears that default so grouping does not silently start summing
> numeric columns. Setting `aggregationFn: "auto"` yourself restores it.

For a total across the whole grid rather than per group, give the column a
`footer` instead — see [Summary row](/docs/summary-row).

### Sorting a grouped grid

Grouping runs before sorting, so sorting sorts the rows *inside* each group and
orders the groups by their aggregated value. A column with no aggregation has
no value on a group row, so sorting on it reorders the rows within each group
but leaves the groups where they are.

## Selection

A group row's checkbox selects every record under it, at any depth, including
records inside collapsed sub-groups. It shows a tick once all of them are
selected and a dash while only some are.

Only the records are written to `rowSelection` — a group row is never in it, so
`getSelectedRowModel()` and the toolbar count are unaffected by how the tree is
arranged.

Under `enableMultiRowSelection: false` group rows carry no checkbox: one box
cannot stand for several rows.

## Group rows are not data rows

A group row does not fire `onRowClick` and cannot be highlighted. TanStack
builds it on top of its first child's record, so a click would hand you a
real-looking row that is the wrong one. The same reasoning keeps group rows out
of [row pinning](/docs/row-pinning) and gives them no details panel.

Rows carry `data-grouped` and `data-depth` for styling, and
`--dg-row-group-bg` sets their background.

## Grouping suspends pagination

**Grouping and the built-in pager do not work together, and grouping wins.** As
soon as a column is grouped the grid renders the whole tree and relies on
virtualization; `TMDataGrid.Footer` greys its pager out, replaces the range with
`Grouped · all N rows`, and explains itself on hover. Ungroup and paging resumes
where it left off.

This is deliberate rather than a limitation worked around. A page can only count
one kind of thing, and once the rows are a tree neither answer is usable:

- Counting **every row** splits a group across a page boundary, so opening one
  group fills the page with its children and strands every group after it on
  pages the user has to go looking for.
- Counting **top-level rows** quietly redefines "rows per page" as groups per
  page, so a page of 25 can hold thousands of rows and the number in the footer
  stops meaning anything.

Rendering the whole tree is also the grid's default mode — pagination is the
opt-in — so nothing is lost but the pager.

If you need both, page on the server: group the rows there and feed the grid one
page of a tree at a time with `manualPagination` and `manualGrouping`.

`isPagingActive(table, features)` is exported, so a custom pager can grey itself
out the same way:

```tsx
import { getTMDataGridPaginationApi, isPagingActive } from "@jielga/tmdatagrid";

<TMDataGrid.Footer
  pagination={(api) => <MyPager {...api} disabled={!isPagingActive(table, features)} />}
/>
```

## Server-side grids

`manualPagination: true` turns grouping off, because the client holds one page
and would build groups out of an arbitrary slice. A grid that groups
server-side can set `enableGrouping: true` alongside `manualGrouping: true` —
see [Server-side data](/docs/server-side).

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `enableGrouping` | Table option | `boolean` | `true` | Group by and Ungroup menu items. Also a column option. |
| `groupedColumnMode` | Table option | `"reorder" \| "remove" \| false` | `"remove"` | Whether a grouped column leaves the grid or moves to the front. |
| `manualGrouping` | Table option | `boolean` | `false` | The rows arrive grouped. Required to group a server-paged grid. |
| `initialState.grouping` | Table option | `string[]` | `[]` | Column ids to group on at mount. A settings slice, so it persists. |
| `aggregationFn` | Column option | `TMDataGridAggregationName \| fn` | – | How a column fills in its group rows. Unset means blank. |
| `aggregatedCell` | Column option | `(ctx) => ReactNode` | The `cell` renderer | Renders a group row's value differently from a data row's. |
| `GROUP_COLUMN_ID` | Export | `"__group__"` | – | Id of the generated tree column. |
| `formatGroupValue` | Export | `(value) => string` | – | How the tree lane renders a group's value. |
| `getGroupDataRows` | Export | `(row) => Row[]` | – | Every record under a group row, at any depth. |
| `isPagingActive` | Export | `(table, features) => boolean` | – | Whether the pager is slicing anything — `false` while grouped. |
| `--dg-row-group-bg` | CSS variable | colour | Themed | Group row background. |
| `data-grouped` | Data attribute | – | – | On every group row. |
| `data-depth` | Data attribute | `number` | – | Nesting level, on every row. |
