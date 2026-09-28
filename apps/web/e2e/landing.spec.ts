import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  [375, 844],
  [768, 900],
  [1024, 900],
  [1440, 900],
] as const;

const copy = {
  ar: {
    path: "/about",
    productHref: "/",
    direction: "rtl",
    title: "مساحة للقاء. ومرجع لما اتفقتم عليه.",
    live: "ابدأ اجتماعاً",
    docs: "استكشف الدليل",
    source: "استعرض الشيفرة",
    visual: "لقطة من واجهة المنتج ببيانات توضيحية؛ لا تعرض اجتماعًا حقيقيًا أو بيانات مستخدمين.",
    product: "ادخل، تعاون، ثم ارجع إلى النتيجة.",
    compare: "مكالمات قوية. وفلسفة مختلفة للمخرجات.",
    faq: "أسئلة قبل بدء الاجتماع.",
  },
  en: {
    path: "/en/about",
    productHref: "/en",
    direction: "ltr",
    title: "A place to meet. A record to return to.",
    live: "Start a meeting",
    docs: "Explore the guide",
    source: "Open the source",
    visual: "Real product interface captured with demonstration data; this is not a live meeting and contains no user data.",
    product: "Join, collaborate, and return to the outcome.",
    compare: "Strong meetings. A different approach to the outcome.",
    faq: "Questions before you join.",
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
          text.productHref,
        );
        await expect(page.getByRole("link", { name: text.source, exact: true })).toHaveAttribute(
          "href",
          /resources\/source/,
        );
        await expect(page.getByRole("link", { name: text.docs, exact: true }).first()).toHaveAttribute(
          "href",
          /docs/,
        );

        const captures = page.getByRole("figure");
        await expect(captures).toHaveCount(2);
        await expect(captures.first().getByText(text.visual, { exact: true })).toBeVisible();
        for (const [index, kind] of ["call", "home"].entries()) {
          const image = captures.nth(index).getByRole("img");
          await image.scrollIntoViewIfNeeded();
          await expect(image).toHaveAttribute("src", new RegExp(`product-${kind}-${locale}`));
          await expect.poll(() => image.evaluate((element: HTMLImageElement) =>
            element.complete && element.naturalWidth > 0,
          )).toBe(true);
        }

        await expect(page.getByRole("heading", { level: 2, name: text.product })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: text.compare })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: text.faq })).toBeVisible();
        for (const id of ["story", "features", "compare", "open-source", "faq"]) {
          await expect(page.locator(`#${id}`)).toBeVisible();
        }
        await expect(page.locator("#compare table")).toHaveCount(1);
        await expect(page.locator("#compare thead th")).toHaveCount(4);
        await expect(page.locator("#compare tbody tr")).toHaveCount(8);
        const comparison = width < 1024 ? page.locator("#compare article").first() : page.locator("#compare table");
        await expect(comparison.getByText("Zoom", { exact: true }).first()).toBeVisible();
        await expect(comparison.getByText("Google Meet", { exact: true }).first()).toBeVisible();
        await expect(page.locator("#faq details")).toHaveCount(5);
        await expect(page.locator('a[href="#story"]')).toHaveCount(1);
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

    const heroLive = page.locator("main").getByRole("link", { name: "Start a meeting", exact: true }).first();
    const heroSource = page.locator("main").getByRole("link", { name: "Explore the guide", exact: true }).first();
    await heroLive.focus();
    await expect(heroLive).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(heroSource).toBeFocused();
  });
});
