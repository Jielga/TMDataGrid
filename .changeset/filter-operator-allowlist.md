---
"@jielga/tmdatagrid": minor
---

`meta.filter.operators` narrows the operators a column offers to a subset of
its type's, for columns backed by an endpoint that answers only some of them.
The panel dropdown and the header funnel show only those; a fresh filter opens
on the type's default when it is offered, else on the first offered operator.
New export `getColumnOperators(column)`.
