import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DocumentationShell } from "@/components/documentation-shell";
import { LandingCopyCommand } from "@/components/landing-copy-command";

const repository = "https://github.com/Lord-shaban/lor";
const topics = ["security", "contributing", "roadmap", "license", "help", "source"] as const;
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
        { title: "نطاق الغرفة", body: "ترتبط النصوص والقرارات والمهام والبحث بالغرفة المعنية. يزيل حذف السجل البيانات المشتقة من مصدره، ولا يسمح البحث بإظهار مصادر منتهية أو محذوفة. تعطيل ميزات الذكاء الاصطناعي لا يوقف الصوت أو الفيديو أو أدوات التعاون." },
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
        { title: "v0.7: تجربة الاجتماع المتاحة", body: "غرفة فيديو برابط، وتعاون مباشر، وتفريغ نصي اختياري، وسجل قرارات ومهام مرتبط بالدليل المحفوظ داخل الغرفة." },
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
    source: {
      title: "الشيفرة المصدرية",
      intro: "يمكنك قراءة شيفرة LOR.‎ ومتابعة تطويره والمساهمة فيه. ابدأ من هذه الخريطة قبل الانتقال إلى المستودع.",
      sections: [
        { title: "تطبيق الويب", body: "توجد صفحات Next.js وواجهة الاجتماع وطرق معالجة الطلبات القصيرة في apps/web. تُراجع الواجهة بالعربية والإنجليزية وعلى الهاتف وسطح المكتب." },
        { title: "البيانات والتقييم", body: "يحتوي packages/db على مخطط البيانات، ويضم eval/captions أدوات قياس دقة التفريغ والحفاظ على الكلمات الإنجليزية داخل النص العربي." },
        { title: "كيف تبدأ؟", body: "اقرأ دليل المساهمة لاختيار مشكلة ومعايير قبولها، ثم شغّل المشروع محلياً وأرفق نتائج الفحوصات في طلب الدمج." },
      ],
      action: "افتح المستودع على GitHub",
      url: repository,
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
        { title: "Room boundaries", body: "Transcripts, decisions, tasks, and search stay within their room. Deleting a source removes its derived records; search excludes expired or deleted evidence. The call and collaboration tools work without AI." },
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
        { title: "v0.7: the released meeting experience", body: "Link-based video rooms, live collaboration, optional captions, and room-scoped decisions and action items grounded in retained evidence." },
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
    source: {
      title: "Source code",
      intro: "Read LOR.'s code, follow its development, and contribute. Start with this map before opening the repository.",
      sections: [
        { title: "Web application", body: "apps/web contains the Next.js pages, meeting interface, and short-lived request handlers. UI changes are reviewed in Arabic and English on mobile and desktop." },
        { title: "Data and evaluation", body: "packages/db holds the data schema, while eval/captions measures transcription accuracy and preservation of English words in Arabic speech." },
        { title: "Getting started", body: "Read the contribution guide, choose an issue with acceptance criteria, run the project locally, and include verification results in your PR." },
      ],
      action: "Open the repository on GitHub",
      url: repository,
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

  const toc = copy.sections.map((section, index) => ({ id: `section-${index + 1}`, label: section.title }));
  const isArabic = language === "ar";
  const command = "npm run typecheck\nnpm run lint\nnpm test\nnpm run build\nnpm run check:docs";

  return (
    <DocumentationShell locale={locale} current={topic} toc={toc}>
      <article className="max-w-3xl">
        <nav aria-label={isArabic ? "مسار الصفحة" : "Breadcrumb"} className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Link href="/docs" className="min-h-11 content-center underline decoration-border underline-offset-4 hover:decoration-foreground">{labels.docs}</Link>
          <span aria-hidden="true">/</span><span aria-current="page" className="text-foreground">{copy.title}</span>
        </nav>
        <header className="mt-5 border-b border-border pb-8 sm:pb-10">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{copy.title}</h1>
          <p className="mt-5 max-w-prose text-base leading-8 text-muted sm:text-lg">{copy.intro}</p>
        </header>
        <details className="group border-b border-border xl:hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            {isArabic ? "في هذه الصفحة" : "On this page"}<span aria-hidden="true" className="text-xl text-muted group-open:rotate-45">+</span>
          </summary>
          <nav aria-label={isArabic ? "أقسام الصفحة" : "Page sections"} className="grid pb-3">
            {toc.map((item) => <a key={item.id} href={`#${item.id}`} className="flex min-h-11 items-center rounded-md px-3 text-sm text-muted hover:bg-surface hover:text-foreground">{item.label}</a>)}
          </nav>
        </details>
        <div className="divide-y divide-border">
          {copy.sections.map((section, index) => (
            <section id={`section-${index + 1}`} key={section.title} aria-labelledby={`heading-${index + 1}`} className="scroll-mt-28 py-8 sm:py-10">
              <h2 id={`heading-${index + 1}`} className="text-xl font-semibold tracking-tight sm:text-2xl">{section.title}</h2>
              <p className="mt-4 max-w-prose text-base leading-8 text-muted">{section.body}</p>
            </section>
          ))}
        </div>
        {topic === "contributing" && (
          <section className="mb-10 overflow-hidden rounded-lg border border-border bg-surface" aria-labelledby="verification-title">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:px-5">
              <h2 id="verification-title" className="text-sm font-semibold">{isArabic ? "فحوصات مطلوبة قبل طلب الدمج" : "Checks before opening a pull request"}</h2>
              <LandingCopyCommand value={command} copyLabel={isArabic ? "نسخ الأوامر" : "Copy commands"} copiedLabel={isArabic ? "تم النسخ" : "Copied"} />
            </div>
            <pre dir="ltr" className="overflow-x-auto p-5 text-start text-sm leading-7"><code>{command}</code></pre>
            <p className="border-t border-border p-5 text-sm leading-7 text-muted">{isArabic ? "اختبار مكالمة الشخصين موجود، لكنه مستبعد حالياً من CI المستضاف. شغّله عند تعديل الوسائط إذا توفرت خدمات LiveKit وPostgres مؤقتة للاختبار؛ لا تستخدم بيانات الإنتاج." : "The two-person call test exists, but hosted CI currently skips it. Run it for media changes when disposable LiveKit and Postgres are available; use no production data."}</p>
          </section>
        )}
        {topic === "security" && (
          <aside className="mb-10 rounded-lg border border-border bg-surface p-5 sm:p-6">
            <h2 className="font-semibold">{isArabic ? "حدود الضمانات الحالية" : "Current security boundaries"}</h2>
            <p className="mt-3 text-sm leading-7 text-muted">{isArabic ? "لا يدّعي المشروع توفير تشفير طرفي كامل للاجتماع. يتصل المتصفح بخادم وسائط LiveKit، وترسل ميزات الذكاء الاصطناعي الاختيارية البيانات اللازمة إلى المزود المختار بعد الموافقة. لا تنشر روابط الغرف أو المفاتيح في البلاغات العامة." : "The project does not claim full meeting end-to-end encryption. Browsers connect through a LiveKit media server; optional AI sends the necessary data to the selected provider after consent. Keep room links and keys out of public reports."}</p>
          </aside>
        )}
        {topic === "roadmap" && (
          <aside className="mb-10 rounded-lg border border-border bg-surface p-5 sm:p-6">
            <p className="font-semibold">{isArabic ? "ما الذي يمكنك استخدامه اليوم؟" : "What can you use today?"}</p>
            <p className="mt-3 text-sm leading-7 text-muted">{isArabic ? "الإصدارات من v0.0 إلى v0.7 مكتملة. التكاملات، وحزمة Docker الرسمية، ونظام الإضافات مراحل مخطط لها؛ ليست ميزات متاحة حالياً." : "Releases v0.0 through v0.7 are complete. Integrations, the official Docker deployment, and the plugin system are planned milestones, not available features."}</p>
          </aside>
        )}
        <aside className="border-t border-border pt-8">
          <p className="text-sm text-muted">{isArabic ? "الخطوة التالية" : "Next step"}</p>
          <a href={copy.url} className="mt-4 inline-flex min-h-11 items-center gap-3 rounded-md bg-foreground px-5 text-sm font-medium text-on-foreground transition-opacity hover:opacity-85">
            {copy.action}<svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 15 15 5M6 5h9v9" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
            <Link href="/docs" className="flex min-h-11 items-center underline decoration-border underline-offset-4 hover:text-foreground">{labels.back}</Link>
            <Link href={topic === "security" ? "/resources/help" : "/resources/security"} className="flex min-h-11 items-center underline decoration-border underline-offset-4 hover:text-foreground">{topic === "security" ? (isArabic ? "المساعدة والدعم" : "Help and support") : (isArabic ? "الأمان والخصوصية" : "Security and privacy")}</Link>
          </div>
        </aside>
      </article>
    </DocumentationShell>
  );
}
