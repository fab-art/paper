import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function installExistingProjectFixture(page) {
  await page.addInitScript(() => {
    const testWindow = window as Window & {
      __factoryFixtureReady?: boolean;
      __factoryObservedWrites?: string[];
    };
    testWindow.__factoryFixtureReady = false;
    testWindow.__factoryObservedWrites = [];

    const originalTransaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (storeNames, mode, options) {
      if (testWindow.__factoryFixtureReady && mode && mode !== "readonly") {
        testWindow.__factoryObservedWrites?.push(mode);
      }
      return originalTransaction.call(this, storeNames, mode, options);
    };

    const definitions: Record<string, { keyPath: string; indexes: string[] }> = {
      projects: { keyPath: "id", indexes: ["updatedAt", "name", "status"] },
      notes: { keyPath: "id", indexes: ["projectId", "updatedAt", "createdAt"] },
      attachments: { keyPath: "id", indexes: ["projectId", "createdAt", "name"] },
      searches: { keyPath: "id", indexes: ["projectId", "searchedAt"] },
      deletedProjects: { keyPath: "id", indexes: ["deletedAt"] },
      researchBlueprints: { keyPath: "id", indexes: ["projectId", "updatedAt", "lifecycleState", "paperType"] },
      researchEntities: { keyPath: "id", indexes: ["projectId", "entityType", "updatedAt", "status"] },
      researchRelations: { keyPath: "id", indexes: ["projectId", "fromEntityId", "toEntityId", "relationType"] },
      researchDecisions: { keyPath: "id", indexes: ["projectId", "subjectType", "subjectId", "createdAt", "approvedByOwner"] },
      researchTasks: { keyPath: "id", indexes: ["projectId", "stationId", "status", "createdAt", "updatedAt", "assignedAgentId"] },
      researchApprovals: { keyPath: "id", indexes: ["projectId", "taskId", "decision", "createdAt"] },
      researchControls: { keyPath: "projectId", indexes: ["agentsPaused", "updatedAt"] },
      researchAuditEvents: { keyPath: "id", indexes: ["projectId", "taskId", "actor", "createdAt"] }
    };

    const request = indexedDB.open("paperorchestra-studio", 6);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const [name, definition] of Object.entries(definitions)) {
        const store = database.createObjectStore(name, { keyPath: definition.keyPath });
        for (const index of definition.indexes) store.createIndex(index, index, { unique: false });
      }
    };
    request.onerror = () => { throw request.error; };
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("projects", "readwrite");
      transaction.objectStore("projects").put({
        id: "fixture-project-001",
        name: "Existing local research project",
        notes: "",
        latex: "",
        bibtex: "",
        template: "",
        outline: [],
        papers: [],
        figures: [],
        logs: "",
        agentRecords: [],
        updatedAt: Date.now(),
        researchQuestion: "Does the existing local project remain readable?",
        objectives: [],
        status: "active"
      });
      transaction.oncomplete = () => {
        testWindow.__factoryFixtureReady = true;
        database.close();
      };
      transaction.onerror = () => { throw transaction.error; };
    };
  });
}

test("Research Station reads an existing IndexedDB project without writes", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await installExistingProjectFixture(page);
  await page.goto("/");
  await page.waitForFunction(() => (window as Window & { __factoryFixtureReady?: boolean }).__factoryFixtureReady === true);

  await expect(page).toHaveTitle(/PaperOrchestra — Research Factory/);
  await expect(page.getByRole("heading", { name: "Research Station", level: 1 })).toBeVisible();
  await expect(page.getByText("Local workspace")).toBeVisible();
  await expect(page.getByText("Existing local research project")).toBeVisible();

  const writes = await page.evaluate(() =>
    (window as Window & { __factoryObservedWrites?: string[] }).__factoryObservedWrites ?? []
  );
  expect(writes).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("Research Factory navigation resolves the Projects route", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Projects" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();
});

test("dashboard has no page-level horizontal overflow at supported widths", async ({ page }) => {
  await page.goto("/");
  for (const width of [320, 375, 560, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }));
    expect(dimensions.content, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
  }
});

test("Research Station has no automated WCAG 2.2 A/AA violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Research Station", level: 1 })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("dark theme preference persists and passes WCAG 2.2 A/AA checks", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator(".factory-app")).toHaveAttribute("data-theme", "dark");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);

  await page.reload();
  await expect(page.locator(".factory-app")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator(".factory-app")).toHaveAttribute("data-theme", "light");
});

test("Projects route survives a direct load and browser refresh", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();
});

test("keyboard focus reaches skip navigation, brand and theme control", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /paperorchestra/i })).toBeFocused();
  await page.keyboard.press("Tab");
  const themeButton = page.getByRole("button", { name: "Switch to dark theme" });
  await expect(themeButton).toBeFocused();
  const outline = await themeButton.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).toBe("solid");
});

test("reduced-motion preference suppresses nonessential transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page.locator(".nav-item").first().evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(duration)).toBeLessThan(0.001);
});

test("empty local library is distinct from a storage failure", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Your research library is ready")).toBeVisible();
  await expect(page.getByText(/Projects you create or import will appear here/)).toBeVisible();
  await expect(page.getByText("Local workspace")).toBeVisible();
});

test("IndexedDB failures are announced without presenting an empty library", async ({ page }) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = function () {
      throw new DOMException("IndexedDB disabled by browser policy", "SecurityError");
    };
  });
  await page.goto("/");
  await expect(page.getByRole("alert").getByText("Local library unavailable")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("IndexedDB disabled by browser policy");
  await expect(page.getByText("Your research library is ready")).toHaveCount(0);
});
