# Scrolling and virtualization

Virtualization is **always on**. There is no flag and no threshold: only the
rows within the viewport, plus a small overscan, are mounted, at any row
count.

```tsx
const grid = useTMDataGrid({ data, columns }); // 200 rows or 200 000
```

## Overscan

How many rows stay mounted on each side of the viewport. Defaults to `6`.

```tsx
const grid = useTMDataGrid({ data, columns, overscan: 12 });
```

Raise it if a fast scroll flashes blank rows; lower it when rows are expensive
to render.

## Row height

Taken from `meta.rowHeight`, or from the `size` prop when that is not set. Rows
are **fixed height**, so the virtualizer's estimate is exact and the scrollbar
does not drift as you scroll.

```tsx
const grid = useTMDataGrid({ data, columns, meta: { rowHeight: 64 } });
```

[Row details](/docs/row-details) are the exception: a row showing a panel is as
tall as the panel, so those rows are measured after they mount.
`renderDetailsEstHeight` is what the virtualizer assumes for one it has not
measured yet. A grid without `renderDetails` mounts no observers.

## Scrolling to a row

```tsx
const { scrollToRow } = useTMDataGrid({ data, columns, getRowId });

scrollToRow({ rowId: "42", align: "center" });
```

Under virtualization the target row may not be mounted, so
`element.scrollIntoView()` cannot find it. `align` is `"start"`, `"center"`,
`"end"` or `"auto"`, which scrolls only if the row is out of view.

`scrollerRef` is the scroll container itself, for anything the helper does not
cover.

## Edge callbacks

`TMDataGrid.Table` reports arrivals at each edge, firing **once** when the
scroll reaches it rather than on every scroll event:

```tsx
<TMDataGrid.Table
  onScrollToBottom={() => console.log("at the end")}
  onScrollToRight={() => console.log("at the last column")}
/>
```

For loading more rows, use [`onReachEnd`](/docs/server-side#infinite-scroll)
instead. It fires a number of rows before the bottom, and latches per row count
so a pending fetch is not requested twice.

## The depth cues

Two soft shadows, both scroll-driven animations run on the compositor, with no
scroll listener, no state and no React render.

**Under the header.** Once body rows scroll beneath the sticky header, a shadow
appears along its bottom edge, indicating rows above the viewport. A grid with
nothing to scroll shows none. `--dg-header-shadow-color` recolours it.

**Beside a pinned lane.** A [pinned column](/docs/column-layout#pinning) casts a
band over the data next to it, and only while it is covering content: it fades
in over the first 20px of horizontal scroll and fades out again at the far
end.

Both use `animation-timeline: scroll(…)`. Where that is unsupported, the
header's own border draws the boundary and the pinned band is always on.

## Reference

| Name | Kind | Type | Default | What it does |
| --- | --- | --- | --- | --- |
| `overscan` | Option | `number` | `6` | Rows kept mounted beyond each edge of the viewport. |
| `meta.rowHeight` | Option | `number` | From `size` | Row height, in pixels. The virtualizer needs a number. |
| `scrollToRow` | Hook return | `({ rowId, align? }) => void` | `align: "auto"` | Scrolls a row into view, mounted or not. |
| `scrollerRef` | Hook return | `RefObject<HTMLDivElement>` | – | The scroll container. |
| `onScrollToTop` · `onScrollToBottom` · `onScrollToLeft` · `onScrollToRight` | Table props | `() => void` | – | Fire once on arriving at that edge. |
| `TMDataGridScrollAlign` | Export | `"start" \| "center" \| "end" \| "auto"` | – | The `align` argument. |
| `--dg-header-shadow-color` | CSS variable | colour | Themed | The shadow under the sticky header. |
| `--dg-sticky-edge-range` | CSS variable | length | `20px` | How far the pinned-lane band takes to fade in. |
