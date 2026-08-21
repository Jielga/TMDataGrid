# Row details

A panel that opens underneath a row, spanning every column, holding whatever
does not fit in the cells - a summary card, an action strip, a nested table.

Setting `renderDetails` turns the lane on. There is no separate flag.

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  renderDetails: ({ row }) => <EmployeeCard employee={row.original} />,
});
```

```demo
file: rows/DetailsPanel.tsx
hint: Expand a few rows - the panels differ in height, and each one is measured.
height: 460
```

The panel is as tall as whatever it renders. The grid measures each one, so
they need not be uniform. `renderDetailsEstHeight` (default `160`) is what the
virtualizer assumes for a panel it has not measured yet, which keeps the
scrollbar accurate for rows that open off screen.

## The details lane

Setting `renderDetails` prepends a generated chevron column,
`DETAILS_COLUMN_ID` (`"__details__"`), pinned to the left after the checkbox
and tree columns - `[checkbox, tree, details, …]`. It comes last of the three
because it acts on a single record.

Like the other two it is structural: fixed width, and it cannot be hidden,
moved, resized or unpinned.

It is a system lane, as wide as the chevron it holds, with no resize handle and
no column menu. Its header is a control rather than a title: the chevron
expands and collapses every panel, as the checkbox column's header selects and
clears every row.

Group rows get no chevron: they expand into their children from the tree lane.

## Opening a row from elsewhere

Which rows are open is TanStack's own `expanded` state, so anything can open
one - a context menu item, a double-click, a button in your own cell:

```tsx
<Menu.Item onClick={() => row.toggleExpanded()}>Show details</Menu.Item>
```

Anything that *reads* `row.getIsExpanded()` inside a cell has to subscribe to
the store, or the React Compiler will cache the call along with the `row`
identity and the control will never update:

```tsx
const expanded = useSelector(row.table.store, () => row.getIsExpanded());
```

Because it is the standard state, `table.toggleAllRowsExpanded()`,
`initialState.expanded` and persistence all work with it. It is one of the
`data` slices, so open panels survive a reload on a
[persisted](/docs/use-tm-data-grid#persist) grid.

> TanStack resets `expanded` when the row structure changes, so replacing
> `data` closes open panels. Pass `autoResetExpanded: false` to keep them.

## The two kinds of expanding

TanStack keeps one `expanded` state, and the grid uses it for two unrelated
things: opening a group row into its children, and opening a data row into its
panel. The controls are kept separate. The details header only opens and closes
panels, and "Expand all groups" in the tree menu only unfolds the tree.

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

## Panel behaviour

The panel is a cell spanning the row, inside the row element. It takes the row's
background, moves with it and is measured with it, but it is **not a row**:
`aria-rowcount` still counts records, and a click or right-click inside it does
not select or highlight the row underneath. It carries
`data-dg-part="details"` with the row's `data-row-id`. See
[Testing](/docs/testing).

Group rows have no panel. Expanding one opens its children, and the record a
group row is built from is an arbitrary one of them, which is also why group
rows do not fire `onRowClick`.

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
