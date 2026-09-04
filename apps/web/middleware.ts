import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  /**
   * Everything except API routes, generated icons, Next internals, and anything
   * with a file extension.
   *
   * `icons` is named explicitly because `/icons/192` has no extension to be
   * caught by the rule below, so the locale middleware rewrote it into
   * `/ar/icons/192` and the manifest's icons 404'd — an installable app with no
   * icon, which is not installable. Found by fetching them, not by reading
   * this.
   *
   * The double backslash matters. `"\."` in a JavaScript string is just `"."`,
   * which turns the guard into `.*..*` — "one or more characters" — and excludes
   * every non-empty path from the middleware. The symptom is subtle: `/` keeps
   * working while every room link 404s, because only the empty path survives the
   * lookahead. `middleware.test.ts` guards this exact mistake.
   */
  matcher: "/((?!api|icons|_next|_vercel|.*\\..*).*)",
};
