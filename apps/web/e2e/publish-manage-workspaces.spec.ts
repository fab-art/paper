import { test, expect } from "@playwright/test";

test.describe("Publish and Manage workspaces", () => {
  test("direct routes load their expected empty or local-first states", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const routes = [
      { path: "/systematic-reviews", text: "Systematic review management" },
      { path: "/quality", text: "Create a research project first" },
      { path: "/publication", text: "Create a research project first" },
      { path: "/collaboration", text: /Cloud collaboration is not configured|Work together, by invitation/ },
      { path: "/settings", text: "Settings" }
    ];
    for (const route of routes) {
      await page.goto(route.path);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByText(route.text).first()).toBeVisible();
      await page.reload();
      await expect(page.locator("main")).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test("Publish and Manage routes stay within a narrow mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/systematic-reviews", "/quality", "/publication", "/collaboration", "/settings"]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, path + " should not cause page-level horizontal overflow").toBe(false);
    }
  });

  test("settings theme selector updates the visible theme", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    await page.getByLabel("Color theme").selectOption("dark");
    await expect(page.locator(".factory-app")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator(".factory-app")).toHaveAttribute("data-theme", "dark");
  });
});
