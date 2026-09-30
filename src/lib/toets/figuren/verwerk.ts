import { detectVakProfiel } from "../bron-figuren.ts";
import { metFiguurKwaliteit } from "../kwaliteit-check.ts";
import { finalizeVragen } from "../mc-balance.ts";
import { repareerPunten } from "../punten-rubric.ts";
import type {
  FiguurRapport,
  FiguurRapportItem,
  FiguurSpec,
  GegenereerdeToets,
  NakijkItem,
  Vraag,
} from "../types.ts";
import { bewaakFiguren, diepBevriezen, figuurIsGeldig, zonderLegacyFiguren } from "./bevriezing.ts";
import { vraagZonderFiguur } from "./fallback.ts";
import type { FiguurOpdracht, FiguurUitkomst } from "./pijplijn.ts";
import { MAX_FIGUREN_PER_TOETS, MAX_SFEERPLATEN_PER_TOETS, heeftLegacyFiguur, isCodeFiguur, legacySpecs } from "./spec.ts";

export interface PlanAntwoord {
  ok: boolean;
  figuren?: { nummer: number; spec: FiguurSpec; verwijst: boolean; nieuweStam?: string }[];
  meldingen?: string[];
  error?: string;
}

export interface VerwerkDeps {
  plan: (input: {
    vak: string;
    vragen: Vraag[];
    nakijkmodel: NakijkItem[];
    overslaan: number[];
    alGepland: number;
    alSfeer: number;
  }) => Promise<PlanAntwoord>;
  maak: (opdracht: FiguurOpdracht) => Promise<FiguurUitkomst>;
  voortgang?: (tekst: string) => void;
}

/** Vraag zonder beelddata (voor serveraanroepen). */
function licht(q: Vraag): Vraag {
  const { figuur: _f, figuurId: _i, ...rest } = q;
  return rest as Vraag;
}

type Job = FiguurOpdracht & { nummer: number };

function samenvoegRapport(oud: FiguurRapport | undefined, items: FiguurRapportItem[], meldingen: string[], vervangNummers: number[]): FiguurRapport {
  const behouden = (oud?.items ?? []).filter((i) => !vervangNummers.includes(i.nummer));
  return { versie: 1, items: [...behouden, ...items], meldingen: [...(oud?.meldingen ?? []), ...meldingen].slice(-12) };
}

/**
 * Beeldpijplijn voor een (deel van een) toets:
 * 1. bestaande figuurvelden → spec (code), 2. planner schrijft specs voor vragen die een figuur nodig hebben,
 * 3. per figuur parallel: tekenen/genereren + verplichte go/no-go-keuring (max. 3 pogingen),
 * 4. go → bevroren figuur onder de stam; no-go → vraag herschreven/vervangen of zonder figuur,
 * 5. figuurrapport + berekende kwaliteitspunten.
 * Gooit nooit: bij elke fout blijft de toets bruikbaar (zonder ongekeurde figuren).
 */
export async function verwerkFiguren(
  toets: GegenereerdeToets,
  deps: VerwerkDeps,
  opts: { alleenNummers?: number[] } = {},
): Promise<GegenereerdeToets> {
  const scope = new Set(opts.alleenNummers ?? toets.vragen.map((q) => q.nummer));
  const meldingen: string[] = [];
  const items: FiguurRapportItem[] = [];
  let vragen = toets.vragen.slice();
  let nakijkmodel = toets.nakijkmodel.slice();
  const nakijkVan = (nr: number) => nakijkmodel.find((n) => n.nummer === nr);

  try {
    const jobs: Job[] = [];
    let sfeer = vragen.filter((q) => figuurIsGeldig(q.figuur) && q.figuur.soort === "sfeerplaat").length;
    let totaal = vragen.filter((q) => figuurIsGeldig(q.figuur)).length;

    for (const q of vragen) {
      if (!scope.has(q.nummer) || figuurIsGeldig(q.figuur) || !heeftLegacyFiguur(q)) continue;
      const [spec, ...rest] = legacySpecs(q);
      for (const extra of rest) {
        items.push({ nummer: q.nummer, soort: extra.soort, bron: "code", status: "gedropt", pogingen: 0, redenen: ["maximaal één figuur per vraag"], fallback: "geen-figuur" });
      }
      if (!spec) continue;
      if (totaal >= MAX_FIGUREN_PER_TOETS) {
        items.push({ nummer: q.nummer, soort: spec.soort, bron: "code", status: "gedropt", pogingen: 0, redenen: ["maximum aantal figuren per toets bereikt"] });
        const fb = vraagZonderFiguur(q, spec, { legacy: true, verwijst: true });
        vragen = vragen.map((v) => (v.nummer === q.nummer ? fb.vraag : v));
        items[items.length - 1]!.fallback = fb.fallback;
        continue;
      }
      totaal++;
      jobs.push({ nummer: q.nummer, vraag: licht(zonderLegacyFiguren(q)), nakijk: nakijkVan(q.nummer), spec, legacy: true, verwijst: true });
    }

    deps.voortgang?.("Figuren plannen…");
    const overslaan = vragen.filter((q) => !scope.has(q.nummer) || figuurIsGeldig(q.figuur) || jobs.some((j) => j.nummer === q.nummer)).map((q) => q.nummer);
    if (totaal < MAX_FIGUREN_PER_TOETS && vragen.some((q) => !overslaan.includes(q.nummer))) {
      try {
        const plan = await deps.plan({
          vak: toets.meta.vak,
          vragen: vragen.map((q) => licht(zonderLegacyFiguren(q))),
          nakijkmodel,
          overslaan,
          alGepland: totaal,
          alSfeer: sfeer,
        });
        if (!plan.ok) meldingen.push(`Figuurplanner niet bereikbaar (${plan.error ?? "onbekend"}); alleen bestaande figuren gekeurd.`);
        meldingen.push(...(plan.meldingen ?? []));
        for (const f of plan.figuren ?? []) {
          const q = vragen.find((v) => v.nummer === f.nummer);
          if (!q || overslaan.includes(f.nummer) || jobs.some((j) => j.nummer === f.nummer)) continue;
          if (totaal >= MAX_FIGUREN_PER_TOETS) break;
          if (f.spec.soort === "sfeerplaat" && sfeer >= MAX_SFEERPLATEN_PER_TOETS) continue;
          if (f.spec.soort === "sfeerplaat") sfeer++;
          totaal++;
          jobs.push({ nummer: q.nummer, vraag: licht(q), nakijk: nakijkVan(q.nummer), spec: f.spec, legacy: false, verwijst: f.verwijst, nieuweStam: f.nieuweStam });
        }
      } catch (err) {
        meldingen.push(`Figuurplanner mislukt (${err instanceof Error ? err.message.slice(0, 120) : "fout"}).`);
      }
    }

    deps.voortgang?.(jobs.length ? `${jobs.length} figuur${jobs.length === 1 ? "" : "en"} maken en keuren (go/no-go)…` : "Geen figuren nodig");
    const uitkomsten = await Promise.all(
      jobs.map(async (job): Promise<FiguurUitkomst> => {
        try {
          const { nummer: _n, ...opdracht } = job;
          return await deps.maak(opdracht);
        } catch (err) {
          return { status: "gedropt", pogingen: 0, redenen: [`figuurfunctie faalde: ${err instanceof Error ? err.message.slice(0, 120) : "fout"}`], log: [] };
        }
      }),
    );

    jobs.forEach((job, i) => {
      const u = uitkomsten[i]!;
      const bron = isCodeFiguur(job.spec.soort) ? "code" : "ai";
      const q = vragen.find((v) => v.nummer === job.nummer);
      if (!q) return;
      if (u.status === "go" && figuurIsGeldig(u.figuur)) {
        const figuur = diepBevriezen(u.figuur);
        const nieuw: Vraag = zonderLegacyFiguren({ ...q, stam: u.nieuweStam?.trim() || q.stam, figuur });
        delete nieuw.figuurId;
        vragen = vragen.map((v) => (v.nummer === job.nummer ? nieuw : v));
        items.push({ nummer: job.nummer, soort: figuur.soort, bron, status: "go", pogingen: u.pogingen, redenen: figuur.keuring.redenen.slice(0, 3), figuurId: figuur.id });
        return;
      }
      const redenen = u.status === "gedropt" ? u.redenen : ["goedgekeurde figuur kwam beschadigd aan (hash klopt niet)"];
      const pogingen = u.pogingen;
      if (u.status === "gedropt" && u.herschreven) {
        const h = u.herschreven;
        const punten = repareerPunten([h.vraag], [h.nakijk]);
        const klaar = finalizeVragen(punten.vragen, punten.nakijkmodel, { skipOrder: true });
        const nv = zonderLegacyFiguren(klaar.vragen[0] ?? h.vraag);
        const nn = klaar.nakijkmodel[0] ?? h.nakijk;
        vragen = vragen.map((v) => (v.nummer === job.nummer ? nv : v));
        nakijkmodel = nakijkmodel.some((n) => n.nummer === job.nummer)
          ? nakijkmodel.map((n) => (n.nummer === job.nummer ? nn : n))
          : [...nakijkmodel, nn];
        items.push({ nummer: job.nummer, soort: job.spec.soort, bron, status: "gedropt", pogingen, redenen, fallback: h.actie });
        return;
      }
      const fb = vraagZonderFiguur(q, job.spec, { legacy: job.legacy, verwijst: job.verwijst });
      vragen = vragen.map((v) => (v.nummer === job.nummer ? fb.vraag : v));
      items.push({ nummer: job.nummer, soort: job.spec.soort, bron, status: "gedropt", pogingen, redenen, fallback: fb.fallback });
    });
  } catch (err) {
    meldingen.push(`Beeldpijplijn onderbroken (${err instanceof Error ? err.message.slice(0, 120) : "fout"}); geen ongekeurde figuren geplaatst.`);
  }

  // Harde regel: binnen de scope geen ongekeurde figuurvelden meer, ongeldige figuren eruit.
  vragen = vragen.map((q) => {
    if (!scope.has(q.nummer)) return q;
    const zonder = zonderLegacyFiguren(q);
    if (zonder.figuur && !figuurIsGeldig(zonder.figuur)) {
      const { figuur: _f, ...rest } = zonder;
      return rest as Vraag;
    }
    return zonder;
  });

  const rapport = samenvoegRapport(toets.figuurRapport, items, meldingen, opts.alleenNummers ?? []);
  const nask = detectVakProfiel(toets.meta.vak, toets.bronmateriaal) === "nask";
  return {
    ...toets,
    vragen,
    nakijkmodel,
    figuurPijplijn: 1,
    figuurRapport: rapport,
    kwaliteit: metFiguurKwaliteit(toets.kwaliteit, vragen, rapport, { nask }),
  };
}

/**
 * Na een modelronde (bijschaven / extra vragen): bevroren figuren terugzetten en bewaken,
 * en alleen nieuwe figuurvelden door de pijplijn halen. Oude toetsen (zonder pijplijn) blijven zoals ze waren.
 */
export async function naModelRonde(
  oud: GegenereerdeToets,
  nieuw: { vragen: Vraag[]; nakijkmodel: NakijkItem[] },
  deps: VerwerkDeps,
): Promise<GegenereerdeToets> {
  const pijplijn = Boolean(oud.figuurPijplijn);
  const nieuweFiguurvragen = nieuw.vragen.filter((q) => heeftLegacyFiguur(q) && !q.figuurId && !q.figuur).map((q) => q.nummer);
  const bewaakt = bewaakFiguren(oud.vragen, nieuw.vragen);
  const meldingen: string[] = [];
  if (bewaakt.hersteld.length) meldingen.push(`${bewaakt.hersteld.length} goedgekeurde figuur hersteld: een latere stap probeerde hem te wijzigen.`);
  if (bewaakt.geweigerd.length) meldingen.push(`${bewaakt.geweigerd.length} figuur geweigerd (geen geldige go/hash).`);
  if (bewaakt.losgeraakt.length) meldingen.push(`${bewaakt.losgeraakt.length} goedgekeurde figuur niet meer gekoppeld: de bijbehorende vraag is verwijderd of herschreven.`);
  let toets: GegenereerdeToets = { ...oud, vragen: bewaakt.vragen, nakijkmodel: nieuw.nakijkmodel };
  if (meldingen.length) {
    toets = { ...toets, figuurRapport: samenvoegRapport(oud.figuurRapport, [], meldingen, []) };
  }
  if (!pijplijn) return toets;
  if (nieuweFiguurvragen.length) return verwerkFiguren(toets, deps, { alleenNummers: nieuweFiguurvragen });
  const nask = detectVakProfiel(toets.meta.vak, toets.bronmateriaal) === "nask";
  const vragen = toets.vragen.map((q) => zonderLegacyFiguren(q));
  return { ...toets, vragen, kwaliteit: metFiguurKwaliteit(toets.kwaliteit, vragen, toets.figuurRapport, { nask }) };
}
