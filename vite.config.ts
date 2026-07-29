import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

/**
 * Demo site — the grid example and the documentation pages. The publishable
 * package is built by `vite.lib.config.ts` into `dist`.
 */
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  build: { outDir: "dist-demo" },
});
