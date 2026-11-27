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
  test("opens an existing local manuscript and autosaves LaTeX edits", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Research Station" })).toBeVisible();

    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("paperorchestra-studio");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("projects", "readwrite");
          transaction.objectStore("projects").put({
            id: "writing-fixture-001",
            name: "Writing Studio Existing Manuscript",
            notes: "Research question: Does the local manuscript open?",
            latex: "\\documentclass{article}\\n\\begin{document}\\nInitial draft\\n\\end{document}",
            bibtex: "",
            template: "Generic Article",
            outline: [{ id: "methods", title: "Methods", description: "Study methods" }],
            papers: [],
            figures: [],
            logs: "",
            agentRecords: [],
            updatedAt: Date.now(),
            revision: 0,
            status: "active"
          });
          transaction.oncomplete = () => { database.close(); resolve(); };
          transaction.onerror = () => { database.close(); reject(transaction.error); };
        };
      });
    });

    await page.goto("/writing");
    await expect(page.getByRole("textbox", { name: "Project name" })).toHaveValue("Writing Studio Existing Manuscript");
    await page.getByRole("button", { name: "LaTeX editor" }).click();
    const editor = page.getByRole("textbox", { name: "LaTeX manuscript source" });
    await expect(editor).toBeVisible();
    await editor.fill("\\documentclass{article}\\n\\begin{document}\\nAutosaved manuscript text\\n\\end{document}");

    await expect.poll(async () => page.evaluate(async () => {
      return await new Promise<string>((resolve, reject) => {
        const request = indexedDB.open("paperorchestra-studio");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("projects", "readonly");
          const read = transaction.objectStore("projects").get("writing-fixture-001");
          read.onsuccess = () => { const value = read.result?.latex ?? ""; database.close(); resolve(value); };
          read.onerror = () => { database.close(); reject(read.error); };
        };
      });
    })).toContain("Autosaved manuscript text");
    expect(errors).toEqual([]);
  });

});
