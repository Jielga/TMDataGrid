import { dts } from "rolldown-plugin-dts";

/**
 * Flattens the per-file declarations emitted by `tsconfig.lib.json` into a
 * single `dist/index.d.ts`.
 *
 * This keeps relative imports out of the published types entirely. TypeScript
 * emits relative specifiers verbatim, so an extensionless `./TMDataGrid` only
 * resolves under `moduleResolution: bundler` - a flat file has no relative
 * specifiers to resolve, so it works under every resolution mode without
 * putting `.js` extensions in the source.
 *
 * `dtsInput` tells the plugin the entry is already a `.d.ts`, so it bundles
 * what `tsc` emitted rather than generating declarations itself.
 */
export default {
  input: "./.types-tmp/index.d.ts",
  output: { file: "dist/index.d.ts", format: "es" },
  plugins: dts({ dtsInput: true }),
  external: [/^react($|\/)/, /^@mantine\//, /^@tabler\//, /^@tanstack\//],
};
