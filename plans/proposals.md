# Proposals - the 1.0 wave

> **Status: P1 approved 2026-08-09 (as amended in discussion - registry
> dropped for direct component references). P2–P4 pending.** Held work in
> the [tracker](scan-adoption.md#execution-tracker) (H1–H5) starts only when
> its proposal is approved.

The four proposals gating the scan-adoption wave
([scan-adoption.md](scan-adoption.md)). Each ends with what approval means.
Decisions Q1–Q7 (settled 2026-08-01) are assumed throughout.

**Approving one:** change its status line to
`> **Status: approved <date>.**` and set the matching H-item in the
[tracker](scan-adoption.md#execution-tracker) from `held` to `ready`. P2
needs its rename table approved as well before H2 starts.

| Proposal | Status | Unblocks |
| --- | --- | --- |
| P1 - Custom controls (direct references) | **approved 2026-08-09** | H1 |
| P2 - API coherence refactor | **pending approval** (+ second gate: rename table) | H2 |
| P3 - Bad-UX warning framework | **pending approval** | H3, then H4 |
| P4 - Density: no built-in | **pending approval** | H5 |

## P1 - Custom controls: direct component references

> **Status: approved 2026-08-09**, as amended in stakeholder discussion.
> Unblocks H1. The original registry proposal (named controls in a
> `controls` option, referenced by string) is superseded: column defs are
> never serialized, so string indirection bought nothing over plain
> imports. This amendment also amends **Q1** - the two-door editor
> (`renderEditor` + registry name) collapses to a single component door.

**Goal.** Build a special input once - with its validation pattern - and
reuse it across columns and grids, for both editing and filtering. Controls
are ordinary named exports, imported and assigned directly on the column;
reuse is `import`, the way everything else in React works. Typos are
compile errors, go-to-definition works, and there is no name-collision
surface at all.

**Shape.**

```tsx
// salaryControls.tsx - plain named exports, shared app-wide by import
export const SalaryEditor = (args: TMDataGridEditorArgs) => { ... };
export const SalaryRangeFilter = (args: TMDataGridFilterControlArgs) => { ... };

// column definition - direct references, no strings
columnHelper.accessor("salary", {
  meta: { type: "number", editor: SalaryEditor, filterControl: SalaryRangeFilter },
});
```

**Args contracts.**

- **Editor:** `meta.editor` is a component receiving the existing
  `TMDataGridEditorArgs` (`field`, `form`, `cell`, `row`, `column`,
  `table`, `commit`, `cancel`, `size`, `autoFocus`, `seedText`). It is
  rendered as JSX - a real component, so hooks are legal inside (the MRT
  bare-call footgun is structurally excluded). `field` is the TanStack Form
  `FieldApi`, so a custom input plugs into `meta.validate` /
  `rowValidators` with no extra wiring. **`meta.renderEditor` is removed**
  (breaking, named in its changeset): one door, always a component. Inline
  still works (`editor: (args) => <X {...args} />`); the docs carry the
  standard React caveat to define editors at module scope so identity stays
  stable across renders.
- **Filter:** `meta.filterControl` is a component receiving the new
  `TMDataGridFilterControlArgs`: `{ column, table, operator, value,
  onChange(nextValue), options, size, labels }`. **Value-only contract:**
  the control reads `operator` to shape itself (e.g. `between` → two
  handles) and calls `onChange` with the bare value; the grid composes the
  operator-aware `TMDataGridFilterValue` internally. Controls never build
  the wrapper and cannot write the operator - `table` is the escape hatch
  for the rare control that must. `options` comes pre-resolved through
  `resolveColumnOptions` for select-shaped controls.

**Resolution order** (most specific wins, two steps each):
`meta.editor` → built-in editor by `meta.type`;
`meta.filterControl` → built-in control by type/operator.

**Built-ins through the same door.** The H1 controls (range slider seeded
from faceted min/max, date-range, autocomplete, tri-state boolean) ship as
PascalCase named exports (`DgRangeSliderFilter`, `DgDateRangeFilter`, …)
built against the same public args contracts consumers use - proving the
contract by construction. No reserved prefix needed; imports don't collide.

**Approval means:** the two args contracts and the resolution order are
final for the beta; H1 builds against them.

## P2 - API coherence refactor (1.0.0-beta)

> **Status: pending approval.** Written 2026-08-01. Unblocks H2 - and H2
> also waits on the second gate below: the rename table comes back for
> yes/no before any renaming is executed.

**Goal.** One convention across every render/override surface before 1.0
freezes them - per Q2, a deliberate refactor rather than point fixes.

**The three conventions.**

1. **One typed args object** per render surface (mostly true today; the
   refactor closes the stragglers and normalizes naming to `render*`).
2. **Composable chrome slots** expose `{ state, actions, Controls }`, where
   `Controls` are pre-bound components and the default render is literally
   the controls in order - consumers rearrange/restyle/drop without
   rebuilding. Applied to: Footer pagination (breaking - replaces
   `TMDataGridPaginationApi`), then `EditActions`.

   ```tsx
   <TMDataGrid.Footer
     renderPagination={({ state, actions, Controls }) => (
       <Group>
         <Controls.Range />
         <MyJumpToPage page={state.page} onJump={actions.setPage} />
         <Controls.Pager size="xs" />
       </Group>
     )}
   />
   ```

3. **Menu-shaped overrides** receive the built-ins and return the full
   list - `internalItems` handback: `renderColumnMenuItems({ column,
   internalItems, table })` on the column menu, and the same treatment for
   the context menu (today's `rowContextMenu` append-below-divider behavior
   stays the zero-config default; the handback is the full-control tier).

**Deliverable.** The old → new rename/reshape table over the full inventory
(Footer `pagination`, `renderDetails`, `rowContextMenu`, `renderEditor`,
toolbar slots, panel render props), produced as the first act of the
refactor and executed in one commit series, each break named in a beta
changeset.

**Approval means:** the three conventions are agreed; the rename table
comes back for a quick yes/no before execution (it's the list you asked to
see).

## P3 - Bad-UX warning framework

> **Status: pending approval.** Written 2026-08-01. Unblocks H3, and H4
> after it.

**Goal.** One idiom for "legal but probably not what you want", replacing
ad-hoc warnings. Types (`?: never`) catch invalid combos at compile time;
this catches unwise ones at runtime, dev-only.

**Shape.**

```
core/uxAdvisor.ts
type TMDataGridUxRule = { key, detect(options, features), message, docsRef };
```

- Dev builds only (`import.meta.env.DEV`); one `console.info` per rule per
  grid instance: the message, the docs link, and
  `Silence with acknowledgeUx: ["<key>"]`.
- New option `acknowledgeUx?: ReadonlyArray<string>`. Keys are forever -
  published in the docs, never renamed.
- Existing warnings folded in: `onReachEnd` + pagination becomes rule
  `"reach-end-with-pagination"`. The `editMode`-without-`getRowId`
  `console.error` stays a hard error - that is a misconfiguration, not an
  opinion; the framework carries opinions only.
- First new rule (lands with phase 6): `"row-click-details-with-row-click-
  selection"` - `detailsTrigger: "rowClick"` combined with a selection mode
  where a row click already acts (`"row"`, `"highlight"`,
  `"checkboxAndHighlight"`).
- Candidate rule (found during C3, 2026-08-01): `"unstable-data-identity"` -
  `data` identity changed while length and first row stayed the same, across
  N consecutive renders. Not just wasted recompute: the v9 beta's
  `autoResetExpanded` turns it into an infinite render loop. Detection is a
  render-time heuristic, so it fits the dev-only framework rather than a hard
  error.

**Approval means:** the option name `acknowledgeUx`, the key style, and the
opinions-vs-errors boundary are settled; phase 1 builds it.

## P4 - Density: recommendation is NO built-in

> **Status: pending approval.** Written 2026-08-01. Unblocks H5.

The grid already derives row height, paddings and font size from the live
`size` prop - a runtime compact/comfortable toggle is a `useState` in
consumer land:

```tsx
const [size, setSize] = useState<MantineSize>("md");
<TMDataGrid {...grid} size={size} />
```

Building density into the grid would duplicate `size` as state, invent a
second source of truth, and add a toolbar control we'd then localize and
document - for something consumers compose in three lines. MRT needed
density state because its spacing was internal; ours never was.

**Deliverable instead:** a docs recipe + a size toggle on the demo page, and
a test pinning that a runtime `size` change re-estimates virtualized row
heights correctly (the one place a live switch could bite).

**Approval means:** density is closed as "recipe, not feature"; revisit only
if real demand shows up.
