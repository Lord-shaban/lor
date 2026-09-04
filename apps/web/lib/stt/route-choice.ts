import { PROVIDERS, type Provider } from "./providers";

/**
 * Which way a participant's audio goes.
 *
 * Three routes, in the order they are preferred, and the order is about where
 * the key and the audio end up rather than about speed:
 *
 * 1. **Direct.** Their own key, at a provider that accepts browser requests.
 *    Neither the key nor the audio reaches our server at all — which is the
 *    strongest form of what `SECURITY.md` promises, and the only one that does
 *    not require trusting us.
 * 2. **Proxy with their key.** Their own key, at a provider that refuses
 *    browser requests. It travels as a header on the one request that uses it;
 *    `/api/stt` forwards and returns and keeps nothing.
 * 3. **Proxy with the operator's key.** Nobody brought one. This is the path
 *    quotas ration.
 *
 * Pure, because the ordering is the decision and a decision worth making is
 * worth a test.
 */

export type Route =
  | { kind: "direct"; provider: Provider; key: string }
  | { kind: "proxy"; key?: string };

export interface HeldKey {
  provider: string;
  key: string;
}

export function chooseRoute(held: readonly HeldKey[]): Route {
  // A provider we know, that we have measured as reachable from a browser, and
  // that this person has a key for. All three, or it is not route one.
  for (const candidate of held) {
    const provider = PROVIDERS[candidate.provider];
    if (provider?.browserDirect && candidate.key.trim()) {
      return { kind: "direct", provider, key: candidate.key.trim() };
    }
  }

  // A key for somewhere we cannot reach from here, or for a provider this
  // build does not know. The proxy can still use it — it is the provider's
  // key, not ours, and the route ignores what it cannot identify.
  for (const candidate of held) {
    if (PROVIDERS[candidate.provider] && candidate.key.trim()) {
      return { kind: "proxy", key: candidate.key.trim() };
    }
  }

  return { kind: "proxy" };
}
