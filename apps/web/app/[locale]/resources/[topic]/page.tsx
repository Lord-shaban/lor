import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

const repository = "https://github.com/Lord-shaban/lor";
const topics = ["security", "contributing", "roadmap", "license", "help"] as const;
type Topic = (typeof topics)[number];
type Copy = { title: string; intro: string; sections: { title: string; body: string }[]; action: string; url: string };

const content: Record<"ar" | "en", Record<Topic, Copy>> = {
  ar: {
    security: {
      title: "الأمان والخصوصية",
      intro: "تعرّف إلى البيانات التي يعالجها الاجتماع، وكيف تُحفظ، وكيف تبلغ عن ثغرة بأمان.",
      sections: [
        { title: "أبلغ بسرية", body: "إذا اكتشفت ثغرة، أرسل بلاغاً خاصاً عبر تنبيهات الأمان في المستودع. نستهدف تأكيد استلامه خلال 72 ساعة ونشر إصلاح أو إجراء وقائي قبل الإعلان عنه." },
        { title: "مفاتيح مزودي الخدمة", body: "لا تُكتب مفاتيح API في قاعدة البيانات أو السجلات أو ذاكرة التخزين المؤقت. يبقى مفتاحك مشفراً في المتصفح، ويرسل مباشرة إلى المزود متى سمح بذلك. المسارات الوسيطة تمرر الطلب والنتيجة دون حفظهما." },
        { title: "النصوص والتسجيلات", body: "يُعلن بدء التفريغ وحفظ السجل كلٌّ على حدة. يتاح النص المحفوظ لمدة تصل إلى 30 يوماً، ويمكن حذفه مبكراً. تزال السطور المنتهية عند قراءتها، لذا قد تبقى بيانات غير مقروءة في التخزين إلى أن تُفتح الغرفة. يظل التسجيل المحلي في تبويب المتصفح ولا يرفعه LOR.‎." },
        { title: "نطاق الغرفة", body: "ترتبط النصوص والقرارات والبحث بالغرفة المعنية. ويزيل حذف السجل الملخص المشتق منه. تعطيل ميزات الذكاء الاصطناعي لا يوقف الصوت أو الفيديو أو أدوات التعاون." },
      ],
      action: "الإبلاغ عن ثغرة بسرية",
      url: `${repository}/security/advisories/new`,
    },
    contributing: {
      title: "المساهمة في LOR.‎",
      intro: "ابدأ بمشكلة محددة، وقدّم تغييراً صغيراً يمكن مراجعته وإعادة اختبار نتيجته.",
      sections: [
        { title: "١. اختر مهمة", body: "راجع المشكلات المفتوحة ومعايير قبولها، وعلّق على المهمة التي ستعمل عليها قبل البدء. تجنّب المهام الموسومة بأنها محجوبة حتى تُحل متطلباتها." },
        { title: "٢. أنشئ فرعاً", body: "أنشئ الفرع من main باسم يتبع النمط feat/رقم-المهمة-وصف-قصير أو fix/رقم-المهمة-وصف-قصير. استخدم صيغة Conventional Commits في الرسائل." },
        { title: "٣. تحقّق وقدّم PR", body: "شغّل typecheck وlint والاختبارات والبناء، واختبر الواجهة بالعربية والإنجليزية على الهاتف وسطح المكتب. افتح طلب دمج صغيراً يربط المشكلة ويشرح خطوات التحقق." },
        { title: "حدود ثابتة", body: "لا تُحفظ المفاتيح في الخادم أو السجلات، ويعمل الاجتماع دون ميزات الذكاء الاصطناعي. أي تغيير في دقة التفريغ يحتاج نتائج WER والحفاظ على الكلمات الإنجليزية داخل النص العربي." },
      ],
      action: "استعرض المهام المفتوحة",
      url: `${repository}/issues`,
    },
    roadmap: {
      title: "خريطة الطريق",
      intro: "الميزات الحالية متاحة للاستخدام. وتوضح المراحل التالية اتجاه التطوير، ولا تمثل موعد إصدار مؤكداً.",
      sections: [
        { title: "الآن: تجربة الاجتماع", body: "غرفة فيديو برابط، وتعاون مباشر، وتفريغ نصي اختياري، وسجل قرارات ومهام مرتبط بالدليل المحفوظ داخل الغرفة." },
        { title: "v0.8: التكاملات", body: "تحديد حدود آمنة للتكاملات الخارجية وصلاحياتها قبل طرح أي مزود أو واجهة عامة." },
        { title: "v0.9: المتانة والاستضافة الذاتية", body: "إعداد مرجعي قابل لإعادة الإنتاج مع تحقق تشغيلي وأمني. لا تتوفر الاستضافة الذاتية كمسار رسمي حالياً." },
        { title: "v1.0: الإضافات", body: "تحديد نموذج أذونات ومراجعة أمنية لمنظومة الإضافات قبل توفيرها للمستخدمين." },
      ],
      action: "تابع المراحل على GitHub",
      url: `${repository}/milestones`,
    },
    license: {
      title: "الترخيص مفتوح المصدر",
      intro: "يُنشر LOR.‎ بموجب رخصة GNU Affero General Public License، الإصدار الثالث (AGPL-3.0).",
      sections: [
        { title: "ماذا تتيح الرخصة؟", body: "تتيح استخدام الشيفرة ودراستها وتعديلها وتوزيعها وفق شروطها. وعند تقديم نسخة معدلة عبر الشبكة، تنطبق التزامات إتاحة الشيفرة المنصوص عليها في الرخصة." },
        { title: "ما المرجع الملزم؟", body: "هذا الملخص للتعريف فقط. النص القانوني الكامل المنشور لدى مشروع GNU هو المرجع، وتنطبق الرخصة نفسها على المساهمات في المشروع." },
      ],
      action: "اقرأ النص الكامل للرخصة",
      url: "https://www.gnu.org/licenses/agpl-3.0.html",
    },
    help: {
      title: "المساعدة والدعم",
      intro: "ابدأ من دليل الاستخدام، ثم اختر قناة مناسبة إذا احتجت إلى مساعدة إضافية.",
      sections: [
        { title: "لا يبدأ الاجتماع", body: "تحقق من اتصال الشبكة وصلاحيات الميكروفون والكاميرا، ثم أعد المحاولة. إذا استمر الخطأ، أرفق خطوات إعادة إنتاجه ورسالة الخطأ دون مشاركة رابط غرفة فعلي أو بيانات حساسة." },
        { title: "سؤال عن ميزة", body: "يوضح الدليل ما هو متاح الآن وما هو مخطط له، بما في ذلك حفظ النصوص والذكاء الاصطناعي والاستضافة الذاتية." },
        { title: "خلل أو طلب تحسين", body: "ابحث عن مشكلة مشابهة في المستودع، ثم افتح مشكلة جديدة تصف النتيجة المتوقعة والفعلية والمتصفح والجهاز." },
        { title: "بلاغ أمني", body: "لا تنشر تفاصيل الثغرات في مشكلة عامة. استخدم قناة الإبلاغ السرية الموضحة في صفحة الأمان." },
      ],
      action: "افتح مشكلات المشروع",
      url: `${repository}/issues`,
    },
  },
  en: {
    security: {
      title: "Security and privacy",
      intro: "Understand what a meeting processes, what is retained, and how to report a vulnerability privately.",
      sections: [
        { title: "Report privately", body: "Send vulnerability reports through GitHub Security Advisories. We aim to acknowledge reports within 72 hours and provide a fix or mitigation before public disclosure." },
        { title: "Provider keys", body: "API keys never enter the database, logs, or cache. Your key is encrypted in the browser and sent directly to the provider where possible. Proxy routes forward requests without retaining the key, audio, or transcript." },
        { title: "Transcripts and recordings", body: "Transcription and retention are announced separately. Retained text is available for up to 30 days and can be deleted sooner. Expired rows are removed on read, so unopened rooms may retain inaccessible rows until opened. Local recordings stay in the browser tab and are not uploaded by LOR." },
        { title: "Room boundaries", body: "Transcripts, decisions, and search stay within their room. Deleting a transcript also invalidates its summary. The call and collaboration tools work without AI." },
      ],
      action: "Report a vulnerability privately",
      url: `${repository}/security/advisories/new`,
    },
    contributing: {
      title: "Contribute to LOR.",
      intro: "Start with a focused issue and propose a small change whose result others can reproduce.",
      sections: [
        { title: "1. Choose an issue", body: "Read open issues and their acceptance criteria. Comment before starting to prevent duplicate work. Wait for prerequisites on issues marked blocked." },
        { title: "2. Create a branch", body: "Branch from main using feat/issue-number-short-slug or fix/issue-number-short-slug. Use Conventional Commits for commit messages." },
        { title: "3. Verify and open a PR", body: "Run typecheck, lint, tests, and build. Check UI changes in Arabic and English on mobile and desktop. Open a small PR linked to the issue with verification steps." },
        { title: "Project invariants", body: "Never persist keys or make a call depend on AI. Caption changes need WER and code-switch preservation results." },
      ],
      action: "Browse open issues",
      url: `${repository}/issues`,
    },
    roadmap: {
      title: "Roadmap",
      intro: "Current features are available today. Later phases describe direction, not promised release dates.",
      sections: [
        { title: "Now: the meeting experience", body: "Link-based video rooms, live collaboration, optional captions, and room-scoped decisions and action items grounded in retained evidence." },
        { title: "v0.8: integrations", body: "Define safe permissions and boundaries for external integrations before shipping providers or a public API." },
        { title: "v0.9: hardening and self-hosting", body: "A reproducible reference deployment with operational and security checks. Self-hosting is not yet an official path." },
        { title: "v1.0: plugins", body: "Define permission and security review boundaries before offering a plugin ecosystem." },
      ],
      action: "Track milestones on GitHub",
      url: `${repository}/milestones`,
    },
    license: {
      title: "Open-source license",
      intro: "LOR. is published under the GNU Affero General Public License, version 3 (AGPL-3.0).",
      sections: [
        { title: "What does it allow?", body: "You can use, study, modify, and distribute the code under the license terms. Providing a modified version over a network also carries the source availability obligations in the license." },
        { title: "Which text governs?", body: "This overview is informational. The full legal text published by the GNU Project governs; contributions use the same license." },
      ],
      action: "Read the full license text",
      url: "https://www.gnu.org/licenses/agpl-3.0.html",
    },
    help: {
      title: "Help and support",
      intro: "Start with the product guide, then choose the right channel if you need more help.",
      sections: [
        { title: "A meeting will not start", body: "Check your connection and camera and microphone permissions, then retry. If the problem persists, share reproduction steps and the error message without exposing a real room link or sensitive data." },
        { title: "Questions about a feature", body: "The guide distinguishes available features from planned work, including retention, AI, and self-hosting." },
        { title: "Bug or improvement", body: "Search existing issues before opening a new one. Include expected and actual results, browser, and device." },
        { title: "Security report", body: "Do not publish vulnerability details in a public issue. Use the private reporting channel described on the security page." },
      ],
      action: "Open project issues",
      url: `${repository}/issues`,
    },
  },
};

export function generateStaticParams() {
  return topics.map((topic) => ({ topic }));
}

type ResourceProps = { params: Promise<{ locale: string; topic: string }> };

export async function generateMetadata({ params }: ResourceProps): Promise<Metadata> {
  const { locale, topic } = await params;
  if (!topics.includes(topic as Topic)) return {};
  const copy = content[locale === "en" ? "en" : "ar"][topic as Topic];
  return { title: `${copy.title} | LOR.`, description: copy.intro };
}

export default async function ResourcePage({ params }: ResourceProps) {
  const { locale, topic } = await params;
  if (!topics.includes(topic as Topic)) notFound();
  setRequestLocale(locale);
  const language = locale === "en" ? "en" : "ar";
  const copy = content[language][topic as Topic];
  const labels = language === "ar"
    ? { home: "الرئيسية", docs: "دليل الاستخدام", product: "عن المنتج", back: "العودة إلى الدليل", explore: "المزيد من المعلومات" }
    : { home: "Home", docs: "Guide", product: "About", back: "Back to the guide", explore: "Explore more" };

  return (
    <div className="min-h-full bg-background text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4 sm:px-8">
          <Link href="/" aria-label="LOR." className="text-xl font-semibold tracking-tight"><bdi>LOR<span className="text-live">.</span></bdi></Link>
          <nav aria-label={language === "ar" ? "التنقل" : "Navigation"} className="flex flex-wrap items-center gap-4 text-sm text-muted">
            <Link href="/about" className="min-h-11 content-center hover:text-foreground">{labels.product}</Link>
            <Link href="/docs" className="min-h-11 content-center hover:text-foreground">{labels.docs}</Link>
            <ThemeToggle /><LocaleSwitcher />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 sm:py-16">
        <nav aria-label={language === "ar" ? "مسار الصفحة" : "Breadcrumb"} className="flex flex-wrap gap-2 text-sm text-muted">
          <Link href="/" className="underline underline-offset-4">{labels.home}</Link><span aria-hidden="true">/</span>
          <Link href="/docs" className="underline underline-offset-4">{labels.docs}</Link><span aria-hidden="true">/</span>
          <span aria-current="page" className="text-foreground">{copy.title}</span>
        </nav>
        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-20">
          <div className="lg:sticky lg:top-10 lg:self-start">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{copy.title}</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted">{copy.intro}</p>
            <Link href="/docs" className="mt-8 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">{labels.back}</Link>
          </div>
          <div>
            <div className="divide-y divide-border border-y border-border">
              {copy.sections.map((section) => (
                <section key={section.title} className="py-8 sm:py-10">
                  <h2 className="text-xl font-semibold">{section.title}</h2>
                  <p className="mt-3 max-w-prose text-base leading-8 text-muted">{section.body}</p>
                </section>
              ))}
            </div>
            <div className="mt-10 rounded-[var(--radius-lg)] border border-border bg-surface p-6 sm:p-8">
              <p className="text-sm text-muted">{labels.explore}</p>
              <a href={copy.url} className="mt-4 inline-flex min-h-11 items-center rounded-[var(--radius-md)] bg-foreground px-5 text-sm font-medium text-on-foreground transition-opacity duration-150 hover:opacity-85">{copy.action}</a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
