import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClassName, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cesuurPunten, cijferVanScore, formuleTekst, nlCijfer, omzetTabel } from "@/lib/toets/cijfer";
import type { CijferNorm } from "@/lib/toets/types";
import { cn } from "@/lib/utils";
import { CijferCurve } from "./cijfer-curve";
import { CijferNormControls } from "./cijfer-norm-controls";

export function CijferPanel({
  max,
  norm,
  onChange,
  maxEditable = false,
  onMaxChange,
  onExport,
  titel = "Cijfer berekenen",
}: {
  max: number;
  norm: CijferNorm;
  onChange: (norm: CijferNorm) => void;
  maxEditable?: boolean;
  onMaxChange?: (max: number) => void;
  onExport: () => void | Promise<void>;
  titel?: string;
}) {
  const safeMax = Math.max(1, Math.round(max) || 1);
  const [score, setScore] = useState(Math.round(safeMax * 0.6));
  const clampedScore = Math.max(0, Math.min(safeMax, score));
  const tabel = useMemo(() => omzetTabel(safeMax, norm), [safeMax, norm]);
  const cijfer = cijferVanScore(clampedScore, safeMax, norm);
  const cesuur = cesuurPunten(safeMax, norm);

  return (
    <div className="grid gap-8">
      {titel ? (
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-brand">{titel}</h2>
          <p className="mt-1 text-sm text-muted">
            Zet punten om naar een cijfer van 1,0 tot 10,0. De tabel kun je als Word bewaren.
          </p>
        </div>
      ) : null}
      {maxEditable ? (
        <div className="grid gap-2 sm:max-w-xs">
          <Label htmlFor="max-punten">Maximumscore</Label>
          <Input
            id="max-punten"
            type="number"
            min={1}
            max={200}
            value={safeMax}
            onChange={(e) => {
              const next = Math.max(1, Math.min(200, Number(e.target.value) || 1));
              onMaxChange?.(next);
              setScore((s) => Math.min(s, next));
            }}
          />
        </div>
      ) : null}
      <CijferNormControls value={norm} onChange={onChange} max={safeMax} showCurve={false} />
      <p className="text-sm font-medium">{formuleTekst(norm, safeMax)}</p>
      <p className="text-sm">
        Cesuur: <span className="tabular-nums font-medium">{cesuur}</span> van {safeMax} punten voor een 5,5
      </p>
      <div>
        <Label htmlFor="score">Behaalde punten</Label>
        <div className="mt-2 flex flex-wrap items-end gap-4">
          <input
            id="score"
            type="range"
            min={0}
            max={safeMax}
            value={clampedScore}
            onChange={(e) => setScore(Number(e.target.value))}
            className="min-w-40 flex-1 accent-primary"
          />
          <input
            type="number"
            min={0}
            max={safeMax}
            value={clampedScore}
            onChange={(e) => setScore(Number(e.target.value))}
            className={cn(fieldClassName, "w-20 tabular-nums")}
          />
          <p className="font-display text-4xl tabular-nums tracking-tight text-brand">{nlCijfer(cijfer)}</p>
        </div>
      </div>
      <div className="rounded-[var(--radius-md)] bg-paper p-4">
        <CijferCurve max={safeMax} norm={norm} score={clampedScore} height={200} />
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-md)] bg-paper p-4">
        <table className="w-full min-w-[16rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 pr-3 font-medium">Punten</th>
              <th className="py-2 font-medium">Cijfer</th>
            </tr>
          </thead>
          <tbody>
            {tabel.map((r) => (
              <tr key={r.punten} className={r.punten === clampedScore ? "bg-primary/10" : "border-b border-border"}>
                <td className="py-1.5 pr-3 tabular-nums">{r.punten}</td>
                <td className="py-1.5 tabular-nums">{nlCijfer(r.cijfer)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" onClick={() => void onExport()}>
        Omzettingstabel als Word
      </Button>
    </div>
  );
}
