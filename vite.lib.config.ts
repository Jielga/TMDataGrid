import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

/**
 * Builds the publishable package into `dist`. The demo site has its own config
 * (`vite.config.ts`) and builds into `dist-demo`.
 *
 * Every peer dependency is externalised. Bundling any of them would give the
 * consumer a second copy of React, of the Mantine theme context, or of the
 * TanStack Table feature registry — each of which breaks at runtime rather
 * than at build time.
 */
const EXTERNAL = [
  /^react($|\/)/,
  /^react-dom($|\/)/,
  /^@mantine\//,
  /^@tabler\//,
  /^@tanstack\//,
];

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  // `public/` holds the demo site's favicon and icons; none of it belongs in
  // the package.
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    // One stylesheet for the whole package, imported by the consumer as
    // `@jielga/tmdatagrid/styles.css`.
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(
        new URL("./src/tmdatagrid/index.ts", import.meta.url),
      ),
      formats: ["es"],
      fileName: () => "index.js",
      cssFileName: "styles",
    },
    rollupOptions: { external: EXTERNAL },
  },
});
