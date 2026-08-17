---
"@jielga/tmdatagrid": major
---

Persisted payloads gain a version stamp and are realigned against the current column set on restore. BREAKING: layouts stored by 0.x builds carry no stamp and are dropped once - users start from the default layout after upgrading.
