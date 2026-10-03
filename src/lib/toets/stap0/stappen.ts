/**
 * Stap-0-generatie in losse server-stappen (elk ruim binnen maxDuration 180 s), met de hele toestand in één
 * serialiseerbaar object, zodat een stap na een time-out vanaf de laatst opgeslagen toestand opnieuw kan:
 *   (a) "spec": één aanroep voor de hele toets (~115 % lengte), dan auto-fixes en eerst schrappen;
 *   (b) "herstel" (herhaalbaar): auto-fixes + schrappen + ≤ 4 parallelle gerichte aanroepen (herstel, of aanvullen
 *       voor lengte/dekking), tot alle checks slagen, de tijd op is of het vangnet ($ 1) bereikt is;
 *   (c) "afronden": deterministisch inkorten tot 90–110 % met behoud van dekking; de toets is klaar voor export.
 * Geen vaste limiet op het aantal herstelaanroepen (alleen tijd en geld); geen rechter in productie.
 * Pure logica: de modelaanroep komt binnen als `StapChat` (productie: xaiChat met XAI_API_KEY; tests: nep).
 */
import { autoHerstel } from "./auto-herstel.ts";
import {
  generatieSchema,
  gerichtPrompt,
  inkorten,
  isServerfout,
  keurGeneratie,
  metId,
  normaliseer,
  pool,
  puntenVan,
  schrapAfgekeurd,
  specPrompt,
  SPEC_SYSTEM,
  vraagstukFouten,
  vraagstukSchema,
  type Generatie,
  type Keuringsrapport,
  type SpecInvoer,
  type Stap,
} from "./grok-spec.ts";
import type { VraagstukSpec } from "./spec.ts";
import type { Kalibratie } from "../kalibratie.ts";

export type Stap0Kal = Pick<Kalibratie, "items" | "punten"> & Partial<Pick<Kalibratie, "vorm" | "pct1p">>;
export type Stap0Fase = "spec" | "herstel" | "afronden" | "klaar";

/** Productieregels (Nick, 3 okt): doel ≤ $0,35 per toets, vangnet $1, alarm boven $0,50; tijd is de grens. */
export const STAP0_BUDGET = {
  vangnetUsd: 1.0,
  alarmUsd: 0.5,
  doelUsd: 0.35,
  /** Gereserveerd vóór een aanroep (realistisch maximum); een aanroep start alleen als hij nog onder het vangnet past. */
  reserveSpecUsd: 0.15,
  reserveVraagstukUsd: 0.05,
  /** Totale wachttijd voor de docent over alle stappen samen. */
  maxTotaalMs: 9 * 60_000,
  parallel: 4,
  /** Per aanroep (de stap zelf blijft daarmee ruim onder 180 s). */
  specTimeoutMs: 160_000,
  vraagstukTimeoutMs: 100_000,
  /** Na zoveel mislukte herstelpogingen valt een vraagstuk weg (aanvullen vervangt het); geen limiet per toets. */
  pogingenPerVraagstuk: 4,
} as const;

export interface Stap0Kosten {
  usd: number;
  specUsd: number;
  herstelUsd: number;
  aanroepen: number;
  gericht: number;
  mislukt: number;
}

export interface AanvulTaak {
  id: string;
  punten: number;
  paragrafen: string[];
  vorige?: VraagstukSpec;
  fouten?: string[];
}

export interface Stap0Staat {
  versie: 1;
  id: string;
  inv: SpecInvoer;
  kal: Stap0Kal;
  fase: Stap0Fase;
  gen?: Generatie;
  /** Lengte (% van het doel) van de ruwe eerste generatie. */
  ruwLengtePct?: number;
  ruwFouten?: number;
  pogingen: Record<string, number>;
  aanvulling: { n: number; open: AanvulTaak[] };
  stappen: Stap[];
  kosten: Stap0Kosten;
  tijden: { start: number; specMs?: number; stapMs: number[] };
  rondes: number;
  /** Alarm (boven alarmUsd) is gemeld. */
  alarm?: boolean;
  /** Waarom er gestopt is zonder dat alle checks slaagden (tijd/vangnet). */
  stopReden?: string;
  /** Volledige kalibratie (voor de vertaling naar het app-formaat) en cijfernorm van de docent. */
  kalVol?: Kalibratie;
  cijferNorm?: import("../types").CijferNorm;
  /** Laatste mislukte aanroep in deze stap (de client probeert de stap dan opnieuw vanaf deze toestand). */
  laatsteFout?: string;
  /** Na "afronden": lengte vóór inkorten en de resterende bevindingen. */
  lengteVoorInkorten?: number;
  restFouten?: string[];
}

export type StapChat = (
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  schema: { naam: string; schema: Record<string, unknown> },
  opts: { maxTokens: number; timeoutMs: number },
) => Promise<{ tekst: string; usd: number }>;

export interface StapOpties {
  nu?: () => number;
  budget?: Partial<Record<keyof typeof STAP0_BUDGET, number>>;
  /** Monitoring (productie: console → Vercel-logs). */
  log?: (soort: "stap" | "alarm" | "klaar", data: Record<string, unknown>) => void;
}

export function nieuweStaat(inv: SpecInvoer, kal: Stap0Kal, id: string, nu = Date.now()): Stap0Staat {
  return { versie: 1, id, inv, kal, fase: "spec", pogingen: {}, aanvulling: { n: 0, open: [] }, stappen: [], kosten: { usd: 0, specUsd: 0, herstelUsd: 0, aanroepen: 0, gericht: 0, mislukt: 0 }, tijden: { start: nu, stapMs: [] }, rondes: 0 };
}

const basis = (s: Stap0Staat) => [
  { role: "system" as const, content: SPEC_SYSTEM },
  { role: "user" as const, content: specPrompt(s.inv, s.kal) },
];
const MAX_LOG = 300;
const fouteIds = (r: Keuringsrapport, gen: Generatie) => gen.vraagstukken.filter((v) => r.perId[v.id]?.length).map((v) => v.id);

/** Is de toets af: geen fouten op vraagstukniveau, lengte ≥ 90 %, genoeg deelvragen en alle paragrafen gedekt. */
export function allesGoed(r: Keuringsrapport, kal: Stap0Kal): boolean {
  const f = r.feiten;
  return vraagstukFouten(r) === 0 && f.lengtePct >= 90 && f.vragen >= Math.ceil(kal.items * 0.85) && f.ontbrekendeParagrafen.length === 0;
}

/** Voer precies één stap uit (volgens `staat.fase`) en geef de nieuwe toestand terug. Gooit alleen bij een mislukte eerste generatie. */
export async function voerStapUit(staat0: Stap0Staat, chat: StapChat, opts: StapOpties = {}): Promise<Stap0Staat> {
  const nu = opts.nu ?? (() => Date.now());
  const B = { ...STAP0_BUDGET, ...opts.budget };
  const t0 = nu();
  const dezeStap: string[] = [];
  const s: Stap0Staat = structuredClone(staat0);
  const log = (st: Stap) => {
    s.stappen.push(st);
    if (!st.ok && dezeStap.length < 8) dezeStap.push(`${st.wat}${st.id ? ` ${st.id}` : ""}: ${(st.fouten ?? []).slice(0, 2).join(" | ")}`.slice(0, 240));
    if (s.stappen.length > MAX_LOG) s.stappen.splice(0, s.stappen.length - MAX_LOG);
  };
  const auto = (g: Generatie): Generatie => {
    const r = autoHerstel(g);
    for (const a of r.stappen) log({ wat: `auto: ${a.wat}`, id: a.id, ok: true });
    return r.gen;
  };
  const past = (reserve: number) => s.kosten.usd + reserve <= B.vangnetUsd + 1e-9;
  const boek = (usd: number, soort: "spec" | "herstel") => {
    s.kosten.usd = Math.round((s.kosten.usd + usd) * 1e6) / 1e6;
    s.kosten.aanroepen++;
    if (soort === "spec") s.kosten.specUsd = Math.round((s.kosten.specUsd + usd) * 1e6) / 1e6;
    else s.kosten.herstelUsd = Math.round((s.kosten.herstelUsd + usd) * 1e6) / 1e6;
    if (!s.alarm && s.kosten.usd > B.alarmUsd) {
      s.alarm = true;
      opts.log?.("alarm", { id: s.id, usd: s.kosten.usd, grens: B.alarmUsd, fase: s.fase });
    }
  };
  // Eén xAI-5xx (kost niets) mag één keer opnieuw, telt niet als extra gerichte aanroep.
  const roep = async (msgs: Parameters<StapChat>[0], schema: Parameters<StapChat>[1], o: Parameters<StapChat>[2], soort: "spec" | "herstel") => {
    try {
      const r = await chat(msgs, schema, o);
      boek(r.usd, soort);
      return r.tekst;
    } catch (e) {
      if (!isServerfout(e)) throw e;
      log({ wat: "xAI-serverfout, opnieuw", id: "", ok: false, fouten: [String((e as Error)?.message ?? e).slice(0, 120)] });
      const r = await chat(msgs, schema, o);
      boek(r.usd, soort);
      return r.tekst;
    }
  };
  const k = s.kal;
  const keur = (g: Generatie) => keurGeneratie(g, s.inv, k);

  s.laatsteFout = undefined;
  if (s.fase === "spec") {
    if (!past(B.reserveSpecUsd)) throw new Error("Vangnet bereikt vóór de eerste generatie.");
    const tc = nu();
    let ruw: Generatie;
    try {
      const raw = await roep(basis(s), { naam: "toets_spec", schema: generatieSchema() }, { maxTokens: 16000, timeoutMs: B.specTimeoutMs }, "spec");
      ruw = normaliseer(JSON.parse(raw) as Generatie);
    } catch (e) {
      // Mislukte eerste generatie: kosten boeken, toestand terug (fase blijft "spec"); na 2 mislukte pogingen stoppen.
      const usd = (e as { usd?: number }).usd ?? 0;
      if (usd) boek(usd, "spec");
      s.kosten.mislukt++;
      s.pogingen.__spec = (s.pogingen.__spec ?? 0) + 1;
      s.laatsteFout = String((e as Error)?.message ?? e).slice(0, 200);
      log({ wat: "eerste generatie mislukt", id: "", ok: false, fouten: [s.laatsteFout] });
      if (s.pogingen.__spec >= 2) throw new Error(`Eerste generatie twee keer mislukt: ${s.laatsteFout}`);
      s.tijden.stapMs.push(nu() - t0);
      return s;
    }
    s.tijden.specMs = nu() - tc;
    const r0 = keur(ruw);
    s.ruwLengtePct = r0.feiten.lengtePct;
    s.ruwFouten = r0.fouten.length;
    let gen = auto(ruw);
    const vooraf = schrapAfgekeurd(gen, s.inv, k);
    gen = vooraf.gen;
    vooraf.stappen.forEach(log);
    s.gen = gen;
    s.fase = "herstel";
  } else if (s.fase === "herstel") {
    s.rondes++;
    let gen = auto(s.gen!);
    const vooraf = schrapAfgekeurd(gen, s.inv, k);
    gen = vooraf.gen;
    vooraf.stappen.forEach(log);
    let rap = keur(gen);
    const tijdOp = nu() - s.tijden.start > B.maxTotaalMs - 45_000;
    if (allesGoed(rap, k)) s.fase = "afronden";
    else if (tijdOp || !past(B.reserveVraagstukUsd)) {
      s.stopReden = tijdOp ? "tijd" : "vangnet";
      s.fase = "afronden";
    } else {
      const vraag = async (prompt: string): Promise<VraagstukSpec | null> => {
        s.kosten.gericht++;
        try {
          const r = await roep([...basis(s), { role: "user", content: prompt }], { naam: "vraagstuk", schema: vraagstukSchema() }, { maxTokens: 6000, timeoutMs: B.vraagstukTimeoutMs }, "herstel");
          const v = (JSON.parse(r) as { vraagstuk: VraagstukSpec }).vraagstuk;
          return auto(normaliseer({ titel: "", vraagstukken: [v] })).vraagstukken[0] ?? null;
        } catch (e) {
          const usd = (e as { usd?: number }).usd ?? 0;
          if (usd) boek(usd, "herstel");
          s.kosten.mislukt++;
          log({ wat: "aanroep mislukt", id: "", ok: false, fouten: [String((e as Error)?.message ?? e).slice(0, 160)] });
          return null;
        }
      };
      const nBudget = Math.max(0, Math.floor((B.vangnetUsd - s.kosten.usd) / B.reserveVraagstukUsd + 1e-9));
      const fout = fouteIds(rap, gen);
      if (fout.length) {
        // Herstel: minst geprobeerde eerst; hoogstens `parallel` tegelijk.
        const batch = [...fout].sort((a, b) => (s.pogingen[a] ?? 0) - (s.pogingen[b] ?? 0)).slice(0, Math.min(B.parallel, nBudget));
        const nieuw = await pool(batch, B.parallel, (id) => vraag(gerichtPrompt({ soort: "herstel", vraagstuk: gen.vraagstukken.find((v) => v.id === id)!, fouten: rap.perId[id]!, gen })));
        batch.forEach((id, i) => {
          const n = nieuw[i];
          if (n) {
            const kand: Generatie = { ...gen, vraagstukken: gen.vraagstukken.map((x) => (x.id === id ? metId(n, id) : x)) };
            const rk = keur(kand);
            const eigen = rk.perId[id] ?? [];
            const beter = vraagstukFouten(rk) < vraagstukFouten(rap);
            log({ wat: `opnieuw (ronde ${s.rondes})`, id, ok: eigen.length === 0, fouten: eigen });
            if (beter) {
              gen = kand;
              rap = rk;
            }
            if (eigen.length === 0 && beter) return;
          }
          s.pogingen[id] = (s.pogingen[id] ?? 0) + 1;
        });
        // Te vaak mislukt: weg (aanvullen vult lengte/dekking daarna aan).
        const opgegeven = fouteIds(rap, gen).filter((id) => (s.pogingen[id] ?? 0) >= B.pogingenPerVraagstuk);
        if (opgegeven.length) {
          for (const id of opgegeven) log({ wat: `geschrapt na ${s.pogingen[id]} pogingen`, id, ok: false, fouten: rap.perId[id] });
          gen = { ...gen, vraagstukken: gen.vraagstukken.filter((v) => !opgegeven.includes(v.id)) };
        }
      } else {
        // Aanvullen voor lengte en dekking (alleen als er niets meer te herstellen is).
        const f = rap.feiten;
        const pars = f.ontbrekendeParagrafen;
        const tekortP = Math.max(0, k.punten - f.punten);
        const tekortV = Math.max(0, Math.ceil(k.items * 0.85) - f.vragen);
        let taken = s.aanvulling.open.filter((t) => t.vorige);
        if (!taken.length) {
          const n = Math.min(B.parallel, nBudget, Math.max(1, Math.ceil(pars.length / 2), Math.ceil(tekortP / 7), Math.ceil(tekortV / 3.5)));
          const per = Math.max(3, Math.min(9, Math.round((tekortP || 3 * n) / Math.max(1, n))));
          taken = Array.from({ length: n }, (_, i) => ({ id: `aanvulling-${++s.aanvulling.n}`, punten: per, paragrafen: pars.filter((_, j) => j % n === i) }));
        }
        taken = taken.slice(0, Math.min(B.parallel, nBudget));
        const nieuw = await pool(taken, B.parallel, (t) => vraag(gerichtPrompt({ soort: "nieuw", id: t.id, punten: t.punten, paragrafen: t.paragrafen, gen, vorige: t.vorige, fouten: t.fouten })));
        const open: AanvulTaak[] = [];
        taken.forEach((t, i) => {
          const v = nieuw[i];
          if (!v) return;
          const voor = vraagstukFouten(rap);
          const kand: Generatie = { ...gen, vraagstukken: [...gen.vraagstukken, metId(v, t.id)] };
          const rk = keur(kand);
          const eigen = rk.perId[t.id] ?? [];
          const ok = eigen.length === 0 && vraagstukFouten(rk) <= voor;
          const fouten = eigen.length ? eigen : ok ? [] : Object.entries(rk.perId).filter(([id]) => id && id !== t.id).flatMap(([, l]) => l).slice(0, 8);
          log({ wat: `aanvulling ${puntenVan(v)} p (ronde ${s.rondes})`, id: t.id, ok, fouten });
          if (ok) {
            gen = kand;
            rap = rk;
          } else if ((s.pogingen[t.id] = (s.pogingen[t.id] ?? 0) + 1) < 2) open.push({ ...t, vorige: v, fouten });
        });
        s.aanvulling.open = open;
      }
      if (allesGoed(keur(gen), k)) s.fase = "afronden";
    }
    s.gen = gen;
  } else if (s.fase === "afronden") {
    let gen = s.gen!;
    // Gestopt op tijd/vangnet: wat nog fout is, valt weg (een afgekeurd vraagstuk wordt nooit geplaatst).
    const r0 = keur(gen);
    const weg = fouteIds(r0, gen);
    if (weg.length) {
      for (const id of weg) log({ wat: "geschrapt (afronden)", id, ok: false, fouten: r0.perId[id] });
      gen = { ...gen, vraagstukken: gen.vraagstukken.filter((v) => !weg.includes(v.id)) };
    }
    s.lengteVoorInkorten = keur(gen).feiten.lengtePct;
    const kort = inkorten(gen, s.inv, k);
    kort.stappen.forEach(log);
    s.gen = kort.gen;
    const r = keur(s.gen);
    s.restFouten = r.fouten;
    s.fase = "klaar";
    opts.log?.("klaar", monitoring(s, r));
  }
  s.tijden.stapMs.push(nu() - t0);
  opts.log?.("stap", { id: s.id, fase: s.fase, ronde: s.rondes, ms: nu() - t0, usd: s.kosten.usd, gericht: s.kosten.gericht, ...(dezeStap.length ? { afgekeurd: dezeStap } : {}) });
  return s;
}

/** Eén regel monitoring per toets: kosten, tijd en resterende bevindingen. */
export function monitoring(s: Stap0Staat, r?: Keuringsrapport): Record<string, unknown> {
  const f = r?.feiten;
  return {
    id: s.id,
    usd: s.kosten.usd,
    specUsd: s.kosten.specUsd,
    herstelUsd: s.kosten.herstelUsd,
    aanroepen: s.kosten.aanroepen,
    gericht: s.kosten.gericht,
    mislukt: s.kosten.mislukt,
    boven: s.kosten.usd > STAP0_BUDGET.doelUsd ? "doel" : undefined,
    alarm: s.alarm ?? false,
    totaalMs: s.tijden.stapMs.reduce((a, b) => a + b, 0),
    specMs: s.tijden.specMs,
    stappen: s.tijden.stapMs.length,
    rondes: s.rondes,
    lengte: { ruw: s.ruwLengtePct, voorInkorten: s.lengteVoorInkorten, eind: f?.lengtePct },
    ruwFouten: s.ruwFouten,
    restFouten: s.restFouten ?? [],
    stopReden: s.stopReden,
    ...(f ? { vragen: f.vragen, punten: f.punten, figuren: f.figuren, figurenGo: f.figurenGo } : {}),
  };
}

/** Korte statustekst voor de UI. */
export function statusTekst(s: Pick<Stap0Staat, "fase" | "rondes" | "kosten" | "gen"> & { restFouten?: string[] }, r?: { fouten: number }): string {
  switch (s.fase) {
    case "spec":
      return "Toets schrijven (eerste versie, ± 1,5–2 minuten)…";
    case "herstel":
      return `Controleren en verbeteren${s.rondes ? ` (ronde ${s.rondes + 1})` : ""}${r ? ` · nog ${r.fouten} punt(en) open` : ""}…`;
    case "afronden":
      return "Inkorten en opmaken…";
    case "klaar":
      return "Klaar.";
  }
}
