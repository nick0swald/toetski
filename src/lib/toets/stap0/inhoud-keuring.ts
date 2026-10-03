/**
 * Inhoudelijke keuringen op een gegenereerde stap-0-spec (deterministisch, geen API):
 * figuurverwijzingen, samenhang binnen een vraagstuk, 1-punts reproductievragen, stof buiten de lesstof, afronding,
 * paragraafdekking op inhoud (niet alleen op het label) en getal-weggevers binnen één context.
 */
import type { FiguurSpec, Parameter, VraagstukSpec } from "./spec.ts";
import { getalInTekst } from "./reken.ts";
import { extractParagrafen } from "../leerdoelen.ts";
import { woorden } from "../eval/rubric.ts";

export interface Bevinding {
  /** Deelvraag-id (of vraagstuk-id). */
  id: string;
  vraagstuk: string;
  tekst: string;
}

type Deelvraag = VraagstukSpec["deelvragen"][number];
const kaal = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const eigenTekst = (d: Deelvraag) => kaal([...(d.context ?? []), d.stam].join(" "));
const alleTekst = (d: Deelvraag) => kaal([...(d.context ?? []), d.stam, ...(d.opties ?? []), ...(d.tabel ?? []).flat()].join(" "));
const norm = (s: string) => kaal(s).toLowerCase().replace(/[^a-zà-ÿ0-9\s]/g, " ").replace(/\s+/g, " ");

// ── 4. figuurverwijzingen ────────────────────────────────────────────────────────────────────────
const VERWIJS_FIG =
  /\b(?:de|deze|het|die|onderstaande|bovenstaande|zie|in|uit|op)\s+(?:figuur|afbeelding|diagram|grafiek|tekening|oscilloscoopbeeld|schakelschema|schema|assenstelsel|maatcilinder)\b|\bfiguur\s+\d|\b(?:hieronder|hiernaast|hierboven)\b|\bje ziet\s+(?:hier\s+)?(?:een|het|de|twee|drie|vier)?\s*(?:figuur|grafiek|diagram|oscilloscoopbeeld|beelden?|schema|tekening|afbeelding|maatcilinder|krachten)/i;
const VERWIJS_TABEL = /\b(?:de|deze|het|onderstaande|bovenstaande|zie|in|uit)\s+tabel\b|\btabel\s+\d/i;
const LETTERS = /\b(?:beeld|beelden|diagram|diagrammen|grafiek|grafieken|figuur|figuren|oscilloscoopbeeld(?:en)?)\s+([A-F])(?:\s*(?:–|-|t\/m|tot en met|en|,)\s*([A-F]))?\b/gi;

const panelLabels = (f?: FiguurSpec): string[] =>
  !f ? [] : f.type === "oscilloscoop" ? f.panelen.map((p) => p.label ?? "").filter(Boolean) : f.type === "grafiek" ? (f.panelen ?? []).map((p) => p.label) : f.type === "maatcilinder" ? f.cilinders.map((c) => c.label ?? "").filter(Boolean) : [];

/** Elke verwijzing naar een figuur/tabel (ook "beeld A–D") moet een bestaande figuur of tabel in het vraagstuk hebben. */
export function zoekFiguurVerwijzingen(vs: VraagstukSpec[]): Bevinding[] {
  const uit: Bevinding[] = [];
  for (const v of vs) {
    const figs: FiguurSpec[] = v.figuur ? [v.figuur] : [];
    let tabel = false;
    v.deelvragen.forEach((d, i) => {
      if (d.figuur) figs.push(d.figuur);
      if (d.tabel?.length) tabel = true;
      const t = eigenTekst(d) + (i === 0 ? " " + kaal(v.context.join(" ")) : "");
      const teken = /\b(teken|schets)\b/i.test(d.stam);
      if (VERWIJS_FIG.test(t) && !figs.length && !(teken && /\bmaak een (grafiek|diagram)\b/i.test(t)))
        uit.push({ id: d.id, vraagstuk: v.id, tekst: `${d.id}: verwijst naar een figuur ("${(VERWIJS_FIG.exec(t) ?? [""])[0]}"), maar het vraagstuk heeft (tot hier) geen figuur; voeg de figuur toe of haal de verwijzing weg` });
      if (VERWIJS_TABEL.test(t) && !tabel) uit.push({ id: d.id, vraagstuk: v.id, tekst: `${d.id}: verwijst naar een tabel, maar er is geen tabel; voeg "tabel" toe of haal de verwijzing weg` });
      const labels = new Set(figs.flatMap(panelLabels).map((l) => l.toUpperCase()));
      const nodig = new Set<string>();
      for (const m of `${t} ${(d.opties ?? []).join(" ")}`.matchAll(LETTERS)) {
        const a = m[1]!.toUpperCase().charCodeAt(0);
        const b = (m[2] ?? m[1]!).toUpperCase().charCodeAt(0);
        for (let c = Math.min(a, b); c <= Math.max(a, b); c++) nodig.add(String.fromCharCode(c));
      }
      const mist = [...nodig].filter((l) => !labels.has(l));
      if (mist.length) uit.push({ id: d.id, vraagstuk: v.id, tekst: `${d.id}: verwijst naar ${[...nodig].join(", ")} (figuren/beelden), maar ${mist.join(", ")} bestaan niet in een figuur van dit vraagstuk; gebruik panelen met die labels` });
    });
  }
  return uit;
}

// ── 3. samenhang binnen een vraagstuk ────────────────────────────────────────────────────────────
const GEEN_NAAM = new Set(["Binas", "Celsius", "Kelvin", "Newton", "Joule", "Watt", "Volt", "Ohm", "Hertz", "Pascal", "Nederland", "Europa", "Leg", "Bereken", "Noem", "Geef", "Teken", "Welke", "Wat", "Waarom", "Hoe", "Kies", "Lees", "Bepaal", "Vul", "Zet", "Omcirkel", "Kruis", "Gebruik", "Schrijf", "Juist", "Onjuist", "Rond", "Vergelijk", "Beschrijf", "Voorspel"]);
const SYMBOOL = /^(Fres|Fz|Fn|Fw|Fs|Fv|Ftrek|Fmotor|Ek|Ez|Pa|Hz|Nm|kWh)$/;
/** Eigennamen midden in een zin (geen zinsbegin, niet in GEEN_NAAM). */
function namen(t: string): Set<string> {
  const uit = new Set<string>();
  for (const zin of kaal(t).split(/(?<=[.!?:])\s+|\n/)) {
    const w = zin.split(/\s+/);
    for (let i = 1; i < w.length; i++) {
      const x = w[i]!.replace(/^[("'„]+|[)"'”.,;:!?]+$/g, "");
      if (!/^[A-Z][a-zà-ÿ]{2,}$/.test(x) || GEEN_NAAM.has(x) || SYMBOOL.test(x)) continue;
      uit.add(x);
    }
  }
  return uit;
}

/**
 * Samenhang: alle deelvragen horen bij de situatie van hun vraagstuk.
 * - geen nieuwe persoon (naam) als de inleiding al een persoon heeft;
 * - geen situatiewoord uit de TITEL van een ánder vraagstuk (persoon, voorwerp, plek; woorden die niet in de
 *   lesstof staan) zonder één situatiewoord van het eigen vraagstuk (contexten door elkaar, zoals een auto-vraag in
 *   "Echo bij Kevin").
 * Vakwoorden uit de lesstof (kracht, geluid, amplitude …) tellen niet als situatie.
 */
export function zoekIncoherentie(vs: VraagstukSpec[], bronmateriaal = ""): Bevinding[] {
  const uit: Bevinding[] = [];
  const stam5 = (w: string) => w.slice(0, 5);
  const bron = new Set(woorden(bronmateriaal).map(stam5));
  const situatie = (v: VraagstukSpec) => woorden([v.titel, ...v.context].join(" ")).filter((w) => !ALGEMEEN.has(w) && !bron.has(stam5(w)));
  const perVs = new Map(vs.map((v) => [v.id, situatie(v)]));
  // Sterke situatiewoorden van een ánder vraagstuk: uit de titel (die noemt de situatie: "Auto van Noor").
  const titelSit = new Map(vs.map((v) => [v.id, woorden(v.titel).filter((w) => !ALGEMEEN.has(w) && !bron.has(stam5(w)))]));
  const raakt = (eigen: string[], sit: string[]) => eigen.some((w) => sit.some((x) => stam5(x) === stam5(w) || (x.length >= 4 && w.includes(x)) || (w.length >= 4 && x.includes(w))));
  for (const v of vs) {
    const basisTekst = [v.titel, ...v.context].join(" ");
    const bekendeNamen = namen(basisTekst);
    const kent = (n: string) => bekendeNamen.has(n) || basisTekst.includes(n) || basisTekst.includes(n.replace(/'?s$/, ""));
    const eigenSit = [...perVs.get(v.id)!, ...woorden(basisTekst)];
    for (const d of v.deelvragen) {
      const tekst = eigenTekst(d);
      const nieuwNaam = [...namen(tekst)].filter((n) => !kent(n));
      if (nieuwNaam.length && bekendeNamen.size) uit.push({ id: d.id, vraagstuk: v.id, tekst: `${d.id}: andere persoon/plaats (${nieuwNaam.join(", ")}) dan in de inleiding van "${v.titel}"; alle deelvragen horen bij dezelfde situatie` });
      const eigen = woorden(tekst).filter((w) => !ALGEMEEN.has(w) && !bron.has(stam5(w)));
      if (!eigen.length || raakt(eigen, eigenSit)) continue;
      const ander = vs.find((x) => x !== v && raakt(eigen, titelSit.get(x.id)!));
      if (ander) uit.push({ id: d.id, vraagstuk: v.id, tekst: `${d.id}: gebruikt de situatie van "${ander.titel}" in plaats van "${v.titel}"; alle deelvragen van een vraagstuk gaan over dezelfde situatie (zelfde persoon, voorwerp en plek)` });
    }
  }
  return uit;
}

// ── 5a. 1-punts reproductievragen ────────────────────────────────────────────────────────────────
export const MAX_1P_R: Record<string, number> = { GT: 0.3, TL: 0.3, KB: 0.4, BB: 0.45 };

/**
 * Hoogstens MAX_1P_R van de punten uit 1-punts R-vragen. Te veel → bevindingen bij de vraagstukken met de meeste
 * 1p-R-vragen (net zoveel als nodig om onder de grens te komen), zodat het gerichte herstel ze kan omzetten.
 */
export function eenPuntsReproductie(vs: VraagstukSpec[], leerweg: string): { pct: number; max: number; bevindingen: Bevinding[] } {
  const max = MAX_1P_R[leerweg] ?? 0.35;
  const alle = vs.flatMap((v) => v.deelvragen);
  const totaal = alle.reduce((s, d) => s + d.punten, 0) || 1;
  const is1R = (d: Deelvraag) => d.punten === 1 && d.rtti === "R";
  const n = alle.filter(is1R).length;
  const pct = n / totaal;
  const bevindingen: Bevinding[] = [];
  let over = n - Math.floor(max * totaal);
  if (over > 0) {
    const per = vs.map((v) => ({ v, r: v.deelvragen.filter(is1R) })).filter((x) => x.r.length).sort((a, b) => b.r.length - a.r.length);
    for (const { v, r } of per) {
      if (over <= 0) break;
      bevindingen.push({ id: v.id, vraagstuk: v.id, tekst: `te veel 1-punts reproductievragen in de toets (${Math.round(pct * 100)} % van de punten, max ${Math.round(max * 100)} %): maak van ${r.map((d) => d.id).join(", ")} een toepassings- of inzichtvraag (T1/T2/I) of een vraag van 2 punten` });
      over -= Math.max(1, r.length - 1);
    }
  }
  return { pct, max, bevindingen };
}

// ── 5b. stof binnen de lesstof ───────────────────────────────────────────────────────────────────
const ALGEMEEN = new Set(
  "berekenen bepalen herkennen uitleggen benoemen aflezen verband verschil eenheid eenheden grootte voorbeeld voorbeelden gebruiken tekenen situatie invloed oorzaak gevolg formule formules omrekenen vergelijken beschrijven verklaren toepassen inzicht redeneren voorspellen diagram grafiek tabel meting metingen berekening uitkomst waarde waarden begrip figuur afleiden controleren schatten juist onjuist kiezen keuze regel regels relatie dagelijks praktijk afronden aflezing groter kleiner hoger lager sneller langzamer verschillende omgekeerd evenredig recht samen bepaling methode stappen gegevens antwoord vraag vragen leerling meten gemeten bereken aflees noemen uitleg herkennen omzetten verbanden".split(" "),
);

/**
 * Vaktermen (NaSk vmbo) met toegestane varianten in de lesstof. Staat een vakterm in begrip/leerdoel/stam/antwoord
 * terwijl de lesstof hem (en zijn varianten) niet noemt, dan is dat stof of vaktaal buiten de lesstof.
 */
export const VAKTERMEN: Record<string, string[]> = {
  versnelling: ["versnel"], nettokracht: [], momentenwet: [], stabiliteit: ["stabiel"], stabiel: ["stabiel"], traagheid: [], impuls: [], luchtweerstand: [], wrijving: [], rolweerstand: [],
  lastkracht: [], spierkracht: [], zwaartepunt: [], normaalkracht: [], spankracht: [], veerkracht: ["veer"], opwaartse: [], archimedes: [], katrol: [], tandwiel: [], overbrenging: [],
  toonhoogte: ["toon", "tonen"], luidheid: ["hard", "zacht", "decibel"], resonantie: [], golflengte: [], ultrasoon: ["ultrasoon", "ultrageluid"], infrasoon: ["infrasoon", "infrageluid"], terugkaatsing: ["echo", "kaats"], vacuüm: ["luchtledig", "vacu"], medium: ["tussenstof"], looptijd: [], blootstellingstijd: ["blootstel", "uur per dag", "veilig"], gehoorschade: ["gehoorschade", "doof", "schade"], gehoordrempel: [], pijngrens: [],
  bewegingsenergie: [], veerenergie: [], rendement: [], vermogen: [], kilowattuur: [], arbeid: [], warmtegeleiding: ["geleid"], straling: [], stroming: [], isolatie: ["isol"],
  stroomsterkte: [], spanning: [], weerstand: [], parallelschakeling: ["parallel"], serieschakeling: ["serie"], kortsluiting: [], zekering: [], aardlek: [], transformator: [], inductie: [],
  molecuul: ["molecu"], moleculen: ["molecu"], molecuulsoort: ["molecu"], atoom: [], oplossing: ["oplos"], verzadigd: [], destillatie: ["destill"], extractie: [], chromatografie: [], adsorptie: [], indampen: [], kristallisatie: [], sublimatie: ["sublim"], rijp: [], condensatie: ["condens"], stollen: [], smeltpunt: [], kookpunt: [], dichtheid: [], emulsie: [], suspensie: [], legering: [],
};
const VAKTERM_RE = new RegExp(`\\b(${Object.keys(VAKTERMEN).join("|")})\\b`, "gi");

/** Vaktermen in begrip/leerdoel/stam/antwoordmodel die nergens in de lesstof (of de antwoorden) voorkomen. */
export function buitenLesstof(vs: VraagstukSpec[], bronmateriaal: string, antwoorden = ""): Bevinding[] {
  const bron = norm(`${bronmateriaal} ${antwoorden}`);
  if (bron.length < 200) return []; // te weinig lesstof om iets over te zeggen
  const uit: Bevinding[] = [];
  for (const v of vs)
    for (const d of v.deelvragen) {
      const lab = norm(`${d.begrip ?? ""} ${d.leerdoel ?? ""} ${eigenTekst(d)} ${(d.antwoordmodel?.regels ?? []).join(" ")}`);
      const termen = [...new Set([...lab.matchAll(VAKTERM_RE)].map((m) => m[1]!.toLowerCase()))];
      const mist = termen.filter((w) => !bron.includes(w) && !(VAKTERMEN[w] ?? []).some((a) => bron.includes(a)));
      if (mist.length) uit.push({ id: d.id, vraagstuk: v.id, tekst: `${d.id}: buiten de lesstof: "${mist.join('", "')}" staat niet in de lesstof; toets alleen stof uit de lesstof en gebruik de woorden van de lesstof` });
    }
  return uit;
}

// ── 5c. afronding ────────────────────────────────────────────────────────────────────────────────
/** Aantal significante cijfers van een Nederlands getal ("39,2" → 3, "0,040" → 2); null bij een geheel getal op 0. */
export function significant(s: string): number | null {
  const t = s.trim().replace(/^[-−+]/, "").replace(/\s/g, "").replace(",", ".");
  if (!/^\d*\.?\d+$/.test(t)) return null;
  if (t.includes(".")) return t.replace(".", "").replace(/^0+/, "").length || 1;
  const z = t.replace(/^0+/, "");
  if (/0$/.test(z)) return null; // 600: niet te zeggen
  return z.length || 1;
}
const EXPLICIET = /\b(rond\w* af|afgerond|decimaal|decimalen|significant|hele getal|geheel getal|op \w+ cijfers?)\b/i;

/**
 * Afrondregel: de einduitkomst heeft hetzelfde aantal significante cijfers als het gegeven met de minste
 * significante cijfers (minimaal 2), of één meer; minder mag alleen als de gegevens zelf maar 1 significant cijfer
 * hebben. Staat er in de vraag een eigen
 * afrondinstructie, dan geldt die (geen controle).
 */
export function afrondFouten(vs: VraagstukSpec[]): Bevinding[] {
  const uit: Bevinding[] = [];
  for (const v of vs)
    for (const d of v.deelvragen) {
      const b = d.berekeningen ?? [];
      const laatste = [...b].reverse().find((x) => x.afgerond);
      if (!laatste?.afgerond || EXPLICIET.test(d.stam)) continue;
      const sf = significant(laatste.afgerond);
      if (sf === null) continue;
      const params: Parameter[] = [...(v.parameters ?? []), ...(d.parameters ?? [])];
      const perNaam = new Map(params.map((p) => [p.naam, p]));
      const stappen = new Map(b.map((x) => [x.naam, x]));
      const gebruikt = new Set<string>();
      const loop = (formule: string, diepte = 0) => {
        for (const id of formule.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) {
          if (perNaam.has(id)) gebruikt.add(id);
          else if (stappen.has(id) && diepte < 10) loop(stappen.get(id)!.formule, diepte + 1);
        }
      };
      loop(laatste.formule);
      const sfs = [...gebruikt].map((n) => perNaam.get(n)!).filter((p) => p.bron !== "binas").map((p) => significant(p.weergave ?? String(p.waarde).replace(".", ","))).filter((x): x is number => x !== null);
      if (!sfs.length) continue;
      const minst = Math.min(...sfs);
      const verwacht = Math.max(2, minst);
      // Toegestaan: van min(2, minst) (gegevens met 1 significant cijfer, bijv. "0,2 ms per hokje") tot verwacht + 1.
      if (sf > verwacht + 1 || sf < Math.min(2, minst))
        uit.push({ id: d.id, vraagstuk: v.id, tekst: `${d.id}: afronding: "${laatste.afgerond}" heeft ${sf} significante cijfers; rond af op ${verwacht} (zoals het gegeven met de minste significante cijfers, minimaal 2), of zeg in de vraag hoe er afgerond moet worden; zet de onafgeronde waarde er in het antwoordmodel bij` });
    }
  return uit;
}

// ── 5d. paragraafdekking op inhoud ───────────────────────────────────────────────────────────────
/**
 * Kernwoorden per paragraaf: titelwoorden en de woorden uit de eerste zin van de paragraaftekst, zonder woorden die
 * in de helft of meer van de paragrafen voorkomen (te algemeen, bijv. "kracht" in een hoofdstuk Krachten).
 */
export function paragraafKern(bronmateriaal: string, antwoorden?: string): Map<string, string[]> {
  const pars = extractParagrafen(bronmateriaal, antwoorden);
  const regels = bronmateriaal.split(/\r?\n/);
  const body = new Map<string, string>();
  for (const p of pars) {
    const i = regels.findIndex((r) => new RegExp(`^\\s*(?:paragraaf\\s+|§\\s*)?${p.code.replace(".", "\\.")}\\.?\\s`).test(r));
    if (i < 0) continue;
    const rest: string[] = [];
    for (let j = i + 1; j < regels.length && !/^\s*(?:paragraaf\s+|§\s*)?\d{1,2}\.\d{1,2}\.?\s+[A-ZÀ-Ý]/.test(regels[j]!); j++) rest.push(regels[j]!);
    body.set(p.code, rest.join(" "));
  }
  const kandidaat = new Map(pars.map((p) => [p.code, [...new Set([...woorden(p.titel), ...woorden((body.get(p.code) ?? "").split(/(?<=[.!?])\s/)[0] ?? "")])]]));
  const df = new Map<string, number>();
  for (const p of pars) for (const w of new Set(woorden(`${p.titel} ${body.get(p.code) ?? ""}`).map((x) => x.slice(0, 5)))) df.set(w, (df.get(w) ?? 0) + 1);
  const grens = Math.max(2, Math.ceil(pars.length / 2));
  return new Map([...kandidaat].map(([c, ws]) => [c, ws.filter((w) => (df.get(w.slice(0, 5)) ?? 0) < grens)]));
}

/** Telt een deelvraag met paragraafcode p in het leerdoel echt mee voor p? Alleen als hij een kernwoord van p raakt. */
export function raaktKern(d: Pick<Deelvraag, "stam" | "context" | "opties" | "begrip" | "leerdoel" | "antwoordmodel">, kern: string[] | undefined): boolean {
  if (!kern?.length) return true;
  const t = norm([alleTekst(d as Deelvraag), d.begrip ?? "", (d.leerdoel ?? "").replace(/\d{1,2}\.\d{1,2}/g, ""), ...(d.antwoordmodel?.regels ?? [])].join(" "));
  // Op woordbegin ("betekent" raakt "tekenen" niet).
  const ws = ` ${t}`;
  return kern.some((w) => ws.includes(` ${w.slice(0, Math.min(w.length, 5))}`));
}

// ── 2. getal-weggevers ───────────────────────────────────────────────────────────────────────────
/**
 * Getal-weggever: de afgeronde uitkomst van A staat MET eenheid (dezelfde grootheid) in de tekst of opties van een
 * andere deelvraag B van HETZELFDE vraagstuk (zelfde context). Een los getal of hetzelfde getal in een ander
 * vraagstuk is toeval en telt niet. Gegeven waarden (parameters) tellen nooit.
 */
export function zoekGetalWeggevers(vs: VraagstukSpec[]): string[] {
  const uit: string[] = [];
  for (const v of vs) {
    const gegeven = new Set([...(v.parameters ?? []), ...v.deelvragen.flatMap((d) => d.parameters ?? [])].map((p) => p.weergave ?? String(p.waarde).replace(".", ",")));
    for (const a of v.deelvragen)
      for (const bk of a.berekeningen ?? []) {
        const u = bk.afgerond;
        if (!u || gegeven.has(u) || u.replace(/[^0-9]/g, "").length < 2) continue;
        const eenheid = (bk.eenheid ?? "").trim();
        for (const b of v.deelvragen) {
          if (b === a) continue;
          const t = alleTekst(b);
          if (!getalInTekst(u, t)) continue;
          const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const metEenheid = eenheid ? new RegExp(`(^|[^0-9,])${esc(u)}\\s*${esc(eenheid)}(?![A-Za-z])`).test(t) : u.replace(/[^0-9]/g, "").length >= 3;
          if (metEenheid) uit.push(`${b.id} verklapt ${a.id} (${u}${eenheid ? " " + eenheid : ""})`);
        }
      }
  }
  return [...new Set(uit)];
}

// ── 6. onderwerplabel uit de inhoud ──────────────────────────────────────────────────────────────
const SUB: Record<string, [string, RegExp][]> = {
  "SE4.1": [["Krachten", /\b(kracht|krachten|zwaartekracht|resulterende|veer|veren|newton)\b/gi], ["druk", /\b(druk|pascal|oppervlakte)\b/gi], ["hefbomen", /\b(hefboom|hefbomen|moment|draaipunt|arm)\b/gi]],
  "SE4.2": [["Geluid", /\b(geluid\w*|trilling\w*|frequentie|toon\w*|decibel|db|oor|echo|amplitude)\b/gi], ["Energie", /\b(energie\w*|rendement|joule|warmte\w*|isolatie|verbranding)\b/gi], ["Stoffen", /\b(stof|stoffen|mengsel\w*|dichtheid|molecu\w*|smelt\w*|kook\w*|fase\w*|oplos\w*|faseovergang\w*)\b/gi]],
  "SE4.4": [["Beweging", /\b(snelheid|beweging|versnelling|afstand|remweg|v,t|s,t)\b/gi], ["Arbeid en vermogen", /\b(arbeid|vermogen|watt)\b/gi]],
};
/** Kort label voor een SE-groep op basis van de echte inhoud (klas 1–3), bv. "Geluid" i.p.v. "Geluid, energie, stoffen". */
export function onderwerpUitInhoud(se: string, tekst: string): string | undefined {
  const subs = SUB[se];
  if (!subs) return undefined;
  const tel = subs.map(([naam, re]) => [naam, (tekst.match(re) ?? []).length] as const);
  const som = tel.reduce((s, [, n]) => s + n, 0);
  if (!som) return undefined;
  const top = tel.filter(([, n]) => n / som >= 0.2).map(([naam]) => naam);
  if (!top.length) return undefined;
  const lijst = top.map((x, i) => (i === 0 ? x : x.toLowerCase()));
  return lijst.length === 1 ? lijst[0] : `${lijst.slice(0, -1).join(", ")} en ${lijst.at(-1)}`;
}

// ── 1/6. tekenfiguren normaliseren ───────────────────────────────────────────────────────────────
/**
 * Lege tekengrafiek: Grok zet er soms een los punt in (bijv. (0; 0)) om aan de controle te voldoen. Bij een tekenvraag
 * verdwijnen niet-rode reeksen met ≤ 1 punt en de y@-controles die daarop leunen (de controle hoort in de antwoordfiguur).
 */
export function normaliseerTekenfiguur(f: FiguurSpec | undefined, teken: boolean): FiguurSpec | undefined {
  if (!f || !teken || f.type !== "grafiek" || f.panelen?.length) return f;
  const reeksen = f.reeksen.filter((r) => r.rood || r.punten.length > 1);
  if (reeksen.length === f.reeksen.length) return f;
  const controle = reeksen.length ? f.controle : (f.controle ?? []).filter((c) => !/^y@/.test(c.meting));
  return { ...f, reeksen, controle: controle?.length ? controle : undefined };
}
