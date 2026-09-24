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
    title: "الروم سهلة. والحدود مكتوبة.",
    start: "شغّل نفس الروم اللي شفتها.",
    workflow: "الاجتماع بيبقى سجل إزاي؟",
    boundaries: "LOR.‎ بتوعد بإيه دلوقتي؟",
    architecture: "طلبات قصيرة. وروم مباشرة واحدة.",
    contribute: "اعمل تغيير صغير قابل للتكرار.",
    copy: "انسخ الأوامر",
  },
  en: {
    path: "/en/docs",
    direction: "ltr",
    title: "The room is easy. The edges are documented.",
    start: "Run the same room you just saw.",
    workflow: "How a meeting becomes a record.",
    boundaries: "What LOR. promises today.",
    architecture: "Short requests. One real-time room.",
    contribute: "Make one small change reproducible.",
    copy: "Copy commands",
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
          page.getByRole("link", {
            name: locale === "en" ? "Try the app" : "جرّب الموقع",
            exact: true,
          }),
        ).toBeVisible();
        await expect(page.getByRole("button", { name: text.copy, exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: text.start })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: text.workflow })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: text.boundaries })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: text.architecture })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: text.contribute })).toBeVisible();

        for (const id of ["start", "what", "workflow", "boundaries", "architecture", "contribute", "help"]) {
          await expect(page.locator(`#${id}`)).toBeVisible();
        }
        await expect(page.locator("#boundaries table")).toHaveCount(1);
        await expect(page.locator("#boundaries thead th")).toHaveCount(3);
        await expect(page.locator("#boundaries tbody tr")).toHaveCount(4);
        await expect(page.locator("#help details")).toHaveCount(4);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

        const mobileToc = page.locator("aside details");
        if (width < 1024) {
          await expect(mobileToc.locator("summary")).toBeVisible();
          await mobileToc.locator("summary").click();
          await expect(mobileToc).toHaveAttribute("open", "");
        }
        const firstNav = width < 1024
          ? mobileToc.locator("nav a").first()
          : page.locator("aside > div nav a").first();
        await expect(firstNav).toBeVisible();
        await firstNav.focus();
        await expect(firstNav).toBeFocused();
      }
    });
  }
});
