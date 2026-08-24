# @jielga/tmdatagrid

## 2.0.0-beta.2

### Major Changes

- [`238470c`](https://github.com/Jielga/TMDataGrid/commit/238470cf675000207b0061d760c93b2bee08a27f) Thanks [@Psvensso](https://github.com/Psvensso)! - **Breaking.** The `"batch"` edit mode is now `"draft"`, reworked: a held draft
  renders its value through the column's own `cell` renderer (in `cellConfirm`
  too), an entered new row stays in the grid as a value row until Save all, and
  the edit lane becomes the change indicator and per-row revert - a state icon
  (new/edited/deleted) beside Revert, Restore or remove. Nothing reaches a
  callback before `edit.submitAll()`: the lane's per-row save and
  Delete-to-clear no longer commit under draft mode.

  | Before                              | After                            |
  | ----------------------------------- | -------------------------------- |
  | `editing.mode: "batch"`             | `editing.mode: "draft"`          |
  | `editing.onCommitBatch`             | `editing.onCommitDrafts`         |
  | `TMDataGridEditCommitBatchArgs`     | `TMDataGridEditCommitDraftsArgs` |
  | `edit.state.newRows[]` `{ tempId }` | `{ tempId, confirmed }`          |

  New: `editing.newRowsSticky` (entered rows scroll by default), row
  `data-dirty`, entry-row `data-new` / `data-confirmed`, parts `row-state` /
  `revert-row`, `edit.state.rows[id].values`, labels `revertRow` /
  `rowStateNew` / `rowStateEdited` / `rowStateDeleted`, `--dg-row-new-bg`.
  The edit lane now appears under draft mode without `onCommitDrafts`.

  Fixed: Restore on a deletion-marked row was unclickable in real browsers
  (`pointer-events`).

## 2.0.0-beta.1

### Major Changes

- [`c662c8a`](https://github.com/Jielga/TMDataGrid/commit/c662c8a36e97bea7e47f58dea437555d1690df3f) Thanks [@Psvensso](https://github.com/Psvensso)! - The editing options of `useTMDataGrid` are namespaced under one `editing`
  object, matching the 2.0 `meta.edit` column namespacing.

  - `editMode: X` becomes `editing: { mode: X }`
  - `onEditCommit` becomes `editing.onCommit`
  - `onEditCommitBatch` becomes `editing.onCommitBatch`
  - `rowValidators`, `isRowEditable`, `newRowDefaults`, `onRowAdd` and
    `onRowDelete` keep their names and move inside `editing`
  - `getRowId` stays top-level and is still required once `editing` is set

  `TMDataGridEditingOptions` is now the type of the `editing` object itself.
  `TMDataGridEditMode`, the `edit` engine and the feature flags are unchanged.

### Minor Changes

- [#28](https://github.com/Jielga/TMDataGrid/pull/28) [`acd8b0c`](https://github.com/Jielga/TMDataGrid/commit/acd8b0cdc1adfd8682f16d07a488a5375826a2d0) Thanks [@Psvensso](https://github.com/Psvensso)! - Generated lanes are no longer user settings.

  - The checkbox and edit lanes are `enableHiding: false`, like the other three.
  - "Manage columns" lists only hideable columns; a column with
    `enableHiding: false` is left out rather than shown disabled.
  - Show/hide all writes only the columns it lists. It used
    `table.toggleAllColumnsVisible`, which writes every leaf column: "show all"
    published the tree column and "hide all" forced it visible.
  - A column pinned right lands to the left of the edit lane.
  - A stale `columnVisibility` entry for a generated lane - persisted before
    this release, or passed in `initialState` - is dropped at mount and on
    Reset layout, since nothing in the grid could bring the lane back.

  New export: `keepGeneratedColumnsOutermost`, `isGeneratedColumn`.

### Patch Changes

- [#28](https://github.com/Jielga/TMDataGrid/pull/28) [`acc190b`](https://github.com/Jielga/TMDataGrid/commit/acc190b169792f36e673453c3440c62071fe55e9) Thanks [@Psvensso](https://github.com/Psvensso)! - `--dg-radius` sets the frame's corner radius, defaulting to
  `--mantine-radius-md`.

  ```tsx
  <TMDataGrid {...grid} style={{ "--dg-radius": 0 }} />
  ```

- [#28](https://github.com/Jielga/TMDataGrid/pull/28) [`aa3aeac`](https://github.com/Jielga/TMDataGrid/commit/aa3aeac4b84fafed7b95072cccfb4f056741699d) Thanks [@Psvensso](https://github.com/Psvensso)! - `meta.autoSize` waits for the column's first cells.

  It ran once on the mounting commit, so a grid whose rows are fetched had a
  header and no cells to measure and the column kept that width. The
  double-click gesture and the **Autosize column** menu item are unchanged.

## 2.0.0-beta.0

### Major Changes

- [#22](https://github.com/Jielga/TMDataGrid/pull/22) [`b2110d4`](https://github.com/Jielga/TMDataGrid/commit/b2110d4a6b30e788b33755d4ce9e64847a920817) Thanks [@Psvensso](https://github.com/Psvensso)! - **Breaking.** Column meta groups its editing and filtering fields into two
  namespaces, `meta.edit` and `meta.filter`, named after the `edit` engine and the
  filter panel they configure. A new `meta.edit.mapValue` maps a value on its way
  into the draft, and the deprecated `autoFocus` on the editor contract is gone.

  Column meta had grown flat across four concerns at once, so a field name had to
  carry its own stage: `editable` and `filterControl` sat beside `label` and
  `align` with nothing but the prefix to say which part of the grid read them.
  Grouping them puts what a column **is** at the top level and what a stage
  **does** with it inside that stage's namespace, and it mirrors the runtime API,
  where editing has been `edit.begin()` / `edit.commit()` / `edit.store` all along.

  | Before                       | After                         |
  | ---------------------------- | ----------------------------- |
  | `meta.editable`              | `meta.edit.enabled`           |
  | `meta.editField`             | `meta.edit.field`             |
  | `meta.editor`                | `meta.edit.editor`            |
  | `meta.validate`              | `meta.edit.validate`          |
  | `meta.filterControl`         | `meta.filter.control`         |
  | `meta.defaultFilterOperator` | `meta.filter.defaultOperator` |

  ```tsx
  // Before
  meta: { type: "number", defaultFilterOperator: "between", editable: false }

  // After
  meta: {
    type: "number",
    filter: { defaultOperator: "between" },
    edit: { enabled: false },
  }
  ```

  `meta.type` and `meta.options` stay at the top level: one declaration of each
  feeds the filter panel and the cell editor alike, and moving either into a
  namespace would mean declaring it twice. Every old field is a compile error
  after the upgrade, so `tsc` names each site to change.

  **`meta.edit.mapValue`** maps every value an editor writes, before it reaches
  the draft: uppercase a code, strip spaces from an IBAN, clamp a number into
  range. It runs per write, so a text input maps per keystroke and a select per
  pick, and what it returns is what the cell shows, what the validators judge and
  what commits.

  ```tsx
  meta: {
    edit: {
      mapValue: ({ value }) =>
        typeof value === "string" ? value.toUpperCase() : value,
    },
  }
  ```

  The map is applied in the editor host, around the field every editor writes
  through, so one declaration covers the six built-in editors, a custom
  `meta.edit.editor`, and the character that opened the editor when typing started
  the edit. The value an editor opens with is deliberately not mapped, since that
  would rewrite stored data nobody edited and swallow the select-all that lets the
  first keystroke replace the value; neither is `edit.clearCell()`, which writes
  the type's empty value through the form rather than through an editor. The
  built-in string and number editors keep the caret where it was typed across a
  mapped write, which a hand-rolled editor previously had to solve for itself.

  **`TMDataGridEditorArgs.autoFocus` is removed**, as 1.1.1 said it would be. The
  grid has placed the caret itself since then, so an editor that ignored the prop
  already behaved correctly and one that honoured it loses nothing. A row opened
  by `edit.addRow()` now gets the same treatment: its caret lands in the first
  editable cell whether that cell holds a built-in editor or your own, which the
  old `autoFocus` path only managed for the built-ins.

  New exported types: `TMDataGridColumnEditOptions`, `TMDataGridColumnFilterOptions`,
  `TMDataGridEditValueMap` and `TMDataGridEditValueMapArgs`. New exported readers:
  `getColumnFilterControl` and `isColumnEditableForRow`.

## 1.1.1

### Patch Changes

- [`ae6305e`](https://github.com/Jielga/TMDataGrid/commit/ae6305e5c7ab069aa1571711a2ce60b2d1b8054d) Thanks [@Psvensso](https://github.com/Psvensso)! - Fix the row context menu never opening on a pinned row.

  `renderRowContextMenu` resolved its target against the body rows only, and pinning takes a row out of those - so a right-click at either edge opened nothing, and a row pinned without an unpin control of its own was stuck there. Under cell selection the same right-click also moved the range onto a row that sits out the range, clearing the selection it should have left alone.

- [`26be712`](https://github.com/Jielga/TMDataGrid/commit/26be712e5e565004f13352ced0e1b20da577c476) Thanks [@Psvensso](https://github.com/Psvensso)! - Fix `editMode: "row"` refusing to open a second row, and open gestures leaving the caret outside the editor.

  - Rows now **accumulate**, as they already did under `"cellConfirm"` and `"batch"`. Opening a second row left the first alone only while it was pristine: a dirty row silently swallowed the gesture, so neither the pencil nor a double-click did anything until that row was saved or cancelled, and a pristine one was discarded to make space. Each row's ✓ and ✕ have always acted on that row alone, and now nothing about one row's draft bears on another's.
  - **Every open gesture puts the caret in the cell it named**, and the grid places it rather than leaving it to the editor's `autoFocus`. Double-click, Enter and F2 on any cell but the row's first landed the caret on the cell instead of in its input - a Tab was still needed to reach it - and a custom `meta.editor` that ignored the prop never got the caret at all, in any mode. Focus goes to `data-dg-part="editor-input"` when the editor publishes it, and to the first focusable element inside the editor otherwise.
  - The caret is placed once per gesture, so a row coming back into view no longer pulls it out of the row the user had moved it to.

  `TMDataGridEditorArgs.autoFocus` is **deprecated** and still passed: the grid no longer depends on it, and it will go in the next major. `edit.begin({ rowId, columnId })` is unchanged for callers - row mode opens the whole row either way, and `columnId` now says which cell takes the caret, `null` leaving it to the row's first editable one. `edit.state.openRowIds` is which rows are editing.

## 1.1.0

### Minor Changes

- [#18](https://github.com/Jielga/TMDataGrid/pull/18) [`62d0cbc`](https://github.com/Jielga/TMDataGrid/commit/62d0cbc2f098ef1f59aa1888f4181075fbb481a7) Thanks [@Psvensso](https://github.com/Psvensso)! - **Breaking.** Every render surface is now a `render*` prop over one typed args object, and the chrome slots hand over the pieces of what they replace instead of only the data behind it.

  - `TMDataGrid.Footer`'s `pagination` becomes **`renderPagination`**, and its argument becomes `{ state, actions, Controls }`. The flat `TMDataGridPaginationApi` members split across `state` (`pageIndex`, `pageSize`, `pageCount`, `rowCount`, `canPreviousPage`, `canNextPage`, plus the new `isPagingActive`, `from` and `to`) and `actions` (`setPageIndex`, `setPageSize`, `previousPage`, `nextPage`, `firstPage`, `lastPage`). `Controls.PageSize`, `Controls.Range` and `Controls.Pager` are the built-in pieces, so a custom pager keeps the parts it likes rather than rebuilding them. `getTMDataGridPaginationApi(table)` returns the same `{ state, actions }` shape.
  - `TMDataGrid.Table`'s `rowContextMenu` becomes **`renderRowContextMenu`**, and the type `TMDataGridRowContextMenu` becomes `TMDataGridRowContextMenuRenderer`. Its args gain `internalItems`: reading it hands the composition over, so the menu is exactly what you return; ignoring it keeps today's behavior, the grid's copy and export items above a divider and yours below.
  - `TMDataGrid.Table` gains **`renderColumnMenuItems`**, which receives `{ column, table, internalItems }` and returns the full item list. Returning an empty list leaves the column with no menu button.
  - `TMDataGrid.EditActions` gains **`renderActions`**, over `{ state, actions, Controls }` with `state.pendingCount`, `state.isSubmitting` and the built-in `Controls.Save` / `Controls.Discard`.

  Migrating: `pagination={(api) => …}` becomes `renderPagination={({ state, actions }) => …}` with `api.pageIndex` reading as `state.pageIndex` and `api.nextPage()` as `actions.nextPage()`; `rowContextMenu={…}` becomes `renderRowContextMenu={…}` with the same arguments.

## 1.0.2

### Patch Changes

- [`f227e3c`](https://github.com/Jielga/TMDataGrid/commit/f227e3c22636770882691cd979a161ffd7851e5b) Thanks [@Psvensso](https://github.com/Psvensso)! - The shipped intent skills are one per docs topic: twelve replacing six, with new `editing`, `rows`, `filtering`, `cell-selection`, `grouping`, `data` and `appearance` skills and `features` dissolved into them. Three inherited errors are corrected along the way - the selection options were documented under the names they had before `selectionMode` and `showSelectedBackground`, the sorting docs taught TanStack v8's `sortingFn` rather than v9's `sortFn`, and `sorting` was described as a settings slice when it persists under `dataKey`.

## 1.0.1

### Patch Changes

- [#15](https://github.com/Jielga/TMDataGrid/pull/15) [`c83d4eb`](https://github.com/Jielga/TMDataGrid/commit/c83d4ebfd93f021b3c26e959a023ac272281db1f) Thanks [@Psvensso](https://github.com/Psvensso)! - The grid's own labels render as `span` rather than `p`, so a grid placed inside prose - a docs page, a CMS body, Mantine's `Typography` - no longer inherits paragraph margins that pushed the toolbar count and the pager off centre.

## 1.0.0

### Major Changes

- [`14f4c4d`](https://github.com/Jielga/TMDataGrid/commit/14f4c4d351b73ad983fe314333c18b54de0bc922) Thanks [@Psvensso](https://github.com/Psvensso)! - Types: the editing options are now a discriminated union. BREAKING for TypeScript consumers who passed an editing callback without `editMode`, `onEditCommitBatch` outside `editMode: "batch"`, or `editMode` without `getRowId` — all previously broken at runtime, now compile errors.

- [`3f5269c`](https://github.com/Jielga/TMDataGrid/commit/3f5269c3cefd6b7c19856a8120d93dc5547a2a19) Thanks [@Psvensso](https://github.com/Psvensso)! - Fuzzy quick search by default: `TMDataGrid.Search` now forgives typos and skipped characters, and while it is the only thing narrowing the grid the rows order by match quality. `quickSearchMode: "contains"` restores the old substring matching; an explicit `globalFilterFn` overrides both. Adds `@tanstack/match-sorter-utils` as a dependency.

- [`9f83cbc`](https://github.com/Jielga/TMDataGrid/commit/9f83cbc554b96b8bca1365414e8ff35e4a4aee6f) Thanks [@Psvensso](https://github.com/Psvensso)! - Persisted payloads gain a version stamp and are realigned against the current column set on restore. BREAKING: layouts stored by 0.x builds carry no stamp and are dropped once — users start from the default layout after upgrading.

- [`b2f3207`](https://github.com/Jielga/TMDataGrid/commit/b2f3207b9d40ecc5375c925b3cfb7fdc3f631cfa) Thanks [@Psvensso](https://github.com/Psvensso)! - The 1.0 wave opens. Beta releases may break API between versions; every break is named in its changeset. First changes: persisted layouts written by 0.x are dropped once (the payload gains a version field).

### Minor Changes

- [`6f1b4db`](https://github.com/Jielga/TMDataGrid/commit/6f1b4dbdf548f22a47937443d278309ee9564379) Thanks [@Psvensso](https://github.com/Psvensso)! - Adding and deleting rows: `edit.addRow()` opens a sticky entry block of editors under the header, `edit.deleteRow` reports immediately or marks for batch; `newRowDefaults`, `onRowAdd`, `onRowDelete`, and `submitAll` batches carrying `added`/`deleted`.

- [`5bcde97`](https://github.com/Jielga/TMDataGrid/commit/5bcde97ddafd6db915dcfe9d16659dadee570c26) Thanks [@Psvensso](https://github.com/Psvensso)! - Batch editing: drafts accumulate until `edit.submitAll()`, `TMDataGrid.EditActions` toolbar chrome, optional `onEditCommitBatch` for one save call covering every dirty row.

- [`7a8c056`](https://github.com/Jielga/TMDataGrid/commit/7a8c056535d2c97979cfbdc1b1077470f8e66d6e) Thanks [@Psvensso](https://github.com/Psvensso)! - `between` filter operator for `number` and `date` columns — an inclusive `[min, max]` pair, either end open when empty; the panel renders a From/To pair. `meta.defaultFilterOperator` picks the operator a fresh filter starts with. New labels: `filterFrom`, `filterTo`, `operators.between`.

- [`4b1985f`](https://github.com/Jielga/TMDataGrid/commit/4b1985ff8b1da5b0ddf2d33d23b99ede424f2e25) Thanks [@Psvensso](https://github.com/Psvensso)! - `onCellClick`, `onCellDoubleClick` and `onCellContextMenu` on `TMDataGrid.Table` — `{ cell, row, column, event }`, composing with selection, editing and the context menu rather than replacing them.

- [`abaa3dc`](https://github.com/Jielga/TMDataGrid/commit/abaa3dc8e534763ded5ba31780c89b895c67667b) Thanks [@Psvensso](https://github.com/Psvensso)! - Cell editing (`editMode: "cell"`): one TanStack Form per editing row, built-in editors per column type, `meta.validate` / `rowValidators` with Standard Schema support, `meta.editor` for a custom editor, keyboard entry and `onEditCommit`. Adds `@tanstack/react-form` as a peer dependency.

- [`b39eece`](https://github.com/Jielga/TMDataGrid/commit/b39eece6d8a31b5dd6529137f4a16b2b502ae7ff) Thanks [@Psvensso](https://github.com/Psvensso)! - `@jielga/tmdatagrid/styles.layer.css`: the stylesheet wrapped in `@layer tmdatagrid`, for consumers who state their cascade order.

- [`ce9a3f8`](https://github.com/Jielga/TMDataGrid/commit/ce9a3f83c92295511c4df6bda197b20a2fa4199d) Thanks [@Psvensso](https://github.com/Psvensso)! - Editing modes `cellConfirm` (✓/✕ beside the input, drafts survive blur) and `row` (generated edit lane pinned right, whole-row commit, cross-field `rowValidators` errors on the Save).

- [`c8acb31`](https://github.com/Jielga/TMDataGrid/commit/c8acb312ffeaf19867e8a5c4db644cde7d0c1a9c) Thanks [@Psvensso](https://github.com/Psvensso)! - `meta.editor` takes a component, rendered as JSX so hooks are legal inside it. It receives the live TanStack Form field alongside the table context (`TMDataGridEditorComponent`, `TMDataGridEditorArgs`); define one at module scope so its identity is stable across renders.

- [`da28796`](https://github.com/Jielga/TMDataGrid/commit/da2879624129d65683ced7e2c3c11b9eaf75ebaf) Thanks [@Psvensso](https://github.com/Psvensso)! - Empty states: `renderEmptyState` on `TMDataGrid.Table` replaces the built-in empty messages, with `hasActiveFilters` distinguishing filtered-empty from truly-empty. A grid with no data and no filters now says `labels.noRows` ("No rows to show") instead of claiming filters matched nothing.

- [`9984dcd`](https://github.com/Jielga/TMDataGrid/commit/9984dcd44f850a692242bb4b015e000e85c22731) Thanks [@Psvensso](https://github.com/Psvensso)! - Custom filter controls: `meta.filterControl` replaces the filter panel's value slot with a component receiving the value-only `TMDataGridFilterControlArgs` contract — it reads the operator, writes the bare value, and the grid composes the stored filter. Four built-ins ship as named exports (`DgRangeSliderFilter`, `DgDateRangeFilter`, `DgAutocompleteFilter`, `DgTriStateFilter`), plus `TMDataGridFilterValueInput`, the default control, for fallbacks. New label: `filterAll`.

- [`992b7c1`](https://github.com/Jielga/TMDataGrid/commit/992b7c16544db4590ff18dd2563866b444c5596b) Thanks [@Psvensso](https://github.com/Psvensso)! - Match highlighting: `enableMatchHighlighting` marks the matched text in default-rendered cells while a contains-family filter or the quick search is active. Contiguous occurrences only — a fuzzy typo-match shows no highlight — and columns with their own `cell` renderer opt out by existing. Colour via `--dg-match-highlight-bg`.

- [`2f105bf`](https://github.com/Jielga/TMDataGrid/commit/2f105bf7336c7d4860c0304b218f8049320b5294) Thanks [@Psvensso](https://github.com/Psvensso)! - Per-row styling on `TMDataGrid.Table`: `rowClassName` and `rowStyle` (value or function of the row), and `striped` — stripes computed from view position so virtualization cannot shift them. Row colours go through `--row-bg`, keeping hover, selection and pinned cells intact.

- [`59d63ab`](https://github.com/Jielga/TMDataGrid/commit/59d63abbce1d33a6e3c451b8a2a004f43c187c0f) Thanks [@Psvensso](https://github.com/Psvensso)! - `resetSettings()` on the api resets visibility, order, widths, pinning and grouping to a clean first visit; the columns panel's Reset button becomes "Reset layout" and calls it, scope stated in its tooltip.

- [`a5a0daf`](https://github.com/Jielga/TMDataGrid/commit/a5a0dafd5376979e64256d866ec613914aeeb1e7) Thanks [@Psvensso](https://github.com/Psvensso)! - `enableRowNumbers`: a generated row-number gutter, outermost left — numbers the current view, continues across pages, leaves group rows unnumbered, never exports.

- [`64eece3`](https://github.com/Jielga/TMDataGrid/commit/64eece393bf886cbe7edb21b427637b32bfe5283) Thanks [@Psvensso](https://github.com/Psvensso)! - Row pinning: `enableRowPinning` (boolean or per-row predicate) lets `row.pin("top" | "bottom" | false)` hold rows in sticky edge blocks — top under the header, bottom above the summary row — outside the scrolling order. Pinned rows survive filtering and paging, stale pinned ids are skipped rather than thrown on, and group rows never pin.

- [`db99330`](https://github.com/Jielga/TMDataGrid/commit/db9933015a68a7e9b2e5ef4ec30530ab9c9915ad) Thanks [@Psvensso](https://github.com/Psvensso)! - `TMDataGrid.Table`'s `rowStyle` accepts CSS custom properties, and the type behind it is exported as `TMDataGridRowStyle`. Setting `--row-bg` is the documented way to colour a row, but the prop was typed as plain `CSSProperties`, so the documented usage did not compile.

- [`9d15d5e`](https://github.com/Jielga/TMDataGrid/commit/9d15d5eda4b763c91cbf903e04dcb7064f3c9f8a) Thanks [@Psvensso](https://github.com/Psvensso)! - Scroll edges: a scroll-driven shadow under the sticky header while rows are beneath it (`--dg-header-shadow-color`), and `onScrollToTop/Bottom/Left/Right` on `TMDataGrid.Table`, firing once per edge arrival.

- [#13](https://github.com/Jielga/TMDataGrid/pull/13) [`64f48cd`](https://github.com/Jielga/TMDataGrid/commit/64f48cddfe3f95cbaebd2968901ff88f04942b3f) Thanks [@Psvensso](https://github.com/Psvensso)! - `scrollToRow({ rowId, align })` on the api returned by `useTMDataGrid`. The grid is always virtualized, so a row far down the list has no element to scroll to — this moves the virtualizer instead. Answers `false` when the row is not in the current view (filtered out, on another page, or an unknown id) and scrolls nothing; a pinned row answers `true` without scrolling.

- [#13](https://github.com/Jielga/TMDataGrid/pull/13) [`f48a8cc`](https://github.com/Jielga/TMDataGrid/commit/f48a8cca13e5b48d90445899211399a4fc5a087d) Thanks [@Psvensso](https://github.com/Psvensso)! - A published testing contract, so a suite is written against structure rather than translated `aria-label`s. Every named piece of the grid carries `data-dg-part` — the chrome, panels, generated lanes and editors — narrowed by `data-row-id` / `data-column-id` where a part repeats. `data-testid` and `id` on `<TMDataGrid>` and `aria-label` on `TMDataGrid.Table` name a grid when a page holds several. Body cells always carry `data-row-id`, headers now carry `data-column-id`, and the grid publishes `aria-busy` and `data-dg-row-count` for tests to wait on. New Testing docs page covers the parts, the roles and Playwright.

### Patch Changes

- [#13](https://github.com/Jielga/TMDataGrid/pull/13) [`573bea5`](https://github.com/Jielga/TMDataGrid/commit/573bea54022fd3b5d62573db8487b0ceafb64500) Thanks [@Psvensso](https://github.com/Psvensso)! - Center the empty/loading state in the visible scrollport, not the full column-track width, so it stays centered under horizontal scroll.

- [#13](https://github.com/Jielga/TMDataGrid/pull/13) [`184b1e8`](https://github.com/Jielga/TMDataGrid/commit/184b1e847a7ef41f62f0ac558138f1d8a293dcfd) Thanks [@Psvensso](https://github.com/Psvensso)! - Getting started docs: add installation (peer deps, beta pin note, MantineProvider) and import from the package name. The demo site now opens on it as a front page.

- [`6c7b71c`](https://github.com/Jielga/TMDataGrid/commit/6c7b71c35bfc808cd849ff039c381bf8eff2f232) Thanks [@Psvensso](https://github.com/Psvensso)! - Docs: `rowSelectionMode`/`highlightSelectedRows` corrected to the shipped `selectionMode` (four modes) and `showSelectedBackground`.

- [`e85772e`](https://github.com/Jielga/TMDataGrid/commit/e85772e8fb151ff0853816bb6969964a0c327728) Thanks [@Psvensso](https://github.com/Psvensso)! - A sorted column's header no longer tints — the sort arrow carries it, in the primary colour while the sort holds and faded grey as the hover affordance on an unsorted column. Filtered headers still tint; `data-active` still means sorted-or-filtered.

## 1.0.0-beta.0

### Major Changes

- [`14f4c4d`](https://github.com/Jielga/TMDataGrid/commit/14f4c4d351b73ad983fe314333c18b54de0bc922) Thanks [@Psvensso](https://github.com/Psvensso)! - Types: the editing options are now a discriminated union. BREAKING for TypeScript consumers who passed an editing callback without `editMode`, `onEditCommitBatch` outside `editMode: "batch"`, or `editMode` without `getRowId` — all previously broken at runtime, now compile errors.

- [`3f5269c`](https://github.com/Jielga/TMDataGrid/commit/3f5269c3cefd6b7c19856a8120d93dc5547a2a19) Thanks [@Psvensso](https://github.com/Psvensso)! - Fuzzy quick search by default: `TMDataGrid.Search` now forgives typos and skipped characters, and while it is the only thing narrowing the grid the rows order by match quality. `quickSearchMode: "contains"` restores the old substring matching; an explicit `globalFilterFn` overrides both. Adds `@tanstack/match-sorter-utils` as a dependency.

- [`9f83cbc`](https://github.com/Jielga/TMDataGrid/commit/9f83cbc554b96b8bca1365414e8ff35e4a4aee6f) Thanks [@Psvensso](https://github.com/Psvensso)! - Persisted payloads gain a version stamp and are realigned against the current column set on restore. BREAKING: layouts stored by 0.x builds carry no stamp and are dropped once — users start from the default layout after upgrading.

- [`b2f3207`](https://github.com/Jielga/TMDataGrid/commit/b2f3207b9d40ecc5375c925b3cfb7fdc3f631cfa) Thanks [@Psvensso](https://github.com/Psvensso)! - The 1.0 wave opens. Beta releases may break API between versions; every break is named in its changeset. First changes: persisted layouts written by 0.x are dropped once (the payload gains a version field).

### Minor Changes

- [`6f1b4db`](https://github.com/Jielga/TMDataGrid/commit/6f1b4dbdf548f22a47937443d278309ee9564379) Thanks [@Psvensso](https://github.com/Psvensso)! - Adding and deleting rows: `edit.addRow()` opens a sticky entry block of editors under the header, `edit.deleteRow` reports immediately or marks for batch; `newRowDefaults`, `onRowAdd`, `onRowDelete`, and `submitAll` batches carrying `added`/`deleted`.

- [`5bcde97`](https://github.com/Jielga/TMDataGrid/commit/5bcde97ddafd6db915dcfe9d16659dadee570c26) Thanks [@Psvensso](https://github.com/Psvensso)! - Batch editing: drafts accumulate until `edit.submitAll()`, `TMDataGrid.EditActions` toolbar chrome, optional `onEditCommitBatch` for one save call covering every dirty row.

- [`7a8c056`](https://github.com/Jielga/TMDataGrid/commit/7a8c056535d2c97979cfbdc1b1077470f8e66d6e) Thanks [@Psvensso](https://github.com/Psvensso)! - `between` filter operator for `number` and `date` columns — an inclusive `[min, max]` pair, either end open when empty; the panel renders a From/To pair. `meta.defaultFilterOperator` picks the operator a fresh filter starts with. New labels: `filterFrom`, `filterTo`, `operators.between`.

- [`4b1985f`](https://github.com/Jielga/TMDataGrid/commit/4b1985ff8b1da5b0ddf2d33d23b99ede424f2e25) Thanks [@Psvensso](https://github.com/Psvensso)! - `onCellClick`, `onCellDoubleClick` and `onCellContextMenu` on `TMDataGrid.Table` — `{ cell, row, column, event }`, composing with selection, editing and the context menu rather than replacing them.

- [`abaa3dc`](https://github.com/Jielga/TMDataGrid/commit/abaa3dc8e534763ded5ba31780c89b895c67667b) Thanks [@Psvensso](https://github.com/Psvensso)! - Cell editing (`editMode: "cell"`): one TanStack Form per editing row, built-in editors per column type, `meta.validate` / `rowValidators` with Standard Schema support, `meta.editor` for a custom editor, keyboard entry and `onEditCommit`. Adds `@tanstack/react-form` as a peer dependency.

- [`b39eece`](https://github.com/Jielga/TMDataGrid/commit/b39eece6d8a31b5dd6529137f4a16b2b502ae7ff) Thanks [@Psvensso](https://github.com/Psvensso)! - `@jielga/tmdatagrid/styles.layer.css`: the stylesheet wrapped in `@layer tmdatagrid`, for consumers who state their cascade order.

- [`ce9a3f8`](https://github.com/Jielga/TMDataGrid/commit/ce9a3f83c92295511c4df6bda197b20a2fa4199d) Thanks [@Psvensso](https://github.com/Psvensso)! - Editing modes `cellConfirm` (✓/✕ beside the input, drafts survive blur) and `row` (generated edit lane pinned right, whole-row commit, cross-field `rowValidators` errors on the Save).

- [`c8acb31`](https://github.com/Jielga/TMDataGrid/commit/c8acb312ffeaf19867e8a5c4db644cde7d0c1a9c) Thanks [@Psvensso](https://github.com/Psvensso)! - `meta.editor` takes a component, rendered as JSX so hooks are legal inside it. It receives the live TanStack Form field alongside the table context (`TMDataGridEditorComponent`, `TMDataGridEditorArgs`); define one at module scope so its identity is stable across renders.

- [`da28796`](https://github.com/Jielga/TMDataGrid/commit/da2879624129d65683ced7e2c3c11b9eaf75ebaf) Thanks [@Psvensso](https://github.com/Psvensso)! - Empty states: `renderEmptyState` on `TMDataGrid.Table` replaces the built-in empty messages, with `hasActiveFilters` distinguishing filtered-empty from truly-empty. A grid with no data and no filters now says `labels.noRows` ("No rows to show") instead of claiming filters matched nothing.

- [`9984dcd`](https://github.com/Jielga/TMDataGrid/commit/9984dcd44f850a692242bb4b015e000e85c22731) Thanks [@Psvensso](https://github.com/Psvensso)! - Custom filter controls: `meta.filterControl` replaces the filter panel's value slot with a component receiving the value-only `TMDataGridFilterControlArgs` contract — it reads the operator, writes the bare value, and the grid composes the stored filter. Four built-ins ship as named exports (`DgRangeSliderFilter`, `DgDateRangeFilter`, `DgAutocompleteFilter`, `DgTriStateFilter`), plus `TMDataGridFilterValueInput`, the default control, for fallbacks. New label: `filterAll`.

- [`992b7c1`](https://github.com/Jielga/TMDataGrid/commit/992b7c16544db4590ff18dd2563866b444c5596b) Thanks [@Psvensso](https://github.com/Psvensso)! - Match highlighting: `enableMatchHighlighting` marks the matched text in default-rendered cells while a contains-family filter or the quick search is active. Contiguous occurrences only — a fuzzy typo-match shows no highlight — and columns with their own `cell` renderer opt out by existing. Colour via `--dg-match-highlight-bg`.

- [`2f105bf`](https://github.com/Jielga/TMDataGrid/commit/2f105bf7336c7d4860c0304b218f8049320b5294) Thanks [@Psvensso](https://github.com/Psvensso)! - Per-row styling on `TMDataGrid.Table`: `rowClassName` and `rowStyle` (value or function of the row), and `striped` — stripes computed from view position so virtualization cannot shift them. Row colours go through `--row-bg`, keeping hover, selection and pinned cells intact.

- [`59d63ab`](https://github.com/Jielga/TMDataGrid/commit/59d63abbce1d33a6e3c451b8a2a004f43c187c0f) Thanks [@Psvensso](https://github.com/Psvensso)! - `resetSettings()` on the api resets visibility, order, widths, pinning and grouping to a clean first visit; the columns panel's Reset button becomes "Reset layout" and calls it, scope stated in its tooltip.

- [`a5a0daf`](https://github.com/Jielga/TMDataGrid/commit/a5a0dafd5376979e64256d866ec613914aeeb1e7) Thanks [@Psvensso](https://github.com/Psvensso)! - `enableRowNumbers`: a generated row-number gutter, outermost left — numbers the current view, continues across pages, leaves group rows unnumbered, never exports.

- [`64eece3`](https://github.com/Jielga/TMDataGrid/commit/64eece393bf886cbe7edb21b427637b32bfe5283) Thanks [@Psvensso](https://github.com/Psvensso)! - Row pinning: `enableRowPinning` (boolean or per-row predicate) lets `row.pin("top" | "bottom" | false)` hold rows in sticky edge blocks — top under the header, bottom above the summary row — outside the scrolling order. Pinned rows survive filtering and paging, stale pinned ids are skipped rather than thrown on, and group rows never pin.

- [`db99330`](https://github.com/Jielga/TMDataGrid/commit/db9933015a68a7e9b2e5ef4ec30530ab9c9915ad) Thanks [@Psvensso](https://github.com/Psvensso)! - `TMDataGrid.Table`'s `rowStyle` accepts CSS custom properties, and the type behind it is exported as `TMDataGridRowStyle`. Setting `--row-bg` is the documented way to colour a row, but the prop was typed as plain `CSSProperties`, so the documented usage did not compile.

- [`9d15d5e`](https://github.com/Jielga/TMDataGrid/commit/9d15d5eda4b763c91cbf903e04dcb7064f3c9f8a) Thanks [@Psvensso](https://github.com/Psvensso)! - Scroll edges: a scroll-driven shadow under the sticky header while rows are beneath it (`--dg-header-shadow-color`), and `onScrollToTop/Bottom/Left/Right` on `TMDataGrid.Table`, firing once per edge arrival.

- [#13](https://github.com/Jielga/TMDataGrid/pull/13) [`64f48cd`](https://github.com/Jielga/TMDataGrid/commit/64f48cddfe3f95cbaebd2968901ff88f04942b3f) Thanks [@Psvensso](https://github.com/Psvensso)! - `scrollToRow({ rowId, align })` on the api returned by `useTMDataGrid`. The grid is always virtualized, so a row far down the list has no element to scroll to — this moves the virtualizer instead. Answers `false` when the row is not in the current view (filtered out, on another page, or an unknown id) and scrolls nothing; a pinned row answers `true` without scrolling.

- [#13](https://github.com/Jielga/TMDataGrid/pull/13) [`f48a8cc`](https://github.com/Jielga/TMDataGrid/commit/f48a8cca13e5b48d90445899211399a4fc5a087d) Thanks [@Psvensso](https://github.com/Psvensso)! - A published testing contract, so a suite is written against structure rather than translated `aria-label`s. Every named piece of the grid carries `data-dg-part` — the chrome, panels, generated lanes and editors — narrowed by `data-row-id` / `data-column-id` where a part repeats. `data-testid` and `id` on `<TMDataGrid>` and `aria-label` on `TMDataGrid.Table` name a grid when a page holds several. Body cells always carry `data-row-id`, headers now carry `data-column-id`, and the grid publishes `aria-busy` and `data-dg-row-count` for tests to wait on. New Testing docs page covers the parts, the roles and Playwright.

### Patch Changes

- [#13](https://github.com/Jielga/TMDataGrid/pull/13) [`573bea5`](https://github.com/Jielga/TMDataGrid/commit/573bea54022fd3b5d62573db8487b0ceafb64500) Thanks [@Psvensso](https://github.com/Psvensso)! - Center the empty/loading state in the visible scrollport, not the full column-track width, so it stays centered under horizontal scroll.

- [#13](https://github.com/Jielga/TMDataGrid/pull/13) [`184b1e8`](https://github.com/Jielga/TMDataGrid/commit/184b1e847a7ef41f62f0ac558138f1d8a293dcfd) Thanks [@Psvensso](https://github.com/Psvensso)! - Getting started docs: add installation (peer deps, beta pin note, MantineProvider) and import from the package name. The demo site now opens on it as a front page.

- [`6c7b71c`](https://github.com/Jielga/TMDataGrid/commit/6c7b71c35bfc808cd849ff039c381bf8eff2f232) Thanks [@Psvensso](https://github.com/Psvensso)! - Docs: `rowSelectionMode`/`highlightSelectedRows` corrected to the shipped `selectionMode` (four modes) and `showSelectedBackground`.

## 0.5.0

### Minor Changes

- [`394b6c3`](https://github.com/Jielga/TMDataGrid/commit/394b6c380ae74969b233f7a5c144dbf327e2e3fa) Thanks [@Psvensso](https://github.com/Psvensso)! - Column autosizing: double-click the resize divider, an Autosize menu item, `meta.autoSize`, and an exported `autosizeColumn` helper.

- [`d0c6e0f`](https://github.com/Jielga/TMDataGrid/commit/d0c6e0f09250df9820a6daab8a3929573fdaa2d1) Thanks [@Psvensso](https://github.com/Psvensso)! - Cell selection: `cellSelection: "single"` gives the body a cell cursor moved
  with the arrow keys, `"range"` adds a rectangle selected by dragging, Shift+click
  or Shift+arrows. Ctrl+C copies the block as tab-separated text, so a paste lands
  in Excel's cells, and right-clicking it offers an Excel-compatible CSV export
  with an optional header row.

  The state is `ui.state.focusedCell` and `ui.state.cellRange`, both held as
  `{ rowId, columnId }` pairs. On, the grid reports `role="grid"` with `gridcell`
  children and the body becomes one tab stop: controls inside body cells take
  `tabindex="-1"`, reached with Enter or F2 instead. `useCellControlTabIndex()`
  does the same for a custom cell's controls.

  The generated lanes are selectable and navigable but never exported. Space ticks
  the row from any of its cells, which is what the checkbox's lost tab stop is
  replaced with.

- [`d399522`](https://github.com/Jielga/TMDataGrid/commit/d39952276c6bead9d63cef9bf6d1519436b73046) Thanks [@Psvensso](https://github.com/Psvensso)! - Add `TMDataGrid.Search`, a debounced quick-search input over the global filter, plus a `canSearch` capability.

- [`2a50690`](https://github.com/Jielga/TMDataGrid/commit/2a506907a38f011a58d5476d4f0db7025016215d) Thanks [@Psvensso](https://github.com/Psvensso)! - Add `buildGridCellMatrix` and `exportGridToCsv` for exporting the whole filtered grid, all pages, to Excel CSV.

- [`8f51c2a`](https://github.com/Jielga/TMDataGrid/commit/8f51c2a1c0db69b116a3ff720b945e4ee1740d56) Thanks [@Psvensso](https://github.com/Psvensso)! - Add `onReachEnd` on `TMDataGrid.Table` for infinite scroll, with a demo page.

- [`c876388`](https://github.com/Jielga/TMDataGrid/commit/c876388e0e73014b0230b9aea3879861c6d2baa8) Thanks [@Psvensso](https://github.com/Psvensso)! - Add a `labels` option: every string in the grid can be overridden, merged over the English defaults (`TMDATAGRID_LABELS_EN`).

- [`1072980`](https://github.com/Jielga/TMDataGrid/commit/10729801e4b3c01354a13252fcecbdf8e744b6ae) Thanks [@Psvensso](https://github.com/Psvensso)! - Add `TMDataGrid.LoadingIndicator`, a toolbar spinner for refetches that keep rows on screen.

- [`f9809e5`](https://github.com/Jielga/TMDataGrid/commit/f9809e5a3c6b442f913225c208f2e935fc2d9753) Thanks [@Psvensso](https://github.com/Psvensso)! - Shift+click adds a column to the sort; sorted headers show their priority while more than one column sorts.

- [`6503e7d`](https://github.com/Jielga/TMDataGrid/commit/6503e7ddfa5f6e2854dbd93a64ca5bece606a14c) Thanks [@Psvensso](https://github.com/Psvensso)! - Render a sticky summary row from column `footer` definitions, with an `aggregateColumn` helper over the filtered rows.

- [`df00c06`](https://github.com/Jielga/TMDataGrid/commit/df00c06ef06f59d1d8758abb4f0ad36684a277c6) Thanks [@Psvensso](https://github.com/Psvensso)! - Ship a complete Swedish dictionary as `TMDATAGRID_LABELS_SV`.

- [`9a47802`](https://github.com/Jielga/TMDataGrid/commit/9a478022331a53498d378df80fe458db53dec729) Thanks [@Psvensso](https://github.com/Psvensso)! - Column types boolean, date, select and multiSelect, with typed filter operators and value controls; `meta.options` + `resolveColumnOptions`. `TMDataGridFilterValue.value` widens to `string | ReadonlyArray<string>`.

### Patch Changes

- [`883579d`](https://github.com/Jielga/TMDataGrid/commit/883579d8d8ce5c0203806451d3227fc931fab095) Thanks [@Psvensso](https://github.com/Psvensso)! - Right-clicking a column header opens the same menu as the ⋮ button, at the
  pointer. Headers without a menu — the checkbox and details lanes — keep the
  browser's own.

## 0.4.0

### Minor Changes

- [`e6d35bf`](https://github.com/Jielga/TMDataGrid/commit/e6d35bf988e39d09887ff7b5b4e96372cb9fc583) Thanks [@Psvensso](https://github.com/Psvensso)! - `overscan` on `useTMDataGrid` sets how many rows the virtualizer keeps mounted
  above and below the viewport. Defaults to 6, the value that was hard-coded.

- [#8](https://github.com/Jielga/TMDataGrid/pull/8) [`da5da07`](https://github.com/Jielga/TMDataGrid/commit/da5da07db6d682f1e48dc44c5c36791249ea88f6) Thanks [@Psvensso](https://github.com/Psvensso)! - Row details: set `renderDetails` and an expanded row opens a panel underneath
  it, spanning every column. Panels are measured, so they can be any height —
  `renderDetailsEstHeight` is only what the virtualizer assumes before it has seen
  one. The option also adds a generated chevron lane (`DETAILS_COLUMN_ID`), pinned
  left after the checkbox and tree columns, whose header expands and collapses
  every panel.

  `resolveExpandAll` and `areAllRowsExpanded` are exported for building your own
  expand-all: TanStack keeps one `expanded` state for both group rows and detail
  panels, and these keep a control for one from disturbing the other.

  The checkbox and details lanes are now 36px and render no resize handle, and
  their cells carry `data-control-column` in place of `data-select-column`. Pinned
  column edges only show while they are covering something, and no longer draw a
  hard border.

## 0.3.0

### Minor Changes

- [#7](https://github.com/Jielga/TMDataGrid/pull/7) [`254709d`](https://github.com/Jielga/TMDataGrid/commit/254709d01df66936bedf1b2ac11bcc45eda13f5a) Thanks [@Psvensso](https://github.com/Psvensso)! - Filter panel: a "Filters" header with a close button, Escape and a click outside
  to dismiss, and a "Clear all" next to "Add filter", which is now disabled once
  every filterable column has a filter.

  New `TMDataGrid.FilterPills` (also exported as `TMDataGridFilterPills`) — one
  pill per active filter, `First name: Sofia ✕`, with the ✕ clearing that filter
  and a click on the label reopening the panel on its column. It takes the grid as
  an `api` prop instead of reading context, so it can be rendered outside the
  grid. `formatFilterLabel` is exported for building your own.

- [#6](https://github.com/Jielga/TMDataGrid/pull/6) [`9f39544`](https://github.com/Jielga/TMDataGrid/commit/9f39544ac48f8fc1f20e656aa79ebe9d364ab719) Thanks [@Psvensso](https://github.com/Psvensso)! - Add `rowContextMenu` to `TMDataGrid.Table`: a render prop that fills a Mantine
  `Menu` the grid opens at the pointer on a right-click or long press. It receives
  `{ table, row, cell, close }`, and returning `null` leaves a row without a menu.
  `rowContextMenuProps` passes through to the `Menu`. The open row carries
  `data-context-menu`.

- [#7](https://github.com/Jielga/TMDataGrid/pull/7) [`040e4b3`](https://github.com/Jielga/TMDataGrid/commit/040e4b3f49c2f1f7be285ee299a568629d7bce88) Thanks [@Psvensso](https://github.com/Psvensso)! - Row grouping. **Group by X** in any column menu collapses the rows into a tree;
  the grouped column leaves the grid and a generated **Group** column takes its
  place, pinned beside the checkbox lane, showing each group's value, its record
  count and a chevron. Group from a second menu to nest. **Ungroup** lives on the
  tree column's menu, and **Expand/Collapse all groups** in every column menu. On
  by default, off under `manualPagination`; `enableGrouping: false` disables it.

  Aggregation is opt-in — a group row is blank until a column declares an
  `aggregationFn`. A group's checkbox selects every record under it at any depth,
  and only the records reach `rowSelection`. `grouping` persists with the settings
  slices, `expanded` with the data slices.

  Grouping suspends the built-in pager, which greys itself out rather than
  disappearing: a page cannot count both rows and groups without stranding part of
  the tree. `isPagingActive` is exported for custom pagers.

  Also fixes a hidden column leaving an empty grid track behind, from the column
  tracks being built from all leaf columns while the cells came from the visible
  ones.

- [#4](https://github.com/Jielga/TMDataGrid/pull/4) [`f947272`](https://github.com/Jielga/TMDataGrid/commit/f947272d7db6bcf78464050a89359f96ce57bacc) Thanks [@Psvensso](https://github.com/Psvensso)! - Add `selectionMode`, replacing `rowSelectionMode`: `"checkbox"` (the default),
  `"row"`, `"checkboxAndHighlight"` and `"highlight"`. The last two introduce a
  highlighted row — state of its own, so a checkbox multi-selection and a single
  highlighted row can coexist for a detail panel. Row-click selection gains the
  usual Ctrl/Shift modifiers, and the select-all box is dropped under
  `enableMultiRowSelection: false`, where it selected every row.

  Breaking renames:

  - `rowSelectionMode` → `selectionMode` (`"checkbox"` and `"row"` unchanged)
  - `highlightSelectedRows` → `showSelectedBackground`
  - `data-highlighted` → `data-selected-bg`; `data-highlighted` now marks the
    highlighted row
  - New `--dg-row-highlight-bg` alongside `--dg-row-selected-bg`

### Patch Changes

- [#7](https://github.com/Jielga/TMDataGrid/pull/7) [`620a739`](https://github.com/Jielga/TMDataGrid/commit/620a739e10f3d73e77c5bd61aafd73721d4d226a) Thanks [@Psvensso](https://github.com/Psvensso)! - Fix the checkbox being clipped in the select column at `size="xl"`. The column
  is a fixed 48px track, which the cell padding — 18px a side at `xl` — left too
  little room for. It no longer takes that padding and centres its box instead.

## 0.2.0

### Minor Changes

- [`c98a857`](https://github.com/Jielga/TMDataGrid/commit/c98a85747a03b8cfc36aa859aa40a61190f320e9) Thanks [@Psvensso](https://github.com/Psvensso)! - Make pagination opt-in via `enablePagination` (implied by `manualPagination`);
  by default all rows render, virtualized. `TMDataGrid.Footer` gains a
  `pagination` render prop for custom pagers.

- [`c98a857`](https://github.com/Jielga/TMDataGrid/commit/c98a85747a03b8cfc36aa859aa40a61190f320e9) Thanks [@Psvensso](https://github.com/Psvensso)! - Add `rowSelectionMode`. `"checkbox"` (the default) keeps the checkbox column;
  `"row"` drops it and toggles a row on click. `highlightSelectedRows` controls
  the selected-row background and follows the mode. Fixes the selection
  checkboxes not re-rendering when a row was selected.

### Patch Changes

- [`20c68ee`](https://github.com/Jielga/TMDataGrid/commit/20c68eeaa7d4ba9034f1c49b59ac253619da9e8b) Thanks [@Psvensso](https://github.com/Psvensso)! - Debounce persistence writes so a column resize no longer writes to storage on
  every pointer move, and drop restored state that fails a shape check instead of
  feeding it to the table. The footer's page-size Select now keeps a current size
  that is not in `pageSizeOptions` rather than rendering blank, and headers expose
  `aria-sort` alongside `aria-rowcount` / `aria-colcount` / `aria-rowindex` on the
  virtualized grid.

## 0.1.0

### Minor Changes

- [`e8090a4`](https://github.com/Jielga/TMDataGrid/commit/e8090a480f1fd944edecace2fd7d415b20b84244) Thanks [@Psvensso](https://github.com/Psvensso)! - Add column reordering. Drag a header to move a column, or move it a step at a
  time from the column menu. Order is respected per pinned region and persists
  through the `columnOrder` slice.

- [`280baf8`](https://github.com/Jielga/TMDataGrid/commit/280baf89e98c6cd5be087273c6532d3df3dcce3a) Thanks [@Psvensso](https://github.com/Psvensso)! - Ship agent skills with the package via TanStack Intent. Five skills under
  `skills/` — getting started, columns, options, features and server-side data —
  are published in the tarball, so coding agents read current guidance for the
  installed version straight from `node_modules` instead of relying on whatever
  their training data happened to include.
