---
"@jielga/tmdatagrid": major
---

TanStack Table 9.2.4: the peer dependencies `@tanstack/react-table` and `@tanstack/table-core` move from `^9.0.0-beta.21` to `^9.2.4`, and column pinning follows TanStack's rename from physical to logical sides.

Upgrading:

- Install `@tanstack/react-table@^9.2.4` and `@tanstack/table-core@^9.2.4`. The `@tanstack/store` and `@tanstack/react-store` peers move to `^0.11.1`, the range table-core requires; a second store copy at 0.11.0 stops the grid from re-rendering on external atoms.
- `columnPinning` is `{ start, end }` instead of `{ left, right }`: in `initialState`, in a controlled `state.columnPinning` and its `onColumnPinningChange`, and wherever `table.store.state.columnPinning` is read.
- `column.pin("left" | "right")` is `column.pin("start" | "end")`, `column.getIsPinned()` returns `"start"`, `"end"` or `false`, and the table's `getLeft*` / `getRight*` methods are `getStart*` / `getEnd*`. TanStack lists every rename in `node_modules/@tanstack/table-core/skills/migrate-v8-to-v9/SKILL.md`, section 5.
- `getColumnRegion` returns `"start" | "center" | "end"`, and `TMDataGridColumnRegion` matches.
- Settings saved under `settingsKey` by 1.x with the old `left` / `right` keys are read and migrated; nothing to do.
- A custom `aggregationFn` on a column definition is now a `constructAggregationFn({ aggregate })` definition rather than a bare function. The named built-ins (`"sum"`, `"min"`, ...) and `TMDataGridAggregationName` are unchanged.
- The menu labels, the `data-pinned` cell attribute and the sticky CSS keep `left` / `right`: they name the physical side.
