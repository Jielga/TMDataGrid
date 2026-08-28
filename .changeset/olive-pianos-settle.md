---
"@jielga/tmdatagrid": patch
---

Column resizing is smooth again, and no longer jumps on mouse down.

- A drag starts from the width the column is rendered with, not its declared
  `size`. The jump could also drop the divider onto a neighbouring header and
  start a column move, which swallowed the mouse up and left the resize running
  after the button was released.
- A running drag is painted on the grid's own column tracks instead of through
  state, so nothing re-renders while the pointer moves.
- `columnResizeMode` now defaults to `"onEnd"`: the width reaches `columnSizing`
  when the pointer is released. Set `"onChange"` to publish it on every move,
  at the cost of a render of the grid for each one.
