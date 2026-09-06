import { RTTI_META, RTTI_ORDER } from "@/lib/toets/constants";
import { normaliseer, somVerdeling } from "@/lib/toets/rtti";
import type { Rtti, RttiVerdeling } from "@/lib/toets/types";
import { cn } from "@/lib/utils";

export function RttiPicker({
  value,
  onChange,
}: {
  value: RttiVerdeling;
  onChange: (v: RttiVerdeling) => void;
}) {
  const n = normaliseer(value);
  const som = somVerdeling(value);
  function set(k: Rtti, raw: number) {
    onChange({ ...value, [k]: Math.max(0, Math.min(100, raw)) });
  }
  return (
    <div className="grid gap-3">
      <p className="text-sm font-semibold text-brand">RTTI-doel ({som}%)</p>
      <div className="flex h-4 overflow-hidden rounded-full">
        {RTTI_ORDER.map((k) => (
          <div
            key={k}
            className={cn(
              k === "R" && "bg-rtti-r",
              k === "T1" && "bg-rtti-t1",
              k === "T2" && "bg-rtti-t2",
              k === "I" && "bg-rtti-i",
            )}
            style={{ width: `${n[k]}%` }}
          />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {RTTI_ORDER.map((k) => (
          <label key={k} className="grid gap-1">
            <span className="text-xs font-semibold text-brand">
              {RTTI_META[k].kort}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              value={value[k]}
              onChange={(e) => set(k, Number(e.target.value))}
              className="h-11 rounded-[var(--radius-md)] bg-paper px-2 text-sm tabular-nums"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
