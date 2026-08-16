# Row pinning and numbering

Two independent lanes at the edges of the body: rows stuck to the top or
bottom so they stay in sight, and a gutter that counts.

## Pinning rows

Opt in with `enableRowPinning: true`, or a per-row predicate.

```tsx
const grid = useTMDataGrid({ data, columns, enableRowPinning: true });
```

Pinned rows leave the scrolling order and render in sticky blocks —
top-pinned rows under the header (and under the entry block while one is
open), bottom-pinned rows above the summary row.

There is no built-in pin gesture. Pin from wherever suits — most naturally the
row context menu:

```tsx
<TMDataGrid.Table<Employee>
  rowContextMenu={({ row }) => (
    <>
      {row.getIsPinned() !== "top" && (
        <Menu.Item onClick={() => row.pin("top")}>Pin to top</Menu.Item>
      )}
      {row.getIsPinned() !== false && (
        <Menu.Item onClick={() => row.pin(false)}>Unpin</Menu.Item>
      )}
    </>
  )}
/>
```

```demo
file: rows/PinningAndNumbers.tsx
hint: Right-click a row to pin it to either edge, then scroll.
```

`row.pin("top" | "bottom" | false)`, `row.getIsPinned()` and `row.getCanPin()`
are TanStack's own APIs; the state is `rowPinning: { top: string[], bottom:
string[] }`, settable wholesale with `table.setRowPinning()` or seeded through
`initialState`.

### They are still body rows

Selection, editing, details, the context menu and per-row styling all behave as
they do in the body. What pinned rows sit out are the statements about
scrolling *order* — striping and the cell range — and the row-number gutter
leaves them unnumbered.

Worth knowing:

- A pinned row stays at its edge even when a filter or the pager would have
  dropped it from the body. Pinning means "always in sight".
- A pinned id whose row leaves `data` — a delete, a server-side page swap — is
  simply not shown. It stays in state, harmless, and the row returns to its
  edge if its data comes back.
- **Group rows never pin.** A group row is built on its first child's record,
  so pinning one would drag an arbitrary data row's identity to the edge. A
  leaf whose group is collapsed stays hidden while pinned.
- `rowPinning` is **not** persisted by `settingsKey`: row ids are data, and a
  layout store outlives any one data set.

## Numbering rows

`enableRowNumbers: true` adds a gutter, outermost left, before every other
lane.

```tsx
const grid = useTMDataGrid({ data, columns, enableRowNumbers: true });
```

It numbers **the current view** — sorted, filtered, and continuing across pages
rather than restarting at each one. So the number answers "where am I in what I
am looking at", not "which record is this". Group rows take no number, and
neither do pinned rows.

If you need a stable identifier instead, that is a column of your own over the
record's id.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `enableRowPinning` | Table option | `boolean \| (row) => boolean` | `false` | Whether rows can be pinned. |
| `initialState.rowPinning` | Table option | `{ top: string[], bottom: string[] }` | empty | Rows pinned at mount. Not persisted. |
| `enableRowNumbers` | Option | `boolean` | `false` | Adds the row-number gutter. |
| `row.pin` | Row method | `("top" \| "bottom" \| false) => void` | – | Pins or unpins one row. |
| `row.getIsPinned` | Row method | `() => "top" \| "bottom" \| false` | – | Where a row is pinned. |
| `ROW_NUMBER_COLUMN_ID` | Export | `"__rowNumber__"` | – | Id of the generated number gutter. |
