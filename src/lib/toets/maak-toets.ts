import { afwerkToets, generateVragenRuw, ruweVragen } from "./generate";
import { figuurDeps } from "./figuren/client";
import { verwerkFiguren, type FiguurGebeurtenis } from "./figuren/verwerk";
import { koppelVroegeFiguren, zonderPlaatjes, type VroegeRonde } from "./figuren/vroeg";
import { zonderLegacyFiguren } from "./figuren/bevriezing";
import type { GegenereerdeToets, GenerateInput } from "./types";

/** Doel: totale wachttijd ± 60 s, inclusief figuren. */
export const DOEL_TOTAAL_MS = 60_000;
/**
 * Figuren krijgen altijd minstens zoveel tijd na het verschijnen van de vragen.
 * (25 s bleek te krap: planner + één vision-keuring liep uit → alle figuren gedropt.)
 */
export const MIN_FIGUURVENSTER_MS = 40_000;

export type Fase = "vragen" | "afwerken" | "plaatjes" | "word" | "klaar";

export interface Voortgang {
  fase: Fase;
  /** Afwerken is klaar maar er wordt nog op plaatjes gewacht. */
  wachtOpPlaatjes?: boolean;
  afwerkenKlaar?: boolean;
  figuren?: { klaar: number; totaal: number; gepland: boolean };
  /** Absolute deadline voor de figuren (Date.now-klok). */
  figuurDeadline?: number;
  metPlaatjes: boolean;
}

/**
 * Snelle route: vragen → (afwerken ∥ figuren plannen + maken + keuren) → koppelen.
 * Figuren die niet vóór de deadline een go hebben, worden gedropt (terugval zonder figuur).
 * Gooit nooit door een figuurfout; alleen tekstfouten geven { ok: false }.
 */
export async function maakToets(
  input: GenerateInput,
  opts: { metPlaatjes: boolean; onVoortgang?: (v: Voortgang) => void; nu?: () => number },
): Promise<{ ok: true; toets: GegenereerdeToets } | { ok: false; error: string }> {
  const nu = opts.nu ?? (() => Date.now());
  const t0 = nu();
  const met = opts.metPlaatjes;
  let staat: Voortgang = { fase: "vragen", metPlaatjes: met };
  const meld = (patch: Partial<Voortgang>) => {
    staat = { ...staat, ...patch };
    opts.onVoortgang?.(staat);
  };
  meld({});
  const data = { ...input, metPlaatjes: met };
  const ruw = await generateVragenRuw({ data });
  if (!ruw.ok) return { ok: false, error: ruw.error };
  const tVragen = nu();
  const afwerkData = { input: { ...data, bronmateriaal: "", bronUrl: undefined, antwoordenmateriaal: "", stuurdocument: undefined }, bron: ruw.bron, payload: ruw.payload };

  if (!met) {
    meld({ fase: "afwerken" });
    const af = await afwerkToets({ data: afwerkData });
    if (!af.ok) return { ok: false, error: af.error };
    const toets = zonderPlaatjes(af.toets);
    const t1 = nu();
    toets.figuurRapport = { ...toets.figuurRapport!, tijden: { vragenMs: tVragen - t0, afwerkenMs: t1 - tVragen, totaalMs: t1 - t0 } };
    meld({ fase: "word", afwerkenKlaar: true });
    return { ok: true, toets };
  }

  const deadline = Math.max(t0 + DOEL_TOTAAL_MS, tVragen + MIN_FIGUURVENSTER_MS);
  meld({ fase: "afwerken", figuurDeadline: deadline, figuren: { klaar: 0, totaal: 0, gepland: false } });
  const gebeurtenis = (e: FiguurGebeurtenis) => {
    if (e.soort === "gepland") meld({ figuren: { klaar: 0, totaal: e.totaal, gepland: true } });
    if (e.soort === "figuur-klaar") meld({ figuren: { klaar: e.klaar, totaal: e.totaal, gepland: true } });
  };
  const deps = { ...figuurDeps(undefined, gebeurtenis), nu };

  // Vroege figuren op de ruwe vragen (alleen als de nummers uniek zijn).
  const vragenRuw = ruweVragen(ruw.payload);
  const uniek = new Set(vragenRuw.map((q) => q.nummer)).size === vragenRuw.length;
  const voorlopig: GegenereerdeToets = {
    id: "voorlopig",
    createdAt: new Date().toISOString(),
    bronmateriaal: ruw.bron,
    extraEisen: input.extraEisen ?? "",
    ronde: input.ronde ?? 1,
    cijferNorm: input.cijferNorm,
    meta: { ...(ruw.payload.meta as GegenereerdeToets["meta"]), vak: input.vak?.trim() || ruw.payload.meta.vak || "NaSk" },
    vragen: vragenRuw,
    nakijkmodel: ruw.payload.nakijkmodel,
    cesuur: { nTerm: 1, cesuurPunten: 0, toelichting: "", formule: "" },
    matrijs: { cellen: {} } as unknown as GegenereerdeToets["matrijs"],
    kwaliteit: { samenvatting: "", punten: [] },
  };
  const vroegPromise: Promise<GegenereerdeToets | null> = uniek
    ? verwerkFiguren(voorlopig, deps, { deadline }).catch(() => null)
    : Promise.resolve(null);

  const af = await afwerkToets({ data: afwerkData });
  if (!af.ok) return { ok: false, error: af.error };
  const tAf = nu();
  meld({ fase: "plaatjes", afwerkenKlaar: true, wachtOpPlaatjes: true });

  let toets: GegenereerdeToets;
  try {
    const vroeg = await vroegPromise;
    const ronde: VroegeRonde | null = vroeg ? { ruw: vragenRuw, resultaat: vroeg } : null;
    toets = await koppelVroegeFiguren(af.toets, ronde, deps, { deadline });
  } catch (err) {
    toets = {
      ...af.toets,
      vragen: af.toets.vragen.map(zonderLegacyFiguren),
      figuurPijplijn: 1,
      figuurRapport: { versie: 1, items: [], meldingen: [`Beeldpijplijn mislukt (${err instanceof Error ? err.message.slice(0, 100) : "fout"}); toets zonder figuren.`] },
    };
  }
  const t2 = nu();
  toets.figuurRapport = {
    ...(toets.figuurRapport ?? { versie: 1, items: [], meldingen: [] }),
    tijden: { vragenMs: tVragen - t0, afwerkenMs: tAf - tVragen, figurenMs: t2 - tVragen, totaalMs: t2 - t0 },
  };
  meld({ fase: "word", wachtOpPlaatjes: false });
  return { ok: true, toets };
}

const OPSLAG_SLEUTEL = "toetski:metPlaatjes";

export function leesMetPlaatjes(): boolean {
  try {
    return globalThis.localStorage?.getItem(OPSLAG_SLEUTEL) !== "0";
  } catch {
    return true;
  }
}

export function bewaarMetPlaatjes(met: boolean): void {
  try {
    globalThis.localStorage?.setItem(OPSLAG_SLEUTEL, met ? "1" : "0");
  } catch {
    /* privémodus: niet bewaren */
  }
}
