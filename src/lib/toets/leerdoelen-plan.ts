/**
 * Officiële leerdoelen per toets: deterministische keuze uit de statische koppeling
 * (leerdoelen-data.ts), promptblok, lokale controle/herstel van leerdoelId's en dekking.
 * Geen extra modelaanroepen: alles is vooraf berekend.
 */
import type { Kwaliteitscheck, LeerdoelPlan, Leerweg, PlanLeerdoel, Vraag } from "./types";
import { EINDTERMEN, KERNDOELEN, LEERDOELEN_BRON, NOVA_LEERDOEL_KOPPELING, ONDERWERP_KOPPELING, type LeerdoelData } from "./leerdoelen-data.ts";
import { vindNovaHoofdstuk } from "./kalibratie.ts";
import { VRAAGTYPEN } from "./kalibratie-data.ts";
import { extractParagrafen } from "./leerdoelen.ts";

function kaal(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();
}

/** Alle leerdoelen die voor deze klas/leerweg gelden (klas 1–2: kerndoelen; klas 3–4: eindtermen). */
export function leerdoelenPool(leerjaar: number, leerweg: Leerweg): LeerdoelData[] {
  const pool = leerjaar <= 2 ? KERNDOELEN : EINDTERMEN;
  return pool.filter((d) => d.leerwegen.includes(leerweg));
}

/** Aantal leerdoelen per toets: genoeg om te spreiden, niet zoveel dat elk doel één vraag krijgt. */
export function maxLeerdoelen(aantalVragen: number): number {
  return Math.max(3, Math.min(8, Math.round(aantalVragen / 2.5)));
}

function telTreffers(re: RegExp, tekst: string): number {
  return (tekst.match(new RegExp(re.source, "gi")) ?? []).length;
}

/** Punten over doelen verdelen naar gewicht (grootste-restmethode), elk doel minstens 1 punt. */
export function verdeelPunten(gewichten: number[], totaal: number): number[] {
  const n = gewichten.length;
  if (!n) return [];
  const basis = Math.min(n, totaal);
  const rest = Math.max(0, totaal - basis);
  const som = gewichten.reduce((s, g) => s + g, 0) || 1;
  const ruw = gewichten.map((g) => (g / som) * rest);
  const uit = ruw.map((r, i) => Math.floor(r) + (i < basis ? 1 : 0));
  let over = totaal - uit.reduce((s, x) => s + x, 0);
  const volgorde = ruw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; over > 0 && k < volgorde.length; k++, over--) uit[volgorde[k]![1]]! += 1;
  return uit;
}

const TYPE_FREQ = new Map(VRAAGTYPEN.map((t) => [t.id, t.niveaus] as const));

/** 0,7 (zelden op het CSE) … 1,3 (vaak op het CSE), op basis van de vraagtypen van het doel. */
export function examenFactor(d: LeerdoelData, leerweg: Leerweg): number {
  const f = Math.max(0, ...d.typen.map((t) => TYPE_FREQ.get(t)?.[leerweg] ?? 0));
  return 0.7 + 0.6 * Math.min(1, f / (leerweg === "BB" ? 12 : leerweg === "KB" ? 16 : 30));
}

export interface PlanInput {
  titel?: string;
  bron: string;
  antwoorden?: string;
  leerjaar: number;
  leerweg: Leerweg;
  doelPunten: number;
  aantalVragen: number;
}

/**
 * Leerdoelen voor deze toets. Zelfde hoofdstuk + klas + leerweg (+ zelfde paragrafen in de lesstof)
 * → altijd dezelfde doelen en dezelfde puntenverdeling.
 * 1. Nova-hoofdstuk herkend → koppeling per paragraaf (alleen de paragrafen die in de lesstof staan).
 * 2. Anders onderwerp uit de titel (o.a. BB klas 3–4).
 * 3. Anders kernwoorden van de leerdoelen in de lesstof.
 */
export function maakLeerdoelPlan(input: PlanInput): LeerdoelPlan | null {
  const pool = leerdoelenPool(input.leerjaar, input.leerweg);
  if (!pool.length) return null;
  const perId = new Map(pool.map((d) => [d.id, d]));
  const gewicht = new Map<string, number>();
  const plus = (id: string, g: number) => {
    if (perId.has(id)) gewicht.set(id, (gewicht.get(id) ?? 0) + g);
  };
  let herkomst = "";
  const titel = input.titel ?? "";
  const hit = vindNovaHoofdstuk(titel, input.bron, input.leerjaar, input.leerweg);
  const koppeling = hit ? NOVA_LEERDOEL_KOPPELING[`${hit.serie}:${hit.hoofdstuk.n}`] : undefined;
  if (hit && koppeling) {
    const inBron = extractParagrafen(input.bron, input.antwoorden)
      .filter((p) => Number(p.code.split(".")[0]) === hit.hoofdstuk.n)
      .map((p) => Number(p.code.split(".")[1]));
    const pars = Object.keys(koppeling).map(Number).filter((n) => !inBron.length || inBron.includes(n));
    for (const n of pars) (koppeling[n] ?? []).forEach((id, i) => plus(id, i === 0 ? 1 : 0.6));
    herkomst = `Nova H${hit.hoofdstuk.n} ${hit.hoofdstuk.titel}${inBron.length && inBron.length < Object.keys(koppeling).length ? ` (§ ${pars.map((n) => `${hit.hoofdstuk.n}.${n}`).join(", ")})` : ""}`;
  }
  if (!gewicht.size) {
    const kop = kaal(titel);
    const onderwerp = input.leerjaar >= 3 ? ONDERWERP_KOPPELING.find((o) => new RegExp(o.re, "i").test(kop) && o.doelen[input.leerweg]?.length) : undefined;
    if (onderwerp) {
      onderwerp.doelen[input.leerweg]!.forEach((id, i) => plus(id, Math.max(0.4, 1 - i * 0.1)));
      herkomst = `onderwerp ${onderwerp.naam}`;
    }
  }
  if (!gewicht.size) {
    const tekst = kaal(`${titel} ${titel} ${titel}\n${input.bron.slice(0, 30000)}`);
    const scores = pool
      .map((d) => [d, telTreffers(new RegExp(d.kw, "i"), tekst)] as const)
      .filter(([, s]) => s >= 3)
      .sort((a, b) => b[1] - a[1]);
    for (const [dd, s] of scores) plus(dd.id, Math.min(3, s / 5));
    if (gewicht.size) herkomst = "kernwoorden in de lesstof";
  }
  if (!gewicht.size) return null;
  // Klas 3–4: doelen die vaak op het examen komen (CSE-frequentie van hun vraagtypen) wegen iets zwaarder.
  if (input.leerjaar >= 3) for (const [id, g] of gewicht) gewicht.set(id, g * examenFactor(perId.get(id)!, input.leerweg));
  const volgorde = [...gewicht.keys()];
  const gekozen = [...gewicht.entries()]
    .sort((a, b) => b[1] - a[1] || volgorde.indexOf(a[0]) - volgorde.indexOf(b[0]))
    .slice(0, Math.min(maxLeerdoelen(input.aantalVragen), Math.max(1, input.aantalVragen)));
  // Terug in syllabusvolgorde (leest prettiger op matrijs en in de prompt).
  const poolIdx = (id: string) => pool.findIndex((d) => d.id === id);
  gekozen.sort((a, b) => poolIdx(a[0]) - poolIdx(b[0]));
  const punten = verdeelPunten(
    gekozen.map(([, g]) => g),
    Math.max(gekozen.length, Math.round(input.doelPunten)),
  );
  const doelen: PlanLeerdoel[] = gekozen.map(([id], i) => {
    const dd = perId.get(id)!;
    return { id, tekst: dd.tekst, deel: dd.deel, typen: dd.typen, doelPunten: punten[i]!, ...(dd.wettelijk ? { wettelijk: dd.wettelijk } : {}) };
  });
  const onderbouw = input.leerjaar <= 2;
  return {
    bron: onderbouw ? "kerndoelen" : "syllabus",
    bronTitel: onderbouw ? LEERDOELEN_BRON.kerndoelen.titel : LEERDOELEN_BRON.syllabus.titel,
    herkomst,
    leerweg: input.leerweg,
    leerjaar: input.leerjaar,
    doelen,
  };
}

/** Promptblok: de doelen met puntdoel; elk item krijgt precies één leerdoelId uit de lijst. */
export function leerdoelenPrompt(plan: LeerdoelPlan | null, deel = false): string {
  if (!plan?.doelen.length) return "";
  const bron = plan.bron === "kerndoelen" ? "SLO-kerndoelen onderbouw (concept 2025), losjes gekoppeld" : `syllabus NaSk1 centraal examen · ${plan.leerweg}`;
  const regels = plan.doelen.map((d) => `- ${d.id} (${d.deel === "KD" ? "kerndoel" : d.deel}) ${d.tekst} — ~${d.doelPunten} p; past bij ${d.typen.filter((t) => t !== "OVERIG").join(", ") || "eigen vraagvorm"}`);
  return [
    `LEERDOELEN (officieel, ${bron}; verplicht): elke vraag krijgt veld leerdoelId = precies één id uit deze lijst (bijv. "${plan.doelen[0]!.id}"). ${
      deel ? "Dit deel levert zijn aandeel: label elke vraag en spreid over de doelen." : "Toets elk leerdoel met minstens één vraag en verdeel de punten ongeveer zo (± 2 per doel)."
    } Stem vraag en niveau af op het werkwoord van het doel (herkennen/noemen ≠ uitleggen/berekenen). Een vraag die bij geen van deze doelen past, hoort niet in de toets. Zet het id nooit in de vraagtekst.`,
    ...regels,
  ].join("\n");
}

/** "NASK1/K/8.4", "k8.4", "K/8/4" → "K/8.4"; "SLO 30C", "KD30C" → "SLO-30C". */
export function normaliseerLeerdoelId(raw: string | undefined | null): string {
  const s = (raw ?? "").toUpperCase().replace(/NASK1\s*\/?/g, "").replace(/\s+/g, "").trim();
  const m = s.match(/^([KV])\/?(\d{1,2})(?:[./](\d{1,2}))?$/);
  if (m) return m[3] ? `${m[1]}/${Number(m[2])}.${Number(m[3])}` : `${m[1]}/${Number(m[2])}`;
  const k = s.match(/^(?:SLO|KD|KERNDOEL)?-?(\d{2}[A-E])$/);
  if (k) return `SLO-${k[1]}`;
  return s;
}

function vraagTekst(q: Vraag): string {
  return kaal(`${q.context ?? ""} ${q.stam} ${q.leerdoel ?? ""} ${q.domein ?? ""} ${(q.opties ?? []).map((o) => o.tekst).join(" ")}`);
}

/**
 * Controleert leerdoelId's tegen het plan. Onbekend of ontbrekend → lokaal herstellen via het
 * vraagtype (koppeling doel ↔ typen), daarna kernwoorden, daarna het doel met het grootste puntentekort.
 */
export function herstelLeerdoelen(vragen: Vraag[], plan: LeerdoelPlan | null | undefined): { vragen: Vraag[]; hersteld: number[] } {
  if (!plan?.doelen.length) return { vragen, hersteld: [] };
  const ids = new Set(plan.doelen.map((d) => d.id));
  const kw = new Map(
    plan.doelen.map((d) => {
      const bron = [...EINDTERMEN, ...KERNDOELEN].find((x) => x.id === d.id && x.leerwegen.includes(plan.leerweg as Leerweg));
      return [d.id, bron ? new RegExp(bron.kw, "i") : null] as const;
    }),
  );
  const toegewezen = new Map<string, number>();
  const genormaliseerd = vragen.map((q) => normaliseerLeerdoelId(q.leerdoelId));
  genormaliseerd.forEach((id, i) => {
    if (ids.has(id)) toegewezen.set(id, (toegewezen.get(id) ?? 0) + (vragen[i]!.punten ?? 1));
  });
  const hersteld: number[] = [];
  const uit = vragen.map((q, i) => {
    const id = genormaliseerd[i]!;
    if (ids.has(id)) return id === q.leerdoelId ? q : { ...q, leerdoelId: id };
    const type = (q.vraagtype ?? "").toUpperCase();
    const tekst = vraagTekst(q);
    const opType = plan.doelen.filter((d) => type && type !== "OVERIG" && d.typen.includes(type));
    const kwScore = (d: PlanLeerdoel) => {
      const re = kw.get(d.id);
      return re ? telTreffers(re, tekst) : 0;
    };
    const opKw = plan.doelen.filter((d) => kwScore(d) > 0);
    const kandidaten = opType.length ? opType : opKw.length ? opKw : plan.doelen;
    const tekort = (d: PlanLeerdoel) => d.doelPunten - (toegewezen.get(d.id) ?? 0);
    const beste = [...kandidaten].sort((a, b) => kwScore(b) - kwScore(a) || tekort(b) - tekort(a) || plan.doelen.indexOf(a) - plan.doelen.indexOf(b))[0]!;
    toegewezen.set(beste.id, (toegewezen.get(beste.id) ?? 0) + (q.punten ?? 1));
    hersteld.push(q.nummer);
    return { ...q, leerdoelId: beste.id };
  });
  return { vragen: uit, hersteld };
}

export interface LeerdoelDekkingRij {
  id: string;
  tekst: string;
  deel: PlanLeerdoel["deel"];
  doelPunten: number;
  vragen: number[];
  punten: number;
}

/** Dekking per leerdoel (vragen + punten) en de doelen zonder vraag. */
export function leerdoelDekking(vragen: Vraag[], plan: LeerdoelPlan | null | undefined): { rijen: LeerdoelDekkingRij[]; ongedekt: LeerdoelDekkingRij[]; perVraag: Map<number, string> } {
  if (!plan?.doelen.length) return { rijen: [], ongedekt: [], perVraag: new Map() };
  const { vragen: vv } = herstelLeerdoelen(vragen, plan);
  const perVraag = new Map(vv.map((q) => [q.nummer, q.leerdoelId ?? ""]));
  const rijen = plan.doelen.map((d) => {
    const qs = vv.filter((q) => q.leerdoelId === d.id);
    return { id: d.id, tekst: d.tekst, deel: d.deel, doelPunten: d.doelPunten, vragen: qs.map((q) => q.nummer), punten: qs.reduce((s, q) => s + (q.punten ?? 1), 0) };
  });
  return { rijen, ongedekt: rijen.filter((r) => !r.vragen.length), perVraag };
}

/** Feedbackpunt "Leerdoelen" (dekking + herstelde labels). */
export function annoteerLeerdoelen(kwaliteit: Kwaliteitscheck, vragen: Vraag[], plan: LeerdoelPlan | null | undefined): Kwaliteitscheck {
  if (!plan?.doelen.length) return kwaliteit;
  const { rijen, ongedekt } = leerdoelDekking(vragen, plan);
  const scheef = rijen.filter((r) => r.vragen.length && Math.abs(r.punten - r.doelPunten) > Math.max(3, r.doelPunten * 0.6));
  const punt = {
    criterium: "Leerdoelen",
    oordeel: (ongedekt.length ? "aandacht" : "voldoet") as "aandacht" | "voldoet",
    toelichting: `${rijen.length - ongedekt.length} van ${rijen.length} leerdoelen getoetst (${plan.bron === "kerndoelen" ? "SLO-kerndoelen" : "syllabus NaSk1"}${plan.herkomst ? `, ${plan.herkomst}` : ""}).${
      ongedekt.length ? ` Niet getoetst: ${ongedekt.map((r) => r.id).join(", ")}.` : ""
    }${scheef.length ? ` Punten wijken af van de richtverdeling bij ${scheef.map((r) => `${r.id} (${r.punten}/${r.doelPunten} p)`).join(", ")}.` : ""}${plan.hersteld?.length ? ` Leerdoel lokaal toegekend bij vraag ${plan.hersteld.join(", ")}.` : ""}`,
  };
  return { samenvatting: kwaliteit.samenvatting, punten: [...(kwaliteit.punten ?? []).filter((p) => p.criterium !== punt.criterium), punt] };
}
