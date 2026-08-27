# Components and hooks

Every hook and component the package exports, with its props.
The options `useTMDataGrid` takes are on [useTMDataGrid](/docs/use-tm-data-grid).

```tsx
import { TMDataGrid, useTMDataGrid } from "@jielga/tmdatagrid";
```

The parts of the grid are reached through the `TMDataGrid` object.
`TMDataGridSearch`, `TMDataGridFilterPills`, `TMDataGridDraftActions`, the editors and the filter controls are also exported by name; the remaining parts are available only as `TMDataGrid.Part`.

## useTMDataGrid

Creates the table instance, the UI store and the edit engine.
Spread its result onto `TMDataGrid`:

```tsx
const grid = useTMDataGrid({ data, columns });

<TMDataGrid {...grid}>
  <TMDataGrid.Table />
</TMDataGrid>;
```

`useTMDataGrid<TData>(options: UseTMDataGridOptions<TData>): TMDataGridApi<TData>`

| Field | Type | What it is |
| --- | --- | --- |
| `table` | `TMDataGridTable<TData>` | The TanStack table instance. State lives in `table.store`. |
| `ui` | `TMDataGridUiStore` | Panels, drag state, focused cell and cell range. |
| `edit` | `TMDataGridEditApi` | The [editing engine](/docs/editing). Inert until `editing` is set. |
| `features` | `TMDataGridFeatureFlags` | Feature switches, re-read from the options on every render. |
| `labels` | `TMDataGridLabels` | The [dictionary](/docs/localization), merged over the English defaults. |
| `renderDetails` | `TMDataGridDetailsRenderer<TData> \| undefined` | The [details renderer](/docs/row-details), passed through to the Table. |
| `renderDetailsEstHeight` | `number` | The option, or `160`. |
| `overscan` | `number` | The option, or `6`. |
| `resetSettings` | `() => void` | Puts visibility, order, widths, pinning and grouping back to a first visit. |
| `scrollToRow` | `({ rowId, align? }) => boolean` | Scrolls a row into view. Returns `false` when the row is not in the current view. |

## useTMDataGridContext

Returns the grid from inside a component rendered under `TMDataGrid`.
It throws when called outside one.

```tsx
const { table, labels, controlSize } = useTMDataGridContext();
```

The value carries every field `useTMDataGrid` returns, plus three resolved from `size`:

| Field | Type | What it is |
| --- | --- | --- |
| `size` | `TMDataGridSize` | The `size` prop set on `TMDataGrid`. |
| `rowHeight` | `number` | Row height in pixels, from `size` and `meta.rowHeight`. |
| `controlSize` | `TMDataGridSize` | The Mantine control size that pairs with `size`. |

## useCellControlTabIndex

Returns the `tabIndex` for a control inside a body cell: `-1` while [cell selection](/docs/cell-selection) is on, `0` otherwise.
Set it on any interactive element you render in a cell, so the grid keeps one tab stop instead of one per mounted row.

```tsx
<Checkbox tabIndex={useCellControlTabIndex()} />
```

`useCellControlTabIndex(): 0 | -1`

## TMDataGrid

The root element.
It provides the grid to every part through context, and takes every field `useTMDataGrid` returns alongside these props:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | – | The grid's parts, in render order. |
| `size` | `TMDataGridSize` | `"md"` | The [size scale](/docs/styling). |
| `className` · `style` · `id` | `string` · `CSSProperties` · `string` | – | Set on the root element. Give the grid a bounded height. |
| `data-testid` | `string` | – | Names the grid for [tests](/docs/testing). Set it when a page holds more than one grid. |

## TMDataGrid.Table

The scrollable surface: the header, the virtualized body and the filter panel.
Pass the row type so the handlers are typed:

```tsx
<TMDataGrid.Table<Employee> onRowClick={(row) => open(row.original.id)} />
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `onRowClick` | `(row) => void` | – | Called when a body row is clicked. Rows show a pointer cursor when set. See [Clicks and context menus](/docs/row-interaction). |
| `onCellClick` · `onCellDoubleClick` · `onCellContextMenu` | `(args: TMDataGridCellEventArgs) => void` | – | Called on cell click, double-click and right-click. Receive `{ cell, row, column, event }`. |
| `renderRowContextMenu` | `TMDataGridRowContextMenuRenderer` | – | Contents of a row's context menu. Receives `{ table, row, cell, close, internalItems }`. |
| `rowContextMenuProps` | `Omit<MenuProps, "opened" \| "onChange" \| "children">` | – | Props passed to the Mantine `Menu` behind the context menu. |
| `renderColumnMenuItems` | `TMDataGridColumnMenuItemsRenderer` | – | Contents of a column's menu. Returning an empty array leaves the column with no menu button. See [Visibility, pinning and size](/docs/column-layout). |
| `rowClassName` | `string \| (row) => string` | – | Class for a body row. See [Row styling](/docs/row-styling). |
| `rowStyle` | `TMDataGridRowStyle \| (row) => TMDataGridRowStyle` | – | Inline style for a body row. Set `--row-bg` rather than `background`. |
| `striped` | `boolean` | `false` | If set, every second row takes `--dg-row-striped-bg`. |
| `onScrollToTop` · `onScrollToBottom` · `onScrollToLeft` · `onScrollToRight` | `() => void` | – | Called once on arriving at that edge, not on mount and not per scroll event. See [Scrolling](/docs/scrolling). |
| `onReachEnd` | `() => void` | – | Called as the scroll nears the last row, once per row count. Sorting and filtering must be server-side. See [Server-side data](/docs/server-side). |
| `reachEndThreshold` | `number` | `10` | Rows before the end at which `onReachEnd` fires. |
| `renderEmptyState` | `({ hasActiveFilters, table }) => ReactNode` | – | Replaces both built-in empty messages. See [Loading and empty](/docs/loading-and-empty). |
| `cellExport` | `TMDataGridCellExportOptions` | `DEFAULT_CELL_EXPORT_OPTIONS` | Separator, decimal mark, headers and file name for the CSV. See [Cell selection](/docs/cell-selection). |
| `aria-label` · `aria-labelledby` | `string` | – | The grid's accessible name, announced on entry and matched by `getByRole("grid", { name })`. |

Note that `onReachEnd` and `enablePagination` slice the same scroll: the pager caps the rows, so the end reached is the page's.
Setting both logs a warning.

## TMDataGrid.Toolbar

A flex row above the grid. See [Toolbar](/docs/toolbar).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | – | The toolbar's contents, in render order. |

## TMDataGrid.Spacer

Pushes the toolbar items after it to the right.

No props.

## TMDataGrid.Search

A debounced quick-search input that writes the grid's global filter.
It renders nothing when no column is searchable. See [Quick search](/docs/quick-search).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `placeholder` | `string` | `labels.searchPlaceholder` | Placeholder text. |
| `debounce` | `number` | `250` | Milliseconds between the last keystroke and the filter being written. |
| `w` | `number \| string` | `220` | Width of the input. |

## TMDataGrid.FilterButton

Opens the filter panel on the first filterable column, and closes it again.
It renders nothing when no column can be filtered. See [Filtering](/docs/filtering).

No props.

## TMDataGrid.FilterPanel

The filter rows: a column, an operator and a value control for each active filter.
`TMDataGrid.Table` renders it; render it yourself only for a custom layout.

No props.

## TMDataGrid.ColumnsButton

A popover holding `TMDataGrid.ColumnsPanel`.
It renders nothing when no column can be hidden. See [Visibility, pinning and size](/docs/column-layout).

No props.

## TMDataGrid.ColumnsPanel

A searchable checkbox list of the hideable columns, with a show-all toggle and a reset button.
`TMDataGrid.ColumnsButton` renders it; render it yourself only for a custom layout.

No props.

## TMDataGrid.LoadingIndicator

A spinner, shown while `meta.loading` is `true`. See [Loading and empty](/docs/loading-and-empty).

No props.

## TMDataGrid.SummaryCount

The row count, as shown over total.
The total comes from `meta.totalRowCount` when set, and from the unfiltered row count otherwise.
While a column is grouped the shown count includes the group rows and the total keeps counting records, so `42 / 42` reads `48 / 42` under six groups; pass `children` to show a count of your own.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | – | Replaces the count with your own text. |

## TMDataGrid.DraftActions

Save and Discard for pending edits.
It renders nothing unless `editing` is set. See [Editing](/docs/editing).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `renderActions` | `(args: TMDataGridDraftActionsSlotArgs) => ReactNode` | – | Replaces both buttons. Receives `{ state, actions, Controls }`. |

The slot argument carries the state, the two operations and the built-in buttons:

| Field | Type | What it is |
| --- | --- | --- |
| `state.draftCount` | `number` | Rows parked in the draft store - what Save sends. |
| `state.openCount` | `number` | Rows still open, not part of a save. |
| `state.pendingCount` | `number` | **Deprecated** - reads as `draftCount + openCount`. |
| `state.isSubmitting` | `boolean` | `true` while a submit is in flight. |
| `actions.save` | `() => Promise<boolean>` | Saves the draft store. Open rows are left alone. |
| `actions.commitAll` | `() => Promise<boolean>` | Submits every open row. Resolves `false` when one stayed open. |
| `actions.discard` | `() => void` | Drops everything - open form state and the draft store alike. |
| `Controls.Save` · `Controls.Discard` · `Controls.OpenRowsNote` | `() => ReactNode` | The built-in pieces, to place in your own layout. |

## TMDataGrid.Footer

The pager bar: rows per page, the current range, and previous and next.
It renders nothing when pagination is off. See [Pagination](/docs/pagination).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `pageSizeOptions` | `ReadonlyArray<number>` | `[10, 25, 50, 100]` | The choices in the rows-per-page select. |
| `renderPagination` | `(args: TMDataGridPaginationSlotArgs) => ReactNode` | – | Replaces the pager. Receives `{ state, actions, Controls }`. |

The slot argument holds the paging state, its operations and the built-in controls:

| Field | Type | What it is |
| --- | --- | --- |
| `state` | `TMDataGridPaginationState` | `pageIndex`, `pageSize`, `pageCount`, `rowCount`, `canPreviousPage`, `canNextPage`, `isPagingActive`, and the 1-based `from` and `to`. |
| `actions` | `TMDataGridPaginationActions` | `setPageIndex`, `setPageSize`, `previousPage`, `nextPage`, `firstPage`, `lastPage`. |
| `Controls.PageSize` · `Controls.Range` · `Controls.Pager` | `() => ReactNode` | The three built-in controls, to place in your own layout. |

`pageCount` is `-1` when a manual grid declares an unknown total, and `isPagingActive` is `false` while a grouping suspends paging.
`getTMDataGridPaginationApi(table, isPaging?)` returns the same `state` and `actions` for a pager built outside the grid.

## TMDataGridFilterPills

The active filters as removable pills, with a clear-all button.
It takes the grid as a prop rather than from context, so it can be rendered outside `TMDataGrid`.
It renders nothing when no filter is active. See [Filtering](/docs/filtering).

```tsx
<TMDataGridFilterPills api={grid} />
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `api` | `TMDataGridApi<TData>` | – | Required. The object returned by `useTMDataGrid`. |
| `size` | `TMDataGridSize` | `"sm"` | Size of the pills. |
| `showClearAll` | `boolean` | `true` | If set, a clear-all button follows the pills once more than one filter is active. |
| `onPillClick` | `(columnId: string) => void` | – | Called when a pill is clicked. If not set, the filter panel opens on that column. |
| `className` | `string` | – | Set on the wrapper element. |

Also available as `TMDataGrid.FilterPills`.

## Editors

The control a cell opens for editing.
The grid picks one from the column's `meta.type`, and `meta.edit.editor` replaces it. See [Editors and validation](/docs/editors).

| Component | Renders | Used for `meta.type` |
| --- | --- | --- |
| `TMDataGridStringEditor` | Mantine `TextInput` | `"string"` |
| `TMDataGridNumberEditor` | `NumberInput`, writing `null` for an empty cell | `"number"` |
| `TMDataGridBooleanEditor` | `Checkbox` | `"boolean"` |
| `TMDataGridDateEditor` | `TextInput` with `type="date"` | `"date"` |
| `TMDataGridSelectEditor` | `Select`, committing on pick in `"cell"` mode | `"select"` |
| `TMDataGridMultiSelectEditor` | `MultiSelect`, committing on Enter or blur | `"multiSelect"` |

Every editor takes the same argument object, `TMDataGridEditorArgs`, so a custom editor can wrap a built-in rather than replace it:

| Field | Type | What it is |
| --- | --- | --- |
| `field` | `TMDataGridEditField` | The TanStack Form field for this cell. |
| `form` | `TMDataGridRowEditForm` | The whole row form, for an editor that reads sibling fields. |
| `cell` · `row` · `column` · `table` | TanStack instances | The cell being edited and its surroundings. |
| `commit` | `() => Promise<boolean>` | Commits the edit, as Enter would. |
| `cancel` | `() => void` | Drops the draft, as Escape would. |
| `size` | `TMDataGridSize` | The grid's resolved control size. |
| `seedText` | `string \| undefined` | Set when typing opened the editor. |

## Filter controls

The value control in a filter row.
The grid picks one from the column's `meta.type` and the current operator, and `meta.filter.control` replaces it. See [Filtering](/docs/filtering).

| Component | Renders | Suits |
| --- | --- | --- |
| `TMDataGridFilterValueInput` | A text input, a multi-select, a boolean select or a from/to pair, by operator | Every column. This is the default. |
| `DgRangeSliderFilter` | `RangeSlider` bounded by the values in the data | `number` columns with `between` |
| `DgDateRangeFilter` | Two `type="date"` inputs | `date` columns with `between` |
| `DgAutocompleteFilter` | `Autocomplete` over the column's values | Text columns with a scalar operator |
| `DgTriStateFilter` | `SegmentedControl` of all, true and false | `boolean` columns |

Each of the four specialised controls falls back to `TMDataGridFilterValueInput` for the operators it does not handle.
Every control takes the same argument object, `TMDataGridFilterControlArgs`:

| Field | Type | What it is |
| --- | --- | --- |
| `column` · `table` | TanStack instances | The column being filtered, and the table. |
| `operator` | `TMDataGridFilterOperator` | The row's selected operator. A control reads it and never writes it. |
| `value` | `string \| ReadonlyArray<string>` | The bare filter value, never the `{ operator, value }` wrapper. |
| `onChange` | `(next: string \| ReadonlyArray<string>) => void` | Writes the bare value. The grid pairs it with the current operator. |
| `options` | `ReadonlyArray<TMDataGridOption>` | The column's options, resolved for a column declaring `meta.options` or a select type. Empty otherwise. |
| `size` | `TMDataGridSize` | The grid's resolved control size. |
| `labels` | `TMDataGridLabels` | The resolved dictionary. |

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `useTMDataGrid` | Hook | `(options) => TMDataGridApi` | – | Creates the table, UI store and edit engine. |
| `useTMDataGridContext` | Hook | `() => TMDataGridContextValue` | – | The grid, from inside any part. Throws outside `TMDataGrid`. |
| `useCellControlTabIndex` | Hook | `() => 0 \| -1` | – | The `tabIndex` for a control inside a body cell. |
| `TMDataGrid` | Component | – | – | The root element. Provides the grid through context. |
| `TMDataGrid.Table` | Component | – | – | Header, virtualized body and filter panel. |
| `TMDataGrid.Toolbar` · `.Spacer` | Components | – | – | The toolbar row, and the gap that pushes items right. |
| `TMDataGrid.Search` | Component | – | – | Quick search input. Also `TMDataGridSearch`. |
| `TMDataGrid.FilterButton` · `.FilterPanel` | Components | – | – | The filter UI. |
| `TMDataGrid.ColumnsButton` · `.ColumnsPanel` | Components | – | – | Column visibility, and Reset layout. |
| `TMDataGrid.LoadingIndicator` · `.SummaryCount` | Components | – | – | Fetch spinner, and the row count. |
| `TMDataGrid.DraftActions` | Component | – | – | Save and Discard. Also `TMDataGridDraftActions`. |
| `TMDataGrid.Footer` | Component | – | – | The pager bar. |
| `TMDataGrid.FilterPills` | Component | – | – | Active filters as pills. Also `TMDataGridFilterPills`. |
| `getTMDataGridPaginationApi` | Function | `(table, isPaging?) => TMDataGridPaginationApi` | `isPaging`: `true` | Paging state and actions for a pager of your own. |
| `DEFAULT_CELL_EXPORT_OPTIONS` | Constant | `TMDataGridCellExportOptions` | – | The CSV defaults `cellExport` merges over. |
