/** Merkteken Toetski: groen toetsblad + check. */
export function LeafMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="6" y="4" width="20" height="24" rx="3.5" fill="var(--color-leaf)" />
      <path
        d="M10 15h9M10 19h7"
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />
      <path
        d="M11 16.5l3 3 7-7"
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
