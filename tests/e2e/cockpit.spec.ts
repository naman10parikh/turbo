// turbo cockpit E2E (CP123 Cluster G / G29). Drives all 4 views + screenshots for the chairman.
// Design-law verified: warm-black bg (#141312, not pure black), serif+sans, no gray-box placeholders.
// Read-mostly (Q5): the cockpit never triggers a build/audit — these tests only read.

import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const SHOTS = join(process.cwd(), "content", "screenshots");
mkdirSync(SHOTS, { recursive: true });

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

test("masthead + warm-black design law", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".wordmark")).toHaveText("turbo");
  // Warm-black, NOT pure black (#000) — the design law.
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(20, 19, 18)"); // #141312
  // The four stat tiles render (no gray-box placeholders).
  await expect(page.locator(".stat")).toHaveCount(4);
  await page.screenshot({ path: join(SHOTS, "cockpit-01-masthead.png"), fullPage: true });
});

test("VIEW 1 — brain browser renders + search works", async ({ page }) => {
  await page.goto("/");
  // The six brain artifacts are listed.
  await expect(page.locator(".brain-files button")).toHaveCount(6);
  // Default doc loaded (KNOWN-PITFALLS).
  await expect(page.locator(".brain-body h1, .brain-body h2")).not.toHaveCount(0);
  // Search "PATCH default" → P-04 hit appears.
  await page.fill("#brain-q", "PATCH default data loss");
  await expect(page.locator(".hit-id").first()).toContainText("P-04", { timeout: 5000 });
  await page.screenshot({ path: join(SHOTS, "cockpit-02-brain-search.png"), fullPage: true });
});

test("VIEW 2 — ask the employee answers a P-id with detection+fix", async ({ page }) => {
  await page.goto("/");
  await page.click('.rail button[data-view="ask"]');
  await expect(page.locator("#view-ask")).toBeVisible();
  // Click the P-02 chip → an answer card with detection+fix renders.
  await page.click('.chip[data-id="P-02"]');
  await expect(page.locator(".answer-card .a-id").first()).toContainText("P-02", { timeout: 5000 });
  await expect(page.locator(".answer-card .a-body").first()).not.toBeEmpty();
  // The echo-boundary surfaces on a rate-limit question.
  await page.fill("#ask-q", "rate limiting and cache");
  await page.click("#ask-go");
  await expect(page.locator(".boundary-note")).toContainText("echo", { timeout: 5000 });
  await page.screenshot({ path: join(SHOTS, "cockpit-03-ask-employee.png"), fullPage: true });
});

test("VIEW 3 — run log shows logged turbo runs", async ({ page }) => {
  await page.goto("/");
  await page.click('.rail button[data-view="runs"]');
  await expect(page.locator("#view-runs")).toBeVisible();
  // At least one row, and at least one 'api' command (the acceptance run).
  await expect(page.locator("#runs-body tr").first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator("#runs-body .c-cmd", { hasText: "api" }).first()).toBeVisible();
  await page.screenshot({ path: join(SHOTS, "cockpit-04-run-log.png"), fullPage: true });
});

test("VIEW 4 — eval scores show the pyramid green/red", async ({ page }) => {
  await page.goto("/");
  await page.click('.rail button[data-view="evals"]');
  await expect(page.locator("#view-evals")).toBeVisible();
  // The summary cards + the per-task grid (G1..G13) render.
  await expect(page.locator(".sum-card").first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator(".eval-card")).toHaveCount(13);
  // The acceptance gate tile reads PASS (13/13 green in the cached result).
  await expect(page.locator(".sum-card", { hasText: "acceptance gate" })).toContainText("PASS");
  await page.screenshot({ path: join(SHOTS, "cockpit-05-eval-scores.png"), fullPage: true });
});
