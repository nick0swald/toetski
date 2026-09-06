import { RTTI_META, RTTI_ORDER } from "@/lib/toets/constants";
import { afwijking } from "@/lib/toets/rtti";
import type { RttiVerdeling } from "@/lib/toets/types";
import { cn } from "@/lib/utils";

const barColor: Record<string, string> = {
  R: "bg-rtti-r",
  T1: "bg-rtti-t1",
  T2: "bg-rtti-t2",
  I: "bg-rtti-i",
};

export function RttiBars({
  actual,
  doel,
}: {
  actual: RttiVerdeling;
  doel: RttiVerdeling;
}) {
  return (
    <div className="grid gap-3">
      {RTTI_ORDER.map((k) => {
        const status = afwijking(actual[k], doel[k]);
        return (
          <div key={k} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-fg">
                {RTTI_META[k].kort}
                <span className="ml-2 font-normal text-muted">
                  {RTTI_META[k].naam}
                </span>
              </span>
              <span
                className={cn(
                  "tabular-nums text-xs",
                  status === "ok" ? "text-leaf" : "text-warn",
                )}
              >
                {actual[k]}% · doel {doel[k]}%
              </span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-border/70">
              <div
                className={cn("absolute inset-y-0 left-0 rounded-full", barColor[k])}
                style={{ width: `${Math.min(100, actual[k])}%` }}
              />
              <div
                className="absolute top-0 h-full w-px bg-ink/50"
                style={{ left: `${doel[k]}%` }}
                aria-hidden
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
