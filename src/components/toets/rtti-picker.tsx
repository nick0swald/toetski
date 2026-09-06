import { useCallback, useRef } from "react";
import { RTTI_META, RTTI_ORDER } from "@/lib/toets/constants";
import { normaliseer } from "@/lib/toets/rtti";
import type { Rtti, RttiVerdeling } from "@/lib/toets/types";
import { cn } from "@/lib/utils";

const FILL: Record<Rtti, string> = {
  R: "bg-rtti-r text-paper",
  T1: "bg-rtti-t1 text-primary-fg",
  T2: "bg-rtti-t2 text-ink",
  I: "bg-rtti-i text-paper",
};

function snap(n: number) {
  return Math.max(0, Math.min(100, Math.round(n / 5) * 5));
}

export function RttiPicker({
  value,
  onChange,
}: {
  value: RttiVerdeling;
  onChange: (next: RttiVerdeling) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    index: number;
    startX: number;
    start: number[];
  } | null>(null);

  const v = normaliseer(value);
  const parts = RTTI_ORDER.map((k) => v[k]);

  const applyParts = useCallback(
    (next: number[]) => {
      onChange({ R: next[0], T1: next[1], T2: next[2], I: next[3] });
    },
    [onChange],
  );

  function onPointerDown(index: number, e: React.PointerEvent) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { index, startX: e.clientX, start: [...parts] };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !barRef.current) return;
    const w = barRef.current.getBoundingClientRect().width;
    if (w <= 0) return;
    const i = drag.current.index;
    const start = drag.current.start;
    const pair = start[i] + start[i + 1];
    const delta = ((e.clientX - drag.current.startX) / w) * 100;
    let left = snap(start[i] + delta);
    left = Math.max(0, Math.min(pair, left));
    const next = [...start];
    next[i] = left;
    next[i + 1] = pair - left;
    applyParts(next);
  }

  function onPointerUp() {
    drag.current = null;
  }

  function nudge(index: number, dir: -1 | 1) {
    const pair = parts[index] + parts[index + 1];
    let left = snap(parts[index] + dir * 5);
    left = Math.max(0, Math.min(pair, left));
    const next = [...parts];
    next[index] = left;
    next[index + 1] = pair - left;
    applyParts(next);
  }

  return (
    <div className="grid gap-3">
      <div
        ref={barRef}
        className="relative flex h-12 w-full overflow-hidden rounded-[var(--radius-lg)] select-none touch-none"
        role="group"
        aria-label="RTTI-verdeling, 100 procent"
      >
        {RTTI_ORDER.map((k, i) => (
          <div
            key={k}
            className={cn(
              "relative flex min-w-0 items-center justify-center text-xs font-medium tabular-nums",
              FILL[k],
            )}
            style={{ width: `${Math.max(0, v[k])}%` }}
          >
            {v[k] >= 14 ? (
              <span>
                {k} {v[k]}
              </span>
            ) : v[k] >= 7 ? (
              <span>{k}</span>
            ) : null}
            {i < 3 ? (
              <button
                type="button"
                aria-label={`Grens ${k} / ${RTTI_ORDER[i + 1]}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={v[k]}
                className="absolute top-0 right-0 z-10 h-full w-6 translate-x-1/2 cursor-ew-resize touch-none"
                onPointerDown={(e) => onPointerDown(i, e)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    nudge(i, -1);
                  }
                  if (e.key === "ArrowRight") {
                    e.preventDefault();
                    nudge(i, 1);
                  }
                }}
              >
                <span className="absolute top-2 bottom-2 left-1/2 w-1 -translate-x-1/2 rounded-full bg-white/85 shadow-[var(--shadow-border)]" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        {RTTI_ORDER.map((k) => (
          <li key={k} className="flex items-baseline justify-between gap-2">
            <span className="text-muted">
              {RTTI_META[k].kort}
              <span className="hidden sm:inline"> · {RTTI_META[k].naam}</span>
            </span>
            <span className="tabular-nums font-medium">{v[k]}%</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        Sleep de schotten. Makkelijk, normaal of moeilijk zet de balk terug.
      </p>
    </div>
  );
}
