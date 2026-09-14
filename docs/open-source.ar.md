# خريطة المساهمة المفتوحة

LOR.‎ مشروع اجتماعات فيديو open-source، عربي أولاً: تدخل من لينك من غير حساب، وتحتفظ
بنتيجة الميتنج المفيدة — transcript وقرارات مرتبطة بالدليل الأصلي. النسخة المستضافة
[شغّالة هنا](https://lor-bay.vercel.app)، والكود والإيشوز على
[GitHub](https://github.com/Lord-shaban/lor).

الملف ده بيوضّح الشغل الجاي من غير ما يدّعي إنه اتنفّذ. قواعد الـPR موجودة في
[CONTRIBUTING.md](../CONTRIBUTING.md)، والشرح التقني الكامل بالإنجليزية في
[الدليل الإنجليزي](open-source.md).

## أبدأ منين؟

- لو دي أول مساهمة: اختار
  [`good first issue`](https://github.com/Lord-shaban/lor/labels/good%20first%20issue)
  زي [#222](https://github.com/Lord-shaban/lor/issues/222)، واكتب تعليق إنك هتشتغل عليها
  قبل ما تبدأ.
- قصة المشروع والصور والفيديوهات: [#212](https://github.com/Lord-shaban/lor/issues/212).
- تحسين تجربة الميتنج: [#215](https://github.com/Lord-shaban/lor/issues/215) للمراجعة
  بالأدلة، وبعده [#216](https://github.com/Lord-shaban/lor/issues/216) للتنفيذ المحدود.
- التكاملات وself-hosting والـplugins ليهم بداية موثقة في
  [#217](https://github.com/Lord-shaban/lor/issues/217)،
  [#218](https://github.com/Lord-shaban/lor/issues/218)، و
  [#219](https://github.com/Lord-shaban/lor/issues/219).

كل Issue فيها نطاق ومعايير قبول. label اسمها `blocked` معناها إن في قرار أو مهمة
سابقة لازم تخلص؛ مش معناها إننا نتجاوزها بتخمين.

## الحاجات اللي مينفعش تتكسر

- أي key لا يتخزّن ولا يتسجّل في log أو cache أو error report.
- المكالمة نفسها لازم تفضل شغّالة من غير AI أو key أو quota.
- نراجع Arabic RTL الأول ثم English LTR. استخدم CSS logical properties و`lineDirection()`
  لنص المستخدم، واعزل اللفظ الأجنبي داخل UI بـ`<bdi>` فقط.
- الأحمر معناه live أو فعل مؤثر؛ مش لون زينة.
- الحذف وانتهاء مدة الحفظ لازم يمسح أي بيانات مشتقة. الصور والفيديوهات العامة لا تظهر
  أسماء، room codes، transcript، أو أي محتوى ميتنج حقيقي.

## المرحلة القادمة: v0.7

المرحلة دي بدأت بمراجعة تجربة المنتج قبل صفحة الـlanding. هدفها إطلاق LOR.‎ كمشروع
open-source بتجربة أوضح:

1. [#215](https://github.com/Lord-shaban/lor/issues/215): مراجعة رحلة المستخدم وتثبيت
   [عقد تجربة المنتج](product-ux-audit.md) قبل أي تغيير بصري واسع.
2. [#216](https://github.com/Lord-shaban/lor/issues/216): ينفذ إصلاحات مساحة وأدوات
   الميتنج المؤكدة ومهامها الصغيرة، ثم
   [#214](https://github.com/Lord-shaban/lor/issues/214) يجعل الصفحة الأولى طريقًا واضحًا
   لبدء أو دخول ميتنج.
3. [#212](https://github.com/Lord-shaban/lor/issues/212): ترتيب قصة الـlanding بالنسختين
   وقائمة media مبنية على الديزاين الجديد بعد دمجه.
4. [#213](https://github.com/Lord-shaban/lor/issues/213): landing page عامة بعد اعتماد
   المحتوى، فيها شرح، GitHub، الموقع المباشر، وصور/فيديو ببديل نصي.
5. [#220](https://github.com/Lord-shaban/lor/issues/220): مساهمة أولى لإضافة asset آمن
   بعد اعتماد القائمة.

التفاصيل المعتمدة موجودة في [brief الـlanding الإنجليزي](landing-brief.md) و[النسخة
العربية](landing-brief.ar.md): ترتيب الأقسام، سجل الادعاءات، الروابط الأساسية، ملكية
الـmedia، مراجعة الخصوصية، وحدود الوصول.

الـlanding منفصلة عن صفحة المنتج: الأولى بتشرح وتعرض LOR.‎، والثانية وظيفتها تخليك
تبدأ أو تدخل روم في خطوتين. الفيديو لا يشتغل تلقائياً؛ لازم captions أو transcript
واضحين، تحكم تشغيل/إيقاف، وصورة بديلة. نحافظ على نظام LOR.‎ الحالي: ألوان محايدة،
Geist مع IBM Plex Sans Arabic، وحركة بسيطة تحترم reduced motion.

## بعد v0.7

| المرحلة | بداية مناسبة للمساهمين |
|---|---|
| `v0.8` التكاملات | عقد آمن وموقّع ومربوط بالروم في [#217](https://github.com/Lord-shaban/lor/issues/217) قبل أي provider |
| `v0.9` التقوية والاستضافة الذاتية | مواصفات deploy واختبارات حقيقية في [#218](https://github.com/Lord-shaban/lor/issues/218)، وتشغيل E2E محلي متكرر في [#221](https://github.com/Lord-shaban/lor/issues/221) |
| `v1.0` منظومة الإضافات | حدود الصلاحيات والـthreat model في [#219](https://github.com/Lord-shaban/lor/issues/219) |

## مساهمة جاهزة للمراجعة

اختار Issue واحدة، اعمل branch من `main` باسم `<type>/<issue-number>-<slug>`، اكتب Conventional
Commit، وافتح PR بتقفل الإيشو. تغييرات الـUI لازم يتشاف لها screenshots أو recording في
العربي والإنجليزي؛ وتغييرات الكابشنز لازم ترفق أرقام التقييم. النتيجة لازم تتكرر من غير
أي context خاص أو بيانات خاصة.
