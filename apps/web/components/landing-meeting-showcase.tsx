import { useTranslations } from "next-intl";

function PersonTile({ label, variant }: { label: string; variant: "light" | "dark" }) {
  return (
    <div className={`relative flex min-h-36 flex-col items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-white/10 ${variant === "light" ? "bg-[#252528]" : "bg-[#1d1d20]"} sm:min-h-48`}>
      <div aria-hidden="true" className="relative h-16 w-16 overflow-hidden rounded-full bg-[#55555a] sm:h-20 sm:w-20">
        <span className="absolute start-1/2 top-3 h-6 w-6 -translate-x-1/2 rounded-full bg-[#b9b9bf] sm:h-7 sm:w-7" />
        <span className="absolute inset-x-2 -bottom-5 h-12 rounded-full bg-[#b9b9bf] sm:inset-x-3 sm:h-14" />
      </div>
      <span className="absolute bottom-3 start-3 rounded-sm bg-black/65 px-2 py-1 text-xs text-white">{label}</span>
    </div>
  );
}

export function LandingMeetingShowcase() {
  const t = useTranslations("landing.showcase");

  return (
    <figure className="min-w-0">
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-[#0a0a0b] text-[#f4f4f5]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2a2a2e] px-4 py-3 sm:px-5">
          <span className="inline-flex items-center gap-2 text-sm font-medium"><span className="h-2 w-2 rounded-full bg-live" aria-hidden="true" />{t("live")}</span>
          <span className="text-xs text-[#a1a1aa]">{t("room")}</span>
        </div>
        <div className="grid min-w-0 gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(15rem,0.85fr)]">
          <div className="min-w-0">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <PersonTile label={t("speaker")} variant="light" />
              <PersonTile label={t("participant")} variant="dark" />
            </div>
            <div className="mt-3 rounded-[var(--radius-md)] border border-[#2a2a2e] bg-[#141416] px-4 py-3">
              <p className="text-xs text-[#a1a1aa]">{t("captionLabel")}</p>
              <p className="mt-1 text-sm leading-6">{t("caption")}</p>
            </div>
            <div aria-hidden="true" className="mt-4 flex items-center justify-center gap-2">
              <span className="h-8 w-8 rounded-full border border-[#55555a] bg-[#2a2a2e]" />
              <span className="h-8 w-8 rounded-full border border-[#55555a] bg-[#2a2a2e]" />
              <span className="h-8 w-8 rounded-full border border-[#55555a] bg-[#2a2a2e]" />
              <span className="h-8 w-12 rounded-full bg-[#dc2626]" />
            </div>
          </div>
          <div className="min-w-0 rounded-[var(--radius-md)] border border-[#2a2a2e] bg-[#141416] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 border-b border-[#2a2a2e] pb-4">
              <div><p className="text-xs text-[#a1a1aa]">{t("panelEyebrow")}</p><h3 className="mt-1 text-base font-semibold">{t("panelTitle")}</h3></div>
              <span className="rounded-full border border-[#55555a] px-2 py-1 text-xs text-[#d4d4d8]">01</span>
            </div>
            <p className="mt-5 text-sm font-medium leading-6">{t("decision")}</p>
            <div className="mt-5 border-s-2 border-[#71717a] ps-3">
              <p className="text-xs text-[#a1a1aa]">{t("sourceLabel")}</p>
              <p className="mt-1 text-sm leading-6 text-[#d4d4d8]">{t("source")}</p>
            </div>
            <p className="mt-5 text-xs text-[#a1a1aa]">{t("review")}</p>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 max-w-2xl text-sm leading-6 text-muted">{t("disclosure")}</figcaption>
    </figure>
  );
}
