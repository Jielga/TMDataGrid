# TMDataGrid

`@jielga/tmdatagrid` - a published React data grid built on TanStack Table v9 (beta) and Mantine v9.
`src/tmdatagrid/` is the library; everything else under `src/` is the demo site that documents it.

## Where work is tracked

Start here after a break, or on a cold session:

- [BACKLOG.md](BACKLOG.md) — what is planned, in progress and done.
- [plans/scan-adoption.md](plans/scan-adoption.md) — **the tracker for the
  current 1.0 wave**: per-item status, running order, and what is waiting on
  whom. Its execution-tracker table is the only place item status lives;
  update the Status cell there when something ships.
- [plans/proposals.md](plans/proposals.md) — proposals awaiting stakeholder
  approval. Held work does not start until its proposal is approved.
- `plans/*.md` for finished waves keep a `> **Status: executed <date>**`
  stamp at the top; they are rationale, not instructions.

Do not start planned work without the stakeholder's go — the tracker names
what is cleared and what is still waiting.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Demo site: docs, examples, playground |
| `npm run test` | Vitest once (`test:watch` to iterate) |
| `npm run lint` | oxlint - types are **not** checked here |
| `npx tsc -b` | The typecheck, run it separately |
| `npm run build:lib` | The package into `dist/` |
| `npm run build` | The demo site into `dist-demo/` |

The pre-commit hook runs lint, `tsc -b`, the changeset check, and `build:lib` when `src/tmdatagrid/` changed.
Run those before committing rather than discovering them at the hook.

Playwright is expensive. Use it deliberately, not as a way to look around.

## The library boundary

`src/tmdatagrid/index.ts` is the only entry point the package exposes.
An export added there is public API: it needs docs and a changeset, and it cannot quietly change again.

Nothing but the library and its `*.test.ts(x)` files may live under `src/tmdatagrid/` - shared test fixtures go in `src/test/`, which keeps them out of the tarball and the declaration build.

Peer dependencies stay external in `vite.lib.config.ts`.
Bundling `react`, `@mantine/*` or `@tanstack/*` hands the consumer a second copy of the React runtime, the Mantine theme context or the TanStack feature registry, and each fails at runtime rather than at build time.

The `tmdatagrid` CSS layer name in `styles.layer.css` is public API - never rename it.

## Conventions specific to this repo

Styling is co-located CSS Modules (`Component.module.css`), not Emotion.

TanStack Table v9 is beta and the grid uses its feature-registry API; check `useTMDataGrid.tsx` before assuming a v8 shape carries over.

The React Compiler runs in both Vite configs but not under Vitest, so a component test proves the wiring, not the memoization.

The grid publishes `data-dg-part` plus `data-row-id` / `data-column-id`, and no `data-testid` of its own.
Roles flip from `table`/`cell` to `grid`/`gridcell` when cell selection is on.
Renaming or dropping a part breaks a documented contract - see [src/docs/testing.md](src/docs/testing.md).

## Tests

Vitest and React Testing Library in jsdom, co-located as `*.test.ts(x)`.
Use the harness in [src/test/gridHarness.tsx](src/test/gridHarness.tsx) - `renderGridUi`, `part()`, `gridRowCount()` - rather than re-deriving selectors.

Two jsdom facts decide how a grid test has to be written:

- There is no layout, so the virtualizer mounts a handful of rows whatever the data says.
  Assert on `aria-rowcount` / `data-dg-row-count`, never on the number of row elements.
- Mantine transitions never settle, so a popover panel mounts empty outside `<MantineProvider env="test">`.
  The harness sets it; a bespoke render has to as well.

[demos.test.tsx](src/examples/demos.test.tsx) mounts every demo, fails on any `console.error`, and checks that every demo fence, topic link and docs link resolves.
A broken demo or a dead link fails the suite, so run the tests after touching docs or examples, not just after touching code.

## Docs and demos

Docs are markdown under [src/docs/](src/docs), registered in [docsPages.ts](src/docs/docsPages.ts).
They stay plain markdown: `intent.docs` publishes them and the `SKILL.md` files cite them as sources, so no MDX.

One touchpoint, one page - the option, prop, column meta, callback, CSS variable and the live demo all sit on the page for the thing they belong to.
[plans/docs-restructure.md](plans/docs-restructure.md) is the rule and the running status.

A demo is one file under `src/examples/demos/` holding code and nothing else: no headings, no prose, nothing you would not paste.
Prose lives in the docs page that shows it.
Put a demo where the prose explains it with a fence naming the file:

````markdown
```demo
file: rows/Grouping.tsx
hint: “Group by …” lives in every column menu.
```
````

Every demo file must be reachable from exactly one place, a topic or a docs page, and the registry pairs each module with its own source, so adding a demo is adding a file.

`skills/*/SKILL.md` cite `src/docs/*.md` by path.
Splitting or renaming a docs page means fixing the `sources:` of every skill that cites it.

## Releasing

Changesets, and a change under `src/tmdatagrid/` needs one - the pre-commit hook refuses the commit otherwise.
A comment, a test or a refactor with no observable effect is the case for `git commit --no-verify`.

`CHANGELOG.md` and the `library_version` in each `SKILL.md` are generated; `npm run version-packages` writes both.
Never edit them by hand.

Nothing publishes from an ordinary push.
Merging the **chore: version packages** PR is the release.

<!-- intent-skills:start -->

## Skill Loading

Before editing files for a substantial task:

- Run `npx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `npx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->
