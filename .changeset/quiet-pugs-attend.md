---
"@jielga/tmdatagrid": patch
---

`meta.autoSize` waits for the column's first cells instead of measuring
whatever is in the DOM on the mounting commit.

On a grid whose rows are fetched - the ordinary case for a real screen - the
first render has a header and no cells at all, so the pass fitted the title and
the header's own hover affordances and nothing else, and because it ran exactly
once that was the width the column kept for the session. The ids are now held
until each one has actual content to measure, and a column is sized on the
render its first cells appear in, whenever that is. A column already covered by
a persisted or user-set width is still left alone, and a column hidden at mount
is now sized when it is shown rather than skipped.

The double-click gesture and the **Autosize column** menu item are unchanged:
both run from a pointer, by which time the rows are there.
