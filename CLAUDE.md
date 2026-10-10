# TMDataGrid

`@jielga/tmdatagrid` - a published React data grid built on TanStack Table v9 (beta) and Mantine v9.
A bun workspaces monorepo: `packages/tmdatagrid/` is the library with its docs and skills, `apps/docs/` is the site that renders them, and `scripts/` is the tooling both share.

## Where work is tracked

Start here after a break, or on a cold session:

- The GitHub issues of `Jielga/TMDataGrid` - `gh issue list` is the backlog, and an issue is the only place item status lives.
  `held` marks planned work waiting on the stakeholder's go, `icebox` a known gap with no decision to build; an issue without either label is cleared.
  Close the issue from the pull request that ships it, and put what shipped in the changeset, not in a file here.

Do not start held or iceboxed work without the stakeholder's go.

`plans/` is gitignored. Working notes may live there, but they stay local and nothing committed may depend on them.

## Commands

All from the repository root.

| Command | What it does |
| --- | --- |
| `bun run dev` | Docs site: docs, examples, playground |
| `bun run test` | Vitest once, every workspace project (`test:watch` to iterate) |
| `bun run test:e2e` | Playwright, Chromium: the docs-site specs and the component specs (`--project=docs` or `--project=components` for one of them) |
| `bun run lint` | oxlint - types are **not** checked here |
| `bun run check:skills` | `intent validate` over every package's `skills/*/SKILL.md` |
| `bun run typecheck` | `tsc -b` over every project |
| `bun run build:lib` | Every published package into its `dist/` |
| `bun run build:docs` | The site into `apps/docs/dist/` |
| `bun run build` | Both |

The pre-commit hook runs lint, both checks above, the typecheck, the changeset check, and `build:lib` when a `packages/*/src/` path changed.
Run those before committing rather than discovering them at the hook.

Run intent through `scripts/intent.mjs`, never `npx intent`.
Two installed packages declare a bin by that name and the one that wins is an install-order accident; the wrong one crashes on startup.

Driving a browser by hand through the Playwright MCP tools is expensive.
Use it deliberately, not as a way to look around; a spec under `playwright/` is the cheap way to check behaviour in a browser.

## The workspace

Shared dependency versions live in the root `package.json` `catalog`; a package declares `"catalog:"` and the root decides the version.
Peer dependency ranges of a published package stay literal - they are policy, not the installed version.

The site depends on `@jielga/tmdatagrid` by name, as a user does, and resolves it to source: `apps/docs/vite.alias.ts` for Vite and Vitest, `paths` in `apps/docs/tsconfig.json` for TypeScript.
The published manifest knows nothing of this.
A new package that tests against the grid copies that pair; its declaration build must not, so that the grid resolves to the published `dist/index.d.ts` and stays external in its dts rollup.

Every published package sits in one changesets `fixed` group, `@jielga/*`: one version, one release, each package published on its own.
The xlsx package has a peer dependency on the grid, and changesets majors a peer dependent on any minor of its peer unless `onlyUpdatePeerDependentsWhenOutOfRange` is on; the config sets it, so a minor of the grid stays a minor for the group.
A private package stays outside that scope (the docs app is `tmdatagrid-docs`): the glob would pull it into the group, and in pre mode `changeset version` crashes on any group member missing from `.changeset/pre.json`.
For the same reason a new published package added during a prerelease wave goes into `initialVersions` there before the next `chore: version packages` run.

## The library boundary

`packages/tmdatagrid/src/index.ts` is the only entry point the package exposes.
An export added there is public API: it needs docs and a changeset, and it cannot quietly change again.

Nothing but the library and its `*.test.ts(x)` files may live under `packages/tmdatagrid/src/` - the test harness (`gridHarness.tsx`, `fixtures.tsx`), the Playwright gallery and the stories live in `packages/tmdatagrid/test/`, which keeps them out of the tarball and the declaration build.

Peer dependencies stay external in `packages/tmdatagrid/vite.config.ts`.
Bundling `react`, `@mantine/*` or `@tanstack/*` hands the consumer a second copy of the React runtime, the Mantine theme context or the TanStack feature registry, and each fails at runtime rather than at build time.

The `tmdatagrid` CSS layer name in `styles.layer.css` is public API - never rename it.

## Conventions specific to this repo

Styling is co-located CSS Modules (`Component.module.css`), not Emotion.

TanStack Table v9 is beta and the grid uses its feature-registry API; check `useTMDataGrid.tsx` before assuming a v8 shape carries over.

The React Compiler runs in both Vite configs and in the Playwright gallery but not under Vitest, so a jsdom component test proves the wiring, not the memoization; a Playwright spec sees the compiled output.

The grid publishes `data-dg-part` plus `data-row-id` / `data-column-id`, and no `data-testid` of its own.
Roles flip from `table`/`cell` to `grid`/`gridcell` when cell selection is on.
Renaming or dropping a part breaks a documented contract - see [testing.md](packages/tmdatagrid/docs/testing.md).

## Tests

Vitest and React Testing Library in jsdom, co-located as `*.test.ts(x)`.
Use the harness in [gridHarness.tsx](packages/tmdatagrid/test/gridHarness.tsx) - `renderGridUi`, `part()`, `gridRowCount()` - rather than re-deriving selectors.

Two jsdom facts decide how a grid test has to be written:

- There is no layout, so the virtualizer mounts a handful of rows whatever the data says.
  Assert on `aria-rowcount` / `data-dg-row-count`, never on the number of row elements.
- Mantine transitions never settle, so a popover panel mounts empty outside `<MantineProvider env="test">`.
  The harness sets it; a bespoke render has to as well.

[demos.test.tsx](apps/docs/src/examples/demos.test.tsx) mounts every demo, fails on any `console.error`, and checks that every demo fence, topic link and docs link resolves.
A broken demo or a dead link fails the suite, so run the tests after touching docs or examples, not just after touching code.

Playwright covers what jsdom cannot, in Chromium, from `bun run test:e2e`; the config is [playwright.config.ts](playwright.config.ts).

- [playwright/docs/](playwright/docs) drives the docs demos through the `DataGrid` page object in [DataGrid.ts](playwright/support/DataGrid.ts).
  Every spec there is a template a consumer copies into their own suite, so it uses parts and coordinates, never text, and never counts row elements.
  A demo is reached by `data-demo="<file>"` on its `DemoBlock`.
- [playwright/components/](playwright/components) mounts stories from `packages/tmdatagrid/test/stories/` through the gallery in `packages/tmdatagrid/test/gallery/`.
  `bun run --cwd packages/tmdatagrid gallery` serves the gallery alone; `?story=Grid/Default` mounts one story for a manual look.
- The page object is embedded verbatim in [testing.md](packages/tmdatagrid/docs/testing.md) below a `<!-- source: playwright/support/DataGrid.ts -->` marker, and [testingPageObject.test.ts](apps/docs/src/docs/testingPageObject.test.ts) fails when the two drift.
  Change the file, then paste it into the fence.
- Both servers run on fixed ports with `--strictPort` (5273 for the docs site, 5274 for the gallery), so a `bun run dev` on 5173 never interferes and a taken port fails the run instead of drifting.

## Docs and demos

Docs are markdown under [packages/tmdatagrid/docs/](packages/tmdatagrid/docs), registered in [docsPages.ts](apps/docs/src/docs/docsPages.ts) as `@jielga/tmdatagrid/docs/<page>.md?raw` imports.
They stay plain markdown: they ship in the package and the `SKILL.md` files cite them as sources, so no MDX.

One topic, one page - the option, prop, column meta, callback, CSS variable and the live demo all sit on the page for the thing they belong to.

That rule decides who owns a component's prop table.
A part whose props belong to one topic is written up on that topic's page, in the `## TMDataGrid.X` layout, and [components.md](packages/tmdatagrid/docs/components.md) lists it with a link instead of repeating it.
`components.md` carries the full entry only for what belongs to no single page: the root, the Table, the hooks, and the parts whose props scatter across every topic.
The `## TMDataGrid.X` heading is what marks ownership, so it may appear on one page only - `demos.test.tsx` fails the build otherwise.
Two copies of a prop table drift within one release; that is how `TMDataGrid.FilterPanel` came to read "No props." on one page and list `layout` on another.

Write them as reference documentation for a library, and nothing looser.
State what an option does and what its default is; give a reason only where it changes a decision.
The person using the grid is "the user", the person reading the page is "you", and nobody is "the reader".
No closing flourishes, no design commentary, no jokes.

A demo is one file under `apps/docs/src/examples/demos/` holding code and nothing else: no headings, no prose, nothing you would not paste.
It imports the grid as `@jielga/tmdatagrid`, and its source is shown verbatim.
Prose lives in the docs page that shows it.
Put a demo where the prose explains it with a fence naming the file:

````markdown
```demo
file: rows/Grouping.tsx
hint: “Group by …” lives in every column menu.
```
````

Every demo file must be reachable from exactly one place, a topic or a docs page, and the registry pairs each module with its own source, so adding a demo is adding a file.

`packages/tmdatagrid/skills/*/SKILL.md` cite `packages/tmdatagrid/docs/*.md` by path.
Splitting or renaming a docs page means fixing the `sources:` of every skill that cites it.

## Releasing

Changesets, and a change under a `packages/*/src/` needs one - the pre-commit hook refuses the commit otherwise.
A comment, a test or a refactor with no observable effect is the case for `git commit --no-verify`.

Keep a changeset short: what changed, in a line or a short list.
Reasoning belongs in the code comments; the only thing worth spelling out is a workaround a consumer has to know about.

Each package's `CHANGELOG.md` and the `library_version` in each `SKILL.md` are generated; `bun run version-packages` writes both.
Never edit them by hand.

Nothing publishes from an ordinary push.
Merging the **chore: version packages** PR is the release: `scripts/publish-missing.mjs` packs each public package with bun and publishes the tarball with npm under trusted publishing.
A new package's first version is published by hand and its trusted-publishing config added on npmjs.com before the workflow can take it over.

## Skill Loading

Before editing files for a substantial task:

- Run `npx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `npx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
