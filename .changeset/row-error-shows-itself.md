---
"@jielga/tmdatagrid": patch
---

Fix a row-level validation message never being seen. A pathless `rowValidators` issue - the bare `.refine()`, "at least one field must have a value" - has no cell to mark, so it rides the edit lane's ✓. That message sat in a plain hover tooltip, and the tooltip was mounted by the failure itself: the pointer that had just clicked ✓ was already resting on the button, so no fresh `mouseenter` was ever fired and nothing opened. A save with Ctrl+Enter left the pointer nowhere near the lane at all. The row simply refused to commit, silently.

The row-level message now opens itself the moment the commit is refused, in red, and closes on the next edit to the row - the edit that clears the error. Hovering still opens the field-level message, which the marked cells already carry.

The entry row's ✓ reports the same way. It was showing neither the red nor the message, whatever the rule.
