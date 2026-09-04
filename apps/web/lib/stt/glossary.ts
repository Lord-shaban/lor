import { cleanGlossary } from "./prompt";

/**
 * Reading the glossary back out of a room's settings.
 *
 * `settings` is `jsonb`, so what comes out of it is whatever was put in — by
 * this version of the code or a previous one, or by hand in a console at three
 * in the morning. Everything that reads it has to survive finding a string
 * where it expected an array, and `null`, and an object, without taking the
 * room down.
 *
 * Its own module rather than a function in `prompt.ts` because the route needs
 * it and the route must not pull the prompt's constants into a bundle that has
 * no use for them.
 */
export function readGlossary(settings: unknown): string[] {
  if (!settings || typeof settings !== "object") return [];

  const value = (settings as Record<string, unknown>).glossary;
  if (!Array.isArray(value)) return [];

  return cleanGlossary(value.filter((term): term is string => typeof term === "string"));
}
