# Row details

A panel that opens underneath a row, spanning every column, holding whatever
does not fit in the cells — a summary card, an action strip, a nested table.

Setting `renderDetails` is what turns the lane on. There is no flag.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  renderDetails: ({ row }) => <EmployeeCard employee={row.original} />,
});
```

```demo
file: rows/DetailsPanel.tsx
hint: Expand a few rows — the panels differ in height, and each one is measured.
height: 460
```

The panel is as tall as whatever it renders — the grid measures each one, so
nothing has to be uniform. `renderDetailsEstHeight` (default `160`) is only
what the virtualizer assumes for a panel it has not seen yet, which keeps the
scrollbar honest for rows that open off screen.

## The details lane

Setting `renderDetails` prepends a generated chevron column,
`DETAILS_COLUMN_ID` (`"__details__"`), pinned to the left after the checkbox
and tree columns — `[checkbox, tree, details, …]`. It comes last of the three
because it acts on one record: the checkbox picks rows out and the tree says
which group they are in, and only then is there a row to open.

Like the other two it is structural: fixed width, and it cannot be hidden,
moved, resized or unpinned — a toggle that wandered to the far right, or hid
itself, would leave rows with panels no one can open.

It is a system lane: as wide as the chevron it holds, with no resize handle and
no column menu — its header is a control rather than a title. The chevron there
expands and collapses every panel, the way the checkbox column's header selects
and clears every row.

Group rows get no chevron: they expand into their children from the tree lane.

## Opening a row from elsewhere

Which rows are open is TanStack's own `expanded` state, so anything can open
one — a context menu item, a double-click, a button in your own cell:

```tsx
<Menu.Item onClick={() => row.toggleExpanded()}>Show details</Menu.Item>
```

Anything that *reads* `row.getIsExpanded()` inside a cell has to subscribe to
the store, or the React Compiler will cache the call along with the `row`
identity and the control will never update:

```tsx
const expanded = useSelector(row.table.store, () => row.getIsExpanded());
```

Because it is the standard state, everything around it comes free:
`table.toggleAllRowsExpanded()`, `initialState.expanded`, and persistence — it
is one of the `data` slices, so open panels survive a reload where the grid is
[persisted](/docs/use-tm-data-grid#persist).

> TanStack resets `expanded` when the row structure changes, so replacing
> `data` closes open panels. Pass `autoResetExpanded: false` to keep them.

## The two kinds of expanding

TanStack keeps one `expanded` state, and the grid opens two unrelated things
out of it — a group row into its children, a data row into its panel. The
controls are kept apart all the same: the details header only opens and closes
panels, and "Expand all groups" in the tree menu only unfolds the tree. Neither
disturbs what the other was showing.

`table.toggleAllRowsExpanded()` is the one that does not distinguish them: it
writes the state's whole-table form, which is every group and every panel at
once. `resolveExpandAll` and `areAllRowsExpanded` are exported for anything
building its own control:

```tsx
table.setExpanded(
  resolveExpandAll({
    rows: table.getPrePaginatedRowModel().flatRows,
    expanded: table.store.state.expanded,
    target: "details",
    expand: true,
  }),
);
```

## What the panel is, and is not

The panel is a cell spanning the row, inside the row element. So it takes the
row's background, moves with it, and is measured with it — but it is **not a
row**: `aria-rowcount` still counts records, and a click or right-click inside
it stops there rather than selecting or highlighting the row underneath. It
carries `data-dg-part="details"` with the row's `data-row-id` — see
[Testing](/docs/testing).

Group rows have no panel. Expanding one opens its children, and the record a
group row is built from is an arbitrary one of them — the same reason group
rows sit out `onRowClick`.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `renderDetails` | Option | `({ row, table }) => ReactNode` | – | Contents of the panel. Setting it adds the lane. |
| `renderDetailsEstHeight` | Option | `number` | `160` | Height the virtualizer assumes for an unmeasured panel. |
| `initialState.expanded` | Table option | `ExpandedState` | `{}` | Rows open at mount. A data slice, so it persists. |
| `autoResetExpanded` | Table option | `boolean` | `true` | `false` keeps panels open when `data` changes. |
| `DETAILS_COLUMN_ID` | Export | `"__details__"` | – | Id of the generated chevron column. |
| `resolveExpandAll` | Export | `(args) => ExpandedState` | – | Expand or collapse every group, or every panel, but not both. |
| `areAllRowsExpanded` | Export | `(args) => boolean` | – | Whether every row of one target is open. |
| `data-dg-part="details"` | Data attribute | – | – | The panel element, carrying the row's `data-row-id`. |
