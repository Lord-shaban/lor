import { cn } from "@/lib/cn";

/**
 * The one place red is allowed: something is happening right now.
 *
 * Never rendered on its own — colour alone cannot carry meaning, so a label is
 * required and is read out alongside the dot.
 */
export function LiveDot({
  label,
  pulse = true,
  className,
}: {
  label: string;
  /** The pulse is the one animation worth keeping; its whole job is to be noticed. */
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        {pulse && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60 motion-reduce:hidden" />
        )}
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-live" />
      </span>
      <span>{label}</span>
    </span>
  );
}
