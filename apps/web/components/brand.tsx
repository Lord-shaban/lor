/** The paths are the existing assets/logo.svg mark; colour follows the theme. */
export function Brand({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-[72px]", md: "w-[96px]", lg: "w-[176px] sm:w-[224px]" };
  return (
    <svg viewBox="0 0 360 140" role="img" aria-label="LOR." className={`${sizes[size]} h-auto shrink-0 ${className}`}>
      <g fill="none" stroke="currentColor" strokeWidth="20" strokeLinecap="butt" strokeLinejoin="round">
        <path d="M10 20 V110 H60" />
        <circle cx="136" cy="70" r="40" />
        <path d="M222 20 V120" />
        <path d="M222 30 H256 A25 25 0 0 1 256 80 H222" />
        <path d="M222 80 L301 110" />
      </g>
      <circle cx="332" cy="105" r="15" fill="var(--live)" />
    </svg>
  );
}
