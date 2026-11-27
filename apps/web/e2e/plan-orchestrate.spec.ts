import { test, expect } from "@playwright/test";

async function seedProject(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("paperorchestra-studio");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("projects", "readwrite");
        transaction.objectStore("projects").put({
          id: "phase10-research-fixture",
          name: "Phase 10 Research Project",
          notes: "",
          latex: "",
          bibtex: "",
          template: "Generic Article",
          outline: [],
          papers: [],
          figures: [],
          logs: "",
          agentRecords: [],
          updatedAt: Date.now(),
          revision: 0,
          researchQuestion: "",
          objectives: [],
          methodology: "",
          status: "planning",
          milestones: []
        });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => { database.close(); reject(transaction.error); };
      };
    });
  });
}

test.describe("Plan & Orchestrate", () => {
  test("builds and approves a blueprint, then advances dependent production tasks", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await seedProject(page);

    await page.goto("/blueprint");
    await expect(page.getByRole("heading", { name: "Build a defensible research plan." })).toBeVisible();
    await page.getByLabel("Primary research question").fill("Which interventions improve diabetes outcomes in primary care?");
    await page.getByLabel(/Specific objectives/).fill("Assess glycaemic control\nCompare care models");
    await page.getByLabel("Methodology").fill("Mixed-methods prospective study");
    await page.getByLabel("Inclusion criteria").fill("Adults with type 2 diabetes attending primary care");
    await page.getByLabel("Exclusion criteria").fill("People unable to provide informed consent");
    await page.getByLabel("Analysis plan").fill("Descriptive statistics and multivariable regression");
    await page.getByRole("button", { name: "Save blueprint" }).click();
    await expect(page.getByRole("status")).toContainText("Blueprint saved to this device.");
    await page.getByRole("button", { name: "Approve blueprint" }).click();
    await expect(page.getByText("Researcher approved", { exact: true })).toBeVisible();

    await page.goto("/production");
    await expect(page.getByRole("heading", { name: "One connected research workflow." })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Research workflow completion" })).toHaveAttribute("aria-valuenow", "0");
    await page.getByRole("button", { name: "Start task" }).first().click();
    await page.getByRole("button", { name: "Confirm complete" }).click();
    await expect(page.getByRole("progressbar", { name: "Research workflow completion" })).toHaveAttribute("aria-valuenow", "14");
    await expect(page.getByRole("button", { name: "Start task" }).first()).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test("keeps both planning workspaces within a narrow mobile viewport", async ({ page }) => {
    await seedProject(page);
    await page.setViewportSize({ width: 375, height: 812 });
    for (const path of ["/blueprint", "/production"]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, path + " should not cause page-level horizontal overflow").toBe(false);
    }
  });
});
