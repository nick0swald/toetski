/**
 * Wachtbalk voor de stap-0-pilot: voortgang per serverstap (eerste versie → controle/verbeterrondes → inkorten en
 * opmaken → opslaan), met een geschat percentage en een geschatte resttijd. Pure functie (testbaar); het component
 * houdt de balk monotoon (nooit terug) en de afteller eerlijk.
 */
export type Stap0Fase = "spec" | "herstel" | "afronden" | "klaar" | "opslaan";

export interface Stap0Voortgang {
  /** De stap die nu loopt (na een serverstap: de volgende fase). */
  fase: Stap0Fase;
  /** Aantal afgeronde controle-/verbeterrondes. */
  ronde: number;
  /** Open bevindingen na de laatste stap (schatting voor het aantal resterende rondes). */
  open?: number;
  tekst: string;
}

/** Gemeten in de pilot (3 okt): eerste versie 76–136 s, een verbeterronde 13–35 s, inkorten + opmaak < 1 s. */
export const STAP0_TIJD = { specMs: 115_000, rondeMs: 28_000, afrondenMs: 2_000, opslaanMs: 1_500 } as const;

/** Balkdelen (in %): eerste versie 0–55, rondes 55–90, inkorten/opmaak 90–97, opslaan 97–100. */
const DEEL = { spec: [0, 55], herstel: [55, 90], afronden: [90, 97], opslaan: [97, 100] } as const;

/** Verwachte resterende rondes: ± 4 bevindingen per ronde (4 parallelle aanroepen), minstens 1 zolang er iets open is. */
export function verwachteRondes(open: number | undefined): number {
  if (open == null) return 2;
  return open <= 0 ? 0 : Math.max(1, Math.ceil(open / 4));
}

/** Loopt binnen een stap asymptotisch op (nooit tot het eind van het deel: dat doet de volgende gebeurtenis). */
const kruip = (verstreken: number, verwacht: number) => 0.92 * (1 - Math.exp(-Math.max(0, verstreken) / Math.max(1, verwacht)));

export function berekenStap0Voortgang(v: Stap0Voortgang, t: { faseStart: number }, nu: number): { pct: number; restMs: number | null; label: string } {
  const verstreken = nu - t.faseStart;
  const T = STAP0_TIJD;
  if (v.fase === "spec") {
    const [a, b] = DEEL.spec;
    const rest = Math.max(5_000, T.specMs - verstreken) + 2 * T.rondeMs + T.afrondenMs + T.opslaanMs;
    return { pct: a + (b - a) * kruip(verstreken, T.specMs), restMs: rest, label: "Eerste versie schrijven" };
  }
  if (v.fase === "herstel") {
    const [a, b] = DEEL.herstel;
    const nog = verwachteRondes(v.open);
    // Elke afgeronde ronde schuift op richting 90 %; binnen de ronde kruipt de balk naar de volgende.
    const gedaan = 1 - Math.pow(0.55, v.ronde);
    const volgende = 1 - Math.pow(0.55, v.ronde + 1);
    const frac = gedaan + (volgende - gedaan) * kruip(verstreken, T.rondeMs);
    const rest = Math.max(3_000, Math.max(1, nog) * T.rondeMs - verstreken) + T.afrondenMs + T.opslaanMs;
    return { pct: a + (b - a) * frac, restMs: rest, label: `Controleren en verbeteren${v.ronde ? ` · ronde ${v.ronde + 1}` : ""}` };
  }
  if (v.fase === "afronden" || v.fase === "klaar") {
    const [a, b] = DEEL.afronden;
    return { pct: a + (b - a) * kruip(verstreken, T.afrondenMs), restMs: Math.max(1_000, T.afrondenMs + T.opslaanMs - verstreken), label: "Inkorten en opmaken" };
  }
  const [a, b] = DEEL.opslaan;
  return { pct: a + (b - a) * kruip(verstreken, T.opslaanMs), restMs: Math.max(0, T.opslaanMs - verstreken), label: "Toets opslaan" };
}
