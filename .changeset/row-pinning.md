---
"@jielga/tmdatagrid": minor
---

Row pinning: `enableRowPinning` (boolean or per-row predicate) lets `row.pin("top" | "bottom" | false)` hold rows in sticky edge blocks — top under the header, bottom above the summary row — outside the scrolling order. Pinned rows survive filtering and paging, stale pinned ids are skipped rather than thrown on, and group rows never pin.
