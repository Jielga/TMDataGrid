import { expect, test } from "../support/test";

test("the front page renders under the shared header", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Switch package" }),
  ).toContainText("Nordic Map");
  await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
});

test("the Sweden map demo draws its map", async ({ page }) => {
  await page.goto("/#sweden-map");
  await expect(page.locator("svg path").first()).toBeVisible();
});

test("the Nordic map demo loads its cells and leaves the loader", async ({
  page,
}) => {
  const cell = page.waitForResponse(
    (response) => /cells\/0-0-0\.json/.test(response.url()) && response.ok(),
  );
  await page.goto("/#nordic-map");
  await cell;
  const map = page.getByRole("application", { name: "Map of Sweden" });
  await expect(map).toBeVisible();
  await expect(map.getByLabel("Loading map")).toHaveCount(0);
});
