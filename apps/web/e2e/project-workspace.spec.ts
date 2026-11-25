import { test, expect } from "@playwright/test";

async function createProject(page, name = "Phase 2 integration project") {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Project name").fill(name);
  await page.getByLabel("Research question").fill("Which factors predict treatment response?");
  await page.getByLabel("Research context").fill("A locally stored project used to verify the new workspace.");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Project workspace", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Project name")).toHaveValue(name);
}

test("creates, edits and reloads a project with notes, sources and milestones", async ({ page }) => {
  await createProject(page);

  await page.getByLabel("Research question").fill("What predicts long-term treatment response?");
  await page.getByLabel("Objectives (one per line)").fill("Estimate response\nIdentify predictors");
  await page.getByLabel("Methodology").fill("Retrospective cohort study");
  await page.getByLabel("New milestone").fill("Approve protocol");
  await page.getByLabel("Due date").fill("2026-12-15");
  await page.getByRole("button", { name: "Add milestone" }).click();
  await expect(page.getByText("Approve protocol")).toBeVisible();

  await page.getByRole("tab", { name: /Research library/ }).click();
  await page.getByLabel("Paper title").fill("Precision medicine in diabetes");
  await page.getByLabel("Authors (comma separated)").fill("A. Researcher, B. Clinician");
  await page.getByLabel("Year").fill("2025");
  await page.getByLabel("DOI").fill("10.1000/phase2.1");
  await page.getByLabel("Journal / venue").fill("Journal of Clinical Research");
  await page.getByRole("button", { name: "Add source" }).click();
  await expect(page.getByText("Precision medicine in diabetes")).toBeVisible();

  await page.getByLabel("Paper title").fill("A different title for the same paper");
  await page.getByLabel("DOI").fill("https://doi.org/10.1000/PHASE2.1");
  await page.getByRole("button", { name: "Add source" }).click();
  await expect(page.getByText(/already exists in the project library/)).toBeVisible();

  await page.getByRole("tab", { name: /Notes/ }).click();
  await page.getByLabel("Note title").fill("Eligibility criteria");
  await page.getByLabel("Content").fill("Include adults with type 2 diabetes.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Eligibility criteria")).toBeVisible();

  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByLabel("Project name")).toHaveValue("Phase 2 integration project");
  await expect(page.getByLabel("Research question")).toHaveValue("What predicts long-term treatment response?");
  await expect(page.getByText("Approve protocol")).toBeVisible();
  await page.getByRole("tab", { name: /Research library/ }).click();
  await expect(page.getByText("Precision medicine in diabetes")).toBeVisible();
  await expect(page.getByText("A different title for the same paper")).toHaveCount(0);
  await page.getByRole("tab", { name: /Notes/ }).click();
  await expect(page.getByText("Eligibility criteria")).toBeVisible();
});

test("uploads, downloads and deletes a local project attachment", async ({ page }) => {
  await createProject(page, "Attachment lifecycle project");
  await page.getByRole("tab", { name: /Files/ }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "protocol-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Local project attachment test")
  });
  await expect(page.getByText("protocol-notes.txt")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("protocol-notes.txt");

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Delete/ }).click();
  await expect(page.getByText("No files are attached to this project yet.")).toBeVisible();
});

test("archives, restores and permanently deletes projects as separate actions", async ({ page }) => {
  await createProject(page, "Project lifecycle test");
  await page.locator(".project-workspace-header").getByRole("button", { name: "Projects" }).click();

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("Start your first research project")).toBeVisible();

  await page.getByRole("button", { name: /Archived/ }).click();
  await expect(page.getByText("Project lifecycle test")).toBeVisible();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("Project lifecycle test")).toBeVisible();

  await page.getByRole("button", { name: "Archive" }).click();
  await page.getByRole("button", { name: /Archived/ }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByText("No archived projects")).toBeVisible();
});
