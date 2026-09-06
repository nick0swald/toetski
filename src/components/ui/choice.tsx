import { cn } from "@/lib/utils";

export function Choice<T extends string>({
  value,
  onChange,
  options,
  legend,
  hint,
}: {
  value: T;
  onChange: (id: T) => void;
  options: { id: T; label: string; hint?: string }[];
  legend?: string;
  hint?: string;
}) {
  const selected = options.find((o) => o.id === value);
  return (
    <fieldset className="grid gap-2">
      {legend ? (
        <legend className="text-sm font-semibold text-brand">{legend}</legend>
      ) : null}
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      <div className="flex min-w-0 rounded-[var(--radius-lg)] bg-paper p-1">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              "min-h-11 min-w-0 flex-1 rounded-[var(--radius-md)] px-2 text-sm transition-[background-color,color] duration-[var(--motion-quick)] ease-[var(--ease-out)]",
              value === o.id
                ? "bg-brand font-semibold text-paper"
                : "text-muted hover:text-brand",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {selected?.hint ? (
        <p className="text-sm text-muted">{selected.hint}</p>
      ) : null}
    </fieldset>
  );
}
