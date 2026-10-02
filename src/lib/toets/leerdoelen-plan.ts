/**
 * Officiële leerdoelen per toets: deterministische keuze uit de statische koppeling
 * (leerdoelen-data.ts), promptblok, lokale controle/herstel van leerdoelId's en dekking.
 * Geen extra modelaanroepen: alles is vooraf berekend.
 */
import type { Kwaliteitscheck, LeerdoelPlan, Leerweg, PlanLeerdoel, Vraag } from "./types";
import { EINDTERMEN, KERNDOELEN, LEERDOELEN_BRON, NOVA_LEERDOEL_KOPPELING, ONDERWERP_KOPPELING, type LeerdoelData } from "./leerdoelen-data.ts";
import { doelInLesstof, inhoudsWoorden, novaSerie, vindNovaHoofdstuk } from "./kalibratie.ts";
export { doelInLesstof } from "./kalibratie.ts";
import { NOVA_HOOFDSTUKKEN, NOVA_LEERDOELEN, VRAAGTYPEN } from "./kalibratie-data.ts";
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
  // Lesstof met meer hoofdstukken (bijv. H11 + H13): elk ander Nova-hoofdstuk waarvan de koppen in de lesstof staan,
  // telt mee naar rato van het aantal paragrafen — zo krijgt ook het tweede hoofdstuk zijn leerdoelen.
  for (const extra of andereNovaHoofdstukken(input, hit?.hoofdstuk.n)) {
    const k = NOVA_LEERDOEL_KOPPELING[`${extra.serie}:${extra.n}`]!;
    for (const n of extra.pars) (k[n] ?? []).forEach((id, i) => plus(id, i === 0 ? 1 : 0.6));
    herkomst = herkomst ? `${herkomst} + Nova H${extra.n} ${extra.titel}` : `Nova H${extra.n} ${extra.titel}`;
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
  if (gewicht.size) {
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

/**
 * Nova-hoofdstukken (naast het al gevonden hoofdstuk) die echt in de lesstof staan. Per lesstofhoofdstuk
 * (koppen n.x) zoeken we het Nova-hoofdstuk met de meeste overeenkomende paragraaftitels — op titel, niet op
 * nummer, want edities nummeren anders (bijv. "Kracht en beweging" is H11 in de ene en H16 in de andere uitgave).
 * pars = Nova-paragraafnummers die in de lesstof overeenkomen.
 */
export function andereNovaHoofdstukken(input: Pick<PlanInput, "bron" | "antwoorden" | "leerjaar" | "leerweg">, behalve?: number): { serie: string; n: number; titel: string; pars: number[] }[] {
  const serie = novaSerie(input.leerjaar, input.leerweg);
  if (!serie) return [];
  const perHoofdstuk = new Map<string, string[]>();
  for (const p of extractParagrafen(input.bron, input.antwoorden)) {
    const h = p.code.split(".")[0]!;
    perHoofdstuk.set(h, [...(perHoofdstuk.get(h) ?? []), kaal(p.titel)]);
  }
  const lijkt = (a: string, b: string) => a.length > 4 && b.length > 4 && (a.includes(b) || b.includes(a));
  const uit: { serie: string; n: number; titel: string; pars: number[] }[] = [];
  for (const titels of perHoofdstuk.values()) {
    let beste: { n: number; titel: string; pars: number[] } | null = null;
    for (const h of NOVA_HOOFDSTUKKEN[serie]) {
      if (!NOVA_LEERDOEL_KOPPELING[`${serie}:${h.n}`]) continue;
      const pars = h.paragrafen.filter((np) => titels.some((t) => lijkt(t, kaal(np.titel)))).map((np) => np.n);
      if (pars.length >= Math.min(2, h.paragrafen.length) && pars.length > (beste?.pars.length ?? 0)) beste = { n: h.n, titel: h.titel, pars };
    }
    if (beste && beste.n !== behalve && !uit.some((u) => u.n === beste!.n)) uit.push({ serie, ...beste });
  }
  return uit;
}

/**
 * Nova-leerdoelen per lesstofparagraaf (op titel gekoppeld, over alle hoofdstukken van de serie), voor het
 * bouwplan: elke vraag kiest een ander leerdoel, kernstof eerst. Geen treffer → paragraaf zonder lijst.
 */
/** Tekst van één lesstofparagraaf: van de kop "code titel" tot de volgende kop (leeg als de kop niet gevonden wordt). */
export function paragraafTekst(bron: string, p: { code: string; titel: string }, alle: { code: string; titel: string }[]): string {
  const kop = (x: { code: string; titel: string }) => {
    const i = bron.indexOf(`${x.code} ${x.titel}`);
    return i >= 0 ? i : bron.search(new RegExp(`(^|\\n)\\s*§?\\s*${x.code.replace(".", "\\.")}\\s`));
  };
  const start = kop(p);
  if (start < 0) return "";
  const volgende = alle.map(kop).filter((i) => i > start).sort((a, b) => a - b)[0] ?? bron.length;
  return bron.slice(start, volgende);
}

export function novaDoelenPerParagraaf(
  paragrafen: { code: string; titel: string }[],
  input: { titel?: string; bron: string; leerjaar: number; leerweg: Leerweg },
  max = 6,
): Record<string, string[]> {
  const serie = novaSerie(input.leerjaar, input.leerweg);
  if (!serie) return {};
  const doelen = NOVA_LEERDOELEN[serie] ?? {};
  const lijkt = (a: string, b: string) => a.length > 4 && b.length > 4 && (a === b || a.includes(b) || b.includes(a));
  const hoofdstukken = NOVA_HOOFDSTUKKEN[serie];
  // Per lesstofhoofdstuk het Nova-hoofdstuk: meeste titel-treffers, anders het herkende hoofdstuk (titel/lesstof).
  const hit = vindNovaHoofdstuk(input.titel ?? "", input.bron, input.leerjaar, input.leerweg);
  const perH = new Map<string, { code: string; titel: string }[]>();
  for (const p of paragrafen) perH.set(p.code.split(".")[0]!, [...(perH.get(p.code.split(".")[0]!) ?? []), p]);
  const uit: Record<string, string[]> = {};
  for (const pars of perH.values()) {
    let beste = hoofdstukken
      .map((h) => ({ h, n: pars.filter((p) => h.paragrafen.some((np) => lijkt(kaal(p.titel), kaal(np.titel)))).length }))
      .sort((x, y) => y.n - x.n)[0];
    if (!beste?.n && hit && perH.size === 1) beste = { h: hit.hoofdstuk, n: 0 };
    if (!beste || (!beste.n && !(hit && perH.size === 1))) continue;
    const h = beste.h;
    const tekst = (t: string) => t.replace(/^Je kunt /, "").replace(/\.?\s*PLUS\.?$/i, "").replace(/\.$/, "");
    const vanPar = (n: number) => Object.entries(doelen).filter(([c]) => c.startsWith(`${h.n}.${n}.`)).map(([, t]) => tekst(t));
    // Eerst op titel. Een paragraafnummer uit de lesstof hoeft niet het Nova-nummer te zijn (KB2 6.4
    // "Geluidssnelheid" ≠ Nova 8.4 "Geluidsoverlast verminderen"), dus nooit op nummer. Zonder titeltreffer:
    // elk overgebleven Nova-doel naar de lesstofparagraaf wiens tekst het het best behandelt (≥ 60 % van de
    // onderscheidende inhoudswoorden; woorden die in de helft van de paragrafen staan tellen niet).
    const toegekend = new Set<string>();
    const zonderTitel: { code: string; tekst: string }[] = [];
    for (const p of pars) {
      const np = h.paragrafen.find((x) => lijkt(kaal(p.titel), kaal(x.titel)));
      if (!np) {
        const t = paragraafTekst(input.bron, p, paragrafen);
        if (t.length >= 150) zonderTitel.push({ code: p.code, tekst: t.toLowerCase() });
        continue;
      }
      const lijst = vanPar(np.n).filter((t) => doelInLesstof(t, input.bron)).slice(0, max);
      for (const t of lijst) toegekend.add(t);
      if (lijst.length) uit[p.code] = lijst;
    }
    if (zonderTitel.length) {
      const secties = pars.map((p) => paragraafTekst(input.bron, p, paragrafen).toLowerCase()).filter(Boolean);
      const algemeen = (w: string) => secties.filter((t) => t.includes(w.slice(0, 5))).length > secties.length / 2;
      for (const t of h.paragrafen.flatMap((x) => vanPar(x.n))) {
        if (toegekend.has(t)) continue;
        const woorden = inhoudsWoorden(t).filter((w) => !algemeen(w));
        if (!woorden.length) continue;
        const scores = zonderTitel.map((z) => ({ z, f: woorden.filter((w) => z.tekst.includes(w.slice(0, 5))).length / woorden.length }));
        const beste = scores.sort((a, b) => b.f - a.f)[0]!;
        if (beste.f < 0.6 || (uit[beste.z.code]?.length ?? 0) >= max) continue;
        uit[beste.z.code] = [...(uit[beste.z.code] ?? []), t];
        toegekend.add(t);
      }
    }
  }
  return uit;
}

/** Promptblok: de doelen met puntdoel; elk item krijgt precies één leerdoelId uit de lijst. */
export function leerdoelenPrompt(plan: LeerdoelPlan | null, deel = false): string {
  if (!plan?.doelen.length) return "";
  const bron = plan.bron === "kerndoelen" ? "SLO-kerndoelen onderbouw (concept 2025), losjes gekoppeld" : `syllabus NaSk1 centraal examen · ${plan.leerweg}`;
  const regels = plan.doelen.map((d) => `- ${d.id} (${d.deel === "KD" ? "kerndoel" : d.deel}) ${d.tekst} — ~${d.doelPunten} p; past bij ${d.typen.filter((t) => t !== "OVERIG").join(", ") || "eigen vraagvorm"}`);
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
