# Proposals - the 1.0 wave

> **Status: P2 and P3 pending. P1 shipped; P4's deliverable shipped ahead of
> its approval.** Held work in the
> [tracker](scan-adoption.md#execution-tracker) starts only when its proposal
> is approved.

The proposals gating the scan-adoption wave
([scan-adoption.md](scan-adoption.md)). Each ends with what approval means.
Decisions Q1–Q7 (settled 2026-08-01) are assumed throughout. A proposal is
dropped from this file once the work it gates has shipped - the shipped
behavior is then documented in `src/docs/`, which is the copy that has to
stay right.

**Approving one:** change its status line to
`> **Status: approved <date>.**` and set the matching H-item in the
[tracker](scan-adoption.md#execution-tracker) from `held` to `ready`. P2
needs its rename table approved as well before H2 starts.

| Proposal | Status | Unblocks |
| --- | --- | --- |
| ~~P1 - Custom controls (direct references)~~ | **shipped 2026-08-09** as H1. Text removed; the contract it proposed is documented in [filtering.md](../src/docs/filtering.md) and [editors.md](../src/docs/editors.md) | - |
| P2 - API coherence refactor | **pending approval** (+ second gate: rename table) | H2 |
| P3 - Bad-UX warning framework | **pending approval** | H3, then H4 |
| P4 - Density: no built-in | **pending approval**, but its deliverable already shipped - see below | H5 |

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
>
> **Overtaken by events, 2026-08-16.** The docs restructure shipped both
> halves of the deliverable without waiting for the approval: the size scale
> and its recipe are on [styling.md](../src/docs/styling.md), and
> `getting-started/DensityAndLayout.tsx` is the runtime toggle, a
> `SegmentedControl` over `size`. What is still missing is the test pinning
> that a live `size` change re-estimates virtualized row heights. Approving
> this now means confirming density stays closed as "recipe, not feature" and
> reducing H5 to that one test.

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
