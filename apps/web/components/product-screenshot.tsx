import Image from "next/image";

/** A real product capture, framed without changing the interface it documents. */
export function ProductScreenshot({
  src, alt, label, caption, inspect, priority = false,
  width = 1440, height = 900, sizes = "(max-width: 768px) 100vw, 1200px",
}: {
  src: string;
  alt: string;
  label: string;
  caption: string;
  inspect: string;
  priority?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
}) {
  return (
    <figure className="min-w-0">
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
        <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border px-4 py-2 text-xs sm:px-5">
          <span className="truncate font-medium">{label}</span>
          <span aria-hidden="true" className="flex shrink-0 gap-1.5">
            <span className="h-2 w-2 rounded-full bg-muted/40" />
            <span className="h-2 w-2 rounded-full bg-muted/40" />
            <span className="h-2 w-2 rounded-full bg-muted/40" />
          </span>
        </div>
        <a href={src} aria-label={`${inspect}: ${label}`} className="block focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-foreground">
          <Image src={src} alt={alt} width={width} height={height} sizes={sizes} preload={priority} className="h-auto w-full" />
        </a>
      </div>
      <figcaption className="mt-4 flex flex-col justify-between gap-2 text-sm leading-6 text-muted sm:flex-row sm:gap-6">
        <span className="max-w-3xl">{caption}</span>
        <a href={src} aria-label={`${inspect}: ${label}`} className="inline-flex min-h-11 shrink-0 items-center self-start font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">{inspect}</a>
      </figcaption>
    </figure>
  );
}
