/** Gedeelde opmaakgegevens (zoals build.py): SE-kleuren, teksten, toetsmatrijs-totalen. Gebruikt door PDF en Word. */
import type { OpmaakVraag, SeCode, ToetsSpec } from "./spec.ts";

export const SE_INFO: Record<SeCode, { naam: string; kleur: string; tint: string }> = {
  "SE4.1": { naam: "Krachten en werktuigen", kleur: "#1f6fb2", tint: "#e3eef8" },
  "SE4.2": { naam: "Energie (H11), Geluid (H13), materie en Binas", kleur: "#2e8b57", tint: "#e2f2e8" },
  "SE4.3": { naam: "Elektriciteit", kleur: "#d35400", tint: "#fbeadb" },
  "SE4.4": { naam: "Arbeid en kracht (arbeid, vermogen, rendement, beweging)", kleur: "#8e44ad", tint: "#f0e4f5" },
  ALG: { naam: "Algemene vaardigheden (grafiek, aflezen, eenheden, onderzoek, rekenen)", kleur: "#6c7a7d", tint: "#eceff0" },
};
export const SE_ORDE: SeCode[] = ["SE4.1", "SE4.2", "SE4.3", "SE4.4", "ALG"];
export const seNaam = (k: SeCode) => (k === "ALG" ? "Algemeen" : k);

/** Klas 1–3: geen SE-toetsen/PTA, maar onderwerpen (zelfde kleuren). */
export const ONDERWERP: Record<SeCode, { kort: string; lang: string; letter: string }> = {
  "SE4.1": { kort: "Krachten", lang: "Krachten, druk en werktuigen", letter: "K" },
  "SE4.2": { kort: "Geluid, energie, stoffen", lang: "Geluid, energie, stoffen en materie", letter: "M" },
  "SE4.3": { kort: "Elektriciteit", lang: "Elektriciteit", letter: "E" },
  "SE4.4": { kort: "Beweging", lang: "Arbeid, vermogen en beweging", letter: "B" },
  ALG: { kort: "Algemeen", lang: "Algemene vaardigheden (grafiek, aflezen, eenheden, rekenen)", letter: "A" },
};
/** SE-indeling alleen in klas 4 (of als de klas onbekend is, zoals de vaste voorbeeldtoets). */
export const isSeToets = (jaar?: number) => jaar === undefined || jaar >= 4;
/** Onderwerplabel uit de inhoud (klas 1–3; gezet door de pijplijn), bv. "Geluid" i.p.v. "Geluid, energie, stoffen". */
export const ondVan = (vragen: { se: SeCode; onderwerp?: string }[], k: SeCode) => vragen.find((q) => q.se === k && q.onderwerp)?.onderwerp;
export const seLabel = (k: SeCode, jaar?: number, ond?: string) => (isSeToets(jaar) ? seNaam(k) : (ond ?? ONDERWERP[k].kort));
export const seOmschrijving = (k: SeCode, jaar?: number, ond?: string) => (isSeToets(jaar) ? SE_INFO[k].naam : (ond ?? ONDERWERP[k].lang));
export const indelingKop = (jaar?: number) => (isSeToets(jaar) ? "SE-toets" : "Onderwerp");
export const jaarVan = (vragen: { jaar?: number }[]) => vragen[0]?.jaar;

/** Uitleg van de indeling in het docentdeel, passend bij klas en leerweg. */
export function uitlegIndeling(klas?: { leerjaar: number; leerweg: string }): string {
  if (!klas || klas.leerjaar >= 4)
    return `De vragen zijn ingedeeld per SE-toets van het PTA klas 4 ${klas?.leerweg ?? "GT"}. Elke SE-toets heeft een eigen kleur; de code (bijvoorbeeld SE4.2-03) geeft de toets en het volgnummer binnen die toets. Vaardigheden die bij alle toetsen horen, staan onder Algemeen (grijs).`;
  return `De vragen zijn ingedeeld per onderwerp (klas ${klas.leerjaar} ${klas.leerweg}). Elk onderwerp heeft een eigen kleur; de code (bijvoorbeeld E-03) geeft het onderwerp en het volgnummer binnen dat onderwerp. Vaardigheden die bij alle onderwerpen horen, staan onder Algemeen (grijs).`;
}

export const INSTRUCTIE =
  "Je mag Binas en een rekenmachine gebruiken. Gebruik g = 10 N/kg, tenzij anders vermeld. Schrijf bij rekenvragen altijd de formule, de berekening en het antwoord met de eenheid op. Bij een tekenvraag teken je in de figuur.";
export const UITLEG_SE = uitlegIndeling();
export const UITLEG_DOCENT =
  "<b>Bij het antwoordmodel.</b> Het antwoordmodel volgt de opbouw van het correctievoorschrift van het CvTE: maximumscore, antwoord en de verdeling van de scorepunten. Bij een meerkeuzevraag krijgt alleen de juiste letter het scorepunt. <b>RTTI:</b> R = reproductie, T1 = toepassen in een bekende situatie, T2 = toepassen in een nieuwe situatie, I = inzicht. <b>Niveau:</b> de examenniveaus waarin dit vraagtype voorkomt. Alle berekeningen zijn in code nagerekend en alle figuren automatisch gecontroleerd. Krachtenfiguren zijn op schaal 1 : 1 afgedrukt.";

export function bandTekst(q: OpmaakVraag): { links: string; rechts: string } {
  const extra = q.niveau !== "BB/KB/GT" ? ` · <font color="#b03a2e">${q.niveau}</font>` : "";
  return {
    links: q.code,
    rechts: `Type ${q.vraagtype.nr} · ${q.vraagtype.naam} <small>(${q.vraagtype.code})</small><br/><small>Onderwerp: ${q.hoofdstuk}${extra}</small>`,
  };
}

export function rttiRegel(q: OpmaakVraag): string {
  const cse = q.vraagtype.cse ? ` (voorkomen CSE 2013–2026: BB ${q.vraagtype.cse[0]} · KB ${q.vraagtype.cse[1]} · GT ${q.vraagtype.cse[2]})` : "";
  const alt = q.ookIn ? ` · ook relevant voor: ${q.ookIn}` : "";
  return `<b>RTTI:</b> ${q.rtti} · <b>Niveau:</b> ${q.niveau}${cse}${alt}`;
}

export function antwoordKop(q: OpmaakVraag): string {
  return q.opties ? `<b>Antwoordmodel</b> — maximumscore ${q.punten} · juiste antwoord: <b>${q.antwoordmodel.juist}</b>` : `<b>Antwoordmodel</b> — maximumscore ${q.punten}`;
}

export interface Totaal {
  sleutel: string;
  vragen: number;
  punten: number;
  pct: number;
}

function totaal<K extends string>(vragen: OpmaakVraag[], sleutel: (q: OpmaakVraag) => K, orde: K[]): Totaal[] {
  const som = vragen.reduce((s, q) => s + q.punten, 0) || 1;
  return orde
    .map((k) => {
      const qs = vragen.filter((q) => sleutel(q) === k);
      const p = qs.reduce((s, q) => s + q.punten, 0);
      return { sleutel: k, vragen: qs.length, punten: p, pct: Math.round((1000 * p) / som) / 10 };
    })
    .filter((t) => t.vragen > 0);
}

export function matrijsTotalen(vragen: OpmaakVraag[]) {
  return {
    perSe: totaal(vragen, (q) => q.se, SE_ORDE),
    perRtti: totaal(vragen, (q) => q.rtti, ["R", "T1", "T2", "I"]),
    perNiveau: totaal(vragen, (q) => q.niveau, ["BB/KB/GT", "vooral KB/GT", "vooral GT"]),
    perHoofdstuk: totaal(vragen, (q) => q.hoofdstuk, [...new Set(vragen.map((q) => q.hoofdstuk))]),
    punten: vragen.reduce((s, q) => s + q.punten, 0),
    vragen: vragen.length,
  };
}

/** Vraagnummers van een vraagstuk, bv. "6–9". */
export function vraagstukBereik(vragen: OpmaakVraag[], id: string): string {
  const nrs = vragen.filter((q) => q.vraagstuk?.id === id).map((q) => q.nr);
  return nrs.length > 1 ? `${nrs[0]}–${nrs[nrs.length - 1]}` : String(nrs[0] ?? "");
}

// ── Leerlingdeel: voorblad (schooltoetsen + Toetski-leerlingblad) en CSE-opbouw per vraag ──────────────────────

/** Instructiepagina na het voorblad (zoals pagina 2 van het CSE), aangepast aan antwoorden in het boekje. */
export const INSTRUCTIE_CSE: { kop: string; regels: string[] }[] = [
  { kop: "Meerkeuzevragen", regels: ["Schrijf alleen de hoofdletter van het goede antwoord op."] },
  {
    kop: "Open vragen",
    regels: [
      "Schrijf je antwoord op de lijnen onder de vraag. Bij een tekenvraag teken je in de figuur.",
      "Geef niet méér antwoorden dan er worden gevraagd. Als er bijvoorbeeld twee redenen worden gevraagd, geef er dan twee en niet méér. Alleen de eerste twee redenen kunnen punten opleveren.",
      "Vermeld altijd de berekening, als een berekening gevraagd wordt. Als een gedeelte van de berekening goed is, kan dat punten opleveren. Een goede uitkomst zonder berekening levert geen punten op.",
      "Vermeld bij een berekening altijd welke grootheid berekend wordt.",
      "Geef de uitkomst van een berekening ook altijd met de juiste eenheid.",
      "Gebruik g = 10 N/kg, tenzij anders vermeld.",
    ],
  },
];

/** Invulvelden van het Toetski-leerlingblad (twee kolommen). */
export const INVULVELDEN: [string, string][] = [
  ["Naam", "Klas"],
  ["Datum", "Extra tijd 20%"],
  ["Behaalde punten", "Cijfer"],
];

export interface VoorbladTekst {
  schoolveld: string;
  kop: string;
  schooljaar: string;
  rechts: string[];
  balk: string;
  hulpmiddelen: string[];
  delenZin: string;
  onder: string[];
  cesuur: string;
  voetcode: string;
}

/** Alle teksten van het voorblad; lege velden vallen weg. Geen schoolnaam/logo: alleen `schoolveld` (standaard leeg). */
export function voorbladTekst(
  t: ToetsSpec,
  vragen: OpmaakVraag[],
  deel: { naam: string; nrs: number[] } | null,
  delen: { naam: string; nrs: number[] }[],
  cesuurTekst: string,
): VoorbladTekst {
  const v = t.voorblad ?? {};
  const p = vragen.reduce((s, q) => s + q.punten, 0);
  const bereik = (d: { nrs: number[] }) => `vraag ${d.nrs[0]}–${d.nrs[d.nrs.length - 1]}`;
  const ditDeel = deel && delen.length > 1;
  const hulp = [...(v.uitwerkbijlage ? ["Bij deze toets hoort een uitwerkbijlage."] : []), ...(v.hulpmiddelen ?? ["Gebruik het BINAS informatieboek.", "Je mag een rekenmachine gebruiken."])];
  return {
    schoolveld: v.schoolveld?.trim() ?? "",
    kop: [v.kop ?? t.titel, v.leerweg].filter(Boolean).join(" "),
    schooljaar: v.schooljaar ?? "",
    rechts: [v.seCode, ditDeel ? `${deel!.naam} · ${bereik(deel!)}` : "", v.toetscode, t.minuten ? `${t.minuten} minuten` : ""].filter((x): x is string => Boolean(x)),
    balk: v.vak ?? "",
    hulpmiddelen: hulp,
    delenZin: delen.length > 1 ? `Deze toets bestaat uit ${delen.length === 2 ? "twee" : delen.length} delen: ${delen.map((d) => `${d.naam.replace(/^Deel/, "deel")} (${bereik(d)})`).join(" en ")}.` : "",
    onder: [
      `${ditDeel ? "Dit deel" : "Deze toets"} bestaat uit ${vragen.length} ${vragen.length === 1 ? "vraag" : "vragen"}.`,
      `Voor ${ditDeel ? "dit deel" : "deze toets"} zijn maximaal ${p} punten te behalen.`,
      "Voor elk vraagnummer staat hoeveel punten met een goed antwoord behaald kunnen worden.",
    ],
    cesuur: v.cesuur === false ? "" : cesuurTekst,
    voetcode: v.voetcode?.trim() ?? "",
  };
}

/** Contexttitel zoals in het CSE: de titel van het vraagstuk, of de titel van een losse vraag. */
export function contextTitel(q: OpmaakVraag): string | null {
  if (q.vraagstuk) return q.vraagstuk.eerste ? q.vraagstuk.titel : null;
  return q.titel ?? null;
}

/**
 * CSE-formulering (vmbo): opdrachten beginnen met een werkwoord in de gebiedende wijs (Bereken, Leg uit, Noteer,
 * Teken, Construeer, Bepaal, Omcirkel, Toon aan, Geef, Maak …) of zijn een vraag (MC). Verwijzingen als "zie
 * figuur", "hieronder" of "In de figuur is …" worden in het CSE geschreven als "Je ziet …". Geen figuurnummers.
 */
const OPDRACHT = /^(Bereken|Leg uit|Noteer|Teken|Construeer|Bepaal|Omcirkel|Toon|Geef|Maak|Zet|Kruis|Beschrijf|Vergelijk|Leg|Deel)\b/;
export function formuleringCSE(q: { stam: string; context?: string[]; opties?: string[] }): string[] {
  const f: string[] = [];
  const stam = q.stam.trim();
  if (!OPDRACHT.test(stam) && !stam.endsWith("?")) f.push(`opdracht begint niet met een CSE-werkwoord en is geen vraag: "${stam}"`);
  if (q.opties && !stam.endsWith("?")) f.push("meerkeuzevraag eindigt niet met een vraagteken");
  if (/Leg je antwoord uit/.test(stam)) f.push('"Leg je antwoord uit" → CSE: "Leg uit …"');
  for (const c of q.context ?? []) {
    if (/\(zie (figuur|schakelschema|tabel|afbeelding)\)/i.test(c)) f.push(`"(zie …)" in de context → CSE: "Je ziet …"`);
    if (/\bhieronder\b/i.test(c)) f.push(`"hieronder" in de context → CSE: "Je ziet …"`);
    if (/\b[Ii]n de figuur (is|zijn|staat|staan)\b/.test(c)) f.push(`"In de figuur is …" in de context → CSE: "Je ziet …"`);
  }
  if (/\b[Ff]iguur \d/.test([stam, ...(q.context ?? [])].join(" "))) f.push("figuurnummer (vmbo-CSE nummert figuren niet)");
  for (const o of q.opties ?? []) if (/\.$/.test(o.trim())) f.push(`meerkeuzeoptie eindigt op een punt: "${o}"`);
  return f;
}
