import { test, expect } from "@playwright/test";

async function seedProject(page: import("@playwright/test").Page, withPaper = true) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Research Station", level: 1 })).toBeVisible();
  await page.evaluate(async (includePaper: boolean) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("paperorchestra-studio");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("projects", "readwrite");
        transaction.objectStore("projects").put({
          id: "phase11-14-e2e-project",
          name: "Phase 11–14 E2E research project",
          notes: "A deterministic local browser fixture.",
          latex: "\\documentclass{article}\n\\begin{document}A test manuscript.\\end{document}",
          bibtex: "@article{fixture2024, title={Research fixture}, author={Test, Researcher}, year={2024}}",
          template: "Generic Article",
          outline: [],
          papers: includePaper ? [{
            title: "Community health intervention outcomes",
            authors: ["Amina Researcher", "John Analyst"],
            year: 2023,
            doi: "10.1000/evidence-fixture",
            abstract: "A study of community health interventions.",
            venue: "Journal of Public Health",
            source: "manual"
          }] : [],
          figures: [],
          logs: "",
          agentRecords: [],
          updatedAt: Date.now(),
          revision: 0,
          researchQuestion: "Which community interventions improve health outcomes?",
          objectives: ["Assess health outcomes"],
          methodology: "Mixed methods",
          status: "planning",
          milestones: []
        });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => { database.close(); reject(transaction.error); };
      };
    });
  }, withPaper);
  await page.reload();
}

async function approveBlueprintAndStartFirstTask(page: import("@playwright/test").Page) {
  await page.goto("/blueprint");
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
  await page.getByRole("button", { name: "Start task" }).first().click();
  await expect(page.getByRole("button", { name: "Confirm complete" }).first()).toBeVisible();
}

test.describe("Research Factory phases 11–14", () => {
  test("Phase 11: orchestration only offers a bounded task brief after blueprint approval", async ({ page }) => {
    await seedProject(page, true);
    await approveBlueprintAndStartFirstTask(page);
    await page.goto("/orchestration");
    await expect(page.getByText("Browser-local research assistant")).toBeVisible();
    await page.getByLabel("Task to orchestrate").selectOption("task:phase11-14-e2e-project:protocol");
    await expect(page.getByText("Ready for AI assistance")).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy task prompt" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Generate with local model" })).toBeDisabled();
    await expect(page.getByText(/The model is downloaded and run on this device/)).toBeVisible();
  });

  test("Phase 12: systematic review protocol and screening decisions persist locally", async ({ page }) => {
    await seedProject(page, true);
    await page.goto("/systematic-reviews");
    await expect(page.getByRole("heading", { name: "Systematic review management" })).toBeVisible();

    await page.getByRole("button", { name: "Protocol", exact: true }).click();
    await page.getByLabel("Population").fill("Adults with type 2 diabetes");
    await page.getByLabel("Intervention / exposure").fill("Community-based follow-up");
    await page.getByLabel("Outcomes").fill("Glycaemic control and continuity of care");
    await page.getByLabel("Databases searched").fill("PubMed, Scopus");
    await expect(page.getByRole("status")).toContainText("Systematic review changes saved locally.");

    await page.getByRole("button", { name: "Screening" }).click();
    await page.getByRole("button", { name: "Mark Community health intervention outcomes include at title/abstract stage" }).click();
    await page.getByLabel("Full text retrieved").check();
    await page.getByLabel("Full-text decision").selectOption("include");
    await expect(page.getByText("1 included full-text study/studies")).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "Protocol", exact: true }).click();
    await expect(page.getByLabel("Population")).toHaveValue("Adults with type 2 diabetes");
  });

  test("Phase 13: scientific audit requires named review of every finding before sign-off", async ({ page }) => {
    await seedProject(page, true);
    await page.goto("/quality");
    await expect(page.getByRole("heading", { name: "Scientific audit", exact: true })).toBeVisible();
    await page.getByPlaceholder("Required for every audit decision").fill("Test Reviewer");

    const findings = page.locator(".publish-finding");
    const count = await findings.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      const finding = findings.nth(index);
      await finding.locator("select").selectOption("verified");
      await finding.locator("textarea").fill("Reviewed against the deterministic E2E project record.");
      await finding.getByRole("button", { name: "Save review" }).click();
      await expect(page.getByRole("status")).toContainText("Scientific audit saved in the local project.");
    }
    await expect(page.getByRole("button", { name: "Sign off audit" })).toBeEnabled();
    await page.getByRole("button", { name: "Sign off audit" }).click();
    await expect(page.getByText("Signed by Test Reviewer")).toBeVisible();
  });

  test("Phase 13: publication metadata saves and drafts a cover letter without submitting externally", async ({ page }) => {
    await seedProject(page, true);
    await page.goto("/publication");
    await expect(page.getByRole("heading", { name: "Publication workspace" })).toBeVisible();
    await page.getByLabel("Target journal").fill("Journal of Public Health");
    await page.getByLabel("Manuscript title").fill("Community-based diabetes care outcomes");
    await page.getByLabel("Abstract").fill("This fixture abstract summarizes a community-based diabetes care study.");
    await page.getByLabel("Keywords").fill("diabetes, community health, primary care");
    await page.getByRole("button", { name: "Add author" }).click();
    await page.getByLabel("Name").fill("Test Researcher");
    await page.getByLabel("Affiliation").fill("Research Institute");
    await page.getByLabel("Corresponding author").check();
    await page.getByLabel("Ethics approval and consent").fill("Approved by the institutional ethics committee.");
    await page.getByLabel("Funding statement").fill("No external funding.");
    await page.getByLabel("Conflict of interest").fill("The authors declare no competing interests.");
    await page.getByLabel("Data availability").fill("De-identified data are available on reasonable request.");
    await page.getByRole("button", { name: "Save metadata" }).click();
    await expect(page.getByRole("status")).toContainText("Publication metadata saved locally.");
    await page.getByRole("button", { name: "Draft cover letter" }).click();
    await expect(page.locator(".publication-letter")).not.toHaveValue("");
    await expect(page.getByText("draft", { exact: true })).toBeVisible();
  });

  test("Phase 14: settings persist appearance and export a local project backup", async ({ page }) => {
    await seedProject(page, true);
    await page.goto("/settings");
    await expect(page.locator(".manage-toolbar h2")).toHaveText("Settings");
    await page.locator(".manage-setting-row select").selectOption("dark");
    await expect(page.locator(".factory-app")).toHaveAttribute("data-theme", "dark");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export JSON backup" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^paperorchestra-backup-.*\\.json$/);
  });

  test("Phase 14: collaboration does not upload local projects before explicit sign-in and sharing", async ({ page }) => {
    await seedProject(page, true);
    await page.goto("/collaboration");
    await expect(page.getByRole("heading", { name: /Work together, by invitation|Cloud collaboration is not configured/ })).toBeVisible();
    await expect(page.getByText(/Your local research library remains separate until you explicitly share a project|Local projects continue to work without cloud access/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Share project" })).toHaveCount(0);
  });
});
