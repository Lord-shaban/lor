import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const button = cva(
  // 44px minimum touch target, and a focus ring that is never removed.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium " +
    "transition-colors duration-150 cursor-pointer select-none " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // The primary action is the foreground at full strength. There is no
        // decorative accent hue: red is reserved for live state.
        primary:
          "bg-foreground text-on-foreground hover:opacity-90 active:opacity-80",
        secondary:
          "bg-surface-strong text-foreground hover:bg-border active:bg-border",
        ghost: "text-foreground hover:bg-surface-strong active:bg-border",
        outline:
          "border border-border text-foreground hover:bg-surface active:bg-surface-strong",
        // Destructive shares the live red: both mean "consequential right now".
        danger: "bg-danger text-on-live hover:opacity-90 active:opacity-80",
      },
      size: {
        sm: "h-9 min-w-9 rounded-sm px-3 text-sm",
        md: "h-11 min-w-11 rounded-md px-4 text-sm",
        lg: "h-12 min-w-12 rounded-md px-6 text-base",
        icon: "h-11 w-11 rounded-md",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof button> {
  /** Render as the child element instead of a <button>, for links that look like buttons. */
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component className={cn(button({ variant, size }), className)} {...props} />
  );
}

export { button as buttonVariants };
