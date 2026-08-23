# Row styling

Colouring rows by their contents, such as an overdue invoice in red.

```tsx
<TMDataGrid.Table<Employee>
  rowStyle={(row) =>
    row.original.status === "Terminated" ? { "--row-bg": "var(--mantine-color-red-0)" } : undefined
  }
/>
```

```demo
file: rows/RowStyling.tsx
hint: Select and hover a coloured row - both still show through the row background.
```

## Set the row background

Set `--row-bg` rather than `background`. Hover, selection, the highlight, the
cell range and striping each add a background over the row and are composed
against `--row-bg`; `background` overrides all of them, so a coloured row stops
responding to hover and selection.

```tsx
rowStyle={() => ({ background: "pink" })}          // hover and selection hidden
rowStyle={() => ({ "--row-bg": "pink" })}          // both still show
```

`rowStyle` accepts `CSSProperties` or an object of custom properties. The type
is a union, so a callback returning either compiles.

## Classes instead

`rowClassName` takes the same shape and adds to the grid's own classes, for
when the styling belongs in a stylesheet:

```tsx
<TMDataGrid.Table<Invoice>
  rowClassName={(row) => (row.original.overdue ? classes.overdue : undefined)}
/>
```

```css
.overdue {
  --row-bg: var(--mantine-color-red-0);
  font-weight: 600;
}
```

## Striping

`striped` gives every second row `--dg-row-striped-bg`. Striping follows the
row's **position in the view**, so it survives sorting, filtering and
virtualization rather than sticking to particular records.

```tsx
<TMDataGrid.Table striped />
```

Pinned rows are not striped: they have left the scrolling order.

## Styling by state

Rows carry data attributes for their state, so a stylesheet can target any of
it without a callback:

| Attribute | On |
| --- | --- |
| `data-selected` | Selected rows |
| `data-selected-bg` | Selected rows that also take the background |
| `data-highlighted` | The highlighted row |
| `data-grouped` | Group rows |
| `data-depth` | Every row. The nesting level |
| `data-context-menu` | The row whose context menu is open |
| `data-row-id` | Every row. Its id, which [tests](/docs/testing) key off |

```css
[data-dg-part="row"][data-grouped] {
  --row-bg: var(--mantine-color-gray-0);
  font-weight: 600;
}
```

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `rowStyle` | Table prop | `TMDataGridRowStyle \| (row) => TMDataGridRowStyle` | – | Inline style for a body row. |
| `rowClassName` | Table prop | `string \| (row) => string \| undefined` | – | Class for a body row, added after the grid's own. |
| `striped` | Table prop | `boolean` | `false` | Every second row takes `--dg-row-striped-bg`. |
| `TMDataGridRowStyle` | Export | type | – | `CSSProperties` or an object of `--*` custom properties. |
| `--row-bg` | CSS variable | colour | – | The row's own background, composed under hover, selection and range. |
| `--dg-row-striped-bg` | CSS variable | colour | Themed | The stripe colour. |
| `--dg-row-height` | CSS variable | length | From `size` | Row height. `meta.rowHeight` is the supported way to change it. |
