import { useEffect, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import type { Voortgang } from "@/lib/toets/maak-toets";
import { berekenVoortgang, verwachteVragenMs } from "@/lib/toets/voortgang";
import { cn } from "@/lib/utils";

/** Vloeiende voortgangsbalk met fase-label en grove resttijd. Gaat nooit terug. */
export function VoortgangsBalk({ voortgang, aantalVragen }: { voortgang: Voortgang; aantalVragen: number }) {
  const start = useRef(Date.now());
  const fase = useRef({ naam: voortgang.fase, start: Date.now() });
  if (fase.current.naam !== voortgang.fase) fase.current = { naam: voortgang.fase, start: Date.now() };
  const [nu, setNu] = useState(Date.now());
  const maxPct = useRef(0);
  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);
  const w = berekenVoortgang(voortgang, { start: start.current, faseStart: fase.current.start, verwachtVragenMs: verwachteVragenMs(aantalVragen) }, nu);
  maxPct.current = Math.max(maxPct.current, w.pct);
  const pct = Math.min(100, maxPct.current);
  // Afteller: geschatte eindtijd. Eerder klaar → direct lager; langer nodig → eerlijk omhoog (geen nep-aftellen).
  const eind = useRef<number | null>(null);
  if (w.restMs != null) {
    const kandidaat = nu + w.restMs;
    if (eind.current == null || kandidaat < eind.current || kandidaat > eind.current + 3_000) eind.current = kandidaat;
  }
  const restS = eind.current != null ? Math.max(0, Math.ceil((eind.current - nu) / 1000)) : null;
  return (
    <div role="status" aria-live="polite" className="rounded-[var(--radius-xl)] bg-surface p-6 sm:p-8">
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 font-semibold text-brand">
          {w.wachtOpPlaatjes ? <ImageIcon className="size-4 shrink-0 animate-pulse" /> : null}
          <span className="min-w-0">{w.label}</span>
        </p>
        <p className="shrink-0 text-lg font-bold tabular-nums text-brand" aria-label="Resterende tijd">
          {restS == null ? "" : restS > 0 ? `nog ${restS} s` : "bijna klaar"}
        </p>
      </div>
      <div
        className="mt-3 h-3 w-full overflow-hidden rounded-full bg-paper"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Voortgang toets maken"
      >
        <div
          className={cn("h-full rounded-full bg-brand transition-[width] duration-300 ease-linear", w.wachtOpPlaatjes && "bg-primary")}
          style={{ width: `${pct.toFixed(1)}%` }}
        />
      </div>
      {w.wachtOpPlaatjes ? (
        <p className="mt-2 text-xs text-muted">Tekst is klaar. Niet op tijd goedgekeurde plaatjes vallen weg; de vraag gaat dan zonder plaatje door.</p>
      ) : null}
    </div>
  );
}
