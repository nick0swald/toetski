import { useEffect, useRef, useState } from "react";
import { berekenStap0Voortgang, type Stap0Voortgang } from "@/lib/toets/stap0-voortgang";

/** Wachtbalk voor de nieuwe generator (stap 0): vult per stap, met geschatte resttijd en de statustekst. Gaat nooit terug. */
export function Stap0Balk({ voortgang }: { voortgang: Stap0Voortgang }) {
  const sleutel = `${voortgang.fase}:${voortgang.ronde}`;
  const fase = useRef({ sleutel, start: Date.now() });
  if (fase.current.sleutel !== sleutel) fase.current = { sleutel, start: Date.now() };
  const [nu, setNu] = useState(Date.now());
  const maxPct = useRef(0);
  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const w = berekenStap0Voortgang(voortgang, { faseStart: fase.current.start }, nu);
  maxPct.current = Math.max(maxPct.current, w.pct);
  const pct = Math.min(100, maxPct.current);
  const eind = useRef<number | null>(null);
  if (w.restMs != null) {
    const kandidaat = nu + w.restMs;
    if (eind.current == null || kandidaat < eind.current || kandidaat > eind.current + 5_000) eind.current = kandidaat;
  }
  const restS = eind.current != null ? Math.max(0, Math.ceil((eind.current - nu) / 1000)) : null;
  const rest = restS == null ? "" : restS > 90 ? `nog ± ${Math.round(restS / 60)} min` : restS > 0 ? `nog ± ${restS} s` : "bijna klaar";
  return (
    <div role="status" aria-live="polite" className="rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8" data-testid="stap0-status">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 font-semibold text-brand">
          {w.label} <span className="tabular-nums">· {Math.round(pct)}%</span>
        </p>
        <p className="shrink-0 text-lg font-bold tabular-nums text-brand" aria-label="Resterende tijd">
          {rest}
        </p>
      </div>
      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-paper" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Voortgang toets maken">
        <div className="h-full rounded-full bg-brand transition-[width] duration-300 ease-linear" style={{ width: `${pct.toFixed(1)}%` }} data-testid="stap0-balk" />
      </div>
      <p className="mt-2 text-sm text-fg">{voortgang.tekst}</p>
    </div>
  );
}
