import type { NakijkItem, Vraag } from "./types";

/**
 * Contextregels (hard): nooit een schoolnaam in vragen. De schoolnaam mag alleen in de kop/branding.
 * Detectie + deterministische reparatie (vervangen door een verzonnen, neutrale bedrijfsnaam).
 */
const EIGEN = String.raw`(?:Aeres|Ares\s*0?58|Ares)(?:\s+(?:VMBO|vmbo|MBO|mbo|College|Hogeschool))?(?:\s+Leeuwarden)?`;
const EIGEN_RE = new RegExp(String.raw`\b${EIGEN}\b`, "g");
const ANDERE_SCHOOL_RE = /\b(?:[A-Z][\wÀ-ÿ'-]+\s){0,2}(?:College|Lyceum|Scholengemeenschap|Gymnasium|Vakcollege|Scholengroep)\b|\b(?:CSG|RSG|OSG|SG)\s+[A-Z][\wÀ-ÿ'-]+/g;
const SCHOOL_LEERBEDRIJF_RE = /\b(?:het\s+)?(?:leerbedrijf|praktijklokaal|schoolerf|schoolkas|schoolboerderij)(?:\s+van\s+(?:de\s+|onze\s+)?school)?\b/gi;

export function bevatSchoolnaam(tekst: string | undefined): boolean {
  if (!tekst) return false;
  EIGEN_RE.lastIndex = 0;
  ANDERE_SCHOOL_RE.lastIndex = 0;
  return EIGEN_RE.test(tekst) || ANDERE_SCHOOL_RE.test(tekst) || /\bleerbedrijf\b|\bschool(?:erf|kas|boerderij)\b|\bvan (?:de |onze )?school\b/i.test(tekst);
}

function bedrijfVoor(zin: string): string {
  if (/\b(erf|stal|koe|koeien|trekker|boerderij|voer|melk)/i.test(zin)) return "Boerderij De Vrolijke Koe";
  if (/\b(kas|plant|tomaat|tomaten|kweker|bloem)/i.test(zin)) return "Kwekerij De Groene Duim";
  if (/\b(frituur|keuken|eten|patat)/i.test(zin)) return "Frituur De Vette Hap";
  if (/\b(fiets|band|ketting)/i.test(zin)) return "Fietsenmaker Van Dijk";
  if (/\b(hout|zaag|versnipper|timmer)/i.test(zin)) return "Houthandel De Knoest";
  return "Bedrijf Van der Meer";
}

/** Vervangt schoolnamen en school-leerbedrijf-verwijzingen door een verzonnen bedrijf. */
export function verwijderSchoolnamen(tekst: string): string;
export function verwijderSchoolnamen(tekst: string | undefined): string | undefined;
export function verwijderSchoolnamen(tekst: string | undefined): string | undefined {
  if (!tekst) return tekst;
  const bedrijf = bedrijfVoor(tekst);
  let s = tekst
    // "het erf van Ares058", "de kas van Aeres VMBO" → "het erf van <bedrijf>"
    .replace(new RegExp(String.raw`\b(van|bij|op|in|naar)\s+(?:de\s+|het\s+)?(?:school\s+)?${EIGEN}\b`, "g"), `$1 ${bedrijf}`)
    // "leerbedrijf Ares058" → "<bedrijf>"
    .replace(new RegExp(String.raw`\b(?:het\s+|op\s+het\s+)?leerbedrijf\s+${EIGEN}\b`, "gi"), (m) => (/^op/i.test(m) ? `bij ${bedrijf}` : bedrijf))
    .replace(EIGEN_RE, bedrijf)
    .replace(ANDERE_SCHOOL_RE, "de school")
    .replace(/\bop het leerbedrijf\b/gi, `bij ${bedrijf}`)
    .replace(/\b(de|het) leerbedrijf\b/gi, bedrijf)
    .replace(SCHOOL_LEERBEDRIJF_RE, bedrijf);
  s = s.replace(/\s{2,}/g, " ");
  return s;
}

/** Past de schoolnaamregel toe op vraag + nakijkregel. Geeft aan of er iets is aangepast. */
export function repareerSchoolnamen(q: Vraag, n: NakijkItem | undefined): boolean {
  const voor = JSON.stringify([q.context, q.stam, q.opties, n?.modelantwoord, n?.puntenverdeling]);
  if (q.context) q.context = verwijderSchoolnamen(q.context);
  q.stam = verwijderSchoolnamen(q.stam);
  if (q.opties) q.opties = q.opties.map((o) => ({ ...o, tekst: verwijderSchoolnamen(o.tekst) }));
  if (n) {
    n.modelantwoord = verwijderSchoolnamen(n.modelantwoord);
    n.puntenverdeling = (n.puntenverdeling ?? []).map((p) => ({ ...p, criterium: verwijderSchoolnamen(p.criterium) }));
  }
  return voor !== JSON.stringify([q.context, q.stam, q.opties, n?.modelantwoord, n?.puntenverdeling]);
}

/**
 * Verwijzingen zonder antecedent: "de installatie", "dit apparaat", "deze machine" zonder dat het ding
 * eerder in de context/stam (of een eerdere gedeelde context) is geïntroduceerd.
 */
const VERWIJS_ZELFST = "installatie|apparaat|machine|toestel|opstelling|situatie";
export function onopgeloste(tekst: string, eerder = ""): string[] {
  const out: string[] = [];
  const re = new RegExp(String.raw`\b(de|het|dit|deze|die)\s+((?:[a-zà-ÿ-]+\s+)?(${VERWIJS_ZELFST}))\b`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(tekst))) {
    const woord = m[3]!.toLowerCase();
    if (woord === "situatie") continue; // 'de situatie' is neutraal genoeg
    const voor = `${eerder} ${tekst.slice(0, m.index)}`.toLowerCase();
    // Geïntroduceerd als er vóór deze plek al een (onbepaald of bepaald) zelfstandig naamwoord met dit woord staat.
    const geintroduceerd = new RegExp(String.raw`\b(een|twee|drie|zijn|haar|hun|nieuwe|nieuw)\s+(?:[a-zà-ÿ-]+\s+){0,2}[a-zà-ÿ-]*${woord}`, "i").test(voor) || new RegExp(`[a-zà-ÿ]+${woord}\\b`, "i").test(voor);
    if (!geintroduceerd) out.push(m[0]);
  }
  return out;
}

const FIGUUR_REF = /\b(?:de|het|dit|deze|die|onderstaande|bovenstaande)\s+(figuur|grafiek|diagram|afbeelding|plaatje|tekening|foto|pictogram|symbool|bord|waarschuwingsbord|schema|schakelschema|tabel)\b|\bkijk naar\b|\bzie (?:figuur|de figuur|hieronder)\b|\b(?:figuur|grafiek|tabel)\s+\d+\b|\bhieronder\b|\bhiernaast\b/gi;

/** Welke figuurverwijzingen staan in de tekst, gegeven wat er bij de vraag echt aanwezig is. */
export function figuurVerwijzingenZonderFiguur(q: Vraag, n?: NakijkItem): string[] {
  const heeftBeeld = Boolean(q.figuur || q.figuurId || q.grafiek || q.schemaFiguur || q.pictogram || q.maatcilinder);
  const heeftTabel = Boolean(q.tabel);
  const teksten = [q.context ?? "", q.stam, ...(q.opties ?? []).map((o) => o.tekst), n?.modelantwoord ?? "", ...(n?.puntenverdeling ?? []).map((p) => p.criterium)];
  const out: string[] = [];
  for (const t of teksten) {
    FIGUUR_REF.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = FIGUUR_REF.exec(t))) {
      const woord = (m[1] ?? "").toLowerCase();
      if (woord === "tabel") {
        if (!heeftTabel) out.push(m[0]);
        continue;
      }
      if (/hieronder|hiernaast|kijk naar|zie/i.test(m[0]) && (heeftBeeld || heeftTabel)) continue;
      if (!heeftBeeld) out.push(m[0]);
    }
  }
  // Aanduiden op een voorwerp ("geef het draaipunt aan", "teken de armen") kan alleen als dat voorwerp getekend is.
  if (!heeftBeeld) {
    const zin = (q.stam.match(/[^.!?]+[.!?]*/g) ?? []).find((z) => AANDUIDEN.some((re) => re.test(z)) && !/hoe\s+groot|bereken|hoeveel/i.test(z));
    if (zin) out.push(zin.trim());
  }
  return [...new Set(out)];
}

/** Een plek op een (niet getekend) voorwerp aanwijzen of er iets in tekenen. */
const PLEK = String.raw`\b(?:aangrijpingspunt(?:en)?|draaipunt|zwaartepunt|armen|arm|werklijn(?:en)?)\b`;
const AANDUIDEN = [
  new RegExp(String.raw`\b(?:teken|markeer|omcirkel)\b[^.?!]{0,60}?` + PLEK, "i"),
  new RegExp(String.raw`\bgeef\b[^.?!]{0,60}?` + PLEK + String.raw`[^.?!]{0,40}\baan\b`, "i"),
];

function zinnen(t: string): string[] {
  return t.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((z) => z.trim()).filter(Boolean) ?? [];
}

const LOS_FIGUURDEEL = /\s*\b(?:in|op|uit|van|bij|volgens)\s+(?:de|het|dit|deze|onderstaande|bovenstaande)\s+(?:figuur|grafiek|diagram|afbeelding|plaatje|tekening|foto|schema)(?:\s+(?:hieronder|hierboven|hiernaast))?\b/gi;

/**
 * Laatste bewaking: een vraag zonder figuur mag nergens naar een figuur verwijzen.
 * 1) losse verwijszinnen ("Kijk naar de grafiek hieronder.") weg; 2) "in de figuur" uit de vraagzin;
 * 3) blijft er een verwijzing over (bijv. "Wat betekent dit pictogram?") → de vraag is zonder beeld
 * niet te maken en gaat eruit. Geeft de gerepareerde vragen/nakijkregels en meldingen terug.
 */
export function borgFiguurVerwijzingen(
  vragen: Vraag[],
  nakijk: NakijkItem[],
): { vragen: Vraag[]; nakijkmodel: NakijkItem[]; meldingen: string[]; verwijderd: number[]; hernummer?: Map<number, number> } {
  const meldingen: string[] = [];
  const verwijderd: number[] = [];
  const uitV: Vraag[] = [];
  let uitN = nakijk.slice();
  for (const q0 of vragen) {
    const n0 = nakijk.find((x) => x.nummer === q0.nummer);
    if (!figuurVerwijzingenZonderFiguur(q0, n0).length) {
      uitV.push(q0);
      continue;
    }
    const q: Vraag = { ...q0 };
    const schoon = (t: string | undefined, vraagZin: boolean): string | undefined => {
      if (!t) return t;
      const delen = zinnen(t);
      const blijf = delen.filter((z) => {
        FIGUUR_REF.lastIndex = 0;
        const ref = FIGUUR_REF.test(z);
        if (!ref) return true;
        const isVraag = /\?\s*$/.test(z);
        if (isVraag && vraagZin) return true;
        // Een zin die alleen naar het beeld verwijst mag weg.
        return /\b(?:\d+(?:[.,]\d+)?\s*(?:m|s|km|dB|Hz|N|kg|g|°C|V|A|W|J|min|uur)\b)/.test(z.replace(LOS_FIGUURDEEL, ""));
      });
      return blijf.map((z) => z.replace(LOS_FIGUURDEEL, "").replace(/\s{2,}/g, " ").replace(/\s+([,.?!])/g, "$1")).join(" ").trim();
    };
    const voorTekst = `${q.context ?? ""} ${q.stam}`;
    q.context = schoon(q.context, false) || undefined;
    q.stam = schoon(q.stam, true) ?? q.stam;
    // Stond de introductie van het voorwerp ("... op een pot") alleen in een weggehaalde zin, dan is de rest
    // ("voordat Emma de pot opent") zonder antecedent: dan liever de vraag eruit dan een kapotte zin.
    const naTekst = `${q.context ?? ""} ${q.stam}`;
    const weg = zinnen(voorTekst).filter((z) => !naTekst.includes(z.replace(LOS_FIGUURDEEL, "").trim())).join(" ").toLowerCase();
    const wees = [...naTekst.matchAll(/\b(?:de|het|deze|dit|die)\s+([a-zà-ÿ]{3,})\b/gi)].some((m) => {
      const w = m[1]!.toLowerCase();
      if (/^(figuur|grafiek|tabel|stof|vraag|antwoord|zin|volgende|juiste|eenheid|formule)$/.test(w)) return false;
      return new RegExp(`\\b${w}\\b`).test(weg) && !new RegExp(`\\b(?:een|twee|drie)\\s+(?:[a-zà-ÿ-]+\\s+)?${w}\\b`, "i").test(naTekst);
    });
    const n = n0 ? { ...n0, puntenverdeling: (n0.puntenverdeling ?? []).map((p) => ({ ...p, criterium: p.criterium.replace(LOS_FIGUURDEEL, "").trim() })) } : undefined;
    if (!wees && !figuurVerwijzingenZonderFiguur(q, n).length && q.stam.trim().length > 10) {
      uitV.push(q);
      if (n) uitN = uitN.map((x) => (x.nummer === n.nummer ? n : x));
      meldingen.push(`Vraag ${q.nummer}: verwijzing naar een figuur weggehaald (er staat geen figuur bij).`);
      continue;
    }
    verwijderd.push(q0.nummer);
    uitN = uitN.filter((x) => x.nummer !== q0.nummer);
    meldingen.push(`Vraag ${q0.nummer} verwijderd: verwijst naar een figuur die er niet is (en is zonder figuur niet te maken).`);
  }
  if (!verwijderd.length) return { vragen: uitV, nakijkmodel: uitN, meldingen, verwijderd };
  // Hernummeren (vraag en nakijkregel samen).
  const kaart = new Map<number, number>();
  uitV.forEach((q, i) => kaart.set(q.nummer, i + 1));
  return {
    vragen: uitV.map((q) => ({ ...q, nummer: kaart.get(q.nummer)! })),
    nakijkmodel: uitN.filter((x) => kaart.has(x.nummer)).map((x) => ({ ...x, nummer: kaart.get(x.nummer)! })),
    meldingen,
    verwijderd,
    hernummer: kaart,
  };
}
