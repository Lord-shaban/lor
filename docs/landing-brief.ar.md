# brief صفحة LOR. العامة

الحالة: محتوى وقواعد الـmedia معتمدة لتنفيذ [#213](https://github.com/Lord-shaban/lor/issues/213)، واتوسع عقد الـshowcase في [#234](https://github.com/Lord-shaban/lor/issues/234)، واتظبط مع دوكس محلية كاملة في [#236](https://github.com/Lord-shaban/lor/issues/236).
الـbrief ده مصدر صفحة المشروع العامة، ومش بيغيّر launcher المنتج الموجود في
`/[locale]`.

## الصفحة المفروض تعمل إيه؟

صفحة الـlanding تعرّف LOR. لمطوّر أو منظّم اجتماع أول مرة. خلال أول شاشة لازم يفهم
الوعد، يشوف إن المنتج حقيقي، ويختار خطوة واضحة من الاتنين:

- **جرّب الموقع المباشر** على [lor-bay.vercel.app](https://lor-bay.vercel.app).
- **اقرأ الدوكس** من صفحة [`/docs`](/docs) المحلية.

المسار العام هو `/about` للعربي الافتراضي و`/en/about` للإنجليزي (`/ar/about` يفضل
alias صريح للغة). رابط اللغة الافتراضية يمر عبر رابط الـlocale المناسب؛ ومسار المنتج
يفضل أقصر طريق لبدء أو دخول اجتماع.

## ترتيب المعلومات ونية النص

| الترتيب | القسم | نية النص بالعربي الأول | المقابل الإنجليزي | حدود الدليل |
|---|---|---|---|---|
| 1 | البداية | `اجتماعات بتفتكر اللي يهم.` جملة بسيطة تشرح LOR. كمشروع فيديو مفتوح المصدر عربي أولاً. | “Meetings that remember what matters.” نفس الوعد من غير مبالغة. | قسم “What LOR. is” في README؛ مفيش أرقام مخترعة. |
| 2 | سطح إثبات | عرض منتج ثابت وآمن للخصوصية قبل طلب الثقة. | نفس الشكل ومعاه وصف نصي مكافئ؛ الصورة مش مصدر المعنى الوحيد. | واجهة v0.6 المنشورة فقط؛ أسماء وهمية ومفيش بيانات روم. |
| 3 | ثلاث حكايات | `ادخل بسهولة؛ اشتغلوا سوا؛ احتفظ بالدليل.` كل جزء يشرح مهمة وقدرة موجودة. | Join simply; collaborate live; keep evidence responsibly. | أقسام v0.1 وv0.1.8 وv0.2–v0.6 في README. |
| 4 | مفتوح المصدر | AGPL-3.0، طريق المساهمة، ومكان خريطة الطريق من غير وعد إن المخطط اتنفّذ. | نفس المعلومات بنفس الترتيب والأولوية. | LICENSE وCONTRIBUTING.md وmilestones على GitHub. |
| 5 | الدعوة الأخيرة | كرّر “جرّب الموقع” و“شوف الكود”، وخلي دليل الإعداد رابط ثانوي. | Repeat the same actions with equivalent hierarchy. | الروابط canonical تحت. |

العناوين تلتزم بالتدرّج (`h1` ثم `h2` لكل قسم)، والجمل مباشرة. ترتيب القراءة يفضل
كامل لو الـCSS أو الـmedia أو الحركة مش موجودة. ممنوع testimonials أو أرقام social proof
أو logos لشركاء أو أسعار أو integrations أو وعود AI مش مثبتة.

## توسعة الـshowcase

الـshowcase المحسّن بيحافظ على عقد الشاشة الأولى المعتمد، وبيوسّع القصة بالترتيب ده:
**Hero ← ليه LOR.‎؟ ← طريق واحد بسيط ← المميزات المنشورة ← جدول مقارنة القدرات ←
الخصوصية والتحكم ← المصدر وquick start ← الأسئلة الشائعة ← الإجراءات النهائية**.
الجدول بيستخدم وصف عام لـ«روم عادية» من غير تسمية منافسين، وكل خانة تخص LOR.‎ راجعة
لـREADME أو release منشور.

‎#236 بيخلّي هوية LOR.‎ واضحة بالـwordmark الرسمي وقفلـة “Live Open Rooms”، ويضيف CTA
لدوكس محلية مترجمة في `/docs` و`/en/docs`. GitHub بقى مسار مصدر ومجتمع ثانوي بدل ما
يكون الدعوة الأساسية في كل جزء. الدوكس فيها البداية السريعة، الـworkflow، حدود المتاح
والمخطط، المعمارية، المساهمة، وFAQ.

لوحة quick start بتستخدم أوامر `#quick-start` الحالية في المستودع، ومعاها زر نسخ وكتلة
كود ظاهرة كـfallback. أسئلة FAQ عبارة عن `details` أصلية، عشان تفضل شغالة مع الكيبورد
وقارئ الشاشة من غير تنقل بجافاسكريبت. الـhero والـgallery بيستخدموا دلوقتي لقطات
privacy-safe حقيقية من launcher المحلي (`product-home-crop.png` و
`product-home-menu-crop.png` و`product-home-ar-crop.png`) ببيانات روم وهمية؛ رسمة مساحة
العمل تفضل اصطناعية لحد ما مساهمة آمنة للخصوصية تحقق شروط
[#220](https://github.com/Lord-shaban/lor/issues/220).

## قاموس النص المعتمد

| الفكرة | العربي الأول | English |
|---|---|---|
| تعريف المنتج | اجتماعات فيديو مفتوحة المصدر بتفتكر اللي يهم. | Open-source video meetings that remember. |
| الدخول | افتح اللينك، اكتب اسمك، وادخل. | Open a link, type your name, and join. |
| التعاون | اشتغلوا سوا على السبورة والنوتس جوّه المكالمة. | Work together on a shared board and notes in the call. |
| الدليل | احتفظ بقرارات ومهام راجعة لدليلها في الـtranscript. | Keep transcript-backed decisions and clear commitments. |
| الخصوصية | من غير حساب، التسجيل المحلي ما بيترفعش، وحدود الحفظ والمسح واضحة. | No account, no upload for local recordings, and explicit retention/deletion boundaries. |
| المصدر المفتوح | AGPL-3.0؛ اقرأ الدليل، اختار issue، وافتح PR صغيرة. | AGPL-3.0; read the guide, pick an issue, and open a small PR. |

مسموح نقول إن المكالمة شغالة من غير AI أو key. ممنوع نوحي إن مميزات AI مطلوبة أو
متاحة دايمًا أو من غير حدود مزوّد.

## قائمة الـmedia المعتمدة

الـshowcase الحالي بيضيف لقطات responsive حقيقية ووصفها النصي. الفيديو تحسين اختياري،
مش شرط لفهم الصفحة.

| الـasset | المسؤول | الغرض | الصيغة / المقاس | البديل النصي | الخصوصية والترخيص | الحالة |
|---|---|---|---|---|---|---|
| `landing/product-preview.svg` | maintainers بتوع LOR. | يبيّن لغة launcher ومساحة الدليل في أول إثبات بصري. | SVG، viewBox ‏1440×900؛ يتعرض responsive مع `next/image` أو fallback inline. | “عرض اجتماع LOR. اصطناعي بيبيّن ساحة المكالمة جنب transcript محفوظ وقرار راجعه المضيف.” | رسم من المشروع؛ labels وهمية فقط، من غير room code أو اسم أو transcript أو device أو key أو self-view. AGPL-3.0. | معتمد لـ #213؛ fallback ثابت. |
| `landing/product-home-crop.png` | maintainers بتوع LOR. | يبيّن launcher الحقيقي في الـhero والـgallery الإنجليزي. | PNG ‏672×704؛ أبعاد ثابتة وعرض responsive. | “لقطة آمنة للخصوصية من launcher LOR. بتبيّن فورم الدخول، الرومات الأخيرة، وتحكمات local-first.” | لقطة من المنتج المحلي بكود روم اصطناعي `mza-krfq-tqn`؛ من غير حساب أو شخص أو transcript أو key أو self-view. AGPL-3.0. | اتشحن مع #236. |
| `landing/product-home-menu-crop.png` | maintainers بتوع LOR. | يبيّن الـlauncher والـmenu مفتوح عشان شكل التنقل يبقى مفهوم. | PNG ‏672×704؛ أبعاد ثابتة وعرض responsive. | “قائمة LOR. بتجمع الاجتماعات والدليل المحفوظ والإعدادات في تنقل واحد مختصر.” | نفس قواعد اللقطة الاصطناعية الآمنة للخصوصية. | اتشحن مع #236. |
| `landing/product-home-ar-crop.png` | maintainers بتوع LOR. | لقطة RTL عربية للصفحة العربية. | PNG ‏672×704؛ أبعاد ثابتة وعرض responsive. | وصف عربي مكافئ مع عزل مصطلحات المنتج اللاتينية. | نفس قواعد اللقطة الاصطناعية الآمنة للخصوصية. | اتشحن مع #236. |
| `landing/product-screenshot.webp` | maintainers بتوع LOR. | بديل مستقبلي للـvector لو اتاخدت لقطة حقيقية أعرض. | WebP، مصدر 1600×1000 ونسخ responsive. | نفس الوصف بعد مراجعته على الحالة المصوّرة. | لقطة من روم محلي اصطناعي؛ تتراجع قبل النشر. | متابعة مستقبلية، مش شرط لـ#236. |
| `landing/walkthrough.webm` + `landing/walkthrough.vtt` | مساهم من المجتمع عبر [#220](https://github.com/Lord-shaban/lor/issues/220). | يشرح مسار اللينك ← المكالمة ← الدليل المحفوظ. | WebM، حد أقصى 45 ثانية، 1280×720، مع VTT وposter. | transcript كامل بجانب المشغّل؛ الـcaptions مش المصدر الوحيد. | demo صامت أو متكابشن ببيانات اصطناعية؛ مفيش autoplay؛ pause لما يختفي؛ credits وترخيص واضحين. | اختياري؛ ممنوع placeholder فيديو متخيل. |

الكود يستخدم `next/image` للصور، ويحجز أبعاد الـmedia لتفادي layout shift، ويحمل
الـmedia غير الأساسي lazy. لو أضفنا فيديو، لازم native controls ظاهرة، poster، captions،
transcript، تشغيل بالكيبورد، وحالة poster مع reduced motion.

## الوجهات الأساسية

| الاسم | الرابط | الاستخدام |
|---|---|---|
| جرّب الموقع المباشر | `https://lor-bay.vercel.app` | CTA أساسي ويفتح launcher المنتج. |
| دوكس المنتج | `/docs` و`/en/docs` | البداية والـworkflow والحدود والمعمارية ودليل المساهمة محلياً. |
| شوف الكود | `https://github.com/Lord-shaban/lor` | مسار مصدر ومجتمع ثانوي؛ الكود والـissues والنقاشات. |
| دليل الإعداد | `https://github.com/Lord-shaban/lor#quick-start` | بداية المطوّر أو المساهم. |
| المساهمة | `https://github.com/Lord-shaban/lor/blob/main/CONTRIBUTING.md` | الـworkflow والفحوصات وقواعد الـPR. |
| الأمان | `https://github.com/Lord-shaban/lor/blob/main/SECURITY.md` | حدود الخصوصية والإبلاغ. |
| خريطة الطريق | `https://github.com/Lord-shaban/lor/milestones` | اللي نزل واللي لسه مخطط. |

كل رابط واضح وقابل للكيبورد، ومفيش تفاعل معتمد على hover فقط. زر الموقع وزر الكود
مختلفين بصرياً من غير لون زينة؛ الأحمر يفضل لمعنى live أو فعل مؤثر.

## عقد الوصول والتحقق

- نراجع Arabic RTL الأول ثم English LTR، بنفس ترتيب الأقسام والروابط والبدائل.
- نستخدم CSS logical properties، و`<bdi>` للـLatin run المعزول داخل نص الواجهة فقط.
- كل target لا يقل عن 44×44px مع focus ring واضح؛ وترتيب Tab يطابق القراءة.
- نراجع contrast في الوضعين الفاتح والغامق، وreduced motion، و200% zoom، ومقاسات
  375 و768 و1024 و1440px من غير horizontal scroll.
- الـmedia decorative فقط لو النص المجاور شارح نفس الفكرة. الـalt والـtranscript هما
  مصدر الادعاء؛ اللون والحركة مش مصدر معنى لوحدهم.
- كل visual evidence يستخدم بيانات اصطناعية ويتراجع من room codes والأسماء والـtranscript
  وdevice labels والمفاتيح وself-view قبل دخوله الـPR.

## سجل الادعاءات

كل جملة في الصفحة لازم ترجع لقسم shipped في README: v0.1 للمكالمة، v0.1.5 للكابشنز،
v0.1.8 للتسجيل المحلي والسبورة والنوتس، v0.2 للقرارات، v0.3 للمهام، v0.4 للـTimeline،
v0.5 للـMemory، أو v0.6 للبحث الدلالي. integrations وself-hosting وplugin APIs
والتشفير الشامل والحسابات والمراحل المستقبلية تفضل خارج لغة “متاح دلوقتي”.
