---
"@jielga/react-popup-window": patch
---

Style content that renders right after a stylesheet `<link>` is added while the popup is open.
Bundlers add lazily loaded chunk CSS as a new `<link>` and render the chunk's content once the opener has loaded it.
The popup loads its own copy of that `<link>`, so the content could render there unstyled until the copy finished loading.
Until the popup's copy has loaded, the rules the opener already loaded are now applied to the popup through a constructed stylesheet.
A cross-origin stylesheet served without CORS cannot be read this way and still loads normally.
