/// <reference types="vite/client" />

/**
 * Stamped by the docs deploy workflow, one value per deployed copy. Absent
 * under `npm run dev` and under Vitest, which is what tells the version menu
 * it is looking at a local build.
 */
interface ImportMetaEnv {
  /** Site root of the Pages deployment, "/TMDataGrid/" in production. */
  readonly VITE_DOCS_SITE_ROOT?: string;
  /** Which copy this bundle is: "root", "next", "v2.0", "b/some-branch". */
  readonly VITE_DOCS_SLUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
