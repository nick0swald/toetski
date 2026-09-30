import type { Leerweg, Vraag } from "./types";
import { CSE_CONTEXTEN, type CseContext } from "./cse-contexten.ts";
import { domeinenUitBron } from "./kalibratie.ts";

/**
 * Blok 'Examenvragen' (alleen klas 4 en examenniveau): 1–2 echte CSE-contexten NaSk1 (2013–2026) die bij het
 * onderwerp passen, licht bewerkt door het model en gemarkeerd met 'naar: examen <jaar> tijdvak <n>',
 * zoals Nick dat in zijn eigen klas-4-toetsen doet. Klas 1–3 krijgen dit nooit.
 */

/** Alleen klas 4 (ook op examenniveau alleen in klas 4); klas 1–3 krijgen nooit letterlijke examentekst. */
export function magExamenvragen(leerjaar: number, _examen = false): boolean {
  return leerjaar === 4;
}

/** Docent wil het blok niet (extra eisen / feedback). */
export function wilGeenExamenvragen(tekst: string): boolean {
  return /\bgeen\s+(?:echte\s+|oude\s+)?examen(?:vragen|contexten|opgaven)\b|\bzonder\s+examenvragen\b/i.test(tekst);
}

export function bronLabel(c: Pick<CseContext, "jaar" | "tijdvak">): string {
  return `naar: examen ${c.jaar} tijdvak ${c.tijdvak}`;
}

/** Aantal contexten in het blok: BB 1 (≈20% van de punten), bij langere toetsen 2; KB/GT 2. */
export function aantalExamenContexten(leerweg: Leerweg, items: number): number {
  if (leerweg === "BB") return items >= 25 ? 2 : 1;
  return items >= 12 ? 2 : 1;
}

/**
 * Kies contexten van dezelfde leerweg die het best bij de lesstof passen (domeinoverlap), met voorkeur voor
 * recente examens en contexten met genoeg vragen zonder figuur. Uit de beste 6 wordt willekeurig gekozen.
 */
export function kiesExamenContexten(bron: string, leerweg: Leerweg, aantal: number, random: () => number = Math.random): CseContext[] {
  const dom = domeinenUitBron(bron).slice(0, 3);
  if (!dom.length || aantal <= 0) return [];
  const score = (c: CseContext) => {
    const overlap = c.domeinen.filter((d) => dom.includes(d)).length;
    const hoofd = c.domeinen[0] && c.domeinen[0] === dom[0] ? 3 : 0;
    return overlap * 10 + hoofd + (c.jaar - 2013) * 0.3 + Math.min(4, c.vragen.length);
  };
  const kandidaten = CSE_CONTEXTEN.filter((c) => c.leerweg === leerweg && c.domeinen.some((d) => dom.includes(d)))
    .map((c) => ({ c, s: score(c) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 6)
    .map((x) => x.c);
  const gekozen: CseContext[] = [];
  const pool = [...kandidaten];
  while (gekozen.length < aantal && pool.length) {
    const i = Math.floor(random() * pool.length);
    const [c] = pool.splice(i, 1);
    if (c && !gekozen.some((g) => g.titel === c.titel)) gekozen.push(c);
  }
  return gekozen;
}

/** Promptblok met de gekozen contexten en de bewerkregels. */
export function examenvragenPrompt(contexten: CseContext[]): string {
  if (!contexten.length) return "";
  const blokken = contexten.map((c) => {
    const vragen = c.vragen
      .map((v) => `  - (${v.p}p, ${v.vorm || "open"}, type ${v.type}) ${v.lead ? `${v.lead} ` : ""}${v.tekst}${v.cv ? `  [correctievoorschrift: ${v.cv}]` : ""}`)
      .join("\n");
    return `Context "${c.titel}" (${bronLabel(c)})\n  Intro: ${c.intro}\n${vragen}`;
  });
  return `EXAMENVRAGEN (klas 4, zoals de docent zelf doet): neem de volgende echte examencontext(en) op als blok 'Examenvragen' aan het EIND van de toets. Regels:
- Zet de titel in het APARTE veld contextTitel (precies de titel hieronder, bij ELKE vraag van die context) en de intro in context van de eerste vraag; bijv. {"contextTitel": "<titel>", "context": "<intro>", "stam": "…"} en daarna {"contextTitel": "<titel>", "context": "", "stam": "…"}. Zet 'Examenvragen' of de titel NIET in context of stam.
- Bewerk licht: verwijzingen naar een figuur, afbeelding of uitwerkbijlage weg (gegevens in de tekst zetten, of die vraag weglaten); getallen en situatie mogen blijven; vervang vragen die niet bij de lesstof passen door een vraag over de lesstof binnen dezelfde context.
- Neem 2–4 vragen per context; nakijkmodel volgens het correctievoorschrift (bij bewerking aanpassen), 1 punt per stap.
- Deze vragen tellen mee in het totaal aantal vragen en punten; de rest van de toets gaat over de overige stof.
${blokken.join("\n\n")}`;
}

function kaal(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");
}

/** CSE-intro zonder verwijzingen naar figuren/uitwerkbijlage (die komen niet mee). */
export function schoonIntro(intro: string): string {
  return intro
    .split(/(?<=[.!?])\s+/)
    .filter((z) => !/afbeelding|figuur|uitwerkbijlage|\bje ziet\b|hieronder|foto|tekening|schema/i.test(z))
    .join(" ")
    .trim();
}

/**
 * Bronvermelding op de vragen van de gekozen examencontexten (deterministisch). Herkent de context aan
 * contextTitel, of (als het model de titel in context/stam zette) aan de titel in de tekst; zet dan
 * contextTitel goed, haalt 'Examenvragen <titel>' uit de context en zorgt dat de eerste vraag de intro heeft.
 */
/** Onderscheidende woorden (≥ 6 letters) uit een CSE-intro, om een bewerkte context terug te vinden. */
function kernwoorden(t: string): Set<string> {
  return new Set(kaal(t).split(/\s+/).filter((w) => w.length >= 6));
}

const EXAMEN_TITEL = /^\s*examen(?:vragen|opgaven)?\b/i;

export function markeerExamenvragen(vragen: Vraag[], contexten: CseContext[]): Vraag[] {
  const gemarkeerd = contexten.length ? markeer(vragen, contexten) : vragen;
  // Een groep die "Examenvragen" heet maar niet op een echte CSE-context terug te voeren is, mag niet
  // doen alsof hij van het examen komt: titel neutraal, geen bronvermelding.
  return gemarkeerd.map((q) =>
    !q.bronvermelding && q.contextTitel && EXAMEN_TITEL.test(q.contextTitel)
      ? { ...q, contextTitel: q.contextTitel.replace(EXAMEN_TITEL, "").replace(/^[\s:–-]+/, "").trim() || "Situatie" }
      : q,
  );
}

function markeer(vragen: Vraag[], contexten: CseContext[]): Vraag[] {
  const gezien = new Set<string>();
  // Groep met titel "Examenvragen" zonder herkenbare titel: zoek de context op inhoud (kernwoorden).
  const perGroep = new Map<string, CseContext>();
  for (const q of vragen) {
    if (!q.contextTitel || !EXAMEN_TITEL.test(q.contextTitel) || perGroep.has(q.contextTitel)) continue;
    const tekst = kaal(vragen.filter((x) => x.contextTitel === q.contextTitel).map((x) => `${x.context ?? ""} ${x.stam}`).join(" "));
    let best: CseContext | undefined;
    let score = 0;
    for (const c of contexten) {
      const n = [...kernwoorden(`${c.titel} ${c.intro}`)].filter((w) => tekst.includes(w)).length;
      if (n > score) [best, score] = [c, n];
    }
    if (best && score >= 3) perGroep.set(q.contextTitel, best);
  }
  return vragen.map((q) => {
    const t = kaal(q.contextTitel ?? "");
    const tekst = kaal(`${q.context ?? ""} ${q.stam}`);
    const c = contexten.find((x) => {
      const k = kaal(x.titel);
      if (t) return k === t || (k.length >= 5 && (t.includes(k) || k.includes(t)));
      return k.length >= 6 && tekst.includes(k) && /examenvragen/i.test(`${q.context ?? ""}`) ;
    });
    const gevonden = c ?? (q.contextTitel ? perGroep.get(q.contextTitel) : undefined);
    if (!gevonden) return q;
    return zetBron(q, gevonden, gezien);
  });
}

function zetBron(q: Vraag, c: CseContext, gezien: Set<string>): Vraag {
  {
    let context = (q.context ?? "").replace(new RegExp(`^\\s*(?:examenvragen\\s*[:\\-–]?\\s*)?${c.titel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:.\\-–]?\\s*`, "i"), "").trim();
    context = context.replace(/^examenvragen\s*[:\-–]?\s*/i, "").trim();
    const eerste = !gezien.has(c.id);
    gezien.add(c.id);
    if (eerste && context.split(/\s+/).length < 8) context = [schoonIntro(c.intro), context].filter(Boolean).join(" ");
    return { ...q, contextTitel: c.titel, bronvermelding: bronLabel(c), context: context || undefined };
  }
}
