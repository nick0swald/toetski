/**
 * Plan-first, stap 1: het bouwplan.
 *
 * Eerst bepaalt code deterministisch de quota (vragen per paragraaf met eerlijke diepgang, RTTI-punten,
 * vraagvormen, punten). Daarna maakt één modelaanroep ("plannen") per vraag een regel: paragraaf, vorm,
 * RTTI, punten, kernbegrip, situatie, persoon, wat er gevraagd wordt en het verwachte antwoord — plus een
 * paar reservevragen. Het plan wordt daarna gecontroleerd/hersteld (bouwplan-check.ts) en pas dan geschreven,
 * waarbij elke schrijf-aanroep het hele plan ziet (zo geen dubbele contexten, personen of weggevers).
 */
import type { Rtti } from "./types";
import type { Kalibratie } from "./kalibratie.ts";
import { vormAantallen } from "./kalibratie.ts";
import type { RttiVerdeling } from "./types";
import { PLAN, VOORNAMEN } from "./config.ts";
import { CACHE_GRENS, berichten, vraagJson, type Kosten } from "./llm.ts";
import { kernbegrippen, type Kernbegrip } from "./samenhang.ts";

export type PlanVorm = "jn" | "mc" | "kort" | "invul" | "uitleg" | "reken" | "teken";
export const PLAN_VORMEN: PlanVorm[] = ["jn", "mc", "kort", "invul", "uitleg", "reken", "teken"];
export const VORM_NAAM: Record<PlanVorm, string> = {
  jn: "juist/onjuist",
  mc: "meerkeuze",
  kort: "kort open antwoord",
  invul: "invullen/aanvullen",
  uitleg: "uitleggen/verklaren",
  reken: "berekening",
  teken: "tekenen/aflezen (tekenvak)",
};
export const GESLOTEN: PlanVorm[] = ["jn", "mc"];

export interface PlanItem {
  n: number;
  /** Paragraafcode uit de lesstof, bijv. "11.2". */
  par: string;
  vorm: PlanVorm;
  rtti: Rtti;
  punten: number;
  /** Eén kernbegrip/vaardigheid (uniek in de toets). */
  begrip: string;
  /** Korte situatie (uniek in de toets); leeg = geen context. */
  context: string;
  /** Voornaam uit VOORNAMEN, of leeg. */
  persoon?: string;
  /** Wat er gevraagd wordt (één regel). */
  kern: string;
  /** Verwacht antwoord in steekwoorden (mag nergens anders in de toets verklapt worden). */
  antwoord: string;
  /** Contexttitel als meerdere vragen één doorlopende context delen. */
  groep?: string;
  /** Aanwijzingen van de plancontrole voor de schrijver (bijv. "andere situatie dan vraag 4"). */
  let?: string[];
}

export interface Bouwplan {
  versie: 1;
  items: PlanItem[];
  reserve: PlanItem[];
  /** Welke aanroep het plan maakte (log/eval): "plan-model" (grok-4.5), "plan-model (2e poging)" of "snel model". */
  route?: PlanRoute;
}

export type PlanRoute = "plan-model" | "plan-model (2e poging)" | "snel model";

export interface PlanQuota {
  aantal: number;
  punten: number;
  paragrafen: { code: string; titel: string; aantal: number }[];
  /** Punten per RTTI-label (som = punten). */
  rttiPunten: Record<Rtti, number>;
  vorm: Record<PlanVorm, number>;
  reserve: number;
  /** Leerdoelen per paragraafcode (Nova, op titel gekoppeld); elke vraag kiest een ander doel. */
  doelen?: Record<string, string[]>;
  /** Kernbegrippen uit de lesstof ("Echo: …", "… heet ultrasoon"): elk minstens één vraag. */
  kern?: Kernbegrip[];
  /** Plan ingekort tot wat in de toetstijd past (was: kalibratie-aantal). */
  ingekortVan?: number;
}

/** Grootste-restmethode: verdeel totaal naar gewicht, elk minstens min. */
export function verdeel(gewichten: number[], totaal: number, min = 0): number[] {
  const n = gewichten.length;
  if (!n) return [];
  const basis = Math.min(min, Math.floor(totaal / n));
  const rest = totaal - basis * n;
  const som = gewichten.reduce((s, g) => s + g, 0) || 1;
  const ruw = gewichten.map((g) => (g / som) * rest);
  const uit = ruw.map((r) => basis + Math.floor(r));
  let over = totaal - uit.reduce((s, x) => s + x, 0);
  const volgorde = ruw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; over > 0; k = (k + 1) % n, over--) uit[volgorde[k]![1]]! += 1;
  return uit;
}

/** Tekstlengte per paragraaf (van zijn kop tot de volgende kop). */
export function paragraafLengtes(bron: string, paragrafen: { code: string }[]): number[] {
  const regels = bron.split(/\r?\n/);
  const start = paragrafen.map((p) => {
    const re = new RegExp(`^(?:paragraaf\\s+|§\\s*)?${p.code.replace(".", "\\.")}\\.?\\s+\\S`, "i");
    return regels.findIndex((r) => re.test(r.replace(/\s+/g, " ").trim()));
  });
  const posities = start.filter((i) => i >= 0).sort((a, b) => a - b);
  return start.map((i) => {
    if (i < 0) return 0;
    const volgende = posities.find((j) => j > i) ?? regels.length;
    return regels.slice(i, volgende).join("\n").length;
  });
}

/**
 * Quota voor het bouwplan. Eerlijke diepgang: vragen per paragraaf ∝ √(tekstlengte), elke paragraaf minstens
 * 1 (2 als er ruimte is), zodat een dunne paragraaf niet op één vraag blijft hangen en een dikke niet alles opslokt.
 */
export function maakQuota(input: {
  bron: string;
  paragrafen: { code: string; titel: string }[];
  aantalVragen: number;
  doelPunten: number;
  rttiDoel: RttiVerdeling;
  kal: Kalibratie;
}): PlanQuota {
  const tijd = aantalVoorTijd(input.aantalVragen, input.kal);
  const N = tijd;
  const pars = input.paragrafen;
  const lengtes = paragraafLengtes(input.bron, pars);
  const gem = lengtes.filter((l) => l > 0).reduce((s, l, _i, a) => s + l / a.length, 0) || 1;
  const gewichten = lengtes.map((l) => Math.sqrt(l > 0 ? l : gem));
  const min = N >= pars.length * 2 + 2 ? 2 : 1;
  const perPar = pars.length ? verdeel(gewichten, N, min) : [];
  const som = input.rttiDoel.R + input.rttiDoel.T1 + input.rttiDoel.T2 + input.rttiDoel.I || 100;
  const labels: Rtti[] = ["R", "T1", "T2", "I"];
  const rp = verdeel(labels.map((l) => input.rttiDoel[l] / som), input.doelPunten);
  const rttiPunten = Object.fromEntries(labels.map((l, i) => [l, rp[i]!])) as Record<Rtti, number>;
  // Minstens één I-vraag (2–3 p) als het doel I > 0 heeft en de toets lang genoeg is.
  if (input.rttiDoel.I > 0 && N >= 10 && rttiPunten.I < 2) {
    const tekort = 2 - rttiPunten.I;
    rttiPunten.I = 2;
    rttiPunten.T2 = Math.max(0, rttiPunten.T2 - tekort);
  }
  const vorm = vormAantallen({ ...input.kal, items: N }) as Record<PlanVorm, number>;
  const kern = kernbegrippen(input.bron).slice(0, 12);
  return {
    ...(N < input.aantalVragen ? { ingekortVan: input.aantalVragen } : {}),
    ...(kern.length ? { kern } : {}),
    aantal: N,
    punten: input.doelPunten,
    paragrafen: pars.map((p, i) => ({ ...p, aantal: perPar[i]! })),
    rttiPunten,
    vorm,
    reserve: PLAN.reserve,
  };
}

/**
 * Aantal vragen dat in de toetstijd past. De kalibratie (Nicks schooltoetsen) geeft het aantal items; bij
 * plan-first zijn de vragen voller (situatie + gegevens), dus begrenzen we op vragen per minuut (BB/KB 0,5,
 * GT/TL 0,55) — nooit onder 86 % van de kalibratie (lengtecriterium) en de punten blijven gelijk: liever
 * minder, rijkere vragen dan veel losse 1-puntsvragen (rechter kb2: "te veel items voor 45 min").
 */
export function aantalVoorTijd(aantal: number, kal: Pick<Kalibratie, "minuten" | "leerweg" | "examen">): number {
  if (kal.examen || !kal.minuten) return aantal;
  const perMin = kal.leerweg === "BB" || kal.leerweg === "KB" ? 0.5 : 0.55;
  const maxTijd = Math.round(kal.minuten * perMin);
  return Math.min(aantal, Math.max(Math.ceil(aantal * 0.86), maxTijd));
}

export function planTokens(q: PlanQuota): number {
  return (q.aantal + q.reserve) * PLAN.tokensPerItem + PLAN.tokensMarge;
}

/** Opdracht voor de plan-aanroep (komt ná het gedeelde, gecachete toetsvoorvoegsel). */
export function bouwplanPrompt(q: PlanQuota): string {
  const parRegels = q.paragrafen.length
    ? q.paragrafen.map((p) => `${p.code} ${p.titel}: ${p.aantal} vragen`).join("; ")
    : "(geen paragraafkoppen: kies zelf domeinen uit de lesstof en spreid eerlijk)";
  const doelRegels = q.doelen && Object.keys(q.doelen).length
    ? `\nLeerdoelen per paragraaf (kernstof; verdeel de vragen van een paragraaf over VERSCHILLENDE leerdoelen, belangrijkste eerst):\n${q.paragrafen
        .filter((p) => q.doelen![p.code]?.length)
        .map((p) => `${p.code}: ${q.doelen![p.code]!.join(" | ")}`)
        .join("\n")}`
    : "";
  const vormRegels = PLAN_VORMEN.filter((v) => q.vorm[v] > 0)
    .map((v) => `${v} (${VORM_NAAM[v]}): ${q.vorm[v]}`)
    .join("; ");
  const gesloten = q.vorm.mc + q.vorm.jn;
  const blokken = contextBlokkenDoel(q);
  const kernRegel = q.kern?.length ? `\n- Kernbegrippen uit de lesstof die elk minstens één vraag krijgen: ${q.kern.map((k) => `${k.term}${k.par ? ` (${k.par})` : ""}`).join(", ")}.` : "";
  return `OPDRACHT NU: maak nog GEEN vragen, maar eerst het BOUWPLAN van de hele toets (JSON). Het plan wordt daarna door anderen uitgeschreven, dus elke regel moet op zichzelf duidelijk zijn.

Vaste aantallen (verplicht, tel na):
- ${q.aantal} vragen, samen ${q.punten} punten.
- Per paragraaf: ${parRegels}.${doelRegels}
- Vraagvormen: ${vormRegels}. Gesloten vragen (jn, mc) = 1 punt; nooit meer dan ${gesloten + 1} gesloten vragen${q.vorm.jn ? "" : ", geen juist/onjuist (jn)"}.
- Contextblokken: ${blokken} groepen (g) van 2–3 open vragen bij één situatie, zoals in een schooltoets: eerst een berekening in die situatie (reken; of toepassen als er niets te rekenen valt), daarna een redeneer-/uitlegvraag (uitleg, T2 of I) die op dezelfde situatie voortbouwt. Zelfde groepstitel, aaneen.
- RTTI in punten: R ${q.rttiPunten.R} · T1 ${q.rttiPunten.T1} · T2 ${q.rttiPunten.T2} · I ${q.rttiPunten.I}${q.rttiPunten.I ? " (I = nieuwe situatie, eigen redenering, 2–3 p)" : ""}.
- Elk kernbegrip of elke regel één keer: niet twee vragen over dezelfde regel of tabel (bijv. twee keer veilige tijd bij een geluidsniveau) en niet twee vragen over dezelfde onderdelen (bijv. twee keer de delen van het oor).${kernRegel}
- Plus ${q.reserve} reservevragen (andere begrippen/situaties, verschillende paragrafen) in "reserve".

Regels voor het plan:
- Elk item toetst een ANDER kernbegrip (b); binnen een paragraaf verschillende onderdelen van die paragraaf (geen varianten van dezelfde regel, zoals krachten optellen én aftrekken als twee vragen). Zelfde begrip twee keer alleen als de vragen echt iets anders vragen (bijv. herkennen vs. berekenen), en dan nooit naast elkaar.
- Elke situatie (c) is anders: niet twee keer dezelfde plek, hetzelfde voorwerp of dezelfde activiteit (geen twee fietsers, geen twee concerten). Alledaags en realistisch voor een vmbo-leerling.
- Ook gesloten en korte vragen krijgen bij voorkeur een korte, concrete situatie of gegeven (zoals in schooltoetsen), niet alleen "Wat is X?". Hooguit de helft van de vragen heeft een persoon.
- Persoon (w): kies uit ${VOORNAMEN.join(", ")}; elke naam hooguit één item (of één groep). Niet elke vraag heeft een persoon nodig. Nooit een schoolnaam.
- Verwacht antwoord (a) in steekwoorden. Geen enkel ander item mag dat antwoord in zijn situatie of vraag noemen (geen weggevers): plan de vragen zo dat ze los van elkaar te maken zijn.
- Groep (g): alleen als 2–4 vragen echt één doorlopende context delen (zelfde titel); die staan dan aaneen.
- Volgorde: eerst alle gesloten vragen (jn, mc), daarna open/berekening/tekenen; groepen aaneen.
- Rekenvragen: realistische getallen; g = 10 N/kg als zwaartekracht nodig is (één waarde voor g in de hele toets).
- Tekenen (teken): de leerling tekent zelf, zonder plaatje: bijv. een krachtpijl op schaal, een lijn in een diagram uit een tabel, een schakelschema. Zet in "wat wordt gevraagd" wat er getekend moet worden.

Antwoord met ALLEEN dit JSON-object. Elke vraag is één rij (array) met precies deze 10 velden in deze volgorde. "Wat wordt gevraagd" is de bedoeling van de vraag in steekwoorden (wat de leerling moet doen/laten zien), niet de letterlijke vraagzin; de schrijver maakt er een volwaardige vraag van. Situatie kort en concreet.
[paragraafcode, vorm (jn|mc|kort|invul|uitleg|reken|teken), rtti (R|T1|T2|I), punten, kernbegrip, situatie of "", voornaam of "", wat wordt gevraagd, verwacht antwoord, groepstitel of ""]
{"items":[["11.1","mc","R",1,"wrijving","fietser op nat wegdek","Daan","welke kracht remt de fiets af","wrijvingskracht",""]],"reserve":[ …zelfde rijen… ]}`;
}

/** Aantal contextblokken (situatie → berekening → redeneren) dat het plan moet hebben: 2, bij ≥ 22 vragen 3. */
export function contextBlokkenDoel(q: Pick<PlanQuota, "aantal">): number {
  return q.aantal >= 22 ? 3 : 2;
}

const RTTI_SET = new Set<Rtti>(["R", "T1", "T2", "I"]);
/** Vrij tekstveld zonder letter of cijfer (bijv. "],[" uit een kapotte rij) telt als leeg. */
const tekstVeld = (x: unknown, max: number) => {
  const t = s(x, max);
  return /[\p{L}\p{N}]/u.test(t) && t !== "-" ? t : "";
};
const s = (x: unknown, max = 160) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, max) : typeof x === "number" ? String(x) : "");

function vormVan(x: unknown): PlanVorm {
  const v = s(x).toLowerCase();
  if ((PLAN_VORMEN as string[]).includes(v)) return v as PlanVorm;
  if (v.includes("juist")) return "jn";
  if (v.includes("meerkeuze") || v === "m") return "mc";
  if (v.includes("bereken") || v.includes("reken")) return "reken";
  if (v.includes("invul")) return "invul";
  if (v.includes("uitleg") || v.includes("verklaar")) return "uitleg";
  if (v.includes("teken")) return "teken";
  return "kort";
}

/** Rij-formaat (compact, zie bouwplanPrompt) → objectvorm. */
const RIJ = ["p", "v", "r", "pt", "b", "c", "w", "k", "a", "g"] as const;

function itemVan(x: unknown, i: number): PlanItem | null {
  if (Array.isArray(x)) {
    const rij: unknown[] = x;
    x = Object.fromEntries(RIJ.map((k, j) => [k, rij[j]]));
  }
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const kern = s(o.k ?? o.kern, 200);
  const begrip = s(o.b ?? o.begrip, 60);
  if (!kern && !begrip) return null;
  const vorm = vormVan(o.v ?? o.vorm);
  const r = s(o.r ?? o.rtti).toUpperCase() as Rtti;
  const pt = Math.round(Number(o.pt ?? o.punten));
  const persoon = tekstVeld(o.w ?? o.persoon, 20);
  const groep = tekstVeld(o.g ?? o.groep, 60);
  return {
    n: Number(o.n) || i + 1,
    par: s(o.p ?? o.par, 12).replace(/^§\s*/, ""),
    vorm,
    rtti: RTTI_SET.has(r) ? r : "T1",
    punten: GESLOTEN.includes(vorm) ? 1 : Number.isFinite(pt) && pt > 0 ? Math.min(5, pt) : 2,
    begrip,
    context: tekstVeld(o.c ?? o.context, 120),
    ...(persoon && persoon !== "-" ? { persoon } : {}),
    kern,
    antwoord: s(o.a ?? o.antwoord, 120),
    ...(groep && groep !== "-" ? { groep } : {}),
  };
}

/** Tolerant parsen (korte of lange sleutels); null als er geen bruikbaar plan in zit. */
export function parseBouwplan(u: unknown): Bouwplan {
  const o = (u && typeof u === "object" ? u : {}) as Record<string, unknown>;
  const lijst = Array.isArray(o.items) ? o.items : Array.isArray(o.vragen) ? o.vragen : [];
  const items = lijst.map(itemVan).filter((x): x is PlanItem => Boolean(x));
  const reserve = (Array.isArray(o.reserve) ? o.reserve : []).map(itemVan).filter((x): x is PlanItem => Boolean(x));
  if (items.length < 3) throw new Error(`Bouwplan onbruikbaar (${items.length} items)`);
  return { versie: 1, items: items.map((it, i) => ({ ...it, n: i + 1 })), reserve: reserve.map((it, i) => ({ ...it, n: items.length + i + 1 })) };
}

/** Eén planregel als tekst (voor de schrijvers en de controle). */
export function planRegel(it: PlanItem): string {
  return `${it.n}. [${it.par}] ${VORM_NAAM[it.vorm]}, ${it.rtti}, ${it.punten}p — begrip: ${it.begrip}${it.context ? ` — situatie: ${it.context}` : ""}${it.persoon ? ` — persoon: ${it.persoon}` : ""}${it.groep ? ` — context "${it.groep}"` : ""} — vraag: ${it.kern} — antwoord: ${it.antwoord}${it.let?.length ? ` — LET OP: ${it.let.join("; ")}` : ""}`;
}

/**
 * De plan-aanroep. `voorvoegsel` = het volledige toetsvoorvoegsel (lesstof, kalibratie, leerdoelen) dat ook de
 * schrijvers krijgen; zo deelt het plan de promptcache met de schrijf-aanroepen erna.
 *
 * Robuust tegen trage API (gate plan5: 3 van 5 plan-aanroepen > 55 s → snel model of oude route):
 * - het plan mag lopen tot er nog PLAN.schrijfReserveMs van de deadline over is (niet meer een vaste 55 s);
 * - geen plan na PLAN.tweedePogingNaMs (of de eerste faalt eerder): een tweede, identieke grok-4.5-aanroep ernaast;
 * - geen plan na PLAN.snelNaMs: het snelle model als reserve ernaast. Dat plan telt pas als alle
 *   grok-4.5-aanroepen mislukt zijn; een grok-4.5-plan dat binnen het planbudget komt, gaat altijd voor.
 * Pas als alles faalt, gooit dit (→ oude route in generate.ts).
 */
export function maakBouwplan(opts: {
  system: string;
  voorvoegsel: string;
  quota: PlanQuota;
  rest: () => number;
  kosten?: Kosten;
  /** Testbaar: de modelaanroep (standaard vraagJson). */
  roep?: (rol: "plannen" | "snel", timeoutMs: () => number) => Promise<Bouwplan>;
  /** Testbaar: kortere wachttijden. */
  tijden?: Partial<{ tweedePogingNaMs: number; snelNaMs: number; minGrokMs: number; minSnelMs: number }>;
}): Promise<Bouwplan> {
  const T = { tweedePogingNaMs: PLAN.tweedePogingNaMs, snelNaMs: PLAN.snelNaMs, minGrokMs: 20_000, minSnelMs: 10_000, ...opts.tijden };
  const msgs = berichten(opts.system, `${opts.voorvoegsel}${CACHE_GRENS}${bouwplanPrompt(opts.quota)}`);
  const planRest = () => opts.rest() - PLAN.schrijfReserveMs;
  const roep =
    opts.roep ??
    ((rol: "plannen" | "snel", t: () => number) =>
      vraagJson(rol, msgs, parseBouwplan, { maxTokens: planTokens(opts.quota), rest: t, kosten: opts.kosten, herkansingMinRestMs: 10 ** 9 }));
  return new Promise<Bouwplan>((resolve, reject) => {
    let klaar = false;
    let grokLopend = 0;
    let lopend = 0;
    let grokGestart = 0;
    let snelGestart = false;
    let snelPlan: Bouwplan | null = null;
    let laatsteFout: unknown = new Error("Geen tijd voor het bouwplan");
    const timers: ReturnType<typeof setTimeout>[] = [];
    const einde = (p: Bouwplan | null) => {
      if (klaar) return;
      klaar = true;
      timers.forEach(clearTimeout);
      if (p) resolve(p);
      else reject(laatsteFout);
    };
    const kijk = () => {
      if (klaar || grokLopend > 0) return;
      if (snelPlan) return einde(snelPlan);
      // Geen grok-4.5 meer bezig: eerst nog een grok-4.5-poging (als die kan), dan het snelle model.
      if (grokGestart < 2 && planRest() >= T.minGrokMs) return start("plannen");
      if (!snelGestart && planRest() >= T.minSnelMs) return start("snel");
      if (lopend === 0) einde(null);
    };
    const start = (rol: "plannen" | "snel") => {
      if (klaar) return;
      lopend++;
      if (rol === "plannen") {
        grokLopend++;
        grokGestart++;
      } else snelGestart = true;
      const route: PlanRoute = rol === "snel" ? "snel model" : grokGestart > 1 ? "plan-model (2e poging)" : "plan-model";
      const max = rol === "snel" ? PLAN.reserveTimeoutMs : PLAN.timeoutMs;
      roep(rol, () => Math.min(planRest(), max))
        .then(
          (p) => {
            if (rol === "plannen") einde({ ...p, route });
            else snelPlan = { ...p, route };
          },
          (e) => {
            laatsteFout = e;
            if (!klaar) console.warn(`[bouwplan] plan-aanroep (${route}) mislukt:`, e instanceof Error ? e.message.slice(0, 120) : e);
          },
        )
        .finally(() => {
          lopend--;
          if (rol === "plannen") grokLopend--;
          kijk();
        });
    };
    if (planRest() < T.minSnelMs) return einde(null);
    start("plannen");
    timers.push(setTimeout(() => !klaar && grokGestart < 2 && planRest() >= T.minGrokMs && start("plannen"), T.tweedePogingNaMs));
    timers.push(setTimeout(() => !klaar && !snelGestart && planRest() >= T.minSnelMs && start("snel"), T.snelNaMs));
  });
}

/** Plan als compacte rijen (zelfde formaat als de plan-aanroep), voor de kritiek-aanroep. */
export function planAlsRijen(plan: Bouwplan): string {
  return plan.items.map((it) => `${it.n}: ${JSON.stringify([it.par, it.vorm, it.rtti, it.punten, it.begrip, it.context, it.persoon ?? "", it.kern, it.antwoord, it.groep ?? ""])}`).join("\n");
}

export function kritiekPrompt(plan: Bouwplan): string {
  return `OPDRACHT NU: controleer dit BOUWPLAN streng op dubbelingen (rijformaat: [paragraaf, vorm, rtti, punten, kernbegrip, situatie, persoon, vraag, antwoord, groep]):
${planAlsRijen(plan)}

Zoek rijen die hetzelfde toetsen als een eerdere rij: hetzelfde begrip of dezelfde regel/redenering (ook in andere woorden, bijv. "Fres = 0 → stilstand" en "evenwicht"), hetzelfde soort situatie, of een rij die het antwoord van een andere rij verklapt. Vervang telkens de LAATSTE rij van zo'n paar door een nieuwe rij uit DEZELFDE paragraaf over een ander onderdeel/leerdoel uit de lesstof dat nog niet getoetst wordt (zelfde vorm, rtti en punten; nieuwe situatie; persoon uit de namenlijst die nog niet gebruikt is, of leeg).
Geen dubbelingen gevonden: lege lijst. Antwoord met ALLEEN JSON: {"vervang":[{"n":<rijnummer>,"waarom":"<kort>","rij":[…10 velden…]}]}`;
}

/** Vervangingen uit de kritiek toepassen (alleen geldige rijen; paragraaf blijft gelijk). */
export function pasKritiekToe(plan: Bouwplan, u: unknown): { plan: Bouwplan; vervangen: string[] } {
  const lijst = (u && typeof u === "object" && Array.isArray((u as { vervang?: unknown }).vervang) ? (u as { vervang: unknown[] }).vervang : []).slice(0, Math.ceil(plan.items.length / 3));
  const items = [...plan.items];
  const vervangen: string[] = [];
  for (const v of lijst) {
    if (!v || typeof v !== "object") continue;
    const o = v as { n?: unknown; waarom?: unknown; rij?: unknown };
    const i = items.findIndex((x) => x.n === Number(o.n));
    const nieuw = itemVan(o.rij, i);
    if (i < 0 || !nieuw) continue;
    const oud = items[i]!;
    items[i] = { ...nieuw, n: oud.n, par: oud.par, vorm: oud.vorm, rtti: oud.rtti, punten: oud.punten, groep: oud.groep };
    vervangen.push(`${oud.n} (${oud.begrip} → ${nieuw.begrip}): ${s(o.waarom, 80)}`);
  }
  return { plan: { ...plan, items }, vervangen };
}

/** Kritiek-aanroep: semantische dubbelingen die code niet ziet. Mislukt → plan ongewijzigd. */
export async function kritiseerBouwplan(opts: { system: string; voorvoegsel: string; plan: Bouwplan; rest: () => number; kosten?: Kosten }): Promise<{ plan: Bouwplan; vervangen: string[] }> {
  try {
    return await vraagJson("plannen", berichten(opts.system, `${opts.voorvoegsel}${CACHE_GRENS}${kritiekPrompt(opts.plan)}`), (u) => pasKritiekToe(opts.plan, u), {
      maxTokens: 2500,
      rest: () => Math.min(opts.rest(), PLAN.kritiekTimeoutMs),
      kosten: opts.kosten,
      herkansingMinRestMs: 10 ** 9,
    });
  } catch {
    return { plan: opts.plan, vervangen: [] };
  }
}
