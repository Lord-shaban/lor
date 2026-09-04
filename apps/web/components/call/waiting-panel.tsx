"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { WaitingPerson } from "@/components/call/use-waiting-list";
import { cn } from "@/lib/cn";

/**
 * The door, from inside the meeting.
 *
 * Deciding has to be possible without leaving the call, because the moment a
 * host is asked to choose is the moment they are mid-sentence. Oldest first,
 * numbered, for the same reason the raised-hand queue is: a list that reorders
 * itself passes over whoever has waited longest.
 *
 * Admit is not the visually louder button. Letting the wrong person into a
 * meeting is the expensive mistake here, and the two need to look like two
 * decisions rather than one obvious one and its escape hatch.
 */
export function WaitingPanel({
  waiting,
  deciding,
  onDecide,
  doorOn,
  onSetDoor,
  locked,
  onSetLocked,
  onClose,
}: {
  waiting: readonly WaitingPerson[];
  /** The id currently being decided, so its buttons can be held. */
  deciding: string | null;
  onDecide: (id: string, decision: "admit" | "deny") => void;
  /** Whether the room currently has a door at all. */
  doorOn: boolean;
  onSetDoor: (enabled: boolean) => void;
  /** Locked means nobody new gets in at all — not even to wait. */
  locked: boolean;
  onSetLocked: (locked: boolean) => void;
  onClose: () => void;
}) {
  const t = useTranslations("call");
  const format = useFormatter();

  return (
    <aside
      aria-label={t("door.title")}
      className={cn(
        "absolute inset-0 z-20 flex flex-col bg-[#0a0a0b]",
        "md:static md:z-auto md:w-80 md:shrink-0 md:border-s md:border-[#2a2a2e]",
      )}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-[#2a2a2e] px-4 py-3">
        <h2 className="text-sm font-medium text-[#f4f4f5]">{t("door.title")}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("door.close")}
          className="h-9 rounded-md px-3 text-sm text-[#a1a1aa] transition-colors duration-150 hover:bg-[#1e1e21] hover:text-[#f4f4f5]"
        >
          {t("chat.closeShort")}
        </button>
      </header>

      {/* The switch lives above the queue it governs, so turning the door off
          and seeing the queue empty is one glance rather than two screens. */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-[#2a2a2e] px-4 py-3">
        <Switch
          checked={doorOn}
          onChange={onSetDoor}
          label={t("door.toggle")}
          hint={t("door.toggleHint")}
        />

        {/* Stronger than the door and stated as such: a locked room has nobody
            waiting, because nobody gets as far as waiting. */}
        <Switch
          checked={locked}
          onChange={onSetLocked}
          label={t("door.lock")}
          hint={t("door.lockHint")}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {waiting.length === 0 ? (
          <p className="text-sm text-[#a1a1aa]">
            {locked
              ? t("door.lockedNote")
              : doorOn
                ? t("door.empty")
                : t("door.off")}
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {waiting.map((person, index) => (
              <li key={person.id} className="rounded-lg bg-[#141416] p-3">
                <div className="flex items-baseline gap-2 text-xs text-[#a1a1aa]">
                  <bdi className="tabular-nums">{format.number(index + 1)}</bdi>
                  <bdi className="shrink-0 tabular-nums">
                    {format.dateTime(new Date(person.at), {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </bdi>
                </div>

                {/* The name is whatever they typed, in either script, and it is
                    not to be trusted as anything but text. */}
                <p
                  dir="auto"
                  className="mt-1 text-sm text-[#f4f4f5] [overflow-wrap:anywhere]"
                >
                  <bdi>{person.name}</bdi>
                </p>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={deciding === person.id}
                    onClick={() => onDecide(person.id, "admit")}
                    className="h-9 flex-1 rounded-md bg-[#1e1e21] px-3 text-sm font-medium text-[#f4f4f5] transition-colors duration-150 hover:bg-[#2a2a2e] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("door.admit")}
                  </button>
                  <button
                    type="button"
                    disabled={deciding === person.id}
                    onClick={() => onDecide(person.id, "deny")}
                    className="h-9 flex-1 rounded-md px-3 text-sm text-[#a1a1aa] transition-colors duration-150 hover:bg-[#1e1e21] hover:text-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("door.deny")}
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        {/* Said plainly, because the alternative is a host who thinks a refusal
            is reversible and finds out it is not by trying. */}
        <p className="pt-4 text-xs text-[#71717a]">{t("door.denyIsFinal")}</p>
      </div>
    </aside>
  );
}

function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[#f4f4f5]"
      />
      <span className="min-w-0">
        <span className="block text-sm text-[#f4f4f5]">{label}</span>
        <span className="mt-1 block text-xs text-[#71717a]">{hint}</span>
      </span>
    </label>
  );
}
