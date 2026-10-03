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

export const UITLEG_SE = uitlegIndeling();
export const UITLEG_DOCENT =
  "<b>Bij het antwoordmodel.</b> Het antwoordmodel volgt de opbouw van het correctievoorschrift van het CvTE: maximumscore, antwoord en de verdeling van de scorepunten. Bij een meerkeuzevraag krijgt alleen de juiste letter het scorepunt. <b>RTTI:</b> R = reproductie, T1 = toepassen in een bekende situatie, T2 = toepassen in een nieuwe situatie, I = inzicht. <b>Niveau:</b> de examenniveaus waarin dit vraagtype voorkomt. Alle berekeningen zijn in code nagerekend en alle figuren automatisch gecontroleerd. Krachtenfiguren zijn op schaal 1 : 1 afgedrukt.";

/** Leesbare naam van het vraagtype, zonder interne code tussen haakjes. */
export const vraagtypeNaam = (q: Pick<OpmaakVraag, "vraagtype">) => (q.vraagtype.naam ?? "").replace(/\s*\([A-Z]+(?:-[A-Z0-9]+)+\)\s*$/, "").trim() || "–";
/** Vraagtype met het nummer uit de bundel "62 vraagtypen" (de code die de docent kent), bv. "Vraagtype 17 · Weerstand berekenen". */
/** Leerdoel met het examendoel erachter, voor de matrijs. */
export const leerdoelMetDoel = (q: Pick<OpmaakVraag, "leerdoel" | "examendoel">) => `${q.leerdoel ?? "–"}${q.examendoel ? ` (${q.examendoel})` : ""}`;
export const vraagtypeLabel = (q: Pick<OpmaakVraag, "vraagtype">) => (q.vraagtype.nr && q.vraagtype.nr <= 62 ? `Vraagtype ${q.vraagtype.nr} · ${vraagtypeNaam(q)}` : vraagtypeNaam(q));
/** Sleutel voor de spreiding in de matrijs: "17 Weerstand berekenen" (63/overig onder "Overig"). */
export const typeSleutel = (q: Pick<OpmaakVraag, "vraagtype">) => (q.vraagtype.nr && q.vraagtype.nr <= 62 ? `${q.vraagtype.nr} ${vraagtypeNaam(q)}` : "Overig");

/** Paragraafcode uit het leerdoel ("13.2 frequentie …" → "13.2"); anders het hoofdstuk. */
export const paragraafVan = (q: Pick<OpmaakVraag, "leerdoel" | "hoofdstuk">) => /\b(\d{1,2}\.\d{1,2})\b/.exec(q.leerdoel ?? "")?.[1] ?? q.hoofdstuk;

export function bandTekst(q: OpmaakVraag): { links: string; rechts: string } {
  const extra = q.niveau !== "BB/KB/GT" ? ` · <font color="#b03a2e">${q.niveau}</font>` : "";
  return {
    links: q.code,
    // Geen interne codes (typenummer, E-COMP …) in de export; wel het leerdoel per vraag.
    rechts: `${vraagtypeLabel(q)}<br/><small>Onderwerp: ${q.hoofdstuk}${extra}</small>${q.leerdoel || q.examendoel ? `<br/><small>Leerdoel: ${q.leerdoel ?? ""}${q.examendoel ? ` (${/^SLO/.test(q.examendoel) ? "kerndoel" : "eindterm"} ${q.examendoel})` : ""}</small>` : ""}`,
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
    /** Leerdoeldekking: per paragraaf (code uit het leerdoel) hoeveel vragen en punten. */
    perParagraaf: totaal(vragen, paragraafVan, [...new Set(vragen.map(paragraafVan))].sort((a, b) => a.localeCompare(b, "nl", { numeric: true }))),
    /** Spreiding van de vraagtypen (nummer uit de 62 vraagtypen). */
    perVraagtype: totaal(vragen, typeSleutel, [...new Set(vragen.map(typeSleutel))].sort((a, b) => a.localeCompare(b, "nl", { numeric: true }))),
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

/** Wat de vragen van de leerling vragen: bepaalt welke instructies en hulpmiddelen op het voorblad komen. */
export interface ToetsKenmerken {
  mc: boolean;
  open: boolean;
  lijnen: boolean;
  teken: boolean;
  reken: boolean;
  meerdere: boolean;
  g: boolean;
  binas: boolean;
}

const platTekst = (q: OpmaakVraag) =>
  [q.stam, ...(q.context ?? []), ...(q.gedeeldeContext ?? []), ...(q.aanloop ?? []), ...(q.opties ?? []), ...q.antwoordmodel.regels, ...q.scorestappen.map((s) => s.omschrijving), ...(q.tabel ?? []).flat()].join(" ").replace(/<[^>]+>/g, " ");

export function toetsKenmerken(vragen: OpmaakVraag[]): ToetsKenmerken {
  const open = vragen.filter((q) => !q.opties?.length);
  const isTeken = (q: OpmaakVraag) => q.tekenvraag ?? /\b(teken|construeer|schets)\b/i.test(q.stam);
  const isReken = (q: OpmaakVraag) => Boolean(q.berekeningen?.length) || /\b(bereken|berekening)\b/i.test(q.stam);
  // g alleen als een vraag zwaartekracht/gewicht gebruikt (Fz, N/kg, g = …, zwaarte-energie), of een parameter g heet.
  const G = /\bF\s?z\b|\bF<sub>z|zwaartekracht|\bN\/kg\b|(?<![\p{L}])g\s*=|zwaarte-energie|valversnelling/iu;
  const gebruiktG = (q: OpmaakVraag) =>
    G.test(platTekst(q)) || G.test([q.stam, ...q.antwoordmodel.regels].join(" ")) || (q.parameters ?? []).some((p) => p.naam === "g") || (q.berekeningen ?? []).some((b) => /(^|[^a-z_])g([^a-z_0-9]|$)/i.test(b.formule));
  return {
    mc: vragen.some((q) => q.opties?.length),
    open: open.length > 0,
    lijnen: open.some((q) => (q.antwoordregels ?? 0) > 0),
    teken: vragen.some(isTeken),
    reken: vragen.some(isReken),
    meerdere: open.some((q) => /\b(twee|drie|vier)\s+(\w+\s+)?(redenen|oorzaken|voorbeelden|manieren|maatregelen|argumenten|verschillen|overeenkomsten|eigenschappen|voordelen|nadelen|stoffen|apparaten)\b/i.test(q.stam)),
    g: vragen.some(gebruiktG),
    binas: vragen.some((q) => /\bbinas\b|informatieboek/i.test(platTekst(q)) || (q.parameters ?? []).some((p) => p.bron === "binas")),
  };
}

/**
 * Instructiepagina na het voorblad (zoals pagina 2 van het CSE), afgeleid uit de inhoud: alleen de regels die bij
 * deze vragen horen (g alleen bij zwaartekracht, berekeningsregels alleen bij rekenvragen, "lijnen" alleen als er
 * antwoordlijnen zijn, tekenen alleen bij een tekenvraag). PDF en Word gebruiken dezelfde tekst: de Word-versie is de
 * bewerkbare versie van dezelfde (afgedrukte) toets, met dezelfde antwoordlijnen.
 */
export function instructieVoor(vragen: OpmaakVraag[]): { kop: string; regels: string[] }[] {
  const k = toetsKenmerken(vragen);
  const uit: { kop: string; regels: string[] }[] = [];
  if (k.mc) uit.push({ kop: "Meerkeuzevragen", regels: ["Schrijf alleen de hoofdletter van het goede antwoord op."] });
  if (k.open) {
    const regels: string[] = [];
    if (k.lijnen) regels.push(`Schrijf je antwoord op de lijnen onder de vraag.${k.teken ? " Bij een tekenvraag teken je in de figuur." : ""}`);
    else if (k.teken) regels.push("Bij een tekenvraag teken je in de figuur.");
    if (k.meerdere) regels.push("Geef niet méér antwoorden dan er worden gevraagd. Als er bijvoorbeeld twee redenen worden gevraagd, geef er dan twee en niet méér. Alleen de eerste twee redenen kunnen punten opleveren.");
    if (k.reken)
      regels.push(
        "Vermeld altijd de berekening, als een berekening gevraagd wordt. Als een gedeelte van de berekening goed is, kan dat punten opleveren. Een goede uitkomst zonder berekening levert geen punten op.",
        "Vermeld bij een berekening altijd welke grootheid berekend wordt.",
        "Geef de uitkomst van een berekening ook altijd met de juiste eenheid.",
      );
    if (k.g) regels.push("Gebruik g = 10 N/kg, tenzij anders vermeld.");
    if (regels.length) uit.push({ kop: "Open vragen", regels });
  }
  return uit;
}

/** Hulpmiddelen op het voorblad uit de inhoud: Binas alleen als een vraag Binas gebruikt, rekenmachine bij rekenvragen. */
export function hulpmiddelenVoor(vragen: OpmaakVraag[]): string[] {
  const k = toetsKenmerken(vragen);
  return [...(k.binas ? ["Gebruik het BINAS informatieboek."] : []), ...(k.reken ? ["Je mag een rekenmachine gebruiken."] : [])];
}

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
  const hulp = [...(v.uitwerkbijlage ? ["Bij deze toets hoort een uitwerkbijlage."] : []), ...(v.hulpmiddelen ?? hulpmiddelenVoor(vragen))];
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
