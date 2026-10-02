import { expect, test } from "../support/test";

// Every page in turn, in one test: the console-error fixture fails it on any
// runtime error a page logs while it renders.
test("every docs page renders without errors", async ({ page }) => {
  // About 35 pages at under a second each: more than the default 30 s once
  // the other specs share the machine.
  test.setTimeout(120_000);
  await page.goto("/docs");
  const links = page.locator('a[href^="/docs/"]');
  await expect(links.first()).toBeVisible();
  const hrefs = await links.evaluateAll((anchors) => {
    return anchors.map((anchor) => anchor.getAttribute("href") ?? "");
  });
  const routes = ["/", "/playground", ...new Set(hrefs)];

  for (const route of routes) {
    await test.step(route, async () => {
      await page.goto(route);
      await expect(page.locator("main").first()).toBeVisible();
    });
  }
});
