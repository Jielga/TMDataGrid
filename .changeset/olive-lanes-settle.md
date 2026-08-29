---
"@jielga/tmdatagrid": patch
---

- `--row-bg` is painted over the theme body colour, so a translucent value no longer leaves pinned columns and pinned rows see-through.
- The summary row sits at the bottom edge when the rows do not fill the body.
- A cell's validation message shows in a tooltip on the editor instead of as text under the input.
- Under `mode: "cell"`, leaving a cell with a value the validators refuse keeps the editor open instead of closing it on the refused value.
