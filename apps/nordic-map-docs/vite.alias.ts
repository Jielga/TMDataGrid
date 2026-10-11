import { fileURLToPath } from "node:url";
import type { AliasOptions } from "vite";

const map = (path: string) =>
  fileURLToPath(new URL(`../../packages/nordic-map/${path}`, import.meta.url));

/**
 * The site consumes the library the way a user does, by package name, but
 * resolves it to source: `bun run --cwd apps/nordic-map-docs dev` then
 * hot-reloads library files and no build has to run first. The published
 * manifest knows nothing of this - it is the consumer's config, here and in
 * tsconfig.json's `paths`.
 */
export const workspaceAlias: AliasOptions = [
  { find: /^@jielga\/nordic-map$/, replacement: map("src/index.ts") },
];
