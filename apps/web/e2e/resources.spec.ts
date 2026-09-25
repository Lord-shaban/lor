import { expect, test } from "@playwright/test";

const topics = ["security", "contributing", "roadmap", "license", "help", "source"] as const;

test("public help links open dedicated localized pages", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await page.goto("/ar");
  await page.locator("header details summary").click();

  for (const topic of topics) {
    await expect(page.locator(`header a[href="/resources/${topic}"]`)).toHaveCount(1);
  }

  for (const locale of ["ar", "en"] as const) {
    for (const topic of topics) {
      const path = locale === "ar" ? `/ar/resources/${topic}` : `/en/resources/${topic}`;
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("main section").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }

  await page.goto("/ar/resources/security");
  await page.getByRole("link", { name: /English/ }).click();
  await expect(page).toHaveURL(/\/en\/resources\/security$/);
});
