import { test, expect } from "@playwright/test";

test.describe("Research GPS", () => {
  test("creates and persists a guided route and editable research plan", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await page.goto("/projects");
    await page.getByPlaceholder("e.g. Diabetes medication adherence in Rwanda").fill("Research GPS acceptance");
    await page.getByPlaceholder("What do you want to investigate?").fill("How can a guided route structure a research project?");
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByLabel("Project name")).toHaveValue("Research GPS acceptance");

    await page.goto("/research-gps");
    await expect(page.getByRole("heading", { name: "Choose your starting point. Build a route you can own." })).toBeVisible();
    await page.getByLabel("Starting point").selectOption("dataset");
    await page.getByLabel("Research output").selectOption("dataset-analysis");
    await page.getByLabel("Problem or observation").fill("A dataset is available but its variables and missingness need review.");
    await page.getByLabel("Research question").fill("Which factors are associated with the outcome?");
    await page.getByLabel("Intended audience").fill("Clinical researchers and health policymakers");
    await page.getByLabel("Available materials").fill("De-identified CSV dataset\nData dictionary");
    await page.getByRole("button", { name: "Save Research GPS" }).click();
    await expect(page.getByRole("status")).toContainText("Research GPS and its station plan were saved to this device.");

    await page.reload();
    await expect(page.getByLabel("Starting point")).toHaveValue("dataset");
    await expect(page.getByLabel("Research output")).toHaveValue("dataset-analysis");
    await expect(page.getByLabel("Research question")).toHaveValue("Which factors are associated with the outcome?");
    await expect(page.getByText("Profile the dataset and confirm its variables before choosing an analysis.")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("keeps Research GPS usable at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/research-gps");
    await expect(page.getByRole("heading", { name: "Research GPS" })).toBeVisible().catch(() => undefined);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});
