import { openDemoGrid } from "../support/docsSite";
import { expect, test } from "../support/test";

test("a shift-click selects the block between two cells", async ({
  page,
}) => {
  // The demo starts in range mode.
  const grid = await openDemoGrid(page, {
    route: "/docs/cell-selection",
    file: "cells/CellSelection.tsx",
  });
  await expect(grid.root.getByRole("grid")).toBeVisible();
  const corner = grid.cell({ rowId: "2", columnId: "firstName" });
  await expect(corner).toHaveRole("gridcell");

  await corner.click();
  await grid
    .cell({ rowId: "4", columnId: "department" })
    .click({ modifiers: ["Shift"] });

  for (const rowId of ["2", "3", "4"]) {
    for (const columnId of ["firstName", "lastName", "department"]) {
      await expect(grid.cell({ rowId, columnId })).toHaveAttribute(
        "data-selected",
        "true",
      );
    }
  }
  for (const outside of [
    { rowId: "1", columnId: "firstName" },
    { rowId: "5", columnId: "lastName" },
    { rowId: "3", columnId: "salary" },
  ]) {
    await expect(grid.cell(outside)).not.toHaveAttribute("data-selected");
  }
});
