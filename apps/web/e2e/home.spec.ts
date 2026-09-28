import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  [390, 844],
  [768, 900],
  [1024, 900],
  [1440, 900],
] as const;

const copy = {
  ar: {
      "title": "ابدأ المحادثة. واحتفظ بما يهم.",
      "start": "إنشاء اجتماع",
      "join": "انضمام",
      "badCode": "الرمز غير صالح. تحقق منه أو الصق رابط الدعوة كاملًا.",
      "menu": "المساعدة والمصدر",
      "source": "الشيفرة المصدرية",
      "trust": [
          "لا يلزم إنشاء حساب",
          "لا يلزم تنزيل تطبيق",
          "تعمل المكالمة دون الذكاء الاصطناعي"
      ],
      "starting": "جارٍ إنشاء الاجتماع…",
      "offline": "تعذر الاتصال بالإنترنت. تحقق من الشبكة ثم حاول مجددًا."
  },
  en: {
      "title": "Start the conversation. Keep what matters.",
      "start": "Start a meeting",
      "join": "Join",
      "badCode": "That code is not right. Check it, or paste the whole link.",
      "menu": "Help and source",
      "source": "Source",
      "trust": [
          "No account",
          "No download",
          "The call works without AI"
      ],
      "starting": "Starting…",
      "offline": "No connection. Check your network and try again."
  },
} as const;

test.describe("product home", () => {
  for (const locale of ["ar", "en"] as const) {
    test(`keeps the ${locale} meeting entry task focused and responsive`, async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const text = copy[locale];

      try {
        for (const [width, height] of VIEWPORTS) {
          await page.setViewportSize({ width, height });
          await page.goto(`/${locale}`);

          await expect(page.getByRole("heading", { name: text.title, level: 1 })).toBeVisible();
          await expect(page.getByTestId("room-launcher")).toBeVisible();
          await expect(page.getByRole("button", { name: text.start, exact: true })).toBeVisible();
          await expect(page.getByRole("button", { name: text.join, exact: true })).toBeVisible();
          for (const trustItem of text.trust) {
            await expect(page.getByText(trustItem, { exact: true })).toBeVisible();
          }
          await expect(page.getByText("v0.6", { exact: true })).toHaveCount(0);
          await expect(page.locator("main ol")).toHaveCount(0);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          ).toBe(true);

          const joinField = page.locator('input[autocomplete="off"]');
          await expect(joinField).toBeVisible();
          await joinField.fill("not-a-room");
          await joinField.press("Enter");
          await expect(page.getByTestId("room-launcher").getByRole("alert")).toContainText(text.badCode);
          await expect(joinField).toHaveAttribute("aria-invalid", "true");

          const menu = page.locator("header details");
          const summary = menu.locator("summary");
          await expect(summary).toContainText(text.menu);
          await summary.focus();
          await page.keyboard.press("Enter");
          await expect(menu).toHaveAttribute("open", "");
          await expect(menu.getByRole("link", { name: text.source, exact: true })).toBeVisible();
          await summary.click();
          await expect(menu).not.toHaveAttribute("open", "");
        }
      } finally {
        await context.close();
      }
    });
  }

  test("keeps create loading and offline recovery attached to New meeting", async ({ page }) => {
    await page.goto("/en");

    await page.route("**/api/rooms*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.abort("internetdisconnected");
    });

    const startButton = page.getByTestId("room-launcher").locator("button").first();
    await startButton.click();
    await expect(startButton).toContainText("Starting…");
    await expect(startButton).toBeDisabled();
    await expect(page.getByTestId("room-launcher").getByRole("alert")).toContainText("No connection");
    await expect(startButton).toBeEnabled();
  });
});
