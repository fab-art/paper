import { test, expect } from "@playwright/test";

test.describe("Data & Methods workspace", () => {
  test("opens the local-first dataset analysis station", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/data");
    await expect(page.getByRole("heading", { name: "Data & Methods" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Research data, understood." })).toBeVisible();
    await expect(page.getByText("On-device analysis")).toBeVisible();
    await expect(page.getByText(/No research projects yet|No tabular dataset uploaded yet|Upload a .csv or .tsv/i)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("keeps the dataset workspace usable at a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/data");
    await expect(page.getByRole("heading", { name: "Research data, understood." })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});
