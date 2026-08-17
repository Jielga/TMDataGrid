# Sorting

On by default. Click a header to sort it, click again to reverse, click a third
time to clear. The same three steps live in the column menu, for anyone
without a pointer.

```tsx
const grid = useTMDataGrid({ data, columns });
```

```demo
file: columns/Sorting.tsx
hint: Click a header to sort, Shift+click a second to append - the badge beside the arrow is its priority.
```

## Sorting by more than one column

Shift+click a second header to **add** it to the sort rather than replace it.
While more than one column sorts, each sorted header shows its priority - 1, 2,
… - beside the arrow, so the order the grid is applying them in is visible
rather than guessed.

A plain click still replaces the whole sort, and the menu's Sort items do the
same.

This is TanStack's own `isMultiSortEvent`, so `enableMultiSort`,
`maxMultiSortColCount` and a custom `isMultiSortEvent` all pass straight
through:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  maxMultiSortColCount: 3,
  // Ctrl rather than Shift, say.
  isMultiSortEvent: (event) => event.ctrlKey,
});
```

## Turning it off

`enableSorting: false` on the table removes click-to-sort, the indicator and
the menu items everywhere; on a column it removes them for that column alone.

```tsx
columnHelper.accessor("avatar", { header: "", enableSorting: false });
```

A column whose menu has no remaining items renders no menu button at all and
takes no right-click, so the browser's own menu comes up there instead -
nothing is left as an empty shell.

## Where the state lives

Sorting writes TanStack's `sorting` state, an array of `{ id, desc }` in
priority order. Seed it, control it, or read it like any other slice:

```tsx
const grid = useTMDataGrid({
  data,
  columns,
  initialState: { sorting: [{ id: "lastName", desc: false }] },
});
```

It is a **data** slice - it names a column and a direction over the data in
front of the reader - so a [persisted](/docs/use-tm-data-grid#persist) grid
comes back sorted the way it was left, under `dataKey`. For a server that does the sorting,
see [Server-side data](/docs/server-side).

Sorting interacts with grouping: grouping runs first, so a grouped grid sorts
rows within each group and orders the groups by their aggregated value - see
[Grouping](/docs/grouping#sorting-a-grouped-grid).

## Custom comparators

`sortFn` on the column takes any of TanStack's registered names, or a function
of two rows and the column id. It is `sortFn` in v9, not v8's `sortingFn`.

```tsx
columnHelper.accessor("priority", {
  header: "Priority",
  sortFn: (rowA, rowB) =>
    RANK[rowA.original.priority] - RANK[rowB.original.priority],
});
```

## The header menu

The menu opens from the ⋮ button on the header, or from a right-click anywhere
on it - the same items either way, at the pointer for the right-click.
Dividers are never left stranded at the end of a menu.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `enableSorting` | Table option | `boolean` | `true` | Also a column option. `false` removes indicator, menu items and click-to-sort. |
| `enableMultiSort` | Table option | `boolean` | `true` | Whether Shift+click appends instead of replacing. |
| `maxMultiSortColCount` | Table option | `number` | `Infinity` | How many columns may sort at once. |
| `isMultiSortEvent` | Table option | `(event) => boolean` | Shift held | What counts as "append to the sort". |
| `sortFn` | Column option | name \| `(rowA, rowB, columnId) => number` | `"auto"` | The comparator for one column. v9's name for v8's `sortingFn`. |
| `initialState.sorting` | Table option | `Array<{ id, desc }>` | `[]` | Sort at mount. A settings slice, so it persists. |
| `manualSorting` | Table option | `boolean` | `false` | The server sorts; the grid stops. |
