import { getTranslations } from "next-intl/server";
import { qrCode } from "@/lib/qr";

/**
 * The link, as something you point a phone at.
 *
 * Rendered on the server: the page already knows the link, so drawing it here
 * costs no client bundle, no canvas and no request for a picture of something
 * the HTML already contains.
 *
 * Deliberately black on white regardless of the theme. A QR inverted for dark
 * mode is a QR that many scanners will not read — the specification assumes
 * dark modules on a light background, and a phone camera pointed at a screen
 * has enough to contend with.
 */
export async function JoinQr({
  url,
  locale,
}: {
  url: string;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "room" });
  const { size, path } = qrCode(url);

  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="128"
        height="128"
        // The image is the link, and the link is already on the page as text
        // next to it. Announcing it twice adds nothing a screen reader can use.
        role="img"
        aria-label={t("qrLabel")}
        className="shrink-0 rounded-md bg-white p-2"
      >
        <path d={path} fill="#000000" />
      </svg>

      <p className="min-w-0 text-sm text-muted">{t("qrHint")}</p>
    </div>
  );
}
