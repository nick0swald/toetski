/**
 * Stap-0-generatie in losse server-stappen (elk ruim binnen maxDuration 180 s), met de hele toestand in één
 * serialiseerbaar object, zodat een stap na een time-out vanaf de laatst opgeslagen toestand opnieuw kan:
 *   (a) "spec": één aanroep voor de hele toets (~115 % lengte), dan auto-fixes en eerst schrappen;
 *   (b) "herstel" (herhaalbaar): auto-fixes + schrappen + ≤ 4 parallelle gerichte aanroepen (herstel, of aanvullen
 *       voor lengte/dekking), tot alle checks slagen, de tijd op is of het vangnet ($ 1) bereikt is. Een vraagstuk
 *       valt nooit weg als de toets daardoor onder 90 % komt: dan alleen de laatste deelvraag, of vervangen door een
 *       nieuw vraagstuk met dezelfde punten en paragrafen. Aanvullen = volledige vraagstukken met exacte punten uit de
 *       minst getoetste paragrafen; twee gelijke mislukkingen → andere strategie (uitbreiden; 88–90 % met
 *       waarschuwing); beide strategieën vast → stoppen ("vastgelopen");
 *   (c) "afronden": lengtebewust inkorten tot net onder 110 % (nooit onder 90 %), liever losse deelvragen.
 * Geen vaste limiet op het aantal herstelaanroepen (alleen tijd en geld); geen rechter in productie.
 * Pure logica: de modelaanroep komt binnen als `StapChat` (productie: xaiChat met XAI_API_KEY; tests: nep).
 */
import { vraagtypeSpreiding } from "./doelen.ts";
import { autoHerstel } from "./auto-herstel.ts";
import { REVIEW, reviewPrompt, reviewSchema, verwerkReview, type ReviewUitslag } from "./docent-review.ts";
import {
  generatieSchema,
  aanvulPrompt,
  figuurAantal,
  foutHandtekening,
  gerichtPrompt,
  inkorten,
  isServerfout,
  keurGeneratie,
  metId,
  normaliseer,
  paragraafTelling,
  paragrafenVan,
  pool,
  puntenVan,
  schrapAfgekeurd,
  specPrompt,
  SPEC_SYSTEM,
  uitbreidPrompt,
  vraagstukFouten,
  vraagstukSchema,
  zonderStaart,
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
  reviewUsd?: number;
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
  /** Figuurtaak uit de docent-review: dit nieuwe vraagstuk moet een (zinvolle) figuur hebben; één poging. */
  figuur?: string;
}

/** Docent-review: rondes, open herstelopdrachten per vraagstuk en de first-time-right-meting. */
export interface Stap0Review {
  rondes: number;
  open: Record<string, string[]>;
  /** Was de eerste review schoon (geen bevinding met ernst "hoog", geen figuurvoorstel)? = first-time-right. */
  eersteSchoon?: boolean;
  bevindingen: number;
  /** Door de review aangezette herstellingen die geaccepteerd zijn (laatste ronde / totaal). */
  hersteld: number;
  hersteldTotaal: number;
  figuurTaak?: "open" | "gelukt" | "mislukt";
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
  /** Stopregel voor aanvullen: handtekening van de laatste mislukking, hoe vaak achter elkaar gelijk, strategie. */
  vul?: { sig?: string; gelijk: number; mislukt: number; strategie: "nieuw" | "uitbreiden"; laatste?: string[]; per?: Record<string, { sig: string; n: number }>; uit?: string[]; wissels?: number };
  /** Bewust geaccepteerde afwijkingen (bijv. lengte 88–90 % na vastgelopen aanvullen). */
  waarschuwingen?: string[];
  review?: Stap0Review;
  /** Aantal figuren (bibliotheek) in de ruwe eerste generatie en na eerst-schrappen. */
  figuren?: { ruw: number; naSchrap: number };
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
  log?: (soort: "stap" | "alarm" | "klaar" | "review", data: Record<string, unknown>) => void;
}

export function nieuweStaat(inv: SpecInvoer, kal: Stap0Kal, id: string, nu = Date.now()): Stap0Staat {
  return { versie: 1, id, inv, kal, fase: "spec", pogingen: {}, aanvulling: { n: 0, open: [] }, stappen: [], kosten: { usd: 0, specUsd: 0, herstelUsd: 0, aanroepen: 0, gericht: 0, mislukt: 0 }, tijden: { start: nu, stapMs: [] }, rondes: 0 };
}

const basis = (s: Stap0Staat) => [
  { role: "system" as const, content: SPEC_SYSTEM },
  { role: "user" as const, content: specPrompt(s.inv, s.kal) },
];
const MAX_LOG = 300;
/** Bevindingen bij ándere vraagstukken die een nieuw/gewijzigd vraagstuk veroorzaakt (bijv. weggever, 1p-R), als reden. */
const andereFouten = (r: Keuringsrapport, id: string) => Object.entries(r.perId).filter(([x]) => x && x !== id).flatMap(([x, l]) => l.map((f) => `[${x}] ${f}`)).slice(0, 8);
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
  const boek = (usd: number, soort: "spec" | "herstel" | "review") => {
    s.kosten.usd = Math.round((s.kosten.usd + usd) * 1e6) / 1e6;
    s.kosten.aanroepen++;
    if (soort === "spec") s.kosten.specUsd = Math.round((s.kosten.specUsd + usd) * 1e6) / 1e6;
    else if (soort === "review") s.kosten.reviewUsd = Math.round(((s.kosten.reviewUsd ?? 0) + usd) * 1e6) / 1e6;
    else s.kosten.herstelUsd = Math.round((s.kosten.herstelUsd + usd) * 1e6) / 1e6;
    if (!s.alarm && s.kosten.usd > B.alarmUsd) {
      s.alarm = true;
      opts.log?.("alarm", { id: s.id, usd: s.kosten.usd, grens: B.alarmUsd, fase: s.fase });
    }
  };
  // Eén xAI-5xx (kost niets) mag één keer opnieuw, telt niet als extra gerichte aanroep.
  const roep = async (msgs: Parameters<StapChat>[0], schema: Parameters<StapChat>[1], o: Parameters<StapChat>[2], soort: "spec" | "herstel" | "review") => {
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
  /** Mislukte aanvulling/uitbreiding: tel mee voor de stopregel (gelijke handtekening = gelijke mislukking). */
  const vulMislukt = (id: string, fouten: string[]) => {
    const vul = (s.vul ??= { gelijk: 0, mislukt: 0, strategie: "nieuw" });
    const sig = foutHandtekening(fouten);
    vul.gelijk = vul.sig === sig ? vul.gelijk + 1 : 1;
    vul.sig = sig;
    vul.mislukt++;
    vul.laatste = fouten.slice(0, 8);
    // Per taak/vraagstuk: twee keer dezelfde soort mislukking telt ook als "gelijk" (parallelle taken wisselen elkaar af).
    const per = (vul.per ??= {});
    per[id] = per[id]?.sig === sig ? { sig, n: per[id]!.n + 1 } : { sig, n: 1 };
    if (per[id]!.n >= 2) {
      vul.gelijk = Math.max(vul.gelijk, 2);
      if (vul.strategie === "uitbreiden") (vul.uit ??= []).push(id);
    }
  };

  /** Eén docent-reviewaanroep; bevindingen worden herstelopdrachten (volgende stap). Een mislukte review blokkeert nooit. */
  const doeReview = async (gen: Generatie) => {
    const rv = (s.review ??= { rondes: 0, open: {}, bevindingen: 0, hersteld: 0, hersteldTotaal: 0 });
    rv.rondes++;
    rv.hersteld = 0;
    const p = reviewPrompt(gen, s.inv);
    try {
      const t = await roep([{ role: "system", content: p.system }, { role: "user", content: p.user }], { naam: "docent_review", schema: reviewSchema() }, { maxTokens: REVIEW.maxTokens, timeoutMs: REVIEW.timeoutMs }, "review");
      const u = verwerkReview(JSON.parse(t) as ReviewUitslag, gen);
      if (rv.rondes === 1) rv.eersteSchoon = u.schoon;
      rv.open = u.perVraagstuk;
      const n = Object.values(u.perVraagstuk).reduce((a, l) => a + l.length, 0);
      rv.bevindingen += n;
      log({ wat: `docent-review ronde ${rv.rondes}: ${u.schoon ? "schoon" : `${n} herstelopdracht(en) in ${Object.keys(u.perVraagstuk).length} vraagstuk(ken)${u.figurenBeter ? "; figuren zouden de toets beter maken" : ""}`}`, id: "", ok: u.schoon, fouten: Object.entries(u.perVraagstuk).flatMap(([id, l]) => l.map((f) => `[${id}] ${f}`)).slice(0, 12) });
      for (const b of u.toets) log({ wat: `docent-review (toets, ${b.soort}, ${b.ernst})`, id: "", ok: b.ernst !== "hoog", fouten: [`${b.probleem} → ${b.fix}`.slice(0, 300)] });
      opts.log?.("review", { id: s.id, ronde: rv.rondes, schoon: u.schoon, firstTimeRight: rv.eersteSchoon, figurenBeter: u.figurenBeter, bevindingen: [...Object.entries(u.perVraagstuk).flatMap(([id, l]) => l.map((f) => `[${id}] ${f}`)), ...u.toets.map((b) => `[toets] ${b.soort}/${b.ernst}: ${b.probleem}`)].slice(0, 20) });
      // "Zou deze toets beter worden met figuren of uitgewerkte voorbeelden?" Ja → één poging voor één figuurvraagstuk.
      if (u.figurenBeter && !rv.figuurTaak && figuurAantal(gen) < 2) {
        const telling = paragraafTelling(gen.vraagstukken, s.inv);
        s.aanvulling.open.push({ id: `figuur-${++s.aanvulling.n}`, punten: 4, paragrafen: telling.slice(0, 2).map((x) => `${x.code} ${x.titel}`), figuur: u.figuurVoorstel ?? "een figuur die de vragen echt beter maakt (schema, aflezing, grafiek of uitgewerkt voorbeeld)" });
        rv.figuurTaak = "open";
      }
    } catch (e) {
      const usd = (e as { usd?: number }).usd ?? 0;
      if (usd) boek(usd, "review");
      rv.open = {};
      if (rv.rondes === 1) rv.eersteSchoon = undefined;
      log({ wat: "docent-review mislukt (geen blokkade)", id: "", ok: false, fouten: [String((e as Error)?.message ?? e).slice(0, 160)] });
    }
  };

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
    const fRuw = figuurAantal(gen);
    const vooraf = schrapAfgekeurd(gen, s.inv, k);
    gen = vooraf.gen;
    vooraf.stappen.forEach(log);
    s.figuren = { ruw: fRuw, naSchrap: figuurAantal(gen) };
    s.gen = gen;
    s.fase = "herstel";
  } else if (s.fase === "herstel") {
    s.rondes++;
    s.vul ??= { gelijk: 0, mislukt: 0, strategie: "nieuw" };
    let gen = auto(s.gen!);
    const vooraf = schrapAfgekeurd(gen, s.inv, k);
    gen = vooraf.gen;
    vooraf.stappen.forEach(log);
    let rap = keur(gen);
    const tijdOp = nu() - s.tijden.start > B.maxTotaalMs - 45_000;
    const minV = Math.ceil(k.items * 0.85);
    const reviewOpen = () => Object.keys(s.review?.open ?? {}).filter((id) => gen.vraagstukken.some((v) => v.id === id));
    const figuurOpen = () => s.aanvulling.open.some((t) => t.figuur);
    // Docent-review: na groen op de deterministische keuring; ronde 2 alleen als ronde 1 iets liet herstellen.
    const reviewMag = () => !tijdOp && past(REVIEW.reserveUsd) && (!s.review || (s.review.rondes < REVIEW.maxRondes && s.review.hersteld > 0));
    if (allesGoed(rap, k) && !reviewOpen().length && !figuurOpen() && reviewMag()) {
      await doeReview(gen);
    } else if (allesGoed(rap, k) && !reviewOpen().length && !figuurOpen()) s.fase = "afronden";
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
      const fout = [...new Set([...fouteIds(rap, gen), ...reviewOpen()])];
      if (fout.length) {
        // Herstel: minst geprobeerde eerst; hoogstens `parallel` tegelijk.
        const batch = [...fout].sort((a, b) => (s.pogingen[a] ?? 0) - (s.pogingen[b] ?? 0)).slice(0, Math.min(B.parallel, nBudget));
        const reviewFouten = (id: string) => (s.review?.open[id] ?? []).map((f) => `docent-review: ${f}`);
        const nieuw = await pool(batch, B.parallel, (id) => vraag(gerichtPrompt({ soort: "herstel", vraagstuk: gen.vraagstukken.find((v) => v.id === id)!, fouten: [...(rap.perId[id] ?? []), ...reviewFouten(id)], gen })));
        batch.forEach((id, i) => {
          const n = nieuw[i];
          // Alleen door de review (deterministisch al goed): één poging; de nieuwe versie moet de harde keuring halen.
          const doorReview = !rap.perId[id]?.length;
          if (doorReview && s.review) delete s.review.open[id];
          if (n) {
            const kand: Generatie = { ...gen, vraagstukken: gen.vraagstukken.map((x) => (x.id === id ? metId(n, id) : x)) };
            const rk = keur(kand);
            const eigen = rk.perId[id] ?? [];
            const beter = doorReview ? eigen.length === 0 && vraagstukFouten(rk) <= vraagstukFouten(rap) : vraagstukFouten(rk) < vraagstukFouten(rap);
            log({ wat: `opnieuw (ronde ${s.rondes}${doorReview ? ", docent-review" : ""})${eigen.length ? ` afgewezen: ${foutHandtekening(eigen)}` : ""}`, id, ok: eigen.length === 0, fouten: eigen });
            if (beter) {
              gen = kand;
              rap = rk;
              if (doorReview && s.review) {
                s.review.hersteld++;
                s.review.hersteldTotaal++;
              }
            }
            if (eigen.length === 0 && beter) return;
          }
          if (!doorReview) s.pogingen[id] = (s.pogingen[id] ?? 0) + 1;
        });
        // Te vaak mislukt. Weg mag alleen als lengte (≥ 90 %), aantal deelvragen en dekking heel blijven; anders
        // eerst alleen de laatste deelvraag (als het vraagstuk daarmee goed is), en anders wordt het vraagstuk
        // vervangen door een NIEUW vraagstuk met dezelfde punten en paragrafen (aanvultaak).
        const opgegeven = fouteIds(rap, gen).filter((id) => (s.pogingen[id] ?? 0) >= B.pogingenPerVraagstuk);
        for (const id of opgegeven) {
          const v = gen.vraagstukken.find((x) => x.id === id)!;
          const ontbr = new Set(rap.feiten.ontbrekendeParagrafen);
          const zonder: Generatie = { ...gen, vraagstukken: gen.vraagstukken.filter((x) => x.id !== id) };
          const fz = keur(zonder).feiten;
          const v2 = zonderStaart(v);
          const metStaart = v2 ? { ...gen, vraagstukken: gen.vraagstukken.map((x) => (x.id === id ? v2 : x)) } : null;
          const rs = metStaart ? keur(metStaart) : null;
          if (fz.lengtePct >= 90 && fz.vragen >= minV && fz.ontbrekendeParagrafen.every((p) => ontbr.has(p))) {
            log({ wat: `geschrapt na ${s.pogingen[id]} pogingen (lengte blijft ${fz.lengtePct} %)`, id, ok: false, fouten: rap.perId[id] });
            gen = zonder;
          } else if (metStaart && rs && !rs.perId[id]?.length && rs.feiten.lengtePct >= 90) {
            log({ wat: `deelvraag ${v.deelvragen.at(-1)!.id} geschrapt na ${s.pogingen[id]} pogingen (rest is goed)`, id, ok: false, fouten: rap.perId[id] });
            gen = metStaart;
          } else {
            const taak: AanvulTaak = { id: `vervang-${++s.aanvulling.n}`, punten: puntenVan(v), paragrafen: paragrafenVan(v, s.inv) };
            log({ wat: `vervangen door nieuw vraagstuk ${taak.id} (${taak.punten} p) na ${s.pogingen[id]} pogingen; schrappen zou de lengte op ${fz.lengtePct} % zetten`, id, ok: false, fouten: rap.perId[id] });
            gen = zonder;
            s.aanvulling.open.push(taak);
          }
          rap = keur(gen);
        }
      } else if (s.vul.strategie === "uitbreiden") {
        // Andere strategie (aanvullen liep twee keer op dezelfde manier vast): goedgekeurde vraagstukken uitbreiden.
        const f = rap.feiten;
        let tekort = Math.max(1, k.punten - f.punten, minV - f.vragen);
        const doelen = gen.vraagstukken.filter((v) => !s.vul!.uit?.includes(v.id)).sort((a, b) => a.deelvragen.length - b.deelvragen.length || puntenVan(a) - puntenVan(b) || a.id.localeCompare(b.id));
        const taken: { v: VraagstukSpec; extra: number }[] = [];
        for (const v of doelen) {
          if (tekort <= 0 || taken.length >= Math.min(B.parallel, nBudget)) break;
          const extra = Math.min(v.deelvragen.length < 4 ? 3 : 2, tekort);
          taken.push({ v, extra });
          tekort -= extra;
        }
        const nieuw = await pool(taken, B.parallel, (t) => vraag(uitbreidPrompt({ vraagstuk: t.v, extra: t.extra, gen, inv: s.inv, fouten: s.vul?.laatste })));
        taken.forEach((t, i) => {
          const n = nieuw[i];
          if (!n) return;
          const oud = gen.vraagstukken.find((x) => x.id === t.v.id);
          if (!oud) return;
          const kand: Generatie = { ...gen, vraagstukken: gen.vraagstukken.map((x) => (x.id === t.v.id ? metId(n, t.v.id) : x)) };
          const rk = keur(kand);
          const eigen = rk.perId[t.v.id] ?? [];
          const fouten = eigen.length ? eigen : vraagstukFouten(rk) > vraagstukFouten(rap) ? andereFouten(rk, t.v.id) : puntenVan(n) <= puntenVan(oud) ? [`vorm: uitbreiding heeft ${puntenVan(n)} punten, moest ${puntenVan(oud) + t.extra} zijn`] : [];
          const ok = fouten.length === 0;
          log({ wat: `uitgebreid ${puntenVan(oud)} → ${puntenVan(n)} p (ronde ${s.rondes})${ok ? "" : ` afgewezen: ${foutHandtekening(fouten)}`}`, id: t.v.id, ok, fouten });
          if (ok) {
            gen = kand;
            rap = rk;
            s.vul!.wissels = 0;
          } else vulMislukt(t.v.id, fouten);
        });
      } else {
        // Aanvullen voor lengte en dekking: volledige vraagstukken met exacte punten, uit de paragrafen die nu het
        // minst getoetst worden (ontbrekende eerst); open (vervang- of herkansings)taken gaan voor.
        const f = rap.feiten;
        const tekortP = Math.max(0, k.punten - f.punten);
        const tekortV = Math.max(0, minV - f.vragen);
        let taken = s.aanvulling.open;
        if (!taken.length) {
          const telling = paragraafTelling(gen.vraagstukken, s.inv);
          const mist = telling.filter((p) => p.n === 0);
          const n = Math.max(1, Math.min(B.parallel, nBudget, Math.max(Math.ceil(tekortP / 6), Math.ceil(mist.length / 2), Math.ceil(tekortV / 4))));
          const totaal = Math.max(3 * n, tekortP);
          taken = Array.from({ length: n }, (_, i) => {
            const punten = Math.max(3, Math.min(8, Math.round(totaal / n)));
            const eigen = mist.filter((_, j) => j % n === i);
            const pars = (eigen.length ? eigen : telling.slice((2 * i) % Math.max(1, telling.length)).concat(telling).slice(0, 2)).map((p) => `${p.code} ${p.titel}`);
            return { id: `aanvulling-${++s.aanvulling.n}`, punten, paragrafen: pars };
          });
        }
        taken = taken.slice(0, Math.min(B.parallel, nBudget));
        const nieuw = await pool(taken, B.parallel, (t) => vraag(aanvulPrompt({ id: t.id, punten: t.punten, paragrafen: t.paragrafen, gen, inv: s.inv, vorige: t.vorige, fouten: t.fouten, figuur: t.figuur })));
        const open: AanvulTaak[] = s.aanvulling.open.filter((t) => !taken.includes(t));
        taken.forEach((t, i) => {
          const v = nieuw[i];
          const figuurMislukt = (waarom: string) => {
            if (s.review) s.review.figuurTaak = "mislukt";
            (s.waarschuwingen ??= []).push(`figuren: geen geldige figuurvraag toegevoegd (${waarom}); toets blijft zonder extra figuur`);
          };
          if (!v) {
            if (t.figuur) figuurMislukt("aanroep mislukt");
            else open.push(t);
            return;
          }
          const voor = vraagstukFouten(rap);
          const kand: Generatie = { ...gen, vraagstukken: [...gen.vraagstukken, metId(v, t.id)] };
          const rk = keur(kand);
          const eigen = rk.perId[t.id] ?? [];
          const zonderFiguur = t.figuur && figuurAantal(kand) <= figuurAantal(gen) ? ["figuur: het nieuwe vraagstuk heeft geen figuur"] : [];
          const fouten = eigen.length ? eigen : vraagstukFouten(rk) > voor ? andereFouten(rk, t.id) : zonderFiguur;
          const ok = fouten.length === 0;
          if (t.figuur) {
            log({ wat: `figuurvraagstuk ${ok ? "toegevoegd" : `afgewezen: ${foutHandtekening(fouten)}`} (docent-review)`, id: t.id, ok, fouten });
            if (ok) {
              gen = kand;
              rap = rk;
              if (s.review) s.review.figuurTaak = "gelukt";
            } else figuurMislukt(foutHandtekening(fouten));
            return;
          }
          log({ wat: `aanvulling ${puntenVan(v)}/${t.punten} p (ronde ${s.rondes})${ok ? "" : ` afgewezen: ${foutHandtekening(fouten)}`}`, id: t.id, ok, fouten });
          if (ok) {
            gen = kand;
            rap = rk;
            s.vul!.gelijk = 0;
            s.vul!.sig = undefined;
            s.vul!.wissels = 0;
            return;
          }
          vulMislukt(t.id, fouten);
          // Herkansing met de redenen; na 2 pogingen een nieuwe taak (andere paragrafen/situatie).
          if ((s.pogingen[t.id] = (s.pogingen[t.id] ?? 0) + 1) < 2) open.push({ ...t, vorige: v, fouten });
        });
        s.aanvulling.open = open;
      }
      // Stopregel: twee keer achter elkaar op dezelfde manier mislukt → andere strategie.
      if (s.vul.gelijk >= 2 || s.vul.mislukt >= 6) {
        const r2 = keur(gen);
        const alleenLengte = vraagstukFouten(r2) === 0 && r2.feiten.ontbrekendeParagrafen.length === 0 && r2.feiten.vragen >= minV;
        if (alleenLengte && r2.feiten.lengtePct >= 88) {
          (s.waarschuwingen ??= []).push(`lengte ${r2.feiten.lengtePct} % geaccepteerd (88–90 %) na ${s.vul.mislukt} mislukte aanvulling(en) (${s.vul.sig ?? "?"})`);
          log({ wat: `andere strategie: lengte ${r2.feiten.lengtePct} % geaccepteerd met waarschuwing`, id: "", ok: true });
          s.fase = "afronden";
        } else if ((s.vul.wissels ?? 0) >= 3) {
          // Beide strategieën twee keer zonder enige vooruitgang: vastgelopen; stoppen spaart geld (het vangnet blijft de grens).
          s.stopReden = "vastgelopen";
          log({ wat: `gestopt: aanvullen en uitbreiden lopen vast (${s.vul.sig ?? "?"})`, id: "", ok: false, fouten: s.vul.laatste });
          s.fase = "afronden";
        } else if (s.vul.strategie === "nieuw") {
          log({ wat: `andere strategie: uitbreiden in plaats van nieuwe vraagstukken (${s.vul.mislukt}× mislukt, laatst ${s.vul.sig ?? "?"})`, id: "", ok: true });
          s.vul = { gelijk: 0, mislukt: 0, strategie: "uitbreiden", laatste: s.vul.laatste, uit: s.vul.uit, wissels: (s.vul.wissels ?? 0) + 1 };
          s.aanvulling.open = [];
        } else {
          // Ook uitbreiden loopt vast: terug naar nieuwe vraagstukken (andere paragrafen), teller op nul.
          log({ wat: `andere strategie: weer nieuwe vraagstukken (uitbreiden ${s.vul.mislukt}× mislukt)`, id: "", ok: true });
          s.vul = { gelijk: 0, mislukt: 0, strategie: "nieuw", uit: s.vul.uit, wissels: (s.vul.wissels ?? 0) + 1 };
        }
      }
      if (s.fase === "herstel" && allesGoed(keur(gen), k) && !s.aanvulling.open.some((t) => t.id.startsWith("vervang-") || t.figuur) && !reviewOpen().length && !reviewMag()) s.fase = "afronden";
    }
    s.gen = gen;
  } else if (s.fase === "afronden") {
    let gen = s.gen!;
    // Gestopt op tijd/vangnet: wat nog fout is, valt weg (een afgekeurd vraagstuk wordt nooit geplaatst). Liever
    // alleen de laatste deelvraag als het vraagstuk daarmee goed is.
    for (let n = 0; n < 20; n++) {
      const r0 = keur(gen);
      const id = fouteIds(r0, gen)[0];
      if (!id) break;
      const v = gen.vraagstukken.find((x) => x.id === id)!;
      const v2 = zonderStaart(v);
      const metStaart = v2 ? { ...gen, vraagstukken: gen.vraagstukken.map((x) => (x.id === id ? v2 : x)) } : null;
      if (metStaart && !keur(metStaart).perId[id]?.length) {
        log({ wat: `deelvraag ${v.deelvragen.at(-1)!.id} geschrapt (afronden)`, id, ok: false, fouten: r0.perId[id] });
        gen = metStaart;
      } else {
        log({ wat: "geschrapt (afronden)", id, ok: false, fouten: r0.perId[id] });
        gen = { ...gen, vraagstukken: gen.vraagstukken.filter((x) => x.id !== id) };
      }
    }
    s.lengteVoorInkorten = keur(gen).feiten.lengtePct;
    const kort = inkorten(gen, s.inv, k);
    kort.stappen.forEach(log);
    s.gen = kort.gen;
    const r = keur(s.gen);
    // Geaccepteerde lengte 88–90 % staat als waarschuwing, niet als open bevinding.
    s.restFouten = s.waarschuwingen?.length ? r.fouten.filter((f) => !/^lengte: \d+ punten = (88|89) %/.test(f)) : r.fouten;
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
    waarschuwingen: s.waarschuwingen ?? [],
    vulStrategie: s.vul?.strategie,
    stopReden: s.stopReden,
    ...(f ? { vragen: f.vragen, punten: f.punten, figuren: f.figuren, figurenGo: f.figurenGo } : {}),
    figurenRuw: s.figuren?.ruw,
    figurenNaSchrap: s.figuren?.naSchrap,
    reviewUsd: s.kosten.reviewUsd,
    review: s.review ? { rondes: s.review.rondes, bevindingen: s.review.bevindingen, hersteld: s.review.hersteldTotaal, figuurTaak: s.review.figuurTaak } : undefined,
    /** First-time-right: de eerste docent-review vond niets (geen "hoog", geen figuurvoorstel). */
    firstTimeRight: s.review?.eersteSchoon,
    /** Spreiding van vraagtypen (62 CSE-typen) en het aandeel deelvragen met een examendoel. */
    vraagtypen: s.gen ? (({ aantal, maxAandeel }) => ({ aantal, maxAandeel }))(vraagtypeSpreiding(s.gen.vraagstukken)) : undefined,
    metExamendoel: s.gen ? (() => { const d = s.gen!.vraagstukken.flatMap((v) => v.deelvragen); return d.length ? Math.round((100 * d.filter((x) => x.examendoel).length) / d.length) : 0; })() : undefined,
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
