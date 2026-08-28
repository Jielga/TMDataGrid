---
"@jielga/tmdatagrid": minor
---

The body is one tab stop in each direction, bracketed by two `tab-guard` parts.
A control inside a body cell needs no `tabIndex` of its own.

- Inside a row, Tab walks its controls - the open editors, the buttons in its cells and the edit lane's save and cancel - and past the last one the cursor moves to the next row's first cell.
- **Breaking.** `useCellControlTabIndex` is removed. Drop the `tabIndex` it fed; nothing replaces it.
- Pressing a control inside a cell keeps the selected block instead of collapsing it to that cell.
- Scrolling a focused row into view accounts for the sticky header, the pinned rows and the summary row.
