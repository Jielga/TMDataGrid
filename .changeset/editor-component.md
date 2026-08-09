---
"@jielga/tmdatagrid": major
---

Breaking: `meta.renderEditor` is removed — `meta.editor` takes a component instead, rendered as JSX so hooks are legal inside. An inline render function ports as-is (`editor: (args) => <X {...args} />` is a valid component); define editors at module scope so their identity is stable. `TMDataGridEditorRenderer` is replaced by `TMDataGridEditorComponent`.
