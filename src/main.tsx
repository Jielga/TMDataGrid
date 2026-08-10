import {
  CodeHighlightAdapterProvider,
  createShikiAdapter,
} from "@mantine/code-highlight";
import "@mantine/code-highlight/styles.css";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { router } from "./router";
import "./index.css";

/**
 * Shiki is loaded on demand — the first code block on screen pays for it, and
 * a visitor who only ever looks at grids never downloads it at all.
 *
 * Built from `shiki/core` rather than the `shiki` entry point, which would
 * bundle every grammar it knows. Five grammars are what this site shows. The
 * JavaScript regex engine keeps the 600 kB oniguruma WASM out of the build
 * too; it handles these grammars without it.
 */
const shikiAdapter = createShikiAdapter(async () => {
  const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] =
    await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
    ]);

  return createHighlighterCore({
    langs: [
      import("@shikijs/langs/tsx"),
      import("@shikijs/langs/typescript"),
      import("@shikijs/langs/css"),
      import("@shikijs/langs/bash"),
      import("@shikijs/langs/json"),
    ],
    themes: [
      import("@shikijs/themes/github-light"),
      import("@shikijs/themes/github-dark"),
    ],
    engine: createJavaScriptRegexEngine(),
  });
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="auto">
      <CodeHighlightAdapterProvider adapter={shikiAdapter}>
        <RouterProvider router={router} />
      </CodeHighlightAdapterProvider>
    </MantineProvider>
  </StrictMode>,
);
