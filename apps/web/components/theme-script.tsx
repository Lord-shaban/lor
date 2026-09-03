/**
 * Applies the stored theme before first paint.
 *
 * Without this the page renders with the system theme, then swaps on hydration
 * — a visible flash for anyone whose choice differs from their OS. It has to be
 * inline and synchronous in <head>, so it cannot be a normal component effect.
 *
 * Storage can throw outright in a private window or with site data blocked, so
 * the whole thing is wrapped and a failure simply falls through to the system
 * preference.
 */
const script = `
try {
  var t = localStorage.getItem("lor-theme");
  if (t === "dark" || t === "light") {
    document.documentElement.setAttribute("data-theme", t);
  }
} catch (e) {}
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
