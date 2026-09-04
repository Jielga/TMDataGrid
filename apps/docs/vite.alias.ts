import { fileURLToPath } from "node:url";
import type { AliasOptions } from "vite";

const lib = (path: string) =>
  fileURLToPath(new URL(`../../packages/tmdatagrid/${path}`, import.meta.url));

/**
 * The site consumes the library the way a user does, by package name, but
 * resolves it to source: `bun run dev` then hot-reloads library files and no
 * build has to run before the tests or the typecheck. The published manifest
 * knows nothing of this - it is the consumer's config, here and in
 * tsconfig.json's `paths`.
 */
export const workspaceAlias: AliasOptions = [
  { find: /^@jielga\/tmdatagrid$/, replacement: lib("src/index.ts") },
  { find: /^@jielga\/tmdatagrid\/docs\//, replacement: lib("docs/") },
];
