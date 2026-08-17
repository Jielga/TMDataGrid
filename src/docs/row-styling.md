# Row styling

Colouring rows by what is in them - an overdue invoice red, a draft greyed, a
terminated employee struck through.

```tsx
<TMDataGrid.Table<Employee>
  rowStyle={(row) =>
    row.original.status === "Terminated" ? { "--row-bg": "var(--mantine-color-red-0)" } : undefined
  }
/>
```

```demo
file: rows/RowStyling.tsx
hint: Select and hover a coloured row - both still read through the row background.
```

## Set `--row-bg`, not `background`

This is the one rule worth knowing. A row is not a single element - it is a
strip of cells, some of them sticky in pinned lanes - and several things paint
on top of it: hover, selection, the highlight, the cell range, striping.

Setting `background` wins over all of them, so a coloured row stops responding
to being hovered or selected. Setting `--row-bg` feeds the variable those
layers are composed against, and everything keeps working on top of your
colour.

```tsx
rowStyle={() => ({ background: "pink" })}          // hover and selection die
rowStyle={() => ({ "--row-bg": "pink" })}          // both still read
```

`rowStyle` accepts `CSSProperties` or an object of custom properties - the type
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

Pinned rows sit striping out - they have left the scrolling order, so there is
no "every second" for them to be part of.

## Styling by state

Rows carry data attributes for everything the grid knows about them, so a
stylesheet can reach any of it without a callback:

| Attribute | On |
| --- | --- |
| `data-selected` | Selected rows |
| `data-selected-bg` | Selected rows that also take the background |
| `data-highlighted` | The highlighted row |
| `data-grouped` | Group rows |
| `data-depth` | Every row - the nesting level |
| `data-context-menu` | The row whose context menu is open |
| `data-row-id` | Every row - its id, which is what [tests](/docs/testing) key off |

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
