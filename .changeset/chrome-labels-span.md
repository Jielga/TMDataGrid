---
"@jielga/tmdatagrid": patch
---

The grid's own labels render as `span` rather than `p`, so a grid placed inside prose - a docs page, a CMS body, Mantine's `Typography` - no longer inherits paragraph margins that pushed the toolbar count and the pager off centre.
