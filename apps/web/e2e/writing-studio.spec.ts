import { test, expect } from "@playwright/test";

test.describe("Writing Studio", () => {
  test("opens the manuscript workspace and guides users without a project", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/writing");
    await expect(page.getByRole("heading", { name: "Writing Studio" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Start with a research project." })).toBeVisible();
    await expect(page.getByRole("button", { name: /Open Projects/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("keeps the writing entry state usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/writing");
    await expect(page.getByRole("heading", { name: "Start with a research project." })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});
