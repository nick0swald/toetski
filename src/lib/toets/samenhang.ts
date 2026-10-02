import type { NakijkItem, Vraag } from "./types";
import type { ItemIssue } from "./item-kwaliteit";
import { findCorrectOptionIndex } from "./mc-balance.ts";

/**
 * Samenhang over de geschreven toets (deterministisch, geen modelaanroep):
 * - herhaling: twee losse vragen toetsen hetzelfde (zelfde antwoord, of stam + antwoord grotendeels gelijk);
 * - verklapt: het antwoord van vraag A staat in de tekst van vraag B (weggever);
 * - kernbegrippen uit de lesstof ("Echo: …", "… heet ultrasoon") die nergens in de toets voorkomen.
 * De dubbele vraag krijgt een reparatie-opdracht: vervangen door een vraag over een ontbrekend kernbegrip.
 */

export interface Kernbegrip {
  par: string;
  term: string;
  /** Zwak signaal (meetinstrument genoemd): alleen invullen via een dubbele vraag, nooit een goede vraag ombouwen. */
  zwak?: true;
  /** Synoniem uit de lesstof ("heet lawaai of geluidshinder"). */
  alt?: string[];
}

const STOP = new Set(
  (
    "deze dit die dat een het de van voor naar door over onder boven met zonder maar omdat waarom welke wordt worden werd hebben heeft had zijn is was kan kunnen mag moet wil gaat gaan komt doet maakt zet zien ziet staat ligt geeft neemt krijgt " +
    "hoeveel hoe wat waar wanneer bereken noem leg uit geef verklaar noteer bepaal beschrijf voorspel juist onjuist leerling situatie vraag antwoord tabel gebruik formule eenheid " +
    "keer even twee drie vier vijf eerst daarna daarom terwijl steeds altijd nooit ook nog niet geen alle beide andere ander zelfde dezelfde hetzelfde ongeveer later dezelfde welk welke " +
    "groot grote groter klein kleine kleiner hoog hoge hoger laag lage lager meer minder juiste volgorde " +
    "nodig komen kunnen laten moeten zorgen afstand meters meter seconde seconden minuten snelheid tijdstip"
  ).split(/\s+/),
);

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

/** Inhoudswoorden (≥ 5 letters), gestamd op 6 letters. */
export function termen(t: string | undefined): Set<string> {
  return new Set(
    norm(t ?? "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 5 && !STOP.has(w) && !/^\d+$/.test(w))
      .map((w) => w.slice(0, 6)),
  );
}

/** Getallen met eenheid ("343 m/s", "15 minuten", "20 000 Hz"). */
function getalEenheden(t: string): string[] {
  return [...norm(t).replace(/(\d)\s+(?=\d{3}\b)/g, "$1").matchAll(/(\d+(?:[.,]\d+)?)\s*(m\/s|n\/cm|n\/m|hz|db|minuten|minuut|uur|seconden|s|m|km|n|kg|j|w|v|a|°c)(?![\w/])/g)].map((m) => `${m[1]!.replace(",", ".")} ${m[2]}`);
}

function leerlingTekst(q: Vraag): string {
  return `${q.context ?? ""} ${q.stam} ${(q.opties ?? []).map((o) => o.tekst).join(" ")} ${q.tabel ? JSON.stringify(q.tabel) : ""}`;
}

/** Het antwoord zoals de leerling het geeft (bij meerkeuze: de tekst van de juiste optie). */
export function antwoordTekst(q: Vraag, n: NakijkItem | undefined): string {
  const ma = n?.modelantwoord ?? "";
  if (q.opties?.length) {
    const i = findCorrectOptionIndex(q.opties, ma);
    return i >= 0 ? q.opties[i]!.tekst : ma.replace(/^\s*[A-D][.):]\s*/, "");
  }
  return ma;
}

const TRIVIAAL = /^(juist|onjuist|ja|nee|wel|niet|waar|niet waar)$/;
function normAntwoord(t: string): string {
  return norm(t).replace(/\(.*?\)/g, "").replace(/[^a-z0-9/ ]+/g, " ").replace(/\s+/g, " ").trim();
}

const GEEN_KERN = /^(voorbeelden?|advies|tips?|let|opdracht|samenvatting|onthoud|conclusie|uitleg|formule|antwoord|regel|stappen|bijvoorbeeld|letop)$/;

/** Kernbegrippen per paragraaf: definities in de lesstof ("Echo: …", "… heet ultrasoon", "meet je met een decibelmeter"). */
export function kernbegrippen(bron: string): Kernbegrip[] {
  const out: Kernbegrip[] = [];
  let par = "";
  const zie = new Set<string>();
  const voeg = (term: string, zwak = false, alt?: string) => {
    const t = term.toLowerCase().trim();
    if (t.length < 4 || zie.has(t) || STOP.has(t) || GEEN_KERN.test(t)) return;
    zie.add(t);
    out.push({ par, term: t, ...(zwak ? { zwak: true as const } : {}), ...(alt && alt.length >= 4 ? { alt: [alt.toLowerCase()] } : {}) });
  };
  for (const regel of bron.split(/\r?\n/)) {
    const kop = regel.trim().match(/^(?:§\s*)?(\d{1,2}\.\d{1,2})\.?\s+\p{Lu}/u);
    if (kop) {
      par = kop[1]!;
      continue;
    }
    for (const m of regel.matchAll(/(?:^|[.!?]\s+)(\p{Lu}[\p{Ll}]{3,})\s*:\s/gu)) voeg(m[1]!);
    for (const m of regel.matchAll(/\bheet\s+(?:de\s+|het\s+|een\s+)?([\p{Ll}]{4,})(?:\s+of\s+([\p{Ll}]{4,}))?/gu)) voeg(m[1]!, false, m[2]);
    for (const m of regel.matchAll(/\b(?:met een|meet je met een|met de)\s+([\p{Ll}]{6,}(?:meter|scoop))\b/gu)) voeg(m[1]!, true);
  }
  return out;
}

/** Komt het kernbegrip in de tekst voor (stam van het woord, zodat "echo's" en "ultrasone" meetellen)? */
export function noemtTerm(tekst: string, term: string): boolean {
  // Stam: lange samenstellingen bijna helemaal ("geluidshinder" ≠ "geluidssterkte"), korte woorden op één letter na.
  const t = norm(term);
  return new RegExp(`\\b${t.slice(0, Math.max(4, t.length - (t.length >= 8 ? 2 : 1)))}`).test(norm(tekst));
}

/**
 * Ontbrekende kernbegrippen. Meerdere begrippen in één paragraaf (ultrasoon/infrasoon, alle faseovergangen) tellen
 * als rijtje: gedekt zodra een derde ervan getoetst is (anders alleen het eerste ontbrekende). Elk lid van zo'n
 * rijtje een eigen vraag geven wordt juist herhaling.
 */
export function noemtKern(tekst: string, k: Kernbegrip): boolean {
  return [k.term, ...(k.alt ?? [])].some((t) => noemtTerm(tekst, t));
}

export function ontbrekendeTermen(kern: Kernbegrip[], gedekt: (k: Kernbegrip) => boolean): Kernbegrip[] {
  const out: Kernbegrip[] = [];
  for (const par of [...new Set(kern.map((k) => k.par))]) {
    const groep = kern.filter((k) => k.par === par);
    const mis = groep.filter((k) => !gedekt(k));
    if (groep.length === 1) {
      out.push(...mis);
      continue;
    }
    if (groep.length - mis.length >= Math.ceil(groep.length / 3)) continue;
    out.push(...mis.slice(0, 1));
  }
  return out;
}

/** Kernbegrippen die in geen enkele vraag (tekst of antwoord) voorkomen. */
export function ontbrekendeKern(vragen: Vraag[], nakijk: NakijkItem[], kern: Kernbegrip[]): Kernbegrip[] {
  const alles = vragen.map((q) => `${leerlingTekst(q)} ${nakijk.find((n) => n.nummer === q.nummer)?.modelantwoord ?? ""}`).join(" ");
  return ontbrekendeTermen(kern, (k) => noemtKern(alles, k));
}

export interface Dubbel {
  a: number;
  b: number;
  soort: "zelfde-antwoord" | "overlap" | "verklapt";
  /** Vraag die vervangen wordt. */
  slachtoffer: number;
  detail: string;
}

/** Paren losse vragen die hetzelfde toetsen of elkaars antwoord verklappen. */
export function vindDubbels(vragen: Vraag[], nakijk: NakijkItem[]): Dubbel[] {
  const nk = (q: Vraag) => nakijk.find((n) => n.nummer === q.nummer);
  // Woorden die in veel vragen staan (onderwerp van het hoofdstuk: "geluid", "frequentie") tellen niet mee.
  const tel = new Map<string, number>();
  for (const q of vragen) for (const w of termen(`${q.stam} ${antwoordTekst(q, nk(q))}`)) tel.set(w, (tel.get(w) ?? 0) + 1);
  const generiek = (w: string) => (tel.get(w) ?? 0) > Math.max(3, vragen.length * 0.25);
  const kern = (t: string) => new Set([...termen(t)].filter((w) => !generiek(w)));
  // Hele woorden (≥ 9 letters) en in hoeveel vragen ze voorkomen (voor weggevers).
  const woorden = (t: string) => [...new Set(norm(t).split(/[^a-z]+/).filter((w) => w.length >= 9))];
  const woordTel = new Map<string, number>();
  for (const q of vragen) for (const w of woorden(`${leerlingTekst(q)} ${antwoordTekst(q, nk(q))}`)) woordTel.set(w, (woordTel.get(w) ?? 0) + 1);
  const info = vragen.map((q) => {
    const ant = antwoordTekst(q, nk(q));
    return { q, ant, antN: normAntwoord(ant), antT: kern(ant), stamT: kern(q.stam), tekst: norm(leerlingTekst(q)), tekstT: kern(leerlingTekst(q)), getallen: getalEenheden(ant) };
  });
  const zelfdeGroep = (x: Vraag, y: Vraag) => Boolean(x.contextTitel?.trim() && x.contextTitel === y.contextTitel);
  // Rekenvraag (ook "hoe groot is Fres" met gegevens): de uitkomst is geen opgevraagd feit.
  const isReken = (x: Vraag) => /bereken|reken|hoe groot|hoeveel/i.test(x.stam) || (`${x.context ?? ""} ${x.stam}`.match(/\d+(?:[.,]\d+)?/g)?.length ?? 0) >= 2;
  // Slachtoffer: liefst de vraag zonder figuur, buiten een contextgroep, met minder punten; anders de latere.
  const kies = (x: Vraag, y: Vraag): number => {
    const gewicht = (q: Vraag) => (q.figuur || q.figuurId ? 100 : 0) + (q.contextTitel ? 10 : 0) + (q.punten ?? 1);
    return gewicht(x) < gewicht(y) ? x.nummer : y.nummer;
  };
  const out: Dubbel[] = [];
  for (let i = 0; i < info.length; i++) {
    for (let j = i + 1; j < info.length; j++) {
      const A = info[i]!;
      const B = info[j]!;
      if (zelfdeGroep(A.q, B.q)) continue;
      // 1) Zelfde antwoord (niet triviaal) én dezelfde soort vraag.
      if (A.antN.length >= 3 && A.antN === B.antN && !TRIVIAAL.test(A.antN) && (A.antT.size > 0 || A.getallen.length > 0)) {
        out.push({ a: A.q.nummer, b: B.q.nummer, soort: "zelfde-antwoord", slachtoffer: kies(B.q, A.q), detail: `zelfde antwoord "${A.ant.slice(0, 40)}"` });
        continue;
      }
      // 1b) Zelfde uitkomst (getal + eenheid) bij vragen over hetzelfde ("15 minuten" bij 95 dB, twee keer).
      const zelfdeGetal = A.getallen.find((g) => B.getallen.includes(g));
      if (zelfdeGetal && [...A.stamT].some((w) => B.stamT.has(w))) {
        out.push({ a: A.q.nummer, b: B.q.nummer, soort: "zelfde-antwoord", slachtoffer: kies(B.q, A.q), detail: `zelfde uitkomst "${zelfdeGetal}"` });
        continue;
      }
      // 2) Stam + antwoord grotendeels gelijk (zelfde begripsverband).
      const sa = new Set([...A.stamT, ...A.antT]);
      const sb = new Set([...B.stamT, ...B.antT]);
      const gedeeld = [...sa].filter((w) => sb.has(w));
      if (gedeeld.length >= 2 && gedeeld.length / Math.min(sa.size, sb.size) >= 0.5) {
        out.push({ a: A.q.nummer, b: B.q.nummer, soort: "overlap", slachtoffer: kies(B.q, A.q), detail: `zelfde begrippen (${gedeeld.slice(0, 3).join(", ")})` });
        continue;
      }
      // 3) Weggever: een opgevraagde waarde ("343 m/s") of een specifiek vakwoord (≥ 9 letters, zelden in de toets)
      // uit een kort antwoord staat in de situatie/stam van de ander.
      for (const [X, Y] of [
        [A, B],
        [B, A],
      ] as const) {
        if (X.ant.split(/\s+/).length > 8) continue;
        const yTekst = norm(`${Y.q.context ?? ""} ${Y.q.stam}`);
        const getal = isReken(X.q) ? undefined : X.getallen.find((g) => yTekst.replace(/(\d)\s+(?=\d{3}\b)/g, "$1").replace(",", ".").includes(g));
        const woord = woorden(X.ant).find((w) => w.length >= 9 && !norm(X.q.stam).includes(w) && (woordTel.get(w) ?? 0) <= 2 && new RegExp(`\\b${w}`).test(yTekst));
        if (!getal && !woord) continue;
        // Heeft de verklappende vraag het gegeven nodig (rekenvraag met dat getal), dan wordt de andere vraag vervangen.
        const slachtoffer = getal && isReken(Y.q) ? X.q.nummer : kies(X.q, Y.q);
        out.push({ a: X.q.nummer, b: Y.q.nummer, soort: "verklapt", slachtoffer, detail: `vraag ${Y.q.nummer} noemt "${getal ?? woord}", het antwoord van vraag ${X.q.nummer}` });
        break;
      }
    }
  }
  // Ernstigste eerst: zelfde antwoord, dan zelfde begrippen, dan weggevers.
  const rang = { "zelfde-antwoord": 0, overlap: 1, verklapt: 2 } as const;
  return out.sort((x, y) => rang[x.soort] - rang[y.soort]);
}

/**
 * Reparatie-opdrachten voor dubbels: hooguit `max` vragen, nooit een vraag met figuur of een al aangewezen vraag.
 * Een ontbrekend kernbegrip uit de lesstof wordt als nieuw onderwerp voorgesteld.
 */
export function samenhangIssues(
  vragen: Vraag[],
  nakijk: NakijkItem[],
  opts: { kern?: Kernbegrip[]; vermijd?: Set<number>; max?: number } = {},
): ItemIssue[] {
  const max = opts.max ?? Math.max(2, Math.round(vragen.length * 0.12));
  const vermijd = opts.vermijd ?? new Set<number>();
  const ontbreekt = [...ontbrekendeKern(vragen, nakijk, opts.kern ?? [])];
  const gedaan = new Set<number>();
  const keuze: { q: Vraag; d: Dubbel; ander: number }[] = [];
  for (const d of vindDubbels(vragen, nakijk)) {
    if (keuze.length >= max) break;
    const q = vragen.find((x) => x.nummer === d.slachtoffer);
    if (!q || gedaan.has(q.nummer) || vermijd.has(q.nummer) || q.figuur || q.figuurId) continue;
    const ander = d.slachtoffer === d.a ? d.b : d.a;
    if (gedaan.has(ander)) continue;
    gedaan.add(q.nummer);
    keuze.push({ q, d, ander });
  }
  // Ontbrekende kernbegrippen verdelen: eerst aan een vraag uit dezelfde paragraaf, daarna op volgorde.
  const parVan = (q: Vraag) => (q.domein ?? "").match(/\d{1,2}\.\d{1,2}/)?.[0];
  const nieuw = new Map<number, Kernbegrip>();
  for (const { q } of keuze) {
    const ki = ontbreekt.findIndex((k) => k.par === parVan(q));
    if (ki >= 0) nieuw.set(q.nummer, ontbreekt.splice(ki, 1)[0]!);
  }
  for (const { q } of keuze) if (!nieuw.has(q.nummer) && ontbreekt.length) nieuw.set(q.nummer, ontbreekt.shift()!);
  const issues: ItemIssue[] = [];
  for (const { q, d, ander } of keuze) {
    const k = nieuw.get(q.nummer);
    const onderwerp = k
      ? `over "${k.term}"${k.par ? ` (paragraaf ${k.par}; staat in de lesstof maar nog niet in de toets)` : ""}; zet domein op die paragraaf`
      : "over een ander kernbegrip uit dezelfde paragraaf dat nog niet in de toets staat";
    issues.push({
      nummer: q.nummer,
      code: d.soort === "verklapt" ? "verklapt" : "herhaling",
      uitleg: `${d.soort === "verklapt" ? `Weggever: ${d.detail}.` : `Vraag ${q.nummer} toetst hetzelfde als vraag ${ander} (${d.detail}).`} Vervang vraag ${q.nummer} door een NIEUWE vraag ${onderwerp}. Zelfde vorm (open/meerkeuze), ${q.punten ?? 1} punt${(q.punten ?? 1) === 1 ? "" : "en"} en rtti ${q.rtti}; andere situatie; het antwoord mag nergens anders in de toets staan.`,
    });
  }
  return issues;
}

/**
 * Na de reparatie nog steeds een echte dubbel (zelfde antwoord of zelfde begrippen)? Dan de 1-puntsvraag weg,
 * zolang er genoeg vragen en punten overblijven. Liever een vraag minder dan twee keer hetzelfde.
 */
export function dubbelsWeg(vragen: Vraag[], nakijk: NakijkItem[], opts: { minVragen: number; minPunten: number }): number[] {
  const weg: number[] = [];
  let aantal = vragen.length;
  let punten = vragen.reduce((s, q) => s + (q.punten ?? 1), 0);
  for (const d of vindDubbels(vragen, nakijk)) {
    if (d.soort === "verklapt") continue;
    const q = vragen.find((x) => x.nummer === d.slachtoffer);
    if (!q || weg.includes(q.nummer) || weg.includes(d.a === q.nummer ? d.b : d.a) || q.figuur || q.figuurId || q.contextTitel) continue;
    if ((q.punten ?? 1) > 1 || aantal - 1 < opts.minVragen || punten - 1 < opts.minPunten) continue;
    weg.push(q.nummer);
    aantal -= 1;
    punten -= 1;
  }
  return weg;
}
