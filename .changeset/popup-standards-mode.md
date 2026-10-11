---
"@jielga/react-popup-window": minor
---

Lay out the default `about:blank` popup in standards mode.
The initial `about:blank` document has no doctype, so the popup was in quirks mode while the app was in standards mode, and some content laid out differently than in the main window.
The document is now written with an HTML5 doctype before the popup content renders.
Popup content can lay out slightly differently than before; it now matches the main window.
In Chromium, `popupWindow.document.URL` now reports the opener's URL instead of `about:blank`; a reload of the popup still loads `about:blank`.
