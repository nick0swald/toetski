/** Merkteken Toetski: toetsblad + groene check (Aeres-groen). */
export function LeafMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      {/* Blad / kaart */}
      <rect x="6" y="4" width="20" height="24" rx="3.5" fill="var(--color-leaf)" />
      {/* Vouwhoek */}
      <path d="M20 4v6h6" fill="none" stroke="var(--color-brand)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M20 4l6 6" fill="var(--color-brand)" opacity="0.2" />
      {/* Regel-hint */}
      <path
        d="M10 14h8M10 18h10M10 22h6"
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.35"
      />
      {/* Check */}
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
