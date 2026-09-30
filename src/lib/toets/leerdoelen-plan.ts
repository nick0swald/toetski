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
  /** Zonder plaatjes: tekendoelen alleen via een tekenvak (leeg antwoordkader). */
  zonderPlaatjes?: boolean;
}

/** Vraagtypen die een tekening vragen (vector, krachtenschaal, parallellogram, arm tekenen). */
export const TEKEN_TYPEN = new Set(["K-VECT", "K-RES", "K-SCHAAL", "K-ARM"]);
export function isTekenDoel(typen: string[]): boolean {
  const t = typen.filter((x) => x !== "OVERIG");
  return t.length > 0 && t.every((x) => TEKEN_TYPEN.has(x));
}

/** Lesstof opdelen in paragrafen (kop + tekst) op de koppen die extractParagrafen herkent. */
export function paragraafTeksten(bron: string, antwoorden?: string): { code: string; titel: string; tekst: string }[] {
  const pars = extractParagrafen(bron);
  if (pars.length < 2) return [];
  const regels = bron.split(/\r?\n/);
  const uit = pars.map((p) => ({ ...p, tekst: "" }));
  let huidig: (typeof uit)[number] | undefined;
  for (const r of regels) {
    const line = r.replace(/\s+/g, " ").trim();
    const m = line.match(/^(?:paragraaf\s+|§\s*)?(\d{1,2})\.(\d{1,2})\.?\s+/);
    const kop = m ? uit.find((p) => p.code === `${Number(m[1])}.${Number(m[2])}` && line.length < 80) : undefined;
    if (kop) {
      huidig = kop;
      continue;
    }
    if (huidig) huidig.tekst += ` ${line}`;
  }
  void antwoorden;
  return uit;
}

/**
 * Doelen per paragraaf uit de eigen lesstof: score = 3 × treffers in de kop + treffers in de tekst.
 * Per paragraaf de beste twee doelen (score ≥ 2). Geen doelen van buiten de lesstof (r236: katrol in H3 zonder katrol).
 */
export function doelenUitLesstof(pool: LeerdoelData[], bron: string, antwoorden?: string): { id: string; gewicht: number; par: string }[] {
  const pars = paragraafTeksten(bron, antwoorden);
  // Alleen koppen zonder tekst (inhoudsopgave): dan geeft de Nova-koppeling een beter beeld.
  if (pars.filter((p) => p.tekst.trim().length >= 120).length < Math.max(2, pars.length / 2)) return [];
  const uit: { id: string; gewicht: number; par: string }[] = [];
  for (const p of pars) {
    const kop = kaal(p.titel);
    const tekst = kaal(p.tekst);
    const scores = pool
      .map((d) => {
        const re = new RegExp(d.kw, "i");
        return [d, 3 * telTreffers(re, kop) + telTreffers(re, tekst)] as const;
      })
      .filter(([, s]) => s >= 1)
      .sort((a, b) => b[1] - a[1]);
    // Beste doel (score ≥ 2) + hooguit twee die ook echt in de tekst genoemd worden.
    const beste = scores[0];
    if (!beste || beste[1] < 2) continue;
    // Bijdoelen alleen uit hetzelfde domein (K-…): 'constante snelheid' in §Krachten samenstellen is geen snelheidsdoel.
    const dom = new Set(beste[0].typen.map((t) => t.split("-")[0]));
    const bij = scores.slice(1).filter(([d, sc]) => sc >= 2 || d.typen.some((t) => dom.has(t.split("-")[0])));
    [beste, ...bij.slice(0, 2)].forEach(([d], i) => uit.push({ id: d.id, gewicht: [1, 0.6, 0.4][i]!, par: p.code }));
  }
  return uit;
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
  // 1. Eigen paragrafen in de lesstof → doelen uit de tekst van die paragrafen (leidend).
  const eigen = doelenUitLesstof(pool, input.bron, input.antwoorden);
  if (eigen.length) {
    // Een doel dat in veel paragrafen terugkomt (krachten herkennen) krijgt niet alle punten.
    for (const e of eigen) gewicht.set(e.id, Math.min(1.6, (gewicht.get(e.id) ?? 0) + e.gewicht));
    const codes = [...new Set(eigen.map((e) => e.par))];
    herkomst = `lesstof § ${codes[0]}–${codes[codes.length - 1]}`;
  }
  const hit = gewicht.size ? null : vindNovaHoofdstuk(titel, input.bron, input.leerjaar, input.leerweg);
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
  // Lesstof-aanvulling: paragraafkoppen in de lesstof die een doel noemen dat nog ontbreekt (bijv. "3.6 Druk").
  if (gewicht.size && !eigen.length) {
    let extra = 0;
    for (const p of extractParagrafen(input.bron, input.antwoorden)) {
      const kop = kaal(p.titel);
      const nieuw = pool.find((d) => !gewicht.has(d.id) && d.deel !== "KD" && new RegExp(`(^|\\s)(${d.kw})`, "i").test(kop));
      if (nieuw) {
        plus(nieuw.id, 0.8);
        extra++;
      }
    }
    if (extra) herkomst += " + lesstofkoppen";
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
    return { id, tekst: dd.tekst, deel: dd.deel, typen: dd.typen, doelPunten: punten[i]!, ...(dd.wettelijk ? { wettelijk: dd.wettelijk } : {}), ...(isTekenDoel(dd.typen) ? { tekenen: true } : {}) };
  });
  const onderbouw = input.leerjaar <= 2;
  return {
    bron: onderbouw ? "kerndoelen" : "syllabus",
    bronTitel: onderbouw ? LEERDOELEN_BRON.kerndoelen.titel : LEERDOELEN_BRON.syllabus.titel,
    herkomst,
    leerweg: input.leerweg,
    leerjaar: input.leerjaar,
    doelen,
    ...(input.zonderPlaatjes ? { zonderPlaatjes: true } : {}),
  };
}

/** Promptblok: de doelen met puntdoel; elk item krijgt precies één leerdoelId uit de lijst. */
export function leerdoelenPrompt(plan: LeerdoelPlan | null, deel = false): string {
  if (!plan?.doelen.length) return "";
  const bron = plan.bron === "kerndoelen" ? "SLO-kerndoelen onderbouw (concept 2025), losjes gekoppeld" : `syllabus NaSk1 centraal examen · ${plan.leerweg}`;
  const regels = plan.doelen.map(
    (d) =>
      `- ${d.id} (${d.deel === "KD" ? "kerndoel" : d.deel}) ${d.tekst} — ~${d.doelPunten} p; past bij ${d.typen.filter((t) => t !== "OVERIG").join(", ") || "eigen vraagvorm"}${
        d.tekenen && plan.zonderPlaatjes ? " — zonder plaatjes: toets dit met een TEKENVRAAG (veld tekenvak: leeg raster, schaal in de stam, rubriek per element)" : ""
      }`,
  );
  return [
    `LEERDOELEN (achtergrond voor toetsopbouw en nakijkmodel, ${bron}; verplicht): elke vraag krijgt veld leerdoelId = precies één id uit deze lijst (bijv. "${plan.doelen[0]!.id}"). ${
      deel ? "Dit deel levert zijn aandeel: label elke vraag en spreid over de doelen." : "Toets elk leerdoel met minstens één vraag en verdeel de punten ongeveer zo (± 2 per doel)."
    } De leerling ziet de doelen NOOIT: geen codes, geen syllabus- of kerndoeltaal ("eindterm", "de kandidaat kan", "CE") in context, stam, opties of modelantwoord. Formuleer elke vraag in de woorden, begrippen en voorbeelden van de lesstof/het Nova-hoofdstuk, in de vertrouwde schooltoetsstijl. Niveau = de lesstof van deze klas: niet moeilijker of abstracter dan het boek; een doel dat verder gaat dan de lesstof toets je alleen op het niveau van de lesstof. Een vraag die bij geen van deze doelen past, hoort niet in de toets.`,
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

const JARGON = String.raw`\b(?:NASK1\/)?[KV]\/\d{1,2}(?:\.\d{1,2})?\b|\bSLO-\d{2}[A-E]\b|\beindterm(?:en)?\b|\bde kandidaat kan\b|\bkerndoel(?:en)?\b|\bsyllabus\b`;

function schoonTekst(t: string): string {
  if (!new RegExp(JARGON, "i").test(t)) return t;
  return t
    .replace(new RegExp(JARGON, "gi"), "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:?])/g, "$1")
    .trim();
}

/** Haalt doelcodes/syllabustaal uit leerlingtekst (context, stam, opties); verder blijft de vraag gelijk. */
export function zonderDoelJargon(vragen: Vraag[]): Vraag[] {
  return vragen.map((q) => ({
    ...q,
    ...(q.context ? { context: schoonTekst(q.context) } : {}),
    stam: schoonTekst(q.stam),
    ...(q.opties ? { opties: q.opties.map((o) => ({ ...o, tekst: schoonTekst(o.tekst) })) } : {}),
  }));
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
export function leerdoelDekking(
  vragen: Vraag[],
  plan: LeerdoelPlan | null | undefined,
): { rijen: LeerdoelDekkingRij[]; ongedekt: LeerdoelDekkingRij[]; alleenTekening: LeerdoelDekkingRij[]; perVraag: Map<number, string> } {
  if (!plan?.doelen.length) return { rijen: [], ongedekt: [], alleenTekening: [], perVraag: new Map() };
  const { vragen: vv } = herstelLeerdoelen(vragen, plan);
  const perVraag = new Map(vv.map((q) => [q.nummer, q.leerdoelId ?? ""]));
  const rijen = plan.doelen.map((d) => {
    const qs = vv.filter((q) => q.leerdoelId === d.id);
    return { id: d.id, tekst: d.tekst, deel: d.deel, doelPunten: d.doelPunten, vragen: qs.map((q) => q.nummer), punten: qs.reduce((s, q) => s + (q.punten ?? 1), 0) };
  });
  const tekenOnly = new Set(plan.zonderPlaatjes ? plan.doelen.filter((d) => d.tekenen).map((d) => d.id) : []);
  return { rijen, ongedekt: rijen.filter((r) => !r.vragen.length && !tekenOnly.has(r.id)), alleenTekening: rijen.filter((r) => !r.vragen.length && tekenOnly.has(r.id)), perVraag };
}

/** Feedbackpunt "Leerdoelen" (dekking + herstelde labels). */
export function annoteerLeerdoelen(kwaliteit: Kwaliteitscheck, vragen: Vraag[], plan: LeerdoelPlan | null | undefined): Kwaliteitscheck {
  if (!plan?.doelen.length) return kwaliteit;
  const { rijen, ongedekt, alleenTekening } = leerdoelDekking(vragen, plan);
  const scheef = rijen.filter((r) => r.vragen.length && Math.abs(r.punten - r.doelPunten) > Math.max(3, r.doelPunten * 0.6));
  const getoetst = rijen.length - ongedekt.length - alleenTekening.length;
  const punt = {
    criterium: "Leerdoelen",
    oordeel: (ongedekt.length ? "aandacht" : "voldoet") as "aandacht" | "voldoet",
    toelichting: `${getoetst} van ${rijen.length - alleenTekening.length} leerdoelen getoetst (${plan.bron === "kerndoelen" ? "SLO-kerndoelen" : "syllabus NaSk1"}${plan.herkomst ? `, ${plan.herkomst}` : ""}).${
      ongedekt.length ? ` Niet getoetst: ${ongedekt.map((r) => r.id).join(", ")}.` : ""
    }${alleenTekening.length ? ` Alleen met een tekening toetsbaar (toets zonder plaatjes): ${alleenTekening.map((r) => r.id).join(", ")}.` : ""}${scheef.length ? ` Punten wijken af van de richtverdeling bij ${scheef.map((r) => `${r.id} (${r.punten}/${r.doelPunten} p)`).join(", ")}.` : ""}${plan.hersteld?.length ? ` Leerdoel lokaal toegekend bij vraag ${plan.hersteld.join(", ")}.` : ""}`,
  };
  return { samenvatting: kwaliteit.samenvatting, punten: [...(kwaliteit.punten ?? []).filter((p) => p.criterium !== punt.criterium), punt] };
}

/**
 * Dekking afdwingen: een doel uit de lesstof zonder vraag → een vraag van het ruimst gedekte doel
 * vervangen door een vraag over het ontbrekende doel (zelfde punten). Tekendoelen zonder plaatjes:
 * als tekenvraag (tekenvak), anders geen gat.
 */
export function leerdoelIssues(vragen: Vraag[], plan: LeerdoelPlan | null | undefined, vermijd: Set<number> = new Set(), max = 2): { nummer: number; code: string; uitleg: string }[] {
  if (!plan?.doelen.length) return [];
  const { vragen: vv } = herstelLeerdoelen(vragen, plan);
  const perDoel = new Map(plan.doelen.map((d) => [d.id, vv.filter((q) => q.leerdoelId === d.id)]));
  const leeg = plan.doelen.filter((d) => !perDoel.get(d.id)!.length);
  const out: { nummer: number; code: string; uitleg: string }[] = [];
  const gebruikt = new Set(vermijd);
  for (const d of leeg) {
    if (out.length >= max) break;
    const donorDoel = plan.doelen
      .map((x) => ({ x, qs: perDoel.get(x.id)!, over: perDoel.get(x.id)!.reduce((s, q) => s + (q.punten ?? 1), 0) - x.doelPunten }))
      .filter((r) => r.qs.length >= 2)
      .sort((a, b) => b.over - a.over || b.qs.length - a.qs.length)[0];
    const donor = donorDoel?.qs.filter((q) => !gebruikt.has(q.nummer) && !q.figuur && !q.figuurId && !q.pictogram).sort((a, b) => Math.abs((a.punten ?? 1) - d.doelPunten) - Math.abs((b.punten ?? 1) - d.doelPunten))[0];
    if (!donor || !donorDoel) break;
    gebruikt.add(donor.nummer);
    perDoel.set(donorDoel.x.id, donorDoel.qs.filter((q) => q.nummer !== donor.nummer));
    const teken = d.tekenen && plan.zonderPlaatjes;
    out.push({
      nummer: donor.nummer,
      code: "dekking",
      uitleg: `Leerdoel ${d.id} (${d.tekst}) uit de lesstof heeft nog geen vraag; ${donorDoel.x.id} heeft er ${donorDoel.qs.length}. Vervang deze vraag door een nieuwe vraag over ${d.id} (leerdoelId "${d.id}", ${donor.punten ?? 1} punt${(donor.punten ?? 1) === 1 ? "" : "en"}, in de woorden van de lesstof)${
        teken ? ": een TEKENVRAAG met veld tekenvak (leeg raster), de schaal in de stam (bijv. 1 cm ≙ 10 N) en een rubriek per getekend element" : ""
      }. Kies een situatie die nog niet in de toets staat.`,
    });
  }
  return out;
}
