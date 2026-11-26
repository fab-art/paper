import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function installExistingProjectFixture(page, withPaper = false) {
  await page.addInitScript((includePaper: boolean) => {
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

    const request = indexedDB.open("paperorchestra-studio");
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
      const existingCheck = database.transaction("projects", "readonly").objectStore("projects").get("fixture-project-001");
      existingCheck.onsuccess = () => {
        if (existingCheck.result) {
          if (includePaper && !(existingCheck.result.papers ?? []).length) {
            const updateExisting = database.transaction("projects", "readwrite");
            updateExisting.objectStore("projects").put({
              ...existingCheck.result,
              papers: [{ title: "Community health intervention outcomes", authors: ["Amina Researcher", "John Analyst"], year: 2023, doi: "10.1000/evidence-fixture", venue: "Journal of Public Health", source: "manual" }]
            });
            updateExisting.oncomplete = () => {
              testWindow.__factoryFixtureReady = true;
              database.close();
            };
            updateExisting.onerror = () => { throw updateExisting.error; };
            return;
          }
          testWindow.__factoryFixtureReady = true;
          database.close();
          return;
        }
        const transaction = database.transaction("projects", "readwrite");
        transaction.objectStore("projects").put({
          id: "fixture-project-001",
          name: "Existing local research project",
          notes: "",
          latex: "",
          bibtex: "",
          template: "",
          outline: [],
          papers: includePaper ? [{ title: "Community health intervention outcomes", authors: ["Amina Researcher", "John Analyst"], year: 2023, doi: "10.1000/evidence-fixture", venue: "Journal of Public Health", source: "manual" }] : [],
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
    };
  });
}


async function addEvidencePaperFixture(page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("paperorchestra-studio");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("projects", "readwrite");
        const store = transaction.objectStore("projects");
        const getProject = store.get("fixture-project-001");
        getProject.onsuccess = () => {
          const project = getProject.result;
          if (!project) {
            reject(new Error("The IndexedDB evidence fixture project was not created."));
            database.close();
            return;
          }
          store.put({
            ...project,
            papers: [{
              title: "Community health intervention outcomes",
              authors: ["Amina Researcher", "John Analyst"],
              year: 2023,
              doi: "10.1000/evidence-fixture",
              venue: "Journal of Public Health",
              source: "manual"
            }]
          });
        };
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => { database.close(); reject(transaction.error); };
      };
    });
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
  await expect(page.getByText(/This Phase 1 preview is read-only/)).toBeVisible();
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
  await expect(page.locator(".count-pill")).toHaveText("—");
  await expect(page.getByText("Your research library is ready")).toHaveCount(0);
});


test("Literature Discovery searches, saves to the selected project and exports BibTeX", async ({ page }) => {
  const requestBodies: unknown[] = [];
  await installExistingProjectFixture(page);
  await page.route("**/api/search-papers", async route => {
    requestBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        papers: [{
          title: "Digital interventions for diabetes adherence",
          authors: ["Amina Example", "John Researcher"],
          source: "semantic-scholar",
          year: 2024,
          abstract: "A sample abstract for the discovery workflow.",
          url: "https://www.semanticscholar.org/paper/example",
          doi: "10.1000/example-doi",
          venue: "Journal of Digital Health",
          citationCount: 12,
          openAccessPdf: "https://example.org/paper.pdf",
          publicationDate: "2024-02-01"
        }]
      })
    });
  });

  await page.goto("/literature");
  await expect(page.getByRole("heading", { name: "Find research worth reading." })).toBeVisible();
  await page.getByLabel("Search scholarly literature").fill("diabetes adherence in Rwanda");
  await page.getByRole("button", { name: "Search papers" }).click();

  await expect(page.getByRole("heading", { name: "Digital interventions for diabetes adherence" })).toBeVisible();
  await expect(page.getByText("Found 1 unique records from Semantic Scholar.")).toBeVisible();
  await expect(page.getByRole("link", { name: /DOI/ })).toHaveAttribute("href", "https://doi.org/10.1000/example-doi");
  await expect(page.getByRole("button", { name: "Save to project" })).toBeEnabled();
  expect(requestBodies).toEqual([{ query: "diabetes adherence in Rwanda", limit: 20 }]);

  await page.getByRole("button", { name: "Save to project" }).click();
  await expect(page.getByText("Paper saved to the selected project and its BibTeX reference added.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh metadata" })).toBeVisible();
  await expect(page.locator(".literature-saved-summary strong")).toHaveText("1");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export BibTeX" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("existing-local-research-project-references.bib");
});

test("Literature Discovery deduplicates DOI variants and filters open-access results", async ({ page }) => {
  await installExistingProjectFixture(page);
  await page.route("**/api/search-papers", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      papers: [
        { title: "A diabetes intervention study", authors: ["A Author"], year: 2024, doi: "10.1000/duplicate", citationCount: 5 },
        { title: "Different provider title", authors: ["B Author"], year: 2024, doi: "https://doi.org/10.1000/DUPLICATE", abstract: "Additional abstract", openAccessPdf: "https://example.org/open.pdf" },
        { title: "A closed access study", authors: ["C Author"], year: 2019, doi: "10.1000/closed" }
      ]
    })
  }));

  await page.goto("/literature");
  await page.getByLabel("Search scholarly literature").fill("diabetes intervention");
  await page.getByRole("button", { name: "Search papers" }).click();
  await expect(page.getByText("Found 2 unique records from Semantic Scholar.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "A diabetes intervention study" })).toBeVisible();
  await expect(page.getByText("Additional abstract")).toHaveCount(1);
  await page.getByLabel("Open access").check();
  await expect(page.getByRole("heading", { name: "A diabetes intervention study" })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "A closed access study" })).toHaveCount(0);
});

test("Literature Discovery explains provider rate limits and stays within mobile viewport", async ({ page }) => {
  await installExistingProjectFixture(page);
  await page.route("**/api/search-papers", route => route.fulfill({
    status: 429,
    headers: { "Retry-After": "30" },
    contentType: "application/json",
    body: JSON.stringify({ detail: "Semantic Scholar is temporarily rate limited.", retryAfterSeconds: 30 })
  }));

  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto("/literature");
  await page.getByLabel("Search scholarly literature").fill("diabetes research");
  await page.getByRole("button", { name: "Search papers" }).click();
  await expect(page.getByRole("alert")).toContainText("Retry in about 30 seconds.");
  await expect(page.getByText("Provider cooldown is active; repeated retries will not bypass it.")).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});


test("Literature Discovery direct route survives refresh and has an accessible empty state", async ({ page }) => {
  await installExistingProjectFixture(page);
  await page.goto("/literature");
  await expect(page.getByRole("heading", { name: "Find research worth reading." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Find research worth reading." })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});


test("Evidence Workspace extracts, appraises and persists study-level records", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", error => browserErrors.push(error.message));
  page.on("console", message => { if (message.type() === "error") browserErrors.push(message.text()); });
  await installExistingProjectFixture(page, true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/evidence");
  await page.waitForFunction(() => (window as Window & { __factoryFixtureReady?: boolean }).__factoryFixtureReady === true);
  await addEvidencePaperFixture(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Evidence Workspace", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Community health intervention outcomes" })).toBeVisible();

  await page.getByLabel("Study design").fill("Cluster-randomized controlled trial");
  const firstDomain = page.locator(".evidence-domain").first();
  await firstDomain.getByRole("combobox").selectOption("low");
  await firstDomain.getByLabel(/Rationale/).fill("The methods describe computer-generated allocation and concealment.");
  await firstDomain.getByLabel("Source location").fill("Methods, page 4");
  await page.getByRole("button", { name: "Save evidence record" }).click();
  await expect(page.getByRole("status")).toContainText("Study extraction and appraisal saved on this device.");

  await page.reload();
  await expect(page.getByLabel("Study design")).toHaveValue("Cluster-randomized controlled trial");
  const reloadedDomain = page.locator(".evidence-domain").first();
  await expect(reloadedDomain.getByRole("combobox")).toHaveValue("low");
  await expect(reloadedDomain.getByLabel(/Rationale/)).toHaveValue("The methods describe computer-generated allocation and concealment.");
  expect(browserErrors).toEqual([]);

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("Evidence Workspace remains within a narrow mobile viewport", async ({ page }) => {
  await installExistingProjectFixture(page, true);
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto("/evidence");
  await expect(page.getByRole("heading", { name: "Evidence Workspace", level: 1 })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});


test("Evidence intelligence links researcher-recorded source passages to claims", async ({ page }) => {
  await installExistingProjectFixture(page, true);
  await page.goto("/evidence");
  await page.waitForFunction(() => (window as Window & { __factoryFixtureReady?: boolean }).__factoryFixtureReady === true);
  await addEvidencePaperFixture(page);
  await page.reload();
  await page.getByRole("button", { name: "Evidence intelligence & protocol" }).click();

  await page.getByLabel("New research claim").fill("Community-based interventions improve continuity of diabetes care.");
  await page.getByRole("button", { name: "Add claim" }).click();
  await expect(page.getByText("Claim saved as awaiting verification. Add source-level evidence before relying on it.")).toBeVisible();

  const sourceEvidenceForm = page.locator(".re-grid .re-panel").nth(1);
  await sourceEvidenceForm.locator("select").nth(0).selectOption({ label: "Community-based interventions improve continuity of diabetes care." });
  await sourceEvidenceForm.locator("select").nth(1).selectOption({ label: "Community health intervention outcomes" });
  await sourceEvidenceForm.getByLabel("Exact source passage").fill("Participants receiving community follow-up had higher continuity of care at 12 months.");
  await sourceEvidenceForm.getByLabel("Page, table, figure or section").fill("Results, page 8, Table 3");
  await sourceEvidenceForm.getByLabel("How does this passage relate to the claim?").selectOption("supports");
  await page.getByRole("button", { name: "Record evidence assessment" }).click();

  await expect(page.getByText("Evidence passage and source relationship saved. Its assessment remains visible for researcher review.")).toBeVisible();
  await expect(page.getByText("Results, page 8, Table 3")).toBeVisible();
  await expect(page.getByText("Supported", { exact: true })).toBeVisible();
});

test("Evidence intelligence protocol builder saves an owner-review draft", async ({ page }) => {
  await installExistingProjectFixture(page, true);
  await page.goto("/evidence");
  await page.waitForFunction(() => (window as Window & { __factoryFixtureReady?: boolean }).__factoryFixtureReady === true);
  await addEvidencePaperFixture(page);
  await page.reload();
  await page.getByRole("button", { name: "Evidence intelligence & protocol" }).click();
  await page.getByRole("button", { name: "Protocol & methods" }).click();

  await page.getByLabel("Research question").fill("Does community follow-up improve continuity of diabetes care?");
  await page.getByLabel("Study design").fill("Retrospective cohort study");
  await page.getByLabel("Setting").fill("Primary healthcare facilities in Rwanda");
  await page.getByLabel("Population").fill("Adults receiving diabetes care");
  await page.getByLabel("Planned sample size").fill("240");
  await page.getByLabel("Primary and secondary outcomes").fill("Continuity of care at 12 months");
  await page.getByLabel("Analysis plan").fill("Estimate adjusted association using multivariable regression.");
  await page.getByRole("button", { name: "Save protocol draft" }).click();

  await expect(page.getByRole("status")).toContainText("Protocol saved and marked ready for your review. It is not approved or registered.");
  await expect(page.getByText("Ready for owner review")).toBeVisible();
});
