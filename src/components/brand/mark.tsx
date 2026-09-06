export function LeafMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M8 22c8-1 14-8 16-16-8 2-15 8-16 16Z"
        fill="var(--color-leaf)"
      />
      <path
        d="M10 20c4-3 8-8 10-14"
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="11" cy="23" r="2.2" fill="var(--color-brand)" />
    </svg>
  );
}
