---
"@jielga/tmdatagrid": minor
---

`meta.editor` takes a component, rendered as JSX so hooks are legal inside it. It receives the live TanStack Form field alongside the table context (`TMDataGridEditorComponent`, `TMDataGridEditorArgs`); define one at module scope so its identity is stable across renders.
