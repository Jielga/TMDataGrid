import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

/**
 * Builds the package into `dist`, as ESM. The docs site is its own workspace
 * package (`apps/nordic-map-docs`) with its own Vite config.
 *
 * Peer dependencies stay external: bundling React or Mantine hands the
 * consumer a second copy of the runtime or of the theme context. The runtime
 * dependencies stay external too, so the consumer's bundler deduplicates them.
 */
const EXTERNAL = [
  /^react($|\/)/,
  /^react-dom($|\/)/,
  /^@mantine\//,
  /^@tabler\//,
  /^d3-geo$/,
  /^topojson-client$/,
];

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  // Asset URLs relative to the module that names them, so they resolve
  // wherever the consumer's bundler puts the package.
  base: "./",
  // Nothing from a public directory ships beside the bundle.
  publicDir: false,
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    sourcemap: true,
    // One stylesheet for the whole package, imported by the consumer as
    // `@jielga/nordic-map/styles.css`.
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      formats: ["es"],
      fileName: () => "index.js",
      cssFileName: "styles",
    },
    rollupOptions: {
      external: EXTERNAL,
      output: {
        // The map cells, under their own names. Each is a `new URL(…,
        // import.meta.url)` in the bundle, which the consumer's bundler
        // copies in turn, so the data loads from their own origin.
        assetFileNames: (asset) => {
          return asset.names.some((name) => name.endsWith(".json"))
            ? "cells/[name][extname]"
            : "[name][extname]";
        },
      },
    },
  },
});
