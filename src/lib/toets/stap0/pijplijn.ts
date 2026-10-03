/**
 * Stap-0-pijplijn: specs → (schema + rekencontrole + figuur-go/no-go) → platte, genummerde vragen voor de export.
 * Een vraag die niet door alle controles komt, wordt niet geplaatst.
 */
import type { Fixture, FiguurSpec, OpmaakVraag, SeCode, ToetsSpec, VraagSpec } from "./spec.ts";
import { valideerSpec, valideerToets } from "./valideer.ts";
import { controleerBerekeningen } from "./reken.ts";
import { onderwerpUitInhoud } from "./inhoud-keuring.ts";
import { isTekenFiguur, keurFiguur, paramMap } from "./figuren/index.ts";
import { isSeToets, ONDERWERP } from "./opmaak.ts";

export const SE_VOLGORDE: SeCode[] = ["SE4.1", "SE4.2", "SE4.3", "SE4.4", "ALG"];

export interface Keuring {
  id: string;
  ok: boolean;
  fouten: string[];
  /** Nagerekende stappen (voor het rapport). */
  reken: string[];
  figuren: { rol: "leerling" | "antwoord"; type: FiguurSpec["type"]; go: boolean; metingen: Record<string, number>; svg: string }[];
}

export interface Pijplijnresultaat {
  vragen: OpmaakVraag[];
  keuringen: Keuring[];
  /** Vragen die niet geplaatst zijn. */
  afgekeurd: string[];
  toetsFouten: string[];
  /** Per leerlingdeel de vraagnummers. */
  delen: { naam: string; nrs: number[] }[];
}

/** Plat maken: een vraagstuk wordt deelvragen met de gedeelde context en figuur alleen bij de eerste deelvraag. */
function plat(fx: Fixture): { q: VraagSpec; extraParams?: VraagSpec["parameters"]; extraTekst: string; vs?: OpmaakVraag["vraagstuk"]; ouderId: string; gedeeld: string[]; aanloop: string[] }[] {
  if (fx.soort !== "vraagstuk") {
    const { soort: _s, ...q } = fx;
    void _s;
    return [{ q, extraTekst: "", ouderId: fx.id, gedeeld: fx.context, aanloop: [] }];
  }
  return fx.deelvragen.map((d, i) => ({
    q: {
      ...d,
      se: fx.se,
      hoofdstuk: fx.hoofdstuk,
      context: [...(i === 0 ? fx.context : []), ...(d.context ?? [])],
      figuur: d.figuur ?? (i === 0 ? fx.figuur : undefined),
    },
    extraParams: fx.parameters,
    extraTekst: fx.context.join(" "),
    vs: { id: fx.id, titel: fx.titel, eerste: i === 0, deel: i + 1, aantal: fx.deelvragen.length },
    ouderId: fx.id,
    gedeeld: i === 0 ? fx.context : [],
    aanloop: d.context ?? [],
  }));
}

export function verwerkToets(toets: ToetsSpec, fixtures: Fixture[]): Pijplijnresultaat {
  const perId = new Map(fixtures.map((f) => [f.id, f]));
  const toetsFouten = valideerToets(toets, fixtures.map((f) => f.id));
  const keuringen: Keuring[] = [];
  const afgekeurd: string[] = [];
  const geplaatst: { q: VraagSpec; vs?: OpmaakVraag["vraagstuk"]; ouderId: string; gedeeld: string[]; aanloop: string[] }[] = [];
  for (const id of toets.vragen) {
    const fx = perId.get(id);
    if (!fx) continue;
    const schema = valideerSpec(fx);
    const items = schema.length ? [] : plat(fx);
    const kOuder: Keuring = { id, ok: schema.length === 0, fouten: [...schema], reken: [], figuren: [] };
    for (const it of items) {
      const r = controleerBerekeningen(it.q, it.extraParams, it.extraTekst);
      kOuder.reken.push(...r.regels.map((x) => `${it.q.id}: ${x}`));
      kOuder.fouten.push(...r.fouten.map((x) => `${it.q.id}: ${x}`));
      const params = { ...paramMap(it.extraParams, it.q.parameters), ...r.waarden };
      const figs: [FiguurSpec | undefined, "leerling" | "antwoord"][] = [
        [it.q.figuur, "leerling"],
        [it.q.antwoordmodel.figuur, "antwoord"],
      ];
      const leerFig = it.q.figuur;
      const teken = Boolean(leerFig) && (it.q.tekenvraag ?? (/\b(teken|schets)\b/i.test(it.q.stam) || isTekenFiguur(leerFig!)));
      if (teken && !it.q.antwoordmodel.figuur)
        kOuder.fouten.push(`${it.q.id}: tekenvraag zonder antwoordfiguur: zet in antwoordmodel.figuur dezelfde figuur mét in rood wat de leerling tekent, met de controle daarop (de leerlingfiguur blijft leeg of half af)`);
      for (const [f, rol] of figs) {
        if (!f) continue;
        const o = keurFiguur(f, params, it.q, { rol, teken });
        kOuder.figuren.push({ rol, type: f.type, go: o.go, metingen: o.metingen, svg: o.svg });
        kOuder.fouten.push(...o.fouten.map((x) => `${it.q.id} (${rol}): ${x}`));
      }
    }
    kOuder.ok = kOuder.fouten.length === 0;
    keuringen.push(kOuder);
    if (kOuder.ok) geplaatst.push(...items);
    else afgekeurd.push(id);
  }
  // Nummering: in toetsvolgorde; code per SE met volgnummer (SE4.2-03).
  const teller: Record<string, number> = {};
  const vragen: OpmaakVraag[] = geplaatst.map((g, i) => {
    teller[g.q.se] = (teller[g.q.se] ?? 0) + 1;
    const jaar = toets.klas?.leerjaar;
    const prefix = isSeToets(jaar) ? g.q.se : ONDERWERP[g.q.se].letter;
    return { ...g.q, nr: i + 1, jaar, code: `${prefix}-${String(teller[g.q.se]).padStart(2, "0")}`, vraagstuk: g.vs, ouderId: g.ouderId, gedeeldeContext: g.gedeeld, aanloop: g.aanloop } as OpmaakVraag;
  });
  // Klas 1–3: het onderwerplabel volgt uit de inhoud (alle teksten van de vragen in die SE-groep).
  if (!isSeToets(toets.klas?.leerjaar))
    for (const k of new Set(vragen.map((v) => v.se))) {
      const groep = vragen.filter((v) => v.se === k);
      const tekst = groep.map((v) => [v.vraagstuk?.titel ?? "", ...(v.gedeeldeContext ?? []), ...(v.aanloop ?? []), v.stam, v.leerdoel ?? "", ...v.antwoordmodel.regels].join(" ")).join(" ");
      const ond = onderwerpUitInhoud(k, tekst);
      if (ond) for (const v of groep) v.onderwerp = ond;
    }
  const ouderVan = new Map(vragen.map((v) => [v.nr, (v as OpmaakVraag & { ouderId: string }).ouderId]));
  const delen = (toets.delen ?? [{ naam: "", vragen: toets.vragen }]).map((d) => ({
    naam: d.naam,
    nrs: vragen.filter((v) => d.vragen.includes(ouderVan.get(v.nr)!)).map((v) => v.nr),
  }));
  return { vragen, keuringen, afgekeurd, toetsFouten, delen };
}
