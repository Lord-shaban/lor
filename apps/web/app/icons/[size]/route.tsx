import { ImageResponse } from "next/og";

/**
 * The app icon, rendered rather than stored.
 *
 * A manifest needs real PNGs at known sizes, and the mark is three shapes. Two
 * committed binaries that nobody can diff and everybody forgets to regenerate
 * is the worse trade — this keeps the icon as the same geometry as
 * `app/icon.svg` and produces the sizes an installer asks for.
 */

/** What an installer asks for, plus the padded one Android masks into a shape. */
const SIZES = {
  "192": { size: 192, maskable: false },
  "512": { size: 512, maskable: false },
  maskable: { size: 512, maskable: true },
} as const;

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

/** Built once. The icon does not depend on anything that changes at runtime. */
export const dynamic = "force-static";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/icons/[size]">,
) {
  const { size: requested } = await params;
  const spec = SIZES[requested as keyof typeof SIZES];
  if (!spec) return new Response("Not found", { status: 404 });

  const { size } = spec;

  // A maskable icon is cropped to whatever shape the launcher uses, so
  // everything that matters has to sit inside the middle 80%. Drawing it
  // smaller is the whole difference between the two variants.
  const mark = size * (spec.maskable ? 0.66 : 0.9);
  const inset = (size - mark) / 2;

  // The same proportions as app/icon.svg, whose viewBox is 64 wide. Taken from
  // it rather than eyeballed: a mark that is nearly the logo reads as a
  // mistake, and the dot touching the ring is exactly that kind of nearly.
  const unit = mark / 64;
  const shape = (cx: number, cy: number, radius: number) => ({
    position: "absolute" as const,
    left: inset + (cx - radius) * unit,
    top: inset + (cy - radius) * unit,
    width: radius * 2 * unit,
    height: radius * 2 * unit,
    borderRadius: radius * unit,
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          position: "relative",
          // Filled to the edge: a transparent background becomes a black square
          // on some launchers and a white one on others.
          background: "#0f172a",
        }}
      >
        {/* Stroke on the outside of the radius, the way the SVG draws it. */}
        <div
          style={{
            ...shape(27, 30, 17),
            border: `${8 * unit}px solid #f8fafc`,
          }}
        />

        {/* The dot. Red because it is the live indicator, and the one piece of
            the wordmark that carries meaning. */}
        <div style={{ ...shape(50, 45, 6), background: "#ef4444" }} />
      </div>
    ),
    { width: size, height: size },
  );
}
