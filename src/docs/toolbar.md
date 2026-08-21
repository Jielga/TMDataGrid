# Toolbar composition

The toolbar is a flex row. There is no slots API, no `actions` prop and no
configuration object: your buttons sit beside the built-in ones because they are
all children of the same element.

```tsx
<TMDataGrid.Toolbar>
  <TMDataGrid.SummaryCount />
  <TMDataGrid.Spacer />
  <TMDataGrid.LoadingIndicator />
  <Button size="xs" variant="light" onClick={exportAll}>
    Export
  </Button>
  <TMDataGrid.FilterButton />
  <TMDataGrid.ColumnsButton />
</TMDataGrid.Toolbar>
```

`TMDataGrid.Spacer` pushes everything after it to the right.

```demo
file: customization/ToolbarComposition.tsx
extraSources: data/employeeColumns.tsx
```

Only the parts you render exist. A grid with no `Toolbar` has no toolbar; a
toolbar with only `Search` has only a search box.

## The built-in parts

| Component | Shows |
| --- | --- |
| `TMDataGrid.Search` | The [quick search](/docs/quick-search) input |
| `TMDataGrid.FilterButton` | Opens the [filter panel](/docs/filtering), with the active count |
| `TMDataGrid.ColumnsButton` | Opens the [columns panel](/docs/column-layout#hiding) |
| `TMDataGrid.SummaryCount` | Visible rows out of total |
| `TMDataGrid.LoadingIndicator` | A spinner while `meta.loading` |
| `TMDataGrid.Spacer` | Pushes what follows to the right |
| `TMDataGridEditActions` | Save and Discard under [batch editing](/docs/editing#batch-editing) |

Each renders nothing when its feature is off, so a read-only grid needs no
conditionals in the toolbar: `FilterButton` under `enableColumnFilters: false`
renders nothing at all.

## Buttons of your own

A button that acts on the grid reads it from context:

```tsx
import { useTMDataGridContext } from "@jielga/tmdatagrid";

function ExportButton() {
  const { table } = useTMDataGridContext();
  return (
    <Button size="xs" onClick={() => exportGridToCsv({ table })}>
      Export
    </Button>
  );
}
```

Anything rendered inside `TMDataGrid` can call it. It returns
`{ table, ui, features, labels, controlSize, resetSettings }`.

### Hiding a button the same way the built-ins do

The built-in parts disappear when their feature is off. Your own can use the
same checks instead of re-deriving them:

```tsx
import { getGridCapabilities, useTMDataGridContext } from "@jielga/tmdatagrid";

function ExportButton() {
  const { table, features } = useTMDataGridContext();
  const { canFilterAny } = getGridCapabilities(table, features);

  if (!canFilterAny) return null;
  // …
}
```

| Field | True when |
| --- | --- |
| `canSortAny` | At least one leaf column can be sorted |
| `canFilterAny` | At least one leaf column can be filtered |
| `canHideAny` | At least one leaf column can be hidden |
| `canPinAny` | At least one leaf column can be pinned |
| `canReorderAny` | At least one leaf column can be moved |
| `canGroupAny` | At least one leaf column can be grouped on |
| `canSelectRows` | `enableRowSelection` is not `false` and the mode is not `"highlight"` |
| `canPaginate` | Paging is configured. See [`isPagingActive`](/docs/pagination#grouping-suspends-it) for whether it is slicing anything |
| `canSearch` | At least one leaf column takes part in the quick search |

`getColumnCapabilities(column, features)` returns the same for one column, as
`canSort`, `canFilter`, `canHide`, `canPin`, `canResize`, `canReorder` and
`canGroup`.

### Why `features` is a second argument

`features` is returned by `useTMDataGrid` and re-derived from the options object
on every render. It is required **in addition to** TanStack's `getCanX()`
methods because it is what makes the result reactive.

`column.getCanSort()` is a method call on a column object whose identity is
preserved across an options change. Under the React Compiler that call is
memoized, so a grid whose `enableSorting` changed to `false` would carry on
rendering sort indicators. Passing `features` supplies a value that *changes*,
while `getCanX()` still decides the outcome and applies per-column overrides.

The same rule applies elsewhere in your application: read state through
`useSelector(table.store, …)` and options through `features`, rather than
calling methods on a long-lived object.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `TMDataGrid.Toolbar` | Component | `children` | – | The flex row above the grid. |
| `TMDataGrid.Spacer` | Component | – | – | Pushes what follows to the right. |
| `TMDataGrid.FilterButton` | Component | – | – | Opens the filter panel, with an active count. |
| `TMDataGrid.ColumnsButton` | Component | – | – | Opens the columns panel. |
| `useTMDataGridContext` | Hook | `() => TMDataGridContextValue` | – | `{ table, ui, features, labels, controlSize, resetSettings }`. |
| `getGridCapabilities` | Export | `(table, features) => TMDataGridCapabilities` | – | What this grid can do. Reactive to option changes. |
| `getColumnCapabilities` | Export | `(column, features) => TMDataGridColumnCapabilities` | – | The same for one column. |
| `readFeatureFlags` | Export | `(options) => TMDataGridFeatureFlags` | – | Derives the flags from an options object. |
