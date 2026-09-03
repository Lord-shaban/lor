"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "lor-theme";

/**
 * The `data-theme` attribute on <html> is the single source of truth. The inline
 * script in <head> sets it before first paint, so duplicating it into React
 * state would mean two copies that can disagree — and reading it in an effect
 * would render once with the wrong value and then correct itself.
 *
 * Subscribing to the attribute instead keeps the label in step with whatever is
 * actually applied, including a change made in another tab or by the script.
 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  const value = document.documentElement.getAttribute("data-theme");
  return value === "dark" || value === "light" ? value : "system";
}

/** Nothing is applied during a server render, so the server sees "system". */
function getServerSnapshot(): Theme {
  return "system";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);

  try {
    if (theme === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private windows and blocked site data throw here. The choice still
    // applies to this page; it just will not be remembered.
  }
}

export function ThemeToggle() {
  const t = useTranslations("theme");
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function cycle() {
    apply(theme === "system" ? "light" : theme === "light" ? "dark" : "system");
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycle}
      // The label names what is currently set rather than what pressing will
      // do, so a screen reader announces the state, not a prediction.
      aria-label={t("current", { theme: t(theme) })}
    >
      {t(theme)}
    </Button>
  );
}
