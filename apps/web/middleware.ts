import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  /**
   * Everything except API routes, Next internals, and anything with a file
   * extension.
   *
   * The double backslash matters. `"\."` in a JavaScript string is just `"."`,
   * which turns the guard into `.*..*` — "one or more characters" — and excludes
   * every non-empty path from the middleware. The symptom is subtle: `/` keeps
   * working while every room link 404s, because only the empty path survives the
   * lookahead. `middleware.test.ts` guards this exact mistake.
   */
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
