import type { Rtti, Vraag } from "./types";

/**
 * Uitlegbare RTTI-labels met vaste regels (Nick gebruikt zelf geen RTTI; Toetski voegt het toe):
 * - R  = feiten/begrippen reproduceren (noem, hoe heet, herkennen);
 * - T1 = toepassen in een bekende (geoefende) situatie: één formule invullen, standaard aflezen;
 * - T2 = toepassen in een nieuwe situatie: meerdere stappen, zelf de aanpak kiezen, factor 2 bij echo, grafiek interpreteren;
 * - I  = inzicht: verklaren, voorspellen, redeneren, een eigen conclusie of advies onderbouwen.
 * Basis = standaard-RTTI per vraagtype (62 examentypen + onderbouwtypen), daarna bijgesteld op
 * opdrachtwoord, aantal stappen/punten en nieuwheid van de context.
 */

export const RTTI_VOLGORDE: Rtti[] = ["R", "T1", "T2", "I"];

/** Standaard-RTTI per vraagtype (hoe de vraag meestal gesteld wordt). */
export const TYPE_RTTI: Record<string, Rtti> = {
  // herkennen / benoemen
  "K-SOORT": "R", "W-FASE": "R", "W-VEIL": "R", "W-AFVAL": "R", "EN-DUUR": "R", "W-STOF": "R", "G-BEREIK": "R",
  "O-HEELAL": "R", "O-WEER": "R",
  // geoefend toepassen
  "E-COMP": "T1", "W-MAT": "T1", "E-VEIL": "T1", "B-VEIL": "T1", "O-LICHT": "T1", "S-EENH": "T1", "W-TEMP-C": "T1",
  "W-TRANS": "T1", "W-VERBR": "T1", "W-CORR": "T1", "EN-SOORT": "T1", "G-OSC": "T1", "G-GEHOOR": "T1", "M-TRAFO": "T1",
  "W-DICHTB": "T1", "K-DRUKB": "T1", "S-AFLEZ": "T1", "E-METER": "T1", "K-ARM": "T1", "S-GRAF": "T1", "K-VECT": "T1",
  "K-HEF": "T1", "G-BRON": "T1", "E-VERM-BEGR": "T1", "E-SCHEMA": "T1", "K-SCHAAL": "T1",
  // één formule
  "W-DICHT": "T1", "B-SNEL": "T1", "E-PUI": "T1", "E-R": "T1", "E-CAP": "T1", "K-DRUK": "T1", "E-REND": "T1", "E-EPT": "T1",
  "E-TRAFO": "T1", "K-FMA": "T1", "B-ACC": "T1", "K-ARB": "T1", "B-EZEK": "T1", "G-FREQ": "T1", "E-KOST": "T1", "E-RV": "T1",
  "W-VBW": "T1",
  // nieuwe situatie / meer stappen / interpreteren
  "E-SERPAR": "T2", "B-DIAG": "T2", "S-VERBAND": "T2", "S-ONDZ": "T2", "K-RES": "T2", "K-NET": "T2", "K-ZWP": "T2",
  "W-DRIJF": "T2", "G-ECHO": "T2", "K-MOM": "T2", "G-DB": "T2", "B-STOP": "T2", "S-CALC-OV": "T2",
  OVERIG: "T1",
};

const INZICHT = /\b(leg\s+uit|verklaar|waarom|beredeneer|voorspel|wat\s+gebeurt\s+er\s+(?:als|met)|geef\s+(?:een\s+)?advies|onderbouw|trek\s+een\s+conclusie|welke\s+conclusie)\b/i;
/** Redeneren over een effect of keuze (niet alleen een geleerd verband navertellen). */
const REDENEER = /\bleg\s+uit\s+of\b|voorspel|advies|conclusie|beredeneer|wat\s+gebeurt\s+er|welke\s+invloed|wat\s+is\s+het\s+gevolg/i;
/** "Leg uit hoe/welke": alleen inzicht als het type zelf al een nieuwe toepassing is (anders een geleerde keten navertellen). */
const REDENEER_ZWAK = /\bleg\s+uit\s+(?:welke|hoe)\b/i;
/** Begrippen uitleggen (verschil, betekenis) is toepassen van geleerde kennis, geen inzicht. */
const BEGRIP_UITLEG = /verschil\s+tussen|wat\s+(?:betekent|het\s+verschil)|wat\s+(?:is|zijn)\s+(?:een|de)\b/i;
const REPRO = /^(?:noteer\s+de\s+naam|noem|noteer|hoe\s+heet|wat\s+is\s+de\s+naam|welke\s+naam|wat\s+betekent)\b/i;
const FORMULE_GEGEVEN = /gebruik\s+(?:de\s+)?formule|formule\s*:|met\s+de\s+formule/i;
const BEREKEN = /\b(bereken|bepaal)\b/i;

function stap(r: Rtti, d: number): Rtti {
  return RTTI_VOLGORDE[Math.max(0, Math.min(3, RTTI_VOLGORDE.indexOf(r) + d))]!;
}

/** Laatste zin (de opdracht) van de stam. */
function opdracht(stam: string): string {
  const zinnen = stam.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean);
  const opdrachtZinnen = zinnen.filter((z) => /^(?:leg|verklaar|bereken|bepaal|noteer|noem|teken|omcirkel|geef|toon|voorspel|beredeneer)\b/i.test(z));
  return [...new Set([...opdrachtZinnen, ...zinnen.slice(-2)])].join(" ") || stam;
}

export interface RttiOordeel {
  rtti: Rtti;
  reden: string;
}

/** RTTI volgens de regels, met korte reden. */
export function rttiVolgensRegels(
  q: Pick<Vraag, "type" | "stam" | "context" | "contextTitel" | "punten" | "vraagtype"> & { opties?: Array<string | { letter?: string; tekst?: string }> | null },
): RttiOordeel {
  const type = (q.vraagtype ?? "OVERIG").toUpperCase();
  const basis = TYPE_RTTI[type] ?? "T1";
  let r = basis;
  const redenen: string[] = [`type ${type} → ${basis}`];
  const stam = q.stam ?? "";
  const op = opdracht(stam);
  const punten = q.punten ?? 1;
  const reken = q.type === "berekening" || BEREKEN.test(op);
  const nieuw = Boolean(q.contextTitel?.trim()) || (q.context ?? "").split(/\s+/).length >= 25;

  const gesloten = q.type === "meerkeuze" || q.type === "juist-onjuist";
  // Getallen tellen alleen als er echt mee gerekend wordt: in de keuzes, of een hoeveel/hoe groot-vraag
  // (r8: "92 dB … Wat is juist over de amplitude?" is geen rekenvraag).
  const optieTekst = (q.opties ?? []).map((o) => (typeof o === "string" ? o : (o?.tekst ?? ""))).join(" ");
  const getallen = /\d/.test(optieTekst) || (/\d/.test(stam) && /hoe\s+groot|hoeveel|hoe\s+lang|hoe\s+ver|bereken|bepaal/i.test(op));

  if (gesloten && punten <= 1 && !reken && !getallen) {
    // Gesloten 1-puntsvraag zonder rekenwerk: herkennen (R) of een geleerd verband toepassen (T1);
    // inzicht (I) of een nieuwe toepassing (T2) toetst een keuzevraag van 1 punt zonder getallen zelden.
    if (q.type === "juist-onjuist" || basis === "R" || REPRO.test(op)) {
      r = "R";
      redenen.push("gesloten stelling/keuze over een feit of begrip");
    } else {
      r = "T1";
      redenen.push(INZICHT.test(op) ? "gesloten keuze: geleerd verband herkennen" : "gesloten keuze: geleerd verband toepassen");
    }
  } else if (gesloten && punten <= 1 && getallen && basis === "R") {
    r = "T1";
    redenen.push("keuzevraag met getallen: kort toepassen");
  } else if (punten <= 1 && !reken && REPRO.test(op.split(/(?<=[.?!])\s+/).pop() ?? op)) {
    r = "R";
    redenen.push("noem/noteer een feit of begrip");
  } else if (INZICHT.test(op) && BEGRIP_UITLEG.test(op) && !REDENEER.test(op)) {
    r = "T1";
    redenen.push("begrip of verschil uitleggen (geleerde kennis)");
  } else if (INZICHT.test(op)) {
    const hoog = RTTI_VOLGORDE.indexOf(basis) >= 2;
    r = REDENEER.test(op) || (hoog && (REDENEER_ZWAK.test(op) || /waarom|verklaar/i.test(op))) ? "I" : "T2";
    redenen.push(r === "I" ? "redeneren/verklaren" : "geleerd verband uitleggen in deze situatie");
  } else if (reken) {
    if (FORMULE_GEGEVEN.test(stam) && punten <= 2) {
      r = "T1";
      redenen.push("formule gegeven, 1 stap");
    } else if (punten >= 3 && r === "T1") {
      r = "T2";
      redenen.push(`${punten} stappen, zelf aanpak kiezen`);
    } else if (punten <= 2 && r === "T2" && type !== "G-ECHO") {
      r = "T1";
      redenen.push("korte standaardberekening");
    } else redenen.push(r === "T1" ? "één formule toepassen" : "meerstaps");
    if (nieuw && r === "T1" && punten >= 3) {
      r = "T2";
      redenen.push("nieuwe context");
    }
  } else if (punten <= 1 && (REPRO.test(opdracht(stam).split(/(?<=[.?!])\s+/).pop() ?? "") || q.type === "juist-onjuist" || basis === "R") && RTTI_VOLGORDE.indexOf(basis) <= 1) {
    r = basis === "R" || REPRO.test(op) ? "R" : basis;
    redenen.push(r === "R" ? "feit of begrip reproduceren" : "kort toepassen van een geleerd verband");
  } else if (punten >= 2 && r === "R") {
    r = "T1";
    redenen.push("meer dan één punt: toepassen");
  } else if (nieuw && r === "R" && q.type === "meerkeuze") {
    r = "T1";
    redenen.push("herkennen in een nieuwe context");
  }
  return { rtti: r, reden: redenen.join("; ") };
}

/**
 * Definitief label: de regel beslist (consistent en uitlegbaar). Een afwijkend modellabel staat erbij
 * in de uitleg, zodat de docent ziet waar de controle anders dacht.
 */
export function labelRtti(vragen: Vraag[]): Vraag[] {
  return vragen.map((q) => {
    // Alleen bij een vraagtype (NaSk-taxonomie); andere vakken houden het modellabel.
    if (!q.vraagtype?.trim()) return q;
    let o = rttiVolgensRegels(q);
    // Gepland als I (bouwplan) en de regel zegt T2 bij een redeneer-/verklaaropdracht van ≥ 2 punten:
    // het grensgeval valt naar het geplande I (nieuwe situatie + eigen redenering), anders verdwijnt elke I-vraag.
    if (q.rtti === "I" && o.rtti === "T2" && (q.punten ?? 1) >= 2 && INZICHT.test(opdracht(q.stam ?? ""))) {
      o = { rtti: "I", reden: `${o.reden}; gepland als I: redeneren in een nieuwe situatie` };
    }
    const anders = q.rtti && q.rtti !== o.rtti ? ` (model: ${q.rtti})` : "";
    return { ...q, rtti: o.rtti, rttiUitleg: `${o.rtti}: ${o.reden}${anders}` };
  });
}

/** Stap omhoog/omlaag (voor tests en balans). */
export const rttiStap = stap;
