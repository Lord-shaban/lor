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
    title: "اجتماعات بتفتكر اللي يهم.",
    live: "جرّب الموقع المباشر",
    source: "شوف الكود",
    visual: "اقرأ وصف الصورة",
    alt: "عرض اصطناعي لاجتماع LOR.‎ بيبيّن بلاطتين للمكالمة جنب transcript محفوظ وقرار راجعه المضيف.",
    overview: "مكالمة أهدى، وتسليم أوضح.",
    compare: "المكالمة بداية، مش أرشيف.",
    faq: "أسئلة تستاهل إجابة.",
    copy: "انسخ الأوامر",
  },
  en: {
    path: "/en/about",
    direction: "ltr",
    title: "Meetings that remember what matters.",
    live: "Try the live app",
    source: "View the source",
    visual: "Read the visual description",
    alt: "A synthetic LOR. meeting view shows two call tiles beside a retained transcript and a host-reviewed decision.",
    overview: "A calmer meeting, a stronger handoff.",
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
        await expect(page.getByRole("link", { name: text.live, exact: true })).toHaveAttribute(
          "href",
          "https://lor-bay.vercel.app",
        );
        await expect(page.getByRole("link", { name: text.source, exact: true })).toHaveAttribute(
          "href",
          "https://github.com/Lord-shaban/lor",
        );

        const preview = page.getByRole("img", { name: text.alt });
        await expect(preview).toBeVisible();
        await expect(preview).toHaveAttribute("src", /product-preview/);
        await expect(page.getByText(text.visual, { exact: true })).toBeVisible();

        await expect(page.getByRole("heading", { level: 2, name: text.overview })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: text.compare })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: text.faq })).toBeVisible();
        for (const id of ["overview", "story", "features", "compare", "open-source", "faq"]) {
          await expect(page.locator(`#${id}`)).toBeVisible();
        }
        await expect(page.locator("#compare table")).toHaveCount(1);
        await expect(page.locator("#compare thead th")).toHaveCount(3);
        await expect(page.locator("#compare tbody tr")).toHaveCount(7);
        await expect(page.getByRole("button", { name: text.copy, exact: true })).toBeVisible();
        await expect(page.locator("#faq details")).toHaveCount(5);
        await expect(page.locator('a[href="#overview"]')).toHaveCount(1);
        await expect(page.locator('a[href="#features"]')).toHaveCount(1);
        await expect(page.locator('a[href="#compare"]')).toHaveCount(2);
        await expect(page.locator("a[href='#open-source']")).toHaveCount(1);
        await expect(page.locator('a[href="#faq"]')).toHaveCount(1);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);

        const mediaDetails = page.locator("figure details");
        const mediaSummary = mediaDetails.locator("summary");
        await mediaSummary.focus();
        await page.keyboard.press("Enter");
        await expect(mediaDetails).toHaveAttribute("open", "");
        await expect(mediaDetails.getByText(text.alt, { exact: true })).toBeVisible();

        const faq = page.locator("#faq details").first();
        await faq.locator("summary").focus();
        await page.keyboard.press("Enter");
        await expect(faq).toHaveAttribute("open", "");
      }
    });
  }

  test("keeps the primary actions reachable in keyboard order", async ({ page }) => {
    await page.goto("/en/about");

    const heroLive = page.getByRole("link", { name: "Try the live app", exact: true });
    const heroSource = page.getByRole("link", { name: "View the source", exact: true });
    await heroLive.focus();
    await expect(heroLive).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(heroSource).toBeFocused();
  });
});
