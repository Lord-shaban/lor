import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  [375, 844],
  [768, 900],
  [1024, 900],
  [1440, 900],
] as const;

const copy = {
  ar: {
    path: "/ar/about",
    direction: "rtl",
    title: "من اجتماع مباشر إلى قرار يمكن تتبّعه.",
    live: "ابدأ اجتماعاً",
    docs: "استكشف الدليل",
    source: "استعرض الشيفرة",
    visual: "تصوّر توضيحي مبني على واجهة الاجتماع والقرارات؛ لا يعرض اجتماعاً حقيقياً أو بيانات مستخدمين.",
    product: "كل ما تحتاج إليه، في سياق الاجتماع.",
    compare: "المكالمة بداية، مش أرشيف.",
    faq: "أسئلة تستاهل إجابة.",
    copy: "انسخ الأوامر",
  },
  en: {
    path: "/en/about",
    direction: "ltr",
    title: "From a live meeting to a decision you can trace.",
    live: "Start a meeting",
    docs: "Explore the guide",
    source: "Open the source",
    visual: "Illustrative view based on the meeting and decision interfaces. It contains no real meeting or user data.",
    product: "What you need, in the meeting context.",
    compare: "A call is the beginning, not the archive.",
    faq: "Questions worth answering.",
    copy: "Copy commands",
  },
} as const;

test.describe("public project landing", () => {
  for (const locale of ["ar", "en"] as const) {
    test(`keeps the ${locale} story equivalent, navigable, and responsive`, async ({ page }) => {
      const text = copy[locale];
      await page.emulateMedia({ reducedMotion: "reduce" });

      for (const [width, height] of VIEWPORTS) {
        await page.setViewportSize({ width, height });
        await page.goto(text.path);

        await expect(page.locator("html")).toHaveAttribute("dir", text.direction);
        await expect(page.getByRole("heading", { level: 1, name: text.title })).toBeVisible();
        await expect(page.getByRole("link", { name: text.live, exact: true }).first()).toHaveAttribute(
          "href",
          "https://lor-bay.vercel.app",
        );
        await expect(page.getByRole("link", { name: text.source, exact: true })).toHaveAttribute(
          "href",
          "https://github.com/Lord-shaban/lor",
        );
        await expect(page.getByRole("link", { name: text.docs, exact: true }).first()).toHaveAttribute(
          "href",
          /docs/,
        );

        await expect(page.getByRole("figure").first().getByText(text.visual, { exact: true })).toBeVisible();

        await expect(page.getByRole("heading", { level: 2, name: text.product })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: text.compare })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: text.faq })).toBeVisible();
        for (const id of ["product", "story", "features", "compare", "open-source", "faq"]) {
          await expect(page.locator(`#${id}`)).toBeVisible();
        }
        await expect(page.locator("#compare table")).toHaveCount(1);
        await expect(page.locator("#compare thead th")).toHaveCount(3);
        await expect(page.locator("#compare tbody tr")).toHaveCount(7);
        await expect(page.getByRole("button", { name: text.copy, exact: true })).toBeVisible();
        await expect(page.locator("#faq details")).toHaveCount(5);
        await expect(page.locator('a[href="#product"]')).toHaveCount(1);
        await expect(page.locator('a[href="#features"]')).toHaveCount(1);
        await expect(page.locator('a[href="#compare"]')).toHaveCount(1);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);

        const faq = page.locator("#faq details").first();
        await faq.locator("summary").focus();
        await page.keyboard.press("Enter");
        await expect(faq).toHaveAttribute("open", "");
      }
    });
  }

  test("keeps the primary actions reachable in keyboard order", async ({ page }) => {
    await page.goto("/en/about");

    const heroLive = page.getByRole("link", { name: "Start a meeting", exact: true });
    const heroSource = page.locator("main").getByRole("link", { name: "Explore the guide", exact: true }).first();
    await heroLive.focus();
    await expect(heroLive).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(heroSource).toBeFocused();
  });
});
