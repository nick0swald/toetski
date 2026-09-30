import { nakijkSchema, vraagSchema } from "../schema.ts";
import type { FiguurSpec, GoedgekeurdeFiguur, NakijkItem, Vraag } from "../types.ts";
import { bevriesGoedgekeurd, zonderLegacyFiguren } from "./bevriezing.ts";
import { beoordeelKeuring, voorcheckNietTonen } from "./keuring.ts";
import { VISIE_MODEL } from "./modellen.ts";
import {
  HERSCHRIJF_SYSTEM,
  KEURING_SYSTEM,
  REVISIE_SYSTEM,
  beeldPrompt,
  herschrijfUser,
  keuringUser,
  revisieUser,
} from "./prompts.ts";
import { altTekst, isCodeFiguur, parseFiguurSpec, parseSpecData } from "./spec.ts";
import { tekenCodeFiguur } from "./svg.ts";
import { controleerStroomkringSymbolen } from "./schakelsymbolen.ts";

/** Afhankelijkheden (netwerk/render) — in productie xAI + resvg, in tests nep. */
export interface PijplijnDeps {
  tekenPng: (svg: string, breedte: number) => Promise<Uint8Array>;
  genereerBeeld: (prompt: string, timeoutMs: number) => Promise<{ bytes: Uint8Array; mime: string }>;
  verkleinJpeg: (bytes: Uint8Array) => { bytes: Uint8Array; breedte: number; hoogte: number };
  keur: (system: string, user: string, beeld: { mime: string; base64: string }, timeoutMs: number) => Promise<unknown>;
  vraagJson: (system: string, user: string, timeoutMs: number) => Promise<unknown>;
  nu: () => number;
  nieuwId: () => string;
}

export interface FiguurOpdracht {
  vraag: Vraag;
  nakijk?: NakijkItem;
  spec: FiguurSpec;
  /** Figuur kwam uit bestaande figuurvelden van de vraag (vraag is erop geschreven). */
  legacy: boolean;
  /** Huidige vraagtekst verwijst al naar een figuur. */
  verwijst: boolean;
  /** Stam die alleen bij een go wordt overgenomen (verwijzing naar de figuur). */
  nieuweStam?: string;
}

export interface PogingLog {
  poging: number;
  besluit: "go" | "no_go" | "fout";
  redenen: string[];
}

export type FiguurUitkomst =
  | {
      status: "go";
      figuur: GoedgekeurdeFiguur;
      nieuweStam?: string;
      pogingen: number;
      log: PogingLog[];
    }
  | {
      status: "gedropt";
      pogingen: number;
      redenen: string[];
      log: PogingLog[];
      herschreven?: { actie: "herschreven" | "vervangen"; vraag: Vraag; nakijk: NakijkItem };
    };

export const PIJPLIJN_TIJDEN = {
  /** Standaardbudget binnen de Vercel-functie (maxDuration 180 s); de client geeft meestal een krapper budget mee. */
  budgetMs: 165_000,
  visieMs: 30_000,
  beeldMs: 40_000,
  revisieMs: 12_000,
  herschrijfMs: 20_000,
  /** Minimale resttijd om nog een poging te starten. */
  nodigCodeMs: 7_000,
  nodigAiMs: 22_000,
};

/** Maximaal aantal pogingen: code-figuren zijn snel (3), AI-sfeerplaten traag (2). */
export const MAX_POGINGEN = 3;
export const MAX_POGINGEN_AI = 2;

export function naarBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fout(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  if (/timeout|aborted/i.test(m)) return "time-out";
  return m.slice(0, 160);
}

/** Getallen uit de oorspronkelijke data blijven vast; alleen presentatie mag veranderen. */
export function vergrendelData(orig: unknown, nieuw: unknown): unknown {
  if (typeof orig === "number") return orig;
  if (Array.isArray(orig)) {
    if (!Array.isArray(nieuw) || nieuw.length !== orig.length) return orig;
    return orig.map((o, i) => vergrendelData(o, nieuw[i]));
  }
  if (orig && typeof orig === "object") {
    const n = nieuw && typeof nieuw === "object" && !Array.isArray(nieuw) ? (nieuw as Record<string, unknown>) : {};
    const o = orig as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(o), ...Object.keys(n)])) {
      if (k in o) out[k] = vergrendelData(o[k], n[k]);
      else if (typeof n[k] !== "number" && !Array.isArray(n[k])) out[k] = n[k];
    }
    return out;
  }
  return nieuw === undefined ? orig : typeof nieuw === typeof orig ? nieuw : orig;
}

export function reviseerSpec(orig: FiguurSpec, raw: unknown): FiguurSpec {
  const r = (raw && typeof raw === "object" ? (raw as Record<string, unknown>).spec ?? raw : {}) as Record<string, unknown>;
  const kandidaat = {
    ...r,
    soort: orig.soort,
    getallen: orig.getallen,
    data: orig.soort === "sfeerplaat" ? { ...orig.data, ...(r.data as object) } : vergrendelData(orig.data, r.data),
  };
  const { spec } = parseFiguurSpec(kandidaat);
  if (!spec) return orig;
  return { ...spec, nietTonen: [...new Set([...orig.nietTonen, ...spec.nietTonen])] };
}

const NOEMT_FIGUUR = /\b(figuur|grafiek|diagram|afbeelding|plaatje|tekening|hieronder)\b/i;

export function parseHerschrijving(raw: unknown, q: Vraag, n?: NakijkItem): { actie: "herschreven" | "vervangen"; vraag: Vraag; nakijk: NakijkItem } | null {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const v = vraagSchema.safeParse({ ...(o.vraag as object), nummer: q.nummer });
  const k = nakijkSchema.safeParse({ ...(o.nakijk as object), nummer: q.nummer });
  if (!v.success || !k.success) return null;
  const vraag = zonderLegacyFiguren({
    ...v.data,
    nummer: q.nummer,
    type: v.data.type,
    rtti: q.rtti,
    domein: q.domein,
    leerdoel: q.leerdoel,
    punten: q.punten,
    context: v.data.context?.trim() || undefined,
    opties: v.data.opties?.length ? v.data.opties : undefined,
  } as Vraag);
  delete (vraag as Partial<Vraag>).figuur;
  delete (vraag as Partial<Vraag>).figuurId;
  if (!vraag.stam.trim() || NOEMT_FIGUUR.test(`${vraag.context ?? ""} ${vraag.stam}`)) return null;
  const nakijk: NakijkItem = { ...k.data, nummer: q.nummer };
  if (!nakijk.modelantwoord.trim()) return null;
  void n;
  return { actie: o.actie === "vervangen" ? "vervangen" : "herschreven", vraag, nakijk };
}

/**
 * Eén figuur: tekenen/genereren → verplichte vision-keuring → max. 3 pogingen met feedback.
 * Geeft NOOIT een figuur terug zonder go. Gooit nooit: alle fouten worden "gedropt".
 */
export async function maakFiguurMetKeuring(
  opdracht: FiguurOpdracht,
  deps: PijplijnDeps,
  opts: { maxPogingen?: number; start?: number; budgetMs?: number } = {},
): Promise<FiguurUitkomst> {
  const T = PIJPLIJN_TIJDEN;
  const start = opts.start ?? deps.nu();
  const deadline = start + (opts.budgetMs ?? T.budgetMs);
  const rest = () => deadline - deps.nu();
  const code = isCodeFiguur(opdracht.spec.soort);
  const plafond = code ? MAX_POGINGEN : MAX_POGINGEN_AI;
  const max = Math.max(1, Math.min(plafond, opts.maxPogingen ?? plafond));
  const vraagVoorKeuring = opdracht.nieuweStam ? { ...opdracht.vraag, stam: opdracht.nieuweStam } : opdracht.vraag;
  const log: PogingLog[] = [];
  let spec = opdracht.spec;
  let pogingen = 0;

  for (let p = 1; p <= max; p++) {
    if (rest() < (code ? T.nodigCodeMs : T.nodigAiMs)) {
      log.push({ poging: p, besluit: "fout", redenen: ["tijdslimiet: geen tijd voor nog een poging"] });
      break;
    }
    pogingen = p;
    let feedback: string[] = [];
    try {
      let mime: "image/png" | "image/jpeg";
      let bytes: Uint8Array;
      let breedte: number;
      let hoogte: number;
      if (code) {
        const getekend = tekenCodeFiguur(spec);
        const voor = [
          ...voorcheckNietTonen(spec, getekend.teksten),
          // Code-keuring: elk onderdeel met zijn standaardsymbool; schakelaar als losse stippen = no_go.
          ...(spec.soort === "stroomkring" ? controleerStroomkringSymbolen(spec, getekend.svg) : []),
        ];
        if (voor.length) throw Object.assign(new Error(voor.join("; ")), { voorcheck: true });
        bytes = await deps.tekenPng(getekend.svg, getekend.breedte);
        mime = "image/png";
        breedte = getekend.breedte;
        hoogte = getekend.hoogte;
      } else {
        const { scene } = parseSpecData("sfeerplaat", spec.data);
        const gen = await deps.genereerBeeld(beeldPrompt(spec, scene), Math.min(T.beeldMs, rest() - 5_000));
        const klein = /jpe?g/i.test(gen.mime) ? deps.verkleinJpeg(gen.bytes) : null;
        if (!klein) throw new Error(`onverwacht beeldformaat ${gen.mime}`);
        bytes = klein.bytes;
        mime = "image/jpeg";
        breedte = klein.breedte;
        hoogte = klein.hoogte;
      }
      const base64 = naarBase64(bytes);
      const raw = await deps.keur(
        KEURING_SYSTEM,
        keuringUser({ vraag: vraagVoorKeuring, nakijk: opdracht.nakijk, spec, bron: code ? "code" : "ai" }),
        { mime, base64 },
        Math.min(T.visieMs, Math.max(5_000, rest() - 2_000)),
      );
      const uitslag = beoordeelKeuring(raw);
      if (uitslag.besluit === "go") {
        log.push({ poging: p, besluit: "go", redenen: uitslag.redenen });
        // Weergavemaat: code-figuren op logische maat, AI-beeld max. 440 px breed.
        const schaal = code ? 1 : Math.min(1, 440 / breedte);
        const figuur = bevriesGoedgekeurd({
          id: deps.nieuwId(),
          soort: spec.soort,
          bron: code ? "code" : "ai",
          mime,
          data: base64,
          breedte: Math.round(breedte * schaal),
          hoogte: Math.round(hoogte * schaal),
          alt: altTekst(spec),
          spec,
          pogingen: p,
          keuring: { besluit: "go", redenen: uitslag.redenen, model: VISIE_MODEL, tijdstip: new Date(deps.nu()).toISOString() },
        });
        return { status: "go", figuur, nieuweStam: opdracht.nieuweStam, pogingen: p, log };
      }
      feedback = [...uitslag.redenen, uitslag.feedback].filter(Boolean);
      log.push({ poging: p, besluit: "no_go", redenen: feedback });
    } catch (err) {
      const voorcheck = Boolean((err as { voorcheck?: boolean })?.voorcheck);
      feedback = [voorcheck ? (err as Error).message : `fout: ${fout(err)}`];
      log.push({ poging: p, besluit: voorcheck ? "no_go" : "fout", redenen: feedback });
    }
    if (p < max && rest() > 5_000 + (code ? T.nodigCodeMs : T.nodigAiMs)) {
      try {
        const raw = await deps.vraagJson(
          REVISIE_SYSTEM,
          revisieUser({ vraag: vraagVoorKeuring, nakijk: opdracht.nakijk, spec, feedback }),
          Math.min(T.revisieMs, rest() - (code ? T.nodigCodeMs : T.nodigAiMs)),
        );
        spec = reviseerSpec(spec, raw);
      } catch {
        /* zelfde spec opnieuw proberen */
      }
    }
  }

  const redenen = [...new Set(log.flatMap((l) => l.redenen))].slice(0, 8);
  const uitkomst: FiguurUitkomst = { status: "gedropt", pogingen, redenen, log };
  if ((opdracht.legacy || opdracht.verwijst) && rest() > 8_000) {
    try {
      const raw = await deps.vraagJson(
        HERSCHRIJF_SYSTEM,
        herschrijfUser({ vraag: opdracht.vraag, nakijk: opdracht.nakijk, spec: opdracht.spec, redenen }),
        Math.min(T.herschrijfMs, rest() - 3_000),
      );
      const h = parseHerschrijving(raw, opdracht.vraag, opdracht.nakijk);
      if (h) uitkomst.herschreven = h;
    } catch {
      /* client valt terug op deterministische variant */
    }
  }
  return uitkomst;
}
