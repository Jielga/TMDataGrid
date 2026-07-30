import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

/**
 * Web storage under test.
 *
 * Vitest's jsdom environment leaves `window.localStorage` as a bare object
 * here — jsdom's own Storage never reaches the window — so the grid's
 * `window.localStorage` lookups would fail on a missing method rather than on
 * anything the test meant to exercise. An in-memory Storage is installed
 * instead: same contract, and each test starts from a known empty state.
 */
function createStorage(): Storage {
  let entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    key: (index) => [...entries.keys()][index] ?? null,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, String(value));
    },
    removeItem: (key) => {
      entries.delete(key);
    },
    clear: () => {
      entries = new Map();
    },
  };
}

function installStorage(name: "localStorage" | "sessionStorage") {
  Object.defineProperty(window, name, {
    value: createStorage(),
    configurable: true,
    writable: true,
  });
}

/**
 * Browser APIs jsdom does not implement. Mantine's provider reads
 * `matchMedia` for the colour scheme, and both Mantine's ScrollArea and
 * TanStack Virtual measure through ResizeObserver.
 */
function installBrowserStubs() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });

  class ResizeObserverStub implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverStub;
  globalThis.ResizeObserver = ResizeObserverStub;

  window.HTMLElement.prototype.scrollIntoView = () => {};

  // jsdom lays nothing out, so every element measures zero and the grid's
  // virtualizer concludes the viewport shows no rows. Giving elements a
  // viewport-sized box makes the scroll container big enough to render into;
  // row heights come from `estimateSize`, not from measurement, so this does
  // not distort them.
  const VIEWPORT = { width: 1200, height: 600 };
  for (const [name, value] of [
    ["offsetWidth", VIEWPORT.width],
    ["offsetHeight", VIEWPORT.height],
  ] as const) {
    Object.defineProperty(window.HTMLElement.prototype, name, {
      configurable: true,
      get: () => value,
    });
  }
  window.Element.prototype.getBoundingClientRect = function (): DOMRect {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: VIEWPORT.width,
      bottom: VIEWPORT.height,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      toJSON: () => ({}),
    } as DOMRect;
  };
}

beforeEach(() => {
  installStorage("localStorage");
  installStorage("sessionStorage");
  installBrowserStubs();
});

afterEach(() => {
  cleanup();
});
