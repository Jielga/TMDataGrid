---
"@jielga/tmdatagrid": patch
---

Fix the row context menu never opening on a pinned row.

`renderRowContextMenu` resolved its target against the body rows only, and pinning takes a row out of those - so a right-click at either edge opened nothing, and a row pinned without an unpin control of its own was stuck there. Under cell selection the same right-click also moved the range onto a row that sits out the range, clearing the selection it should have left alone.
