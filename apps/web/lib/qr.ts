import qrcode from "qrcode-generator";

/**
 * A room link as a square you can point a phone at.
 *
 * Half of these meetings happen on a phone, and the usual way onto one is
 * somebody reading a code out while the other person types it with their
 * thumbs. This is the alternative, and it has to work from across a table.
 *
 * Returned as geometry rather than an image: an SVG path renders at any size
 * without a canvas, without a client bundle, and without a network request for
 * a picture of a link the page already knows.
 */

export interface QrCode {
  /** Modules per side, including the quiet zone. Also the SVG viewBox. */
  size: number;
  /** One path covering every dark module, in `M x y h 1 v 1 h -1 z` runs. */
  path: string;
}

/**
 * Four modules of margin, which the specification requires.
 *
 * Scanners use it to find the edges of the code. Without it, a QR printed
 * against a dark background or butted up to other content often will not read
 * at all — and the failure looks like a bad camera rather than a bad margin.
 */
export const QUIET_ZONE = 4;

/**
 * Medium error correction: about 15% of the code can be obscured.
 *
 * The next level up would survive a thumb over the corner but needs a denser
 * grid for the same text, and a denser grid is harder to read from across a
 * table — which is the thing this is actually for.
 */
const ERROR_CORRECTION = "M";

export function qrCode(text: string): QrCode {
  // 0 asks the library to pick the smallest version that fits.
  const code = qrcode(0, ERROR_CORRECTION);
  code.addData(text);
  code.make();

  const modules = code.getModuleCount();
  const size = modules + QUIET_ZONE * 2;

  // One path for the whole code. A rect per module is thousands of elements for
  // something that never changes shape once drawn.
  let path = "";
  for (let row = 0; row < modules; row++) {
    for (let column = 0; column < modules; column++) {
      if (!code.isDark(row, column)) continue;
      path += `M${column + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
    }
  }

  return { size, path };
}
