import { describe, expect, it } from "vitest";
import { distTag, selectMissing } from "./publish-missing.mjs";

const pkg = (name, version, extra = {}) => ({ name, version, ...extra });

describe("selectMissing", () => {
  it("publishes only public packages the registry lacks", () => {
    const packages = [
      pkg("@jielga/tmdatagrid", "2.1.0"),
      pkg("@jielga/tmdatagrid-excel", "2.1.0"),
      pkg("@jielga/docs", "0.0.0", { private: true }),
    ];
    const onRegistry = (name) => name === "@jielga/tmdatagrid";
    expect(selectMissing(packages, onRegistry).map((p) => p.name)).toEqual([
      "@jielga/tmdatagrid-excel",
    ]);
  });

  it("is empty when everything is published", () => {
    expect(selectMissing([pkg("a", "1.0.0")], () => true)).toEqual([]);
  });
});

describe("distTag", () => {
  it("is latest for a release", () => {
    expect(distTag("2.1.0")).toBe("latest");
  });

  it("is the prerelease identifier otherwise", () => {
    expect(distTag("2.0.0-beta.15")).toBe("beta");
    expect(distTag("3.0.0-rc.0")).toBe("rc");
  });
});
