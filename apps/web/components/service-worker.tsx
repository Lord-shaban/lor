"use client";

import { useEffect } from "react";

/**
 * Register the service worker, once the page has finished being a page.
 *
 * Deferred to `load` on purpose: registering during hydration competes with the
 * work that actually gets somebody into a meeting, and an installable app is
 * worth nothing if joining is slower for it.
 *
 * Only in production. A worker in development caches a build that is about to
 * change and produces the strangest class of bug there is — the one that goes
 * away when you open a private window.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Blocked by the browser, or served without HTTPS. The site works
        // exactly as before; it simply is not installable.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
