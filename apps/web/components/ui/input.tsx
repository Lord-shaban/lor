import { cn } from "@/lib/cn";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      // dir="auto" by default: a room code is Latin, a display name may be
      // Arabic, and the field should follow whatever is typed into it.
      dir={props.dir ?? "auto"}
      className={cn(
        "h-11 w-full rounded-sm border border-border bg-surface px-3 text-base",
        "text-foreground placeholder:text-muted",
        "transition-colors duration-150",
        "hover:border-muted",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}
