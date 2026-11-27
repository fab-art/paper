import { test, expect } from "@playwright/test";

test.describe("Projects workspace", () => {
  test("creates, edits, saves and restores a complete local project", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await page.goto("/projects");
    await page.getByPlaceholder("e.g. Diabetes medication adherence in Rwanda").fill("Project lifecycle acceptance");
    await page.getByPlaceholder("What do you want to investigate?").fill("Does local project data persist across routes?");
    await page.getByRole("button", { name: "Create project" }).click();

    await expect(page.getByLabel("Project name")).toHaveValue("Project lifecycle acceptance");
    await page.getByLabel("Objectives (one per line)").fill("Verify local persistence\nProtect existing records");
    await page.getByLabel("Methodology").fill("Prospective implementation evaluation");
    await page.getByLabel("Project status").selectOption("active");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toContainText("Project changes saved on this device.");

    const milestones = page.locator(".project-section").filter({ has: page.getByRole("heading", { name: "Milestones" }) });
    await milestones.getByLabel("New milestone").fill("Approve research protocol");
    await milestones.getByRole("button", { name: "Add" }).click();
    await expect(milestones.getByText("Approve research protocol")).toBeVisible();

    await page.getByLabel("Note title").fill("Implementation decision");
    await page.getByLabel("Note content").fill("Keep the existing IndexedDB database and project identity.");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("Implementation decision", { exact: true })).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: "protocol-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Research protocol acceptance fixture")
    });
    await expect(page.getByText("protocol-notes.txt", { exact: true })).toBeVisible();

    const projectPath = page.url();
    await page.reload();
    await expect(page.getByLabel("Project name")).toHaveValue("Project lifecycle acceptance");
    await expect(page.getByLabel("Objectives (one per line)")).toHaveValue("Verify local persistence\nProtect existing records");
    await expect(page.getByText("Implementation decision", { exact: true })).toBeVisible();
    await expect(page.getByText("protocol-notes.txt", { exact: true })).toBeVisible();
    await expect(page.getByText("Approve research protocol", { exact: true })).toBeVisible();

    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page).toHaveURL(/\/projects\/?$/);
    await page.getByRole("button", { name: /Archived/ }).click();
    await expect(page.getByRole("heading", { name: "Project lifecycle acceptance" })).toBeVisible();
    await page.getByRole("button", { name: "Restore" }).click();
    await page.getByRole("button", { name: /Active/ }).click();
    await expect(page.getByRole("heading", { name: "Project lifecycle acceptance" })).toBeVisible();

    expect(projectPath).toMatch(/\/projects\/project-/);
    expect(errors).toEqual([]);
  });

  test("keeps the project library usable at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: /Active projects/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});
