# Product captures / لقطات المنتج

The public product page uses four localized captures introduced in
[#276](https://github.com/Lord-shaban/lor/issues/276), inside the original responsive
`ProductScreenshot` browser frame. They replace the HTML illustration. The frame
is project-authored; no imagery or templates were copied from reference sites.

## Inventory and alternatives

All four images are WebP, 1440×900 px. Preserve their aspect ratio. The main
meeting image is preloaded; the home image is lazy loaded through `next/image`.
Each has a caption and a link to its full-size original for inspection on phones.

| Asset | Size | English alternative | البديل العربي |
|---|---|---|---|
| `product-home-ar.webp` | 39 KB | The Arabic LOR. home screen with the official logo, new-meeting action, and invitation field. | الصفحة الرئيسية العربية في LOR.‎ مع الشعار الرسمي وإنشاء الاجتماع وحقل الدعوة. |
| `product-home-en.webp` | 50 KB | The English LOR. home screen with the official logo, new-meeting action, and invitation field. | الصفحة الرئيسية الإنجليزية في LOR.‎ مع الشعار الرسمي وإنشاء الاجتماع وحقل الدعوة. |
| `product-call-ar.webp` | 41 KB | The Arabic meeting interface with four synthetic participants, captions, and two confirmed decisions with source quotes, speakers, and UTC times. | واجهة الاجتماع العربية مع أربعة مشاركين تجريبيين ونص مباشر وقرارين مؤكدين مع اقتباس المصدر والمتحدث والتوقيت. |
| `product-call-en.webp` | 54 KB | The equivalent English meeting interface with synthetic participants and evidence-linked confirmed decisions. | واجهة الاجتماع الإنجليزية المكافئة مع مشاركين تجريبيين وقرارات مؤكدة مرتبطة بمصادرها. |

Files are in `apps/web/public/landing/`. Sizes above are rounded; combined payload
is approximately 183 KiB before Next image optimization.

Documentation review evidence is recorded in
[Arabic](assets/product-docs-ar.webp) and [English](assets/product-docs-en.webp).
These are 1440×900 development screenshots for PR review, not public marketing
assets; the visible Next.js development indicator is intentional.

## Capture provenance

- Captured on 2026-09-28 from the local Next.js development build on
  `feat/276-public-product-polish`, at 1440×900 CSS px. The home uses the light
  theme; the meeting uses the product's dark call theme.
- Home captures show the actual `/ar` and `/en` pages. No meeting was created
  or joined, and the invitation field contains only its example placeholder.
- Meeting captures use the shipped `VideoGrid`, `CallControls`, and
  `CaptionsStrip` with an offline LiveKit `Room`. The decision panel rendering
  was copied verbatim into a temporary fixture, replacing API loading with
  deterministic synthetic records. No transport, camera, microphone, database,
  or provider connection was opened.
- Synthetic participants are Design, Engineering, Product, and Research, with
  equivalent Arabic labels. Quotes and UTC timestamps are examples. The visible
  room code `demo-design-review` is not an invitation. The fixture visibly says
  “Demonstration · Synthetic data · Offline”; adjacent page captions repeat that
  this is a real interface capture with demonstration data, not a real meeting.
- The temporary `/capture-demo` route and copied panel were removed after capture.
  They are not product features. This captures rendering, not a verified live
  meeting or a successful server-side decision generation.
- Browser JPEG captures were encoded to WebP at quality 88 without compositing,
  cropping, retouching, inserting faces, or changing the displayed interface.

## Privacy, ownership, and visual review

Only project UI and synthetic content appear. There are no real participant
names, photos, private meeting transcripts, active invitations, credentials, or
device labels. The images and frame are owned by LOR. maintainers and distributed
under AGPL-3.0-only. Their text alternatives describe the visible state; marketing
copy never treats these examples as customer activity or performance evidence.

The original `product-launcher-ar.webp` from #220 remains available as a historical
732×918 px capture (15 KB). It is not used by the current public page.

## ملاحظات بالعربية

تستخدم الصفحة لقطات حقيقية لواجهة المشروع داخل قوالب أصلية متجاوبة. لقطة البداية
لا تتضمن اجتماعاً، ولقطة المكالمة تستخدم مكوّنات المنتج مع بيانات محلية تجريبية،
دون اتصال بخدمات أو تشغيل الأجهزة. لم تُضف وجوه أو بيانات مستخدمين، ولم يُعدّل
المحتوى المصوّر. يوضح التعليق طبيعة المثال، ويمكن فتح الصورة كاملة لفحص التفاصيل
على الهاتف. لا تثبت هذه اللقطات تنفيذ اجتماع حي أو توليد قرارات عبر الخادم.
