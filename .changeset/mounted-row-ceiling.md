---
"@jielga/tmdatagrid": patch
---

Cap how many rows the body mounts at once: at most three windows' worth, never
fewer than 100.

A scroll container that is never given a height grows to the virtualizer's
bottom spacer, which is as tall as the whole dataset. The measured viewport is
then the dataset, and every row mounts - 5 000 rows took 35 s to first paint in
that layout, against 2.7 s capped. The rows past the cap are left to the
spacer, and a `console.warn` names the container's measured height and the fix:
give the grid a bounded height, or a flex parent with `min-height: 0`.
