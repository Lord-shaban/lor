import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  [375, 844],
  [768, 900],
  [1024, 900],
  [1440, 900],
] as const;

const copy = {
  ar: {
    path: "/ar/docs",
    direction: "rtl",
    title: "دليل الاجتماع وما بعده.",
    start: "شغّل المشروع محلياً.",
    workflow: "استخدم الغرفة من البداية إلى النهاية.",
    boundaries: "تعرّف إلى القدرات وحدودها.",
    architecture: "كيف ترتبط أجزاء المشروع؟",
    contribute: "قدّم تغييراً يمكن التحقق منه.",
    copy: "انسخ الأوامر",
    browse: "تصفح التوثيق",
  },
  en: {
    path: "/en/docs",
    direction: "ltr",
    title: "Meetings, documented.",
    start: "Run the project locally.",
    workflow: "Use the room from start to finish.",
    boundaries: "Know what the product includes.",
    architecture: "How the pieces fit together.",
    contribute: "Make a change others can verify.",
    copy: "Copy commands",
    browse: "Browse documentation",
  },
} as const;

test.describe("public documentation hub", () => {
  for (const locale of ["ar", "en"] as const) {
    test(`keeps the ${locale} docs navigable and responsive`, async ({ page }) => {
      const text = copy[locale];
      await page.emulateMedia({ reducedMotion: "reduce" });

      for (const [width, height] of VIEWPORTS) {
        await page.setViewportSize({ width, height });
        await page.goto(text.path);

        await expect(page.locator("html")).toHaveAttribute("dir", text.direction);
        await expect(page.getByRole("heading", { level: 1, name: text.title })).toBeVisible();
        await expect(
          page.locator("#documentation-content").getByRole("link", {
            name: locale === "en" ? "Try the live app" : "ابدأ اجتماعاً",
            exact: true,
          }).first(),
        ).toBeVisible();
        await expect(page.getByRole("button", { name: text.copy, exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: text.start })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: text.workflow })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: text.boundaries })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: text.architecture })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: text.contribute })).toBeVisible();

        for (const id of ["start", "what", "workflow", "boundaries", "architecture", "quick-start", "contribute", "help"]) {
          await expect(page.locator(`#${id}`)).toBeVisible();
        }
        await expect(page.locator("#boundaries table")).toHaveCount(1);
        await expect(page.locator("#boundaries thead th")).toHaveCount(3);
        await expect(page.locator("#boundaries tbody tr")).toHaveCount(4);
        if (width < 1024) {
          await expect(page.locator("#boundaries article")).toHaveCount(4);
          await expect(page.locator("#boundaries article").first()).toBeVisible();
        } else {
          await expect(page.locator("#boundaries table")).toBeVisible();
        }
        await expect(page.locator("#help details")).toHaveCount(4);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

        const mobileNavigation = page.getByRole("group").filter({ has: page.getByText(text.browse, { exact: true }) });
        if (width < 1024) {
          await expect(mobileNavigation.locator("summary")).toBeVisible();
          await mobileNavigation.locator("summary").click();
          await expect(mobileNavigation).toHaveAttribute("open", "");
        }
        const firstNav = width < 1024
          ? mobileNavigation.locator("nav a").first()
          : page.locator("aside > div nav a").first();
        await expect(firstNav).toBeVisible();
        await firstNav.focus();
        await expect(firstNav).toBeFocused();

        if (width < 1280) {
          const pageToc = page.locator("#documentation-content > details");
          await pageToc.locator("summary").click();
          await expect(pageToc).toHaveAttribute("open", "");
          await pageToc.locator('a[href="#workflow"]').click();
        } else {
          await page.locator('aside > nav a[href="#workflow"]').click();
        }
        await expect(page).toHaveURL(/#workflow$/);
        await expect(page.locator("#workflow-title")).toBeInViewport();
      }
    });
  }
});
