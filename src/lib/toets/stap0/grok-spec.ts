/**
 * Stap 0 + Grok: Grok vult ALLEEN de gestructureerde spec (JSON-schema uit spec-schema.ts); de deterministische
 * pijplijn (rekencontrole, figuur-go/no-go, opmaak) maakt daar het leerling- en docentdeel van.
 *
 *   genereerSpec(...)  → 1 aanroep met JSON-schema (structured output) + keuring + maximaal 1 herstelaanroep.
 *   keurGeneratie(...) → alle harde controles op een gegenereerde spec (schema, regels, rekenen, figuren, lengte,
 *                        weggevers, schoolnamen/merken, letterlijk overnemen uit de lesstof).
 *   alsGegenereerdeToets(...) → adapter naar het bestaande toetsformaat, zodat de eval-rubriek en -rechter werken.
 *
 * Nog niet in de app gekoppeld: alleen achter STAP0_RENDERER (uit) en in het eval-harnas.
 */
import { SPEC_SCHEMA } from "./spec-schema.ts";
import type { Fixture, FiguurSpec, OpmaakVraag, ToetsSpec, VraagstukSpec } from "./spec.ts";
import { verwerkToets, type Pijplijnresultaat } from "./pijplijn.ts";
import { getalInTekst, nl } from "./reken.ts";
import { annoteerKalibratie, relevanteVraagtypen, type Kalibratie } from "../kalibratie.ts";
import { extractParagrafen } from "../leerdoelen.ts";
import type { GegenereerdeToets, Leerweg, RttiVerdeling, Vraag } from "../types";

export interface SpecInvoer {
  titel: string;
  leerweg: Leerweg;
  leerjaar: number;
  duurMinuten: number;
  bronmateriaal: string;
  antwoordenmateriaal?: string;
  rttiDoel: RttiVerdeling;
}

export interface Generatie {
  titel: string;
  vraagstukken: VraagstukSpec[];
}

export interface Herstel {
  vraagstukken: VraagstukSpec[];
  schrappen: string[];
}

// ── JSON-schema voor de structured output ────────────────────────────────────────────────────────
/** draft-07 → wat de xAI-structured-output aanneemt ($defs, geen ^…$ in patronen, geen required-only anyOf). */
export function naarXaiSchema(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(naarXaiSchema);
  if (!x || typeof x !== "object") return x;
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (k === "$schema" || k === "$id" || k === "title") continue;
    if (k === "anyOf" && Array.isArray(v) && v.every((s) => s && typeof s === "object" && Object.keys(s).join() === "required")) continue;
    if (k === "definitions") o.$defs = naarXaiSchema(v);
    else if (k === "$ref" && typeof v === "string") o.$ref = v.replace("#/definitions/", "#/$defs/");
    else if (k === "pattern" && typeof v === "string") o.pattern = v.replace(/^\^/, "").replace(/\$$/, "");
    else o[k] = naarXaiSchema(v);
  }
  return o;
}

function defs(): Record<string, unknown> {
  const d = naarXaiSchema(SPEC_SCHEMA.definitions) as Record<string, Record<string, unknown>>;
  const vs = structuredClone(d.vraagstuk) as { properties: Record<string, Record<string, unknown>> };
  vs.properties.deelvragen = { ...vs.properties.deelvragen, minItems: 3, maxItems: 4 };
  return { ...d, vraagstuk: vs };
}

export function generatieSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["titel", "vraagstukken"],
    properties: { titel: { type: "string", minLength: 1 }, vraagstukken: { type: "array", minItems: 2, items: { $ref: "#/$defs/vraagstuk" } } },
    $defs: defs(),
  };
}

export function herstelSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["vraagstukken", "schrappen"],
    properties: { vraagstukken: { type: "array", items: { $ref: "#/$defs/vraagstuk" } }, schrappen: { type: "array", items: { type: "string" } } },
    $defs: defs(),
  };
}

// ── prompt ───────────────────────────────────────────────────────────────────────────────────────
export const SPEC_SYSTEM = `Je bent een ervaren toetsconstructeur natuur- en scheikunde (NaSk1) voor het vmbo. Je schrijft een nieuwe toets in de stijl van het centraal examen (CSE) en levert die ALLEEN als JSON volgens het opgegeven schema. Opmaak, figuren tekenen, nummering, rekencontrole en cijferberekening doet de software; jij levert de inhoud.

OPBOUW (CSE-stijl)
- De toets bestaat uit vraagstukken (soort "vraagstuk"). Elk vraagstuk = één situatie met een korte titel (2–4 woorden) en een korte inleiding (context, 2–4 zinnen), gevolgd door 3 of 4 samenhangende deelvragen over díe situatie.
- Elk vraagstuk gaat over een ANDERE situatie, met een ander voorwerp en een andere persoon. Geen twee vraagstukken over hetzelfde apparaat of dezelfde handeling.
- Een deelvraag mag eigen extra informatie hebben in "context" (die komt vóór de opdracht). De "stam" is de opdracht zelf ("Bereken …", "Leg uit …", "Welke … ?"). Herhaal de inleiding niet in de stam.
- Mix van vraagvormen zoals in het CSE: meerkeuze (4 opties, precies één juist), berekeningen (formule zelf kiezen, punten per stap), uitlegvragen ("Leg uit …", "Leg uit waarom …"), en inzichtvragen (I): nieuwe situatie, voorspellen, verband leggen of redeneren in meerdere stappen. Gebruik in elke toets meerdere uitlegvragen en minstens twee I-vragen.
- Geen weggevers: een deelvraag mag nooit het antwoord van een andere deelvraag (in hetzelfde of een ander vraagstuk) verklappen, ook niet in de context, de opties of een tabel. Geef geen uitkomst die eerder berekend moet worden.
- Meerkeuze: ALTIJD "opties" (2–4 stuks) én "juist". Opties zonder letters (de software zet A–D ervoor). Bij een keuze tussen figuren A–D zijn de opties "beeld A", "beeld B", … (of "diagram A", …). Juist/onjuist-vraag: opties ["juist", "onjuist"]. Afleiders plausibel (typische denkfouten), niet overlappend, ongeveer even lang. Wissel de plaats van het juiste antwoord af. Scorestap: 1 punt voor de juiste letter.
- Realistische, herkenbare situaties uit het dagelijks leven van een vmbo-leerling, met realistische getallen.
- Namen: gewone Nederlandse voornamen (ook meercultureel), per vraagstuk een andere naam. GEEN schoolnamen, geen plaatsnamen van scholen, geen merknamen of productnamen, geen namen van methodes of uitgevers, geen "Toetski".
- Neem NOOIT een vraag uit het boek, de lesstof of een examen letterlijk over. Bedenk nieuwe situaties en nieuwe getallen; ook geen zinnen uit de lesstof overschrijven.
- Taal: helder Nederlands op het niveau van de klas. Getallen met decimale komma ("2,5"). Eenheden met spatie ("12 V"). Inline opmaak mag: <b>, <i>, <sub>, <sup>.

PUNTEN EN NAKIJKEN
- punten per deelvraag 1–4. "scorestappen": per scorepunt één controleerbaar criterium; de som = punten.
- "antwoordmodel.regels": het antwoord en de uitwerking zoals in een correctievoorschrift. Bij meerkeuze "juist" = de letter.
- "rtti": R (reproductie), T1 (toepassen bekend), T2 (toepassen nieuw), I (inzicht). Label eerlijk naar wat de vraag vraagt.
- "leerdoel": begin met de paragraafcode uit de lesstof (bijv. "13.2 …") en daarna wat er getoetst wordt.
- "niveau": "BB/KB/GT", "vooral KB/GT" of "vooral GT".

REKENEN (wordt door code nagerekend; een fout = de vraag wordt niet geplaatst)
- Elke berekening krijgt "parameters" (gegevens) en "berekeningen" (stappen).
- parameter: naam (letters/cijfers/_), waarde (getal), eenheid, bron = "tekst" (staat in context/stam/tabel), "figuur" (lees je af in de figuur) of "binas". Bij bron "tekst" moet "weergave" EXACT zo in de tekst staan als het getal daar staat (bijv. weergave "2,5" als er "2,5 kg" staat).
- berekening: naam, formule met parameternamen en eerdere stapnamen (alleen + - * / ^, haakjes, sqrt, sin, cos (graden), round, ceil), waarde = de exacte uitkomst, eenheid, afgerond = de uitkomst zoals die in het antwoordmodel staat ("7,9"). Die afgeronde waarde moet letterlijk in antwoordmodel.regels staan. Gebruik getallen zonder machten van 10 (dus "0,0008", niet "8·10^-4").
- Parameters van het vraagstuk ("parameters" op vraagstukniveau) gelden voor alle deelvragen.
- Gebruik overal dezelfde waarde voor g (die uit de lesstof; anders 10 N/kg).

FIGUREN (alleen als de vraag er echt een nodig heeft; de software tekent ze exact)
- Toegestane typen: grafiek, oscilloscoop, schakelschema, krachten, maatcilinder, en ai-afbeelding.
- Elke meetfiguur (alle typen behalve ai-afbeelding) MOET "controle" hebben: een lijst die een meting in de figuur koppelt aan een parameter (bron "figuur") of aan een vaste verwachte waarde. Meetsleutels:
  * grafiek: "y@<x>" (y-waarde van reeks 1 bij x, bijv. "y@4"); bij panelen (kleine diagrammen A–D zonder getallen): "<label>.trend" (1 stijgend, 0 vlak, -1 dalend) en "<label>.eind".
  * oscilloscoop: "A" en "T" (amplitude en trillingstijd in hokjes) bij één paneel; bij meerdere panelen met labels "A.A", "A.T", "B.T", …; "tijdbasis" als het onderschrift "1 hokje = … ms" bevat. Amplitude ≤ hokjesY/2.
  * schakelschema: "takken", "aantal.lamp", "aantal.weerstand", … en waarden uit labels zoals "R1 = 40 Ω" → meting "R1".
  * krachten: "<naam>.N" en "<naam>.hoek" per pijl (hoek in graden: 0 rechts, 90 omhoog, 270 omlaag). breedteCm/hoogteCm op ware grootte, punt binnen het vlak, pijl past binnen de figuur.
  * maatcilinder: "niveau1", "niveau2" (in mL), streep = waarde van de kleinste streep; niveaus op een streep.
- Bij precies 4 keuzefiguren (A–D) zet de software ze in een 2×2-raster; gebruik daarvoor panelen met labels A, B, C, D.
- breedteCm 6–11 (krachtenfiguur: ware grootte, max 14).
- ai-afbeelding: ALLEEN voor een foto of situatieplaatje dat de situatie herkenbaar maakt, nooit om iets af te lezen of te meten; beschrijving zonder getallen en meetwaarden; hoogstens 2 per toets. Geen getallen of meetwoorden (aflezen, hokjes, grafiek) in een vraag die alleen een ai-afbeelding heeft.
- Verwijs in de tekst nooit naar een figuur of tabel die er niet is. Een tabel: "tabel" als lijst rijen, de eerste rij zijn de kopjes.

IDS: kleine letters, cijfers en streepjes; elke deelvraag-id uniek (bijv. "fietsbel-a").
SE-code ("se"): SE4.1 krachten/druk/werktuigen, SE4.2 energie/geluid/materie (dichtheid, fasen, stoffen), SE4.3 elektriciteit, SE4.4 arbeid/vermogen/beweging, ALG algemene vaardigheden.`;

export function specPrompt(inv: SpecInvoer, kal: Pick<Kalibratie, "items" | "punten"> & Partial<Pick<Kalibratie, "vorm" | "pct1p">>): string {
  const pars = extractParagrafen(inv.bronmateriaal, inv.antwoordenmateriaal);
  const typen = relevanteVraagtypen(inv.bronmateriaal, inv.leerjaar, inv.leerweg)
    .map((t, i) => `${i + 1}=${t.id} (${t.naam.split(/[(:;]/)[0]!.trim().slice(0, 50)})`)
    .join("; ");
  const r = inv.rttiDoel;
  const nVs = [Math.max(2, Math.round(kal.items / 4)), Math.max(2, Math.round(kal.items / 3))];
  return [
    `TOETS: "${inv.titel}" · NaSk · ${inv.leerweg} klas ${inv.leerjaar} · ${inv.duurMinuten} minuten.`,
    `LENGTE: totaal precies ${kal.punten} punten (minimaal ${Math.ceil(kal.punten * 0.95)}, maximaal ${Math.floor(kal.punten * 1.05)}) verdeeld over ongeveer ${kal.items} deelvragen (minimaal ${Math.ceil(kal.items * 0.9)}), dus ${nVs[0]}–${nVs[1]} vraagstukken van 3 of 4 deelvragen. Tel de punten na voordat je antwoordt.`,
    `RTTI-doel (percentage van de punten): R ${r.R}%, T1 ${r.T1}%, T2 ${r.T2}%, I ${r.I}%.`,
    kal.vorm ? `VRAAGVORMEN (aantal deelvragen, ongeveer, zoals echte toetsen van deze klas): ${vormRegel(kal.vorm, kal.items)}${kal.pct1p ? `; ongeveer ${kal.pct1p}% van de deelvragen is 1 punt` : ""}.` : "",
    `FIGUREN: gebruik in deze toets 2–4 figuren uit de toegestane typen waar de lesstof dat vraagt (bijv. een oscilloscoopbeeld bij geluid, een grafiek bij beweging of metingen, een schakelschema bij elektriciteit, een krachtenfiguur bij krachten), elk met "controle".`,
    pars.length ? `PARAGRAFEN: elke paragraaf krijgt minstens één deelvraag, verdeeld naar de hoeveelheid stof: ${pars.map((p) => `${p.code} ${p.titel}`).join("; ")}.` : "",
    inv.leerjaar <= 2 ? `NIVEAU: onderbouw klas ${inv.leerjaar}: korte inleidingen, eenvoudige taal, rekenwerk in 1–2 stappen; wel CSE-opbouw met vraagstukken.` : "",
    typen ? `VRAAGTYPE: vul "vraagtype" met nr, code en naam uit deze lijst (nr=code): ${typen}. Gebruik minstens 5 verschillende typen.` : "",
    `\nLESSTOF:\n${inv.bronmateriaal}`,
    inv.antwoordenmateriaal ? `\nANTWOORDEN BIJ DE LESSTOF (alleen als achtergrond; niets letterlijk overnemen):\n${inv.antwoordenmateriaal}` : "",
    `\nSchrijf nu de complete toets als JSON volgens het schema (titel + vraagstukken).`,
  ]
    .filter(Boolean)
    .join("\n");
}

function vormRegel(v: Kalibratie["vorm"], items: number): string {
  const n = (pct: number) => Math.round((pct / 100) * items);
  const delen = [
    v.mc ? `meerkeuze ${n(v.mc)}` : "",
    v.jn ? `juist/onjuist ${n(v.jn)}` : "",
    v.reken ? `berekening ${n(v.reken)}` : "",
    v.uitleg ? `uitleggen ${Math.max(2, n(v.uitleg))}` : "uitleggen 2",
    v.kort ? `kort open antwoord ${n(v.kort)}` : "",
    v.invul ? `invullen/aankruisen ${n(v.invul)}` : "",
    v.teken ? `tekenen in een figuur ${n(v.teken)}` : "",
  ];
  return delen.filter(Boolean).join(", ");
}

/**
 * Deterministische normalisatie vóór de keuring (geen inhoud verzinnen): een figuurkeuze-MC met "juist" maar zonder
 * opties krijgt de paneellabels van de figuur als opties ("beeld A" …).
 */
export function normaliseer(gen: Generatie): Generatie {
  const g = structuredClone(gen);
  for (const v of g.vraagstukken ?? []) {
    for (const d of v.deelvragen ?? []) {
      if (!d.antwoordmodel?.juist || d.opties?.length) continue;
      const f = d.figuur ?? v.figuur;
      const labels = f && (f.type === "oscilloscoop" || f.type === "grafiek") ? (f.panelen ?? []).map((p) => p.label).filter((x): x is string => Boolean(x)) : [];
      if (labels.length >= 2) d.opties = labels.map((l) => `${f!.type === "oscilloscoop" ? "beeld" : "diagram"} ${l}`);
    }
  }
  return g;
}

// ── keuring ──────────────────────────────────────────────────────────────────────────────────────
const MERKEN = /\b(Toetski|Nova|Malmberg|Noordhoff|ThiemeMeulenhoff|Cito|CvTE|Examenblad|Grok|xAI|Apple|iPhone|Samsung|Philips|Gazelle|Albert Heijn|Jumbo|Lidl|Coca[- ]?Cola)\b/;
const SCHOOL = /\b(Aeres|Nordwin)\b|\b[A-Z][a-z]+\s+(College|Lyceum)\b|\b[A-Z][a-z]+school\b/;

export interface Keuringsrapport {
  /** Alle fouten, per vraagstuk-id ("" = toetsniveau). */
  perId: Record<string, string[]>;
  fouten: string[];
  res: Pijplijnresultaat;
  toets: ToetsSpec;
  feiten: {
    vraagstukken: number;
    vragen: number;
    punten: number;
    doelPunten: number;
    doelVragen: number;
    lengtePct: number;
    rekenStappen: number;
    rekenFout: number;
    figuren: number;
    figurenGo: number;
    weggevers: string[];
    afgekeurd: string[];
  };
}

const kaal = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function tekstVan(d: { context?: string[]; stam: string; opties?: string[]; tabel?: string[][] }): string {
  return kaal([...(d.context ?? []), d.stam, ...(d.opties ?? []), ...(d.tabel ?? []).flat()].join(" \n "));
}

/** Weggevers die code kan zien: een afgeronde uitkomst of het juiste MC-antwoord staat in de tekst van een andere deelvraag. */
export function zoekWeggevers(vs: VraagstukSpec[]): string[] {
  const items = vs.flatMap((v) =>
    v.deelvragen.map((d, i) => ({ v, d, eigen: tekstVan(d) + (i === 0 ? " " + kaal(v.context.join(" ")) : ""), gegeven: new Set([...(v.parameters ?? []), ...(d.parameters ?? [])].map((p) => p.weergave ?? nl(p.waarde))) })),
  );
  const uit: string[] = [];
  for (const a of items) {
    const uitkomsten = (a.d.berekeningen ?? []).map((b) => b.afgerond).filter((x): x is string => Boolean(x && x.replace(/[^0-9]/g, "").length >= 2));
    const juist = a.d.opties && a.d.antwoordmodel.juist ? kaal(a.d.opties[a.d.antwoordmodel.juist.charCodeAt(0) - 65] ?? "") : "";
    for (const b of items) {
      if (a === b) continue;
      const tb = b.eigen;
      for (const u of uitkomsten) if (!a.gegeven.has(u) && !b.gegeven.has(u) && getalInTekst(u, tb)) uit.push(`${b.d.id} verklapt ${a.d.id} (${u})`);
      if (juist.length >= 14 && !/^(ja|nee|juist|onjuist|groter|kleiner|gelijk)/i.test(juist) && tb.toLowerCase().includes(juist.toLowerCase()) && !(b.d.opties ?? []).some((o) => kaal(o).toLowerCase() === juist.toLowerCase()))
        uit.push(`${b.d.id} verklapt ${a.d.id} ("${juist.slice(0, 40)}")`);
    }
  }
  return [...new Set(uit)];
}

/** Zinnen (≥ 10 woorden) die letterlijk uit de lesstof komen. */
function overgenomen(tekst: string, bron: string): boolean {
  const w = kaal(tekst).toLowerCase().split(/\s+/);
  const b = kaal(bron).toLowerCase().replace(/\s+/g, " ");
  for (let i = 0; i + 10 <= w.length; i++) if (b.includes(w.slice(i, i + 10).join(" "))) return true;
  return false;
}

export function alsToetsSpec(gen: Generatie, inv: SpecInvoer): ToetsSpec {
  return {
    titel: gen.titel || inv.titel,
    vragen: gen.vraagstukken.map((v) => v.id),
    minuten: inv.duurMinuten,
    nTerm: 1,
    voorblad: {
      kop: inv.titel,
      leerweg: inv.leerweg === "GT" ? "VMBO-GL en TL" : `VMBO-${inv.leerweg}`,
      schooljaar: "2026-2027",
      seCode: inv.leerjaar === 4 ? "SE4" : `klas ${inv.leerjaar}`,
      vak: `natuur- en scheikunde${inv.leerjaar >= 3 ? " 1" : ""}`,
      hulpmiddelen: [...(inv.leerjaar >= 3 ? ["Gebruik het BINAS informatieboek."] : []), "Je mag een rekenmachine gebruiken."],
      schoolveld: "",
    },
  };
}

export function keurGeneratie(gen: Generatie, inv: SpecInvoer, kal: Pick<Kalibratie, "items" | "punten">): Keuringsrapport {
  const perId: Record<string, string[]> = { "": [] };
  const voeg = (id: string, f: string) => (perId[id] ??= []).push(f);
  const ids = new Set<string>();
  for (const v of gen.vraagstukken) {
    perId[v.id] ??= [];
    if (ids.has(v.id)) voeg(v.id, `vraagstuk-id ${v.id} dubbel`);
    ids.add(v.id);
    for (const d of v.deelvragen ?? []) {
      if (ids.has(d.id)) voeg(v.id, `deelvraag-id ${d.id} dubbel`);
      ids.add(d.id);
      const t = `${tekstVan(d)} ${(d.antwoordmodel?.regels ?? []).join(" ")}`;
      if (MERKEN.test(t) || MERKEN.test(v.context.join(" ") + v.titel)) voeg(v.id, `${d.id}: merk-/methodenaam in de tekst (${(MERKEN.exec(t) ?? MERKEN.exec(v.context.join(" ") + v.titel))![0]})`);
      if (SCHOOL.test(t) || SCHOOL.test(v.context.join(" "))) voeg(v.id, `${d.id}: schoolnaam in de tekst`);
      const fig = d.figuur ?? (v.deelvragen[0] === d ? v.figuur : undefined);
      if (/\bteken\b/i.test(kaal(d.stam)) && fig?.type === "grafiek" && !fig.panelen?.length && fig.reeksen.some((r) => !r.rood && r.punten.length >= 2))
        voeg(v.id, `${d.id}: tekenvraag, maar de leerlingfiguur toont de grafiek al (leerling krijgt een leeg diagram; het antwoord hoort in antwoordmodel.figuur)`);
      if (overgenomen(tekstVan(d), `${inv.bronmateriaal}\n${inv.antwoordenmateriaal ?? ""}`)) voeg(v.id, `${d.id}: zin letterlijk uit de lesstof overgenomen`);
    }
    if (overgenomen(v.context.join(" "), `${inv.bronmateriaal}\n${inv.antwoordenmateriaal ?? ""}`)) voeg(v.id, `${v.id}: inleiding letterlijk uit de lesstof overgenomen`);
  }
  const toets = alsToetsSpec(gen, inv);
  const fixtures: Fixture[] = gen.vraagstukken.map((v) => ({ ...v, soort: "vraagstuk" }) as Fixture);
  const res = verwerkToets(toets, fixtures);
  for (const k of res.keuringen) for (const f of k.fouten) voeg(k.id, f);
  for (const f of res.toetsFouten) voeg("", f);
  const weggevers = zoekWeggevers(gen.vraagstukken);
  for (const w of weggevers) {
    const id = gen.vraagstukken.find((v) => v.deelvragen.some((d) => w.startsWith(d.id)))?.id ?? "";
    voeg(id, `weggever: ${w}`);
  }
  const alle = gen.vraagstukken.flatMap((v) => v.deelvragen ?? []);
  const punten = alle.reduce((s, d) => s + (d.punten ?? 0), 0);
  const lengtePct = Math.round((punten / kal.punten) * 100);
  if (lengtePct < 90 || lengtePct > 110) voeg("", `lengte: ${punten} punten = ${lengtePct} % van het doel ${kal.punten} (moet 90–110 %)`);
  if (alle.length < Math.ceil(kal.items * 0.85)) voeg("", `lengte: ${alle.length} deelvragen, doel ± ${kal.items} (minimaal ${Math.ceil(kal.items * 0.85)})`);
  const rekenStappen = alle.reduce((s, d) => s + (d.berekeningen?.length ?? 0), 0);
  const rekenFout = res.keuringen.reduce((s, k) => s + k.fouten.filter((f) => /geeft .*spec zegt|afgerond|staat niet in|onbekend teken|rest na positie|onbekende variabele|parameter .* staat niet/i.test(f)).length, 0);
  const figs = res.keuringen.flatMap((k) => k.figuren);
  const fouten = Object.entries(perId).flatMap(([id, l]) => l.map((f) => (id ? `[${id}] ${f}` : f)));
  return {
    perId,
    fouten,
    res,
    toets,
    feiten: {
      vraagstukken: gen.vraagstukken.length,
      vragen: alle.length,
      punten,
      doelPunten: kal.punten,
      doelVragen: kal.items,
      lengtePct,
      rekenStappen,
      rekenFout,
      figuren: figs.length,
      figurenGo: figs.filter((f) => f.go).length,
      weggevers,
      afgekeurd: res.afgekeurd,
    },
  };
}

export function herstelPrompt(r: Keuringsrapport): string {
  const regels = Object.entries(r.perId)
    .filter(([, l]) => l.length)
    .map(([id, l]) => `${id ? `vraagstuk ${id}` : "toets"}:\n- ${l.join("\n- ")}`);
  const f = r.feiten;
  const verschil = f.doelPunten - f.punten;
  const lengte = verschil === 0 ? "" : `\n\nPUNTEN: nu ${f.punten}, doel ${f.doelPunten}: ${verschil > 0 ? `voeg PRECIES ${verschil} punt(en) toe` : `haal PRECIES ${-verschil} punt(en) weg`} (pas punten + scorestappen van bestaande deelvragen aan of voeg een deelvraag toe/verwijder er een), zodat het totaal na het herstel ${f.doelPunten} is. Tel na.`;
  return `De software heeft je toets gekeurd. Deze punten zijn FOUT:\n\n${regels.join("\n\n")}${lengte}\n\nHerstel ze. Stuur JSON volgens het schema: "vraagstukken" = alleen de vraagstukken die je verandert of toevoegt, elk VOLLEDIG met alle deelvragen (zelfde id = vervangen, nieuwe id = toevoegen); "schrappen" = ids van vraagstukken die weg moeten (liever herstellen dan schrappen). Elk genoemd vraagstuk MOET hersteld terugkomen. Houd je aan alle regels van de opdracht en reken elke berekening opnieuw na.`;
}

export function pasHerstelToe(gen: Generatie, h: Herstel): Generatie {
  const weg = new Set(h.schrappen ?? []);
  const nieuw = new Map((h.vraagstukken ?? []).map((v) => [v.id, v]));
  const lijst = gen.vraagstukken.filter((v) => !weg.has(v.id)).map((v) => nieuw.get(v.id) ?? v);
  for (const v of h.vraagstukken ?? []) if (!gen.vraagstukken.some((x) => x.id === v.id) && !weg.has(v.id)) lijst.push(v);
  return { ...gen, vraagstukken: lijst };
}

export type ChatFn = (messages: { role: "system" | "user" | "assistant"; content: string }[], schema: { naam: string; schema: Record<string, unknown> }, maxTokens: number) => Promise<string>;

/** Genereer + keur + maximaal één herstelronde. Gooit niet bij keurfouten: het rapport vertelt wat er mis is. */
export async function genereerSpec(inv: SpecInvoer, kal: Pick<Kalibratie, "items" | "punten">, chat: ChatFn, opts: { maxTokens?: number; voorHerstel?: () => boolean } = {}) {
  const max = opts.maxTokens ?? 30000;
  const messages = [
    { role: "system" as const, content: SPEC_SYSTEM },
    { role: "user" as const, content: specPrompt(inv, kal) },
  ];
  const raw = await chat(messages, { naam: "toets_spec", schema: generatieSchema() }, max);
  let gen = normaliseer(JSON.parse(raw) as Generatie);
  const eerste = keurGeneratie(gen, inv, kal);
  let rapport = eerste;
  let hersteld = false;
  if (eerste.fouten.length && (opts.voorHerstel?.() ?? true)) {
    const raw2 = await chat([...messages, { role: "assistant", content: raw }, { role: "user", content: herstelPrompt(eerste) }], { naam: "toets_herstel", schema: herstelSchema() }, max);
    gen = normaliseer(pasHerstelToe(gen, JSON.parse(raw2) as Herstel));
    rapport = keurGeneratie(gen, inv, kal);
    hersteld = true;
  }
  return { gen, eerste, rapport, hersteld };
}

// ── adapter naar het bestaande toetsformaat (voor rubriek + rechter) ─────────────────────────────
export function figuurTekst(f: FiguurSpec | undefined): string {
  if (!f) return "";
  const n = (x: number) => nl(x);
  switch (f.type) {
    case "grafiek":
      if (f.panelen?.length) return `[figuur: ${f.panelen.length} diagrammen (${f.y.label} tegen ${f.x.label}) zonder getallen: ${f.panelen.map((p) => `${p.label}: ${p.punten.map(([x, y]) => `(${n(x)}; ${n(y)})`).join(" ")}`).join(" | ")}]`;
      return `[figuur: grafiek ${f.y.label} tegen ${f.x.label}; ${f.reeksen.map((r) => `${r.rood ? "antwoord: " : ""}${r.vorm} door ${r.punten.map(([x, y]) => `(${n(x)}; ${n(y)})`).join(" ")}`).join(" | ")}${f.x.zonderGetallen ? "; assen zonder getallen" : ""}]`;
    case "oscilloscoop":
      return `[figuur: oscilloscoop ${f.hokjesX}×${f.hokjesY} hokjes; ${f.panelen.map((p) => `${p.label ? `${p.label}: ` : ""}amplitude ${n(p.amplitude)} hokjes, trillingstijd ${n(p.trillingstijd)} hokjes`).join(" | ")}${f.onderschrift ? `; ${f.onderschrift}` : ""}]`;
    case "schakelschema":
      return `[figuur: schakelschema met ${f.bron.soort}${f.bron.label ? ` (${f.bron.label})` : ""}; ${f.takken.map((t, i) => `tak ${i + 1}: ${t.onderdelen.map((o) => `${o.soort}${o.label ? ` ${o.label}` : ""}`).join(" + ")}`).join(" | ")}]`;
    case "krachten":
      return `[figuur: krachtenfiguur (${f.voorwerp}), schaal 1 cm ≙ ${n(f.schaalN)} N; ${f.pijlen.map((p) => `${p.naam}: ${n(p.grootteN)} N onder ${n(p.hoek)}°`).join(" | ")}]`;
    case "maatcilinder":
      return `[figuur: maatcilinder(s) tot ${n(f.max)} mL, kleinste streep ${n(f.streep)} mL; ${f.cilinders.map((c) => `${c.label ? `${c.label}: ` : ""}${n(c.niveau)} mL${c.voorwerp ? " met voorwerp" : ""}`).join(" | ")}]`;
    case "ai-afbeelding":
      return `[foto: ${f.beschrijving}]`;
  }
}

export function alsGegenereerdeToets(res: Pijplijnresultaat, inv: SpecInvoer & { moeilijkheid?: string }, kal: Kalibratie, extra: Partial<GegenereerdeToets> = {}): GegenereerdeToets {
  // De figuur van een vraagstuk staat één keer (bij de eerste deelvraag) maar hoort bij alle deelvragen.
  const metFiguur = new Set(res.vragen.filter((q) => q.figuur && q.vraagstuk).map((q) => q.vraagstuk!.id));
  const vragen: Vraag[] = res.vragen.map((q: OpmaakVraag) => {
    const ctx = [...(q.gedeeldeContext ?? []), ...(q.aanloop ?? [])].map(kaal).join(" ");
    const fig = figuurTekst(q.figuur);
    const mc = Boolean(q.opties?.length);
    return {
      nummer: q.nr,
      type: mc ? (q.opties!.length === 2 ? "juist-onjuist" : "meerkeuze") : q.berekeningen?.length ? "berekening" : "open",
      rtti: q.rtti,
      domein: q.hoofdstuk,
      leerdoel: q.leerdoel ?? q.hoofdstuk,
      punten: q.punten,
      context: [ctx, fig].filter(Boolean).join(" ") || undefined,
      contextTitel: q.vraagstuk?.titel ?? q.titel,
      vraagtype: q.vraagtype.code,
      stam: kaal(q.stam),
      opties: q.opties?.map((o, i) => ({ letter: String.fromCharCode(65 + i), tekst: kaal(o) })),
      tabel: q.tabel ? { koppen: q.tabel[0]!.map(kaal), rijen: q.tabel.slice(1).map((r) => r.map(kaal)) } : undefined,
      ...(q.figuur || (q.vraagstuk && metFiguur.has(q.vraagstuk.id)) ? { figuur: { stap0: q.figuur?.type ?? "vraagstuk" } } : {}),
    } as unknown as Vraag;
  });
  const nakijkmodel = res.vragen.map((q) => {
    const letter = q.antwoordmodel.juist;
    const regels = q.antwoordmodel.regels.map(kaal).join(" / ");
    return {
      nummer: q.nr,
      modelantwoord: letter ? `${letter}. ${q.opties?.[letter.charCodeAt(0) - 65] ? kaal(q.opties[letter.charCodeAt(0) - 65]!) : ""}${regels ? ` (${regels})` : ""}` : regels,
      puntenverdeling: q.scorestappen.map((s) => ({ punt: s.punten, criterium: kaal(s.omschrijving) })),
    };
  });
  const kwaliteit = annoteerKalibratie({ samenvatting: "", punten: [] }, vragen, kal, inv.bronmateriaal);
  return {
    id: "stap0",
    createdAt: new Date().toISOString(),
    bronmateriaal: "",
    extraEisen: "",
    ronde: 1,
    cijferNorm: { model: "lineair", cesuurPct: 55, exponent: 1 },
    meta: { titel: inv.titel, vak: "NaSk", leerweg: inv.leerweg, leerjaar: inv.leerjaar as 1 | 2 | 3 | 4, duurMinuten: inv.duurMinuten, school: "", hulpmiddelen: [], instructies: [], onderwerp: inv.titel, versie: "A", moeilijkheid: "normaal" },
    vragen,
    nakijkmodel,
    cesuur: { nTerm: 1, cesuurPunten: 0, toelichting: "", formule: "" },
    matrijs: { domeinen: [], cellen: {}, totalen: {} as never, doelverdeling: inv.rttiDoel },
    kwaliteit,
    ...extra,
  } as GegenereerdeToets;
}
