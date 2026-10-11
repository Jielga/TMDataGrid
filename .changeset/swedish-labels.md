---
"@jielga/tmdatagrid": patch
---

Swedish labels (`TMDATAGRID_LABELS_SV`) follow Excel's and the common data grids' wording. Tests that find controls by their Swedish name need the new text:

- Selection says "Markera": "Markera alla rader", "Markera rad", "Markera grupp", "Markera alla" in the export picker, "markerade rader" in export, and "Radmarkering" for the checkbox column
- Grouping: "Gruppera efter …", "Sluta gruppera efter …", and the paging hint
- Pinning: "Lås till vänster", "Lås till höger", "Lås upp"
- "Autopassa kolumnbredd", "Ångra alla", "Avbryt ny rad", "Ta med rubriker", "(Tomt)", "Visa alla detaljer", "Dölj alla detaljer"
