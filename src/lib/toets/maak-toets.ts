import { afwerkToets, generateVragenRuw, ruweVragen } from "./generate";
import { figuurDeps } from "./figuren/client";
import { verwerkFiguren, type FiguurGebeurtenis } from "./figuren/verwerk";
import { figuurDeadline } from "./voortgang";
import { koppelVroegeFiguren, zonderPlaatjes, type VroegeRonde } from "./figuren/vroeg";
import { zonderLegacyFiguren } from "./figuren/bevriezing";
import type { GegenereerdeToets, GenerateInput, PlaatjesModus } from "./types";
import { MAX_TOTAAL_MS } from "./voortgang";
import { borgFiguurVerwijzingen, repareerSchoolnamen } from "./context-regels";
import { herbouwMatrijs } from "./rtti";
import { cesuurPunten, formuleTekst } from "./cijfer";

export { DOEL_TOTAAL_MS, MAX_TOTAAL_MS, MIN_FIGUURVENSTER_MS, figuurDeadline } from "./voortgang";

/** "Met plaatjes": zoveel figuren laten plannen, en doorgaan tot er minstens MIN_MET_GEPLAATST zijn. */
export const MIN_MET_GEPLAATST = 2;
export const MET_DOEL_FIGUREN = 3;
/** Eerste figuurronde bij "Met plaatjes" stopt hier, zodat er tijd is voor een extra ronde binnen 100 s. */
export const MET_EERSTE_RONDE_MS = 72_000;

export type Fase = "vragen" | "afwerken" | "plaatjes" | "word" | "klaar";

export interface Voortgang {
  fase: Fase;
  /** Afwerken is klaar maar er wordt nog op plaatjes gewacht. */
  wachtOpPlaatjes?: boolean;
  afwerkenKlaar?: boolean;
  figuren?: { klaar: number; totaal: number; gepland: boolean };
  /** Absolute deadline voor de figuren (Date.now-klok). */
  figuurDeadline?: number;
  /** Moment waarop de figuren startten (vragen klaar). */
  figuurStart?: number;
  metPlaatjes: boolean;
}

/**
 * Snelle route: vragen → (afwerken ∥ figuren plannen + maken + keuren) → koppelen.
 * Figuren die niet vóór de deadline een go hebben, worden gedropt (terugval zonder figuur).
 * Gooit nooit door een figuurfout; alleen tekstfouten geven { ok: false }.
 */
export async function maakToets(
  input: GenerateInput,
  opts: { plaatjes: PlaatjesModus; onVoortgang?: (v: Voortgang) => void; nu?: () => number },
): Promise<{ ok: true; toets: GegenereerdeToets } | { ok: false; error: string }> {
  const nu = opts.nu ?? (() => Date.now());
  const t0 = nu();
  const modus = opts.plaatjes;
  const met = modus !== "zonder";
  const verplicht = modus === "met";
  let staat: Voortgang = { fase: "vragen", metPlaatjes: met };
  const meld = (patch: Partial<Voortgang>) => {
    staat = { ...staat, ...patch };
    opts.onVoortgang?.(staat);
  };
  meld({});
  const data = { ...input, metPlaatjes: met, plaatjes: modus };
  const ruw = await generateVragenRuw({ data });
  if (!ruw.ok) return { ok: false, error: ruw.error };
  const tVragen = nu();
  // Het antwoordenboek gaat mee naar het afwerken: bron van waarheid voor de inhoudscontrole.
  const afwerkData = { input: { ...data, bronmateriaal: "", bronUrl: undefined, antwoordenmateriaal: (input.antwoordenmateriaal ?? "").slice(0, 30_000), stuurdocument: undefined }, bron: ruw.bron, payload: ruw.payload };

  if (!met) {
    meld({ fase: "afwerken" });
    const af = await afwerkToets({ data: afwerkData });
    if (!af.ok) return { ok: false, error: af.error };
    const toets = eindControle(zonderPlaatjes(af.toets));
    const t1 = nu();
    toets.figuurRapport = { ...toets.figuurRapport!, tijden: { vragenMs: tVragen - t0, afwerkenMs: t1 - tVragen, totaalMs: t1 - t0 } };
    meld({ fase: "word", afwerkenKlaar: true });
    return { ok: true, toets };
  }

  const deadline = verplicht ? Math.min(figuurDeadline(t0, tVragen), t0 + MET_EERSTE_RONDE_MS) : figuurDeadline(t0, tVragen);
  meld({ fase: "afwerken", figuurDeadline: deadline, figuurStart: tVragen, figuren: { klaar: 0, totaal: 0, gepland: false } });
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
    ? verwerkFiguren(voorlopig, deps, { deadline, ...(verplicht ? { minFiguren: MET_DOEL_FIGUREN } : {}) }).catch(() => null)
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
  // "Met plaatjes" is een harde keuze: te weinig goedgekeurde figuren → nieuwe ronde (andere vragen of
  // eenvoudiger spec) zolang het harde maximum van 100 s het toelaat.
  if (verplicht) {
    const hardeDeadline = t0 + MAX_TOTAAL_MS;
    for (let ronde = 0; ronde < 2; ronde++) {
      const geplaatst = toets.vragen.filter((q) => q.figuur).length;
      if (geplaatst >= MIN_MET_GEPLAATST || hardeDeadline - nu() < 22_000) break;
      const afgekeurd = [...new Set((toets.figuurRapport?.items ?? []).filter((i) => i.status === "gedropt").map((i) => i.nummer))];
      meld({ fase: "plaatjes", wachtOpPlaatjes: true, figuurDeadline: hardeDeadline, figuurStart: nu(), figuren: { klaar: 0, totaal: 0, gepland: false } });
      try {
        toets = await verwerkFiguren(toets, deps, { deadline: hardeDeadline, minFiguren: MET_DOEL_FIGUREN - geplaatst, afgekeurd });
      } catch {
        break;
      }
      if (toets.vragen.filter((q) => q.figuur).length === geplaatst && hardeDeadline - nu() < 30_000) break;
    }
    const n = toets.vragen.filter((q) => q.figuur).length;
    if (n < MIN_MET_GEPLAATST && toets.figuurRapport) {
      toets.figuurRapport = {
        ...toets.figuurRapport,
        meldingen: [...toets.figuurRapport.meldingen, `Met plaatjes: binnen 100 s ${n === 0 ? "geen" : `maar ${n}`} goedgekeurde ${n === 1 ? "figuur" : "figuren"}. Afgekeurde figuren worden nooit geplaatst.`],
      };
    }
  }
  toets = eindControle(toets);
  const t2 = nu();
  toets.figuurRapport = {
    ...(toets.figuurRapport ?? { versie: 1, items: [], meldingen: [] }),
    tijden: { vragenMs: tVragen - t0, afwerkenMs: tAf - tVragen, figurenMs: t2 - tVragen, totaalMs: t2 - t0 },
  };
  meld({ fase: "word", wachtOpPlaatjes: false });
  return { ok: true, toets };
}

/**
 * Laatste bewaking vóór het blad: geen verwijzing naar een figuur die er niet staat.
 * Een vraag die zonder figuur niet te maken is, gaat eruit (punten, cesuur en matrijs worden herberekend).
 */
export function eindControle(toets0: GegenereerdeToets): GegenereerdeToets {
  // Schoolnamen ook hier (figuurterugval kan tekst uit de ruwe vraag terugzetten).
  const nk = toets0.nakijkmodel.map((n) => ({ ...n, puntenverdeling: (n.puntenverdeling ?? []).map((p) => ({ ...p })) }));
  const vr = toets0.vragen.map((q) => {
    const kopie = { ...q, opties: q.opties?.map((o) => ({ ...o })) };
    repareerSchoolnamen(kopie, nk.find((n) => n.nummer === q.nummer));
    return kopie;
  });
  const toets = { ...toets0, vragen: vr, nakijkmodel: nk };
  const b = borgFiguurVerwijzingen(toets.vragen, toets.nakijkmodel);
  if (!b.meldingen.length) return toets;
  const rapport = toets.figuurRapport ?? { versie: 1 as const, items: [], meldingen: [] };
  const her = b.hernummer;
  let uit: GegenereerdeToets = {
    ...toets,
    vragen: b.vragen,
    nakijkmodel: b.nakijkmodel,
    figuurRapport: {
      ...rapport,
      items: her ? rapport.items.filter((i) => her.has(i.nummer)).map((i) => ({ ...i, nummer: her.get(i.nummer)! })) : rapport.items,
      meldingen: [...rapport.meldingen, ...b.meldingen],
    },
  };
  if (b.verwijderd.length) {
    const max = uit.vragen.reduce((s, q) => s + (q.punten || 0), 0);
    uit = herbouwMatrijs({ ...uit, cesuur: { ...uit.cesuur, cesuurPunten: cesuurPunten(max, uit.cijferNorm), formule: formuleTekst(uit.cijferNorm, max) } });
  }
  return uit;
}

const OPSLAG_SLEUTEL = "toetski:plaatjes";

/** Plaatjeskeuze onthouden (standaard Automatisch; de oude aan/uit-sleutel wordt bewust genegeerd). */
export function leesPlaatjesModus(): PlaatjesModus {
  try {
    const v = globalThis.localStorage?.getItem(OPSLAG_SLEUTEL);
    return v === "met" || v === "zonder" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function bewaarPlaatjesModus(m: PlaatjesModus): void {
  try {
    globalThis.localStorage?.setItem(OPSLAG_SLEUTEL, m);
  } catch {
    /* privémodus: niet bewaren */
  }
}
