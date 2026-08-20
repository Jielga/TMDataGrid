---
"@jielga/tmdatagrid": patch
---

`--dg-radius` sets the frame's corner radius, so a grid can be squared off
against a card or a full-bleed page without fighting the stylesheet.

The radius was the one part of the frame with no variable behind it, hard-coded
to `--mantine-radius-md`. It now reads `--dg-radius`, which defaults to the same
value, and takes any length or Mantine radius token:

```tsx
<TMDataGrid {...grid} style={{ "--dg-radius": 0 }} />
```

The root clips its overflow, so the header and the last row follow whatever
corner it is given.
