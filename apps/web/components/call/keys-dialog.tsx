"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PROVIDERS } from "@/lib/stt/providers";
import { listKeys, removeKey, saveKey, type StoredKey } from "@/lib/keys/store";

/**
 * Where somebody puts their own key, sees what is stored, and takes it back.
 *
 * Three things here are deliberate.
 *
 * **The field is a password field and is never repopulated.** After saving, the
 * input is cleared and what is shown is the last four characters. There is no
 * screen in this product that displays a whole key, so there is no screenshot,
 * screen share or shoulder that can carry one — which matters in a video call
 * more than most places.
 *
 * **It says where the key goes.** For a provider a browser can reach, the
 * audio goes straight there and never touches our server; for one it cannot,
 * the request passes through and nothing is kept. Somebody handing over a key
 * is entitled to know which, and the difference is not cosmetic.
 *
 * **Removing is one press with no confirmation.** A key can be pasted again in
 * five seconds; a dialog asking "are you sure" before *deleting a secret* gets
 * the risk backwards.
 */
export function KeysDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  /** Captions stopped when the allowance ran out; a key is a reason to try again. */
  onSaved: () => void;
}) {
  const t = useTranslations("call.keys");

  const [stored, setStored] = useState<StoredKey[] | null>(null);
  const [provider, setProvider] = useState("groq");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void listKeys()
      .then((keys) => live && setStored(keys))
      .catch(() => live && setStored([]));
    return () => {
      live = false;
    };
  }, []);

  async function add() {
    if (!value.trim() || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await saveKey(provider, value);
      setValue("");
      setStored(await listKeys());
      onSaved();
    } catch {
      // Private browsing, a full disk, storage refused. Nothing was stored, and
      // saying so is better than looking as though it was.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function drop(id: string) {
    await removeKey(id).catch(() => {});
    setStored(await listKeys().catch(() => []));
  }

  return (
    <aside
      className="absolute inset-y-0 z-30 flex w-full max-w-sm flex-col gap-4 overflow-y-auto border-s border-[#27272a] bg-[#111113] p-4 end-0"
      aria-label={t("title")}
    >
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#fafafa]">{t("title")}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs text-[#a1a1aa] hover:text-[#fafafa]"
        >
          {t("close")}
        </button>
      </header>

      <p className="text-xs leading-relaxed text-[#a1a1aa]">{t("blurb")}</p>

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs text-[#a1a1aa]">
          {t("provider")}
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            className="rounded-md border border-[#27272a] bg-[#18181b] px-2 py-1.5 text-sm text-[#fafafa]"
          >
            {Object.values(PROVIDERS).map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-[#a1a1aa]">
          {t("key")}
          <input
            // A password field, and never repopulated: no screen in this
            // product shows a whole key, so no screen share can carry one.
            type="password"
            value={value}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setValue(event.target.value)}
            placeholder={PROVIDERS[provider]?.id === "groq" ? "gsk_…" : "sk-…"}
            className="rounded-md border border-[#27272a] bg-[#18181b] px-2 py-1.5 font-mono text-sm text-[#fafafa]"
          />
        </label>

        <p className="text-[11px] leading-relaxed text-[#71717a]">
          {PROVIDERS[provider]?.browserDirect ? t("goesDirect") : t("goesViaServer")}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={add}
            disabled={!value.trim() || busy}
            className="rounded-md bg-[#f4f4f5] px-3 py-1.5 text-sm font-medium text-[#0a0a0b] disabled:opacity-40"
          >
            {t("save")}
          </button>
          <a
            href={PROVIDERS[provider]?.keysUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#a1a1aa] underline decoration-[#52525b] underline-offset-2 hover:text-[#fafafa]"
          >
            {t("whereFrom")}
          </a>
        </div>

        {failed && <p className="text-xs text-[#fca5a5]">{t("saveFailed")}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-[#a1a1aa]">{t("stored")}</h3>

        {stored === null && <p className="text-xs text-[#71717a]">{t("loading")}</p>}
        {stored?.length === 0 && <p className="text-xs text-[#71717a]">{t("none")}</p>}

        <ul className="flex flex-col gap-1">
          {stored?.map((entry) => (
            <li
              key={entry.provider}
              className="flex items-center justify-between gap-2 rounded-md bg-[#18181b] px-2 py-1.5 text-sm"
            >
              <span className="text-[#f4f4f5]">
                {PROVIDERS[entry.provider]?.label ?? entry.provider}
                <span className="ms-2 font-mono text-xs text-[#71717a]">
                  ····{entry.hint}
                </span>
              </span>
              {/* No confirmation. A key can be pasted again in five seconds;
                  asking "are you sure" before deleting a secret has the risk
                  backwards. */}
              <button
                type="button"
                onClick={() => drop(entry.provider)}
                className="rounded-md px-2 py-0.5 text-xs text-[#a1a1aa] hover:text-[#fca5a5]"
              >
                {t("remove")}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
