---
"@jielga/tmdatagrid": minor
---

The edit engine and the table's own state now stay in step under `editing.draft`.

- A commit no longer resets the page index or collapses open details panels and groups. The grid sets TanStack's `autoResetPageIndex` and `autoResetExpanded` to `false` and resets the page on a query change itself: `resetPageOnQueryChange` now defaults to `true` on every grid and also covers grouping.
- A deletion-marked row is read-only and not selectable until restored: `begin`, `setCellValue`, `setRowValues` and `clearCell` refuse it, the keyboard cannot open it, its checkbox is disabled, select-all skips it, and the mark drops it from `rowSelection`. An editor open on the row is cancelled by the mark; a committed edit stays under it for Restore.
- `saveDrafts` sends a row that is edited and marked in `deleted` only, never in `updated` as well, and the per-row path no longer calls `onCommit` before `onRowDelete` for it. The Save count counts it once.
- A refetch that no longer returns a row drops that row's draft, open editor and deletion mark. Not under `manualPagination` or `manualFiltering`, where a missing row is on another page.
- A row the engine takes out of the table leaves `expanded` and `rowPinning` too, not only `rowSelection`.
- Export leaves deletion-marked rows out.
