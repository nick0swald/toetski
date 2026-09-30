import type { NakijkItem, Vraag } from "./types";
import type { ItemIssue } from "./item-kwaliteit";
import { findCorrectOptionIndex } from "./mc-balance.ts";

/**
 * Samenhang over de hele toets (deterministisch, naast de modelreview in afwerken):
 * - verklappen: een vraag toont een formule/regel of een antwoord dat in een andere vraag punten oplevert;
 * - dubbele context: hetzelfde concrete voorwerp of scenario in twee losse vragen (buiten een situatiegroep);
 * - dubbel concept: hetzelfde begripsverband (bijv. groter oppervlak → kleinere druk) meer dan één keer;
 * - afleiders: onzinnige of te makkelijk weg te strepen opties.
 * Plus kleine taalreparaties die altijd veilig zijn (het-woorden: "kleiner oppervlak", "hetzelfde krat").
 */

/** Formules/regels die als scorepunt in een rubriek kunnen staan. */
export const FORMULES: { id: string; naam: string; re: RegExp }[] = [
  { id: "hefboom", naam: "de hefboomwet F1 × r1 = F2 × r2", re: /\bf\s*1\s*[×x·*]\s*r\s*1\b|\bf1r1\b|hefboomwet|momentenwet|linksdraaiende?\s+moment\s+(?:is\s+)?gelijk/i },
  { id: "moment", naam: "M = F × r", re: /\bm\s*=\s*f\s*[×x·*]\s*r\b/i },
  { id: "druk", naam: "p = F / A", re: /\bp\s*=\s*f\s*[\/:]\s*a\b/i },
  { id: "zwaartekracht", naam: "Fz = m × g", re: /\bf\s*z\s*=\s*m\s*[×x·*]\s*g\b/i },
  { id: "veer", naam: "F = C × u", re: /\bf\s*=\s*c\s*[×x·*]\s*u\b|\bc\s*=\s*f\s*[\/:]\s*u\b|\bu\s*=\s*f\s*[\/:]\s*c\b/i },
  { id: "snelheid", naam: "s = v × t", re: /\bs\s*=\s*v\s*[×x·*]\s*t\b|\bv\s*=\s*s\s*[\/:]\s*t\b/i },
  { id: "dichtheid", naam: "ρ = m / V", re: /(?:ρ|\brho\b|dichtheid)\s*=\s*m\s*[\/:]\s*v\b/i },
  { id: "vermogen", naam: "P = U × I", re: /\bp\s*=\s*u\s*[×x·*]\s*i\b/i },
  { id: "weerstand", naam: "R = U / I", re: /\br\s*=\s*u\s*[\/:]\s*i\b|\bu\s*=\s*i\s*[×x·*]\s*r\b/i },
  { id: "energie", naam: "E = P × t", re: /\be\s*=\s*p\s*[×x·*]\s*t\b/i },
  { id: "frequentie", naam: "f = 1 / T", re: /\bf\s*=\s*1\s*[\/:]\s*t\b/i },
];

/** Begripsverbanden die maar één keer getoetst worden (tweede alleen als I-vraag). */
const BEGRIP_TYPEN = new Set(["K-DRUKB", "K-HEF", "K-NET", "K-ZWP", "W-DRIJF", "G-BEREIK", "W-DICHTB", "E-VERM-BEGR", "G-OSC", "W-TRANS"]);

function leerlingTekst(q: Vraag): string {
  return `${q.context ?? ""} ${q.stam} ${(q.opties ?? []).map((o) => o.tekst).join(" ")}`;
}

function sleutelTekst(q: Vraag, n: NakijkItem | undefined): string {
  if (!q.opties?.length || !n) return "";
  const i = findCorrectOptionIndex(q.opties, n.modelantwoord ?? "");
  return i >= 0 ? q.opties[i]!.tekst.trim() : "";
}

/** Formules waarvoor deze vraag een scorepunt geeft (rubriek of modelantwoord bij een meerpuntsvraag). */
function gescoordeFormules(q: Vraag, n: NakijkItem | undefined): string[] {
  if (q.opties?.length || !n || (q.punten ?? 1) < 2) return [];
  const rubriek = (n.puntenverdeling ?? []).map((p) => p.criterium).join(" ");
  const bron = `${rubriek} ${/formule|gebruik van|hefboomwet|momentenwet/i.test(rubriek) ? n.modelantwoord : ""}`;
  return FORMULES.filter((f) => f.re.test(bron)).map((f) => f.id);
}

const STOP = new Set(
  (
    "deze dit die dat een het de van voor naar door over onder boven met zonder maar omdat waarom welke wordt worden werd hebben heeft had zijn is was kan kunnen mag moet wil gaat gaan komt doet maakt zet zien ziet kijkt staat ligt legt houdt geeft neemt krijgt " +
    "hoeveel hoe wat waar wanneer bereken noem leg uit geef verklaar noteer bepaal beschrijf voorspel juist onjuist leerling situatie vraag antwoord tabel " +
    "keer even twee drie vier vijf eerst daarna daarom terwijl steeds altijd nooit ook nog niet geen alle allebei beide andere ander zelfde dezelfde hetzelfde " +
    "groot grote groter grootste klein kleine kleiner kleinste zwaar zware zwaarder licht lichte hoog hoge hoger laag lage lager lang lange langer kort korte korter snel snelle sneller langzaam " +
    "links rechts omhoog omlaag beneden boven naar voren achteren schuin horizontaal verticaal loodrecht " +
    "kracht krachten zwaartekracht spierkracht veerkracht spankracht normaalkracht wrijvingskracht wrijving luchtweerstand rolweerstand magnetische elektrische massa newton gewicht " +
    "druk oppervlak oppervlakte contactoppervlak veer veren uitrekking uitrekt rekt veerconstante hefboom draaipunt lastarm werkarm moment momenten evenwicht resulterende nettokracht " +
    "snelheid richting grootte pijl schaal krachtenschaal zwaartepunt aangrijpingspunt steunvlak lengte afstand meter centimeter kilogram gram werkt werken oefent uitgeoefend uitoefent " +
    "formule eenheid berekening waarde uitkomst constante beweegt beweging stilstand versnelt vertraagt remt trekt duwt drukt gebruikt gebruiken " +
    "geluid frequentie trilling spanning stroom weerstand energie vermogen warmte temperatuur dichtheid volume stof stoffen"
  ).split(/\s+/),
);

function inhoudWoorden(q: Vraag): Set<string> {
  const tekst = `${q.context ?? ""} ${q.stam}`;
  // Namen (hoofdletterwoorden) tellen niet als situatie; dezelfde hoofdpersoon weegt apart mee (persoon()).
  const namen = new Set((tekst.match(/\b[A-Z][a-zéëï]{2,}\b/g) ?? []).map((w) => w.toLowerCase()).filter((w) => !new RegExp(`(^|[^A-Za-z])${w}\\b`).test(tekst)));
  const woorden = (tekst.toLowerCase().match(/[a-zà-ÿ]{4,}/g) ?? []).filter((w) => !STOP.has(w) && !namen.has(w));
  return new Set(woorden.map((w) => w.replace(/(?<=\w{4})(en|s|je|tje)$/, "")));
}

function persoon(q: Vraag): string | null {
  return `${q.context ?? ""} ${q.stam}`.match(/\b([A-Z][a-zéëï]{2,})\s+(?:[a-z]+t|is|heeft|wil|zet|legt)\b/)?.[1] ?? null;
}

/** Dezelfde situatie of hetzelfde concrete voorwerp in twee losse vragen. */
export function dubbeleContexten(vragen: Vraag[]): { a: number; b: number; woorden: string[] }[] {
  const out: { a: number; b: number; woorden: string[] }[] = [];
  const w = vragen.map(inhoudWoorden);
  for (let i = 0; i < vragen.length; i++) {
    for (let j = i + 1; j < vragen.length; j++) {
      const qa = vragen[i]!;
      const qb = vragen[j]!;
      if (qa.contextTitel?.trim() && qa.contextTitel === qb.contextTitel) continue;
      const gedeeld = [...w[i]!].filter((x) => w[j]!.has(x));
      const zelfdePersoon = persoon(qa) && persoon(qa) === persoon(qb);
      if (gedeeld.length >= 2 || (gedeeld.length >= 1 && (zelfdePersoon || gedeeld[0]!.length >= 4))) out.push({ a: qa.nummer, b: qb.nummer, woorden: gedeeld.slice(0, 3) });
    }
  }
  return out;
}

const ONZIN_OPTIE = /^(altijd|nooit)\b.*\d|\bkleiner dan 0\b|\bnegatief\b.*\bN\b|^geen van (de|deze)|^alle(?: bovenstaande| antwoorden)|^(ik weet het niet|weet ik niet)/i;

/** Alle samenhangproblemen (verklappen, dubbele context, dubbel concept, onzinnige afleiders). */
export function samenhangIssues(vragen: Vraag[], nakijk: NakijkItem[]): ItemIssue[] {
  const issues: ItemIssue[] = [];
  const nk = (q: Vraag) => nakijk.find((n) => n.nummer === q.nummer);
  // 1) Formule/regel zichtbaar in een andere vraag terwijl die hier een punt oplevert.
  for (const b of vragen) {
    for (const f of gescoordeFormules(b, nk(b))) {
      const formule = FORMULES.find((x) => x.id === f)!;
      for (const a of vragen) {
        if (a.nummer === b.nummer || !formule.re.test(leerlingTekst(a))) continue;
        issues.push({
          nummer: a.nummer,
          code: "verklapt",
          uitleg: `Vraag ${a.nummer} toont ${formule.naam}; in vraag ${b.nummer} levert die formule een punt op. Herschrijf vraag ${a.nummer} zodat de formule nergens in context, stam of opties staat (toets een ander aspect van dezelfde paragraaf, in een andere situatie).`,
        });
      }
    }
  }
  // 2) Antwoord van een keuzevraag is (een deel van) het antwoord van een open vraag over hetzelfde.
  for (const a of vragen) {
    const k = sleutelTekst(a, nk(a)).toLowerCase();
    if (k.length < 5 || k.split(/\s+/).length > 3) continue;
    for (const b of vragen) {
      if (b.nummer === a.nummer || b.opties?.length) continue;
      const zelfde = a.vraagtype === b.vraagtype || !a.vraagtype || !b.vraagtype || (a.leerdoelId && a.leerdoelId === b.leerdoelId);
      if (zelfde && (nk(b)?.modelantwoord ?? "").toLowerCase().includes(k)) {
        issues.push({ nummer: a.nummer, code: "verklapt", uitleg: `Het antwoord van vraag ${a.nummer} ('${k}') is ook (een deel van) het antwoord van vraag ${b.nummer}. Vervang vraag ${a.nummer} door een vraag over iets anders uit dezelfde paragraaf.` });
        break;
      }
    }
  }
  // 3) Dubbele context/scenario. Slachtoffer: liefst een losse vraag (een situatiegroep blijft heel);
  // twee groepen → de hele latere groep krijgt samen één nieuwe situatie.
  const groep = (q: Vraag) => (q.contextTitel?.trim() ? vragen.filter((x) => x.contextTitel === q.contextTitel) : [q]);
  const gemeld = new Set<number>();
  for (const d of dubbeleContexten(vragen)) {
    if (gemeld.size >= 4) break;
    const qa = vragen.find((q) => q.nummer === d.a)!;
    const qb = vragen.find((q) => q.nummer === d.b)!;
    const ga = groep(qa);
    const gb = groep(qb);
    const slachtoffer = ga.length === 1 && gb.length > 1 ? ga : gb;
    const ander = slachtoffer === ga ? qb : qa;
    if (slachtoffer.some((q) => gemeld.has(q.nummer))) continue;
    const nrs = slachtoffer.map((q) => q.nummer);
    for (const q of slachtoffer) {
      gemeld.add(q.nummer);
      issues.push({
        nummer: q.nummer,
        code: "dubbele-context",
        uitleg: `${nrs.length > 1 ? `De situatie van vragen ${nrs.join(", ")}` : `Vraag ${q.nummer}`} gebruikt dezelfde situatie/voorwerp als vraag ${ander.nummer} (${d.woorden.join(", ")}). Elke concrete situatie komt één keer voor: kies een andere, alledaagse en realistische situatie die nog niet in de toets staat${nrs.length > 1 ? " (voor al deze vragen hetzelfde nieuwe voorwerp, zodat de situatie klopt)" : ""}; zelfde leerdoel, type, punten en rtti.`,
      });
    }
  }
  // 4) Hetzelfde begripsverband meer dan één keer (tweede alleen als echte I-vraag).
  const perType = new Map<string, Vraag[]>();
  const reken = (q: Vraag) => q.type === "berekening" || /\b(bereken|bepaal)\b/i.test(q.stam);
  for (const q of vragen) if (q.vraagtype && BEGRIP_TYPEN.has(q.vraagtype) && !reken(q)) perType.set(q.vraagtype, [...(perType.get(q.vraagtype) ?? []), q]);
  for (const [type, qs] of perType) {
    if (qs.length < 2) continue;
    const houd = qs.find((q) => q.rtti === "I") ? [qs[0]!, qs.find((q) => q.rtti === "I")!] : [qs[0]!];
    for (const q of qs.filter((x) => !houd.includes(x))) {
      issues.push({ nummer: q.nummer, code: "dubbel-concept", uitleg: `Vraag ${q.nummer} toetst hetzelfde verband (${type}) als vraag ${houd[0]!.nummer}. Maximaal één vraag per verband: vervang vraag ${q.nummer} door een vraag over een ander leerdoel of een andere paragraaf die nog weinig punten heeft.` });
    }
  }
  // 5) Onzinnige of weg te strepen afleiders.
  for (const q of vragen) {
    if (!q.opties?.length || q.type === "juist-onjuist") continue;
    const onzin = q.opties.filter((o) => ONZIN_OPTIE.test(o.tekst.trim()));
    const t = `${q.context ?? ""} ${q.stam}`.toLowerCase();
    const vreemd = q.vraagtype === "K-SOORT" || /welke kracht/.test(t) ? q.opties.filter((o) => /magnetische|elektrische/i.test(o.tekst) && !/magne|elektr/.test(t)) : [];
    const slecht = [...onzin, ...vreemd];
    if (slecht.length) issues.push({ nummer: q.nummer, code: "afleider", uitleg: `Afleider(s) die niemand kiest of die niet serieus zijn: ${slecht.map((o) => `'${o.tekst}'`).join(", ")}. Vervang door geloofwaardige, grammaticaal parallelle afleiders (typische leerlingfouten), met precies één verdedigbaar antwoord.` });
  }
  const gezien = new Set<string>();
  return issues.filter((i) => {
    const k = `${i.nummer}:${i.code}`;
    if (gezien.has(k)) return false;
    gezien.add(k);
    return true;
  });
}

/** Het-woorden die vaak in toetsen staan. */
const HET_WOORDEN = ["oppervlak", "krat", "blok", "voorwerp", "gewichtje", "touw", "karretje", "boek", "draaipunt", "zwaartepunt", "steunvlak", "aangrijpingspunt", "wiel", "bord", "plankje", "ijzer", "hout", "water", "glas", "blikje", "pakket", "fietswiel", "skateboard", "kastje", "vat", "stuur", "bed", "raam", "dak", "tuinhek", "hek", "gereedschap", "apparaat", "potlood", "meetlint", "moment", "evenwicht"];

/**
 * Taalreparatie (altijd veilig): bij een het-woord zonder lidwoord geen buigings-e ("kleiner oppervlak",
 * niet "kleinere oppervlak"); "dezelfde krat" → "hetzelfde krat"; "de krat" → "het krat".
 */
export function taalHetWoorden(t: string): string {
  let s = t;
  for (const w of HET_WOORDEN) {
    const woord = `${w}(?![a-zà-ÿ])`;
    s = s.replace(new RegExp(`(^|[^a-zà-ÿ])(dezelfde|Dezelfde)\\s+(${woord})`, "g"), (_m, v: string, d: string, x: string) => `${v}${d[0] === "D" ? "H" : "h"}etzelfde ${x}`);
    s = s.replace(new RegExp(`(^|[^a-zà-ÿ])(deze|Deze)\\s+(${woord})`, "g"), (_m, v: string, d: string, x: string) => `${v}${d[0] === "D" ? "D" : "d"}it ${x}`);
    s = s.replace(new RegExp(`(^|[.!?]\\s+|[^a-zà-ÿ])(de|De)\\s+(${woord})`, "g"), (_m, v: string, d: string, x: string) => `${v}${d[0] === "D" ? "H" : "h"}et ${x}`);
    // Vergrotende trap zonder lidwoord (optie "Kleinere oppervlak" → "Kleiner oppervlak"; "een grotere oppervlak" → "een groter oppervlak").
    s = s.replace(new RegExp(`(^|\\b(?:een|geen)\\s+|[^a-zà-ÿ\\s]\\s*)([A-Za-zà-ÿ]+er)e\\s+(${woord})`, "g"), (_m, v: string, adj: string, x: string) => `${v}${adj} ${x}`);
  }
  return s;
}

export function repareerTaal(vragen: Vraag[]): Vraag[] {
  return vragen.map((q) => ({
    ...q,
    ...(q.context ? { context: taalHetWoorden(q.context) } : {}),
    stam: taalHetWoorden(q.stam),
    ...(q.opties ? { opties: q.opties.map((o) => ({ ...o, tekst: taalHetWoorden(o.tekst) })) } : {}),
  }));
}

/** Reviewcodes van de toetsbrede modelreview (samenhang tussen vragen). */
export const REVIEW_CODES = ["verklapt", "dubbele-context", "dubbel-concept", "afleider", "taal", "realisme", "meer-juiste-opties"] as const;

export const TOETSREVIEW_SYSTEM = `Je bent een strenge NaSk-docent (vmbo) die een HELE toets naleest vóór hij naar de leerlingen gaat. Je kijkt naar de samenhang tussen de vragen en naar de kwaliteit van de opties. Antwoord met één JSON-object:
{ "bevindingen": [ { "nummer": <vraag die aangepast moet worden>, "code": "<code>", "ander": <nummer van de andere vraag of null>, "uitleg": "kort en concreet" } ] }
Codes:
- verklapt: de stam, een optie of de tekst van vraag A toont het antwoord, een formule of een scorestap van vraag B (bijv. optie 'F1 × r1 = F2 × r2' terwijl een andere vraag een punt geeft voor die formule; een MC-vraag waarvan het antwoord de helft van een open vraag is). Noem de vraag die het weggeeft (meestal de gesloten of eerdere vraag).
- dubbele-context: hetzelfde concrete voorwerp/situatie in twee losse vragen (bijv. twee keer koevoet + steen, twee keer 'X tilt ... op'), buiten één bewuste doorlopende situatie met gedeelde inleiding.
- dubbel-concept: hetzelfde verband wordt vaker dan één keer getoetst (bijv. drie vragen 'groter oppervlak → kleinere druk'); alleen toegestaan als de tweede echt een ander niveau (I) heeft en niets weggeeft.
- afleider: een optie die onzinnig of te makkelijk weg te strepen is ('Altijd 10 N', 'kleiner dan 0 N', een kracht die er niets mee te maken heeft), opties die grammaticaal niet parallel zijn, of een afleider die onder een voorwaarde ook waar is.
- meer-juiste-opties: twee opties zijn te verdedigen (bijv. 'recht evenredig' en 'alleen bij kleine gewichten' bij een veer: elasticiteitsgrens).
- taal: fout Nederlands (bijv. 'kleinere oppervlak' → 'kleiner oppervlak', 'dezelfde krat' → 'hetzelfde krat').
- realisme: een vergelijking of situatie die niet echt zo gebeurt (bijv. 'een punaise drukt met dezelfde kracht als een brede schoen').
Wees streng maar terecht: alleen echte problemen, hooguit 8 bevindingen, de belangrijkste eerst. Geen bevindingen → { "bevindingen": [] }.`;

/** Compacte weergave van de hele toets voor de review (geen beelddata). */
export function toetsReviewPrompt(vragen: Vraag[], nakijk: NakijkItem[]): string {
  const regels = vragen.map((q) => {
    const n = nakijk.find((x) => x.nummer === q.nummer);
    const opties = q.opties?.length ? ` Opties: ${q.opties.map((o) => `${o.letter}) ${o.tekst}`).join(" | ")}.` : "";
    const rub = n?.puntenverdeling?.length ? ` Rubriek: ${n.puntenverdeling.map((c) => c.criterium).join("; ")}.` : "";
    return `${q.nummer}. [${q.punten}p${q.contextTitel ? `, situatie '${q.contextTitel}'` : ""}] ${q.context ? `${q.context} ` : ""}${q.stam}${opties} Antwoord: ${(n?.modelantwoord ?? "").slice(0, 220)}.${rub}`;
  });
  return `Toets (${vragen.length} vragen):\n${regels.join("\n")}`;
}

export function parseToetsReview(raw: string | null, vragen: Vraag[]): ItemIssue[] {
  if (!raw) return [];
  let data: unknown;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    data = JSON.parse(m ? m[0] : raw);
  } catch {
    return [];
  }
  const lijst = (data as { bevindingen?: unknown })?.bevindingen;
  if (!Array.isArray(lijst)) return [];
  const nrs = new Set(vragen.map((q) => q.nummer));
  const codes = new Set<string>(REVIEW_CODES);
  const out: ItemIssue[] = [];
  for (const b of lijst.slice(0, 10)) {
    const { nummer, code, ander, uitleg } = (b ?? {}) as { nummer?: unknown; code?: unknown; ander?: unknown; uitleg?: unknown };
    if (typeof nummer !== "number" || !nrs.has(nummer) || typeof code !== "string" || !codes.has(code)) continue;
    const extra =
      code === "verklapt"
        ? " Vervang wat het weggeeft (geen formule/antwoord van de andere vraag in stam of opties); zelfde leerdoel, punten en rtti."
        : code === "dubbele-context"
          ? " Kies een andere, alledaagse situatie die nog niet in de toets staat; zelfde leerdoel, punten en rtti."
          : code === "dubbel-concept"
            ? " Toets een ander verband uit dezelfde lesstof (of maak er een echte I-vraag van die niets weggeeft)."
            : code === "afleider"
              ? " Maak alle afleiders plausibel (typische leerlingfouten), grammaticaal parallel en onder geen enkele voorwaarde waar."
              : "";
    out.push({ nummer, code, uitleg: `Toetsreview${typeof ander === "number" ? ` (vgl. vraag ${ander})` : ""}: ${String(uitleg ?? "").slice(0, 300)}${extra}` });
  }
  return out;
}

/** Korte lijst van wat er al in de toets staat (voor reparaties: niet herhalen). */
export function alInToets(vragen: Vraag[], behalve: Set<number>): string {
  const r = vragen
    .filter((q) => !behalve.has(q.nummer))
    .map((q) => `${q.nummer}: ${`${q.context ?? ""} ${q.stam}`.replace(/\s+/g, " ").trim().slice(0, 90)}`);
  return r.length ? `\n\nAl in de toets (NIET herhalen: geen zelfde situatie/voorwerp, geen zelfde verband, geen formule of antwoord van deze vragen tonen):\n${r.join("\n")}` : "";
}
