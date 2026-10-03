/**
 * Stap 0 + Grok: Grok vult ALLEEN de gestructureerde spec (JSON-schema uit spec-schema.ts); de deterministische
 * pijplijn (rekencontrole, figuur-go/no-go, opmaak) maakt daar het leerling- en docentdeel van.
 *
 *   genereerSpec(...)  → 1 aanroep met JSON-schema (structured output) + keuring + maximaal 1 herstelaanroep.
 *   keurGeneratie(...) → alle harde controles op een gegenereerde spec (schema, regels, rekenen, figuren, lengte,
 *                        weggevers, schoolnamen/merken, letterlijk overnemen uit de lesstof).
 *   alsGegenereerdeToets(...) → adapter naar het bestaande toetsformaat, zodat de eval-rubriek en -rechter werken.
 *
 * In de app alleen achter de server-side vlag STAP0_RENDERER + STAP0_USERS (pilot, zie pilot.server.ts) en in het eval-harnas.
 */
import { SPEC_SCHEMA } from "./spec-schema.ts";
import type { Fixture, FiguurSpec, OpmaakVraag, ToetsSpec, VraagstukSpec } from "./spec.ts";
import { verwerkToets, type Pijplijnresultaat } from "./pijplijn.ts";
import { nl } from "./reken.ts";
import { annoteerKalibratie, relevanteVraagtypen, type Kalibratie } from "../kalibratie.ts";
import { extractParagrafen, paragraafDekking } from "../leerdoelen.ts";
import { overlap, woorden } from "../eval/rubric.ts";
import { afrondFouten, begripTelling, bloklijstRegel, buitenLesstof, eenPuntsReproductie, MAX_1P_R, normaliseerTekenfiguur, paragraafKern, raaktKern, zoekBegripHerhaling, zoekFiguurVerwijzingen, zoekGetalWeggevers, zoekIncoherentie } from "./inhoud-keuring.ts";
import { autoHerstel } from "./auto-herstel.ts";
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

// ── JSON-schema voor de structured output ────────────────────────────────────────────────────────
/** draft-07 → wat de xAI-structured-output aanneemt ($defs, geen ^…$ in patronen, geen required-only anyOf). */
export function naarXaiSchema(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(naarXaiSchema);
  if (!x || typeof x !== "object") return x;
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (k === "$schema" || k === "$id" || k === "title" || k === "if" || k === "then") continue;
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
  const dv = structuredClone(d.deelvraag) as { required: string[] };
  dv.required = [...dv.required, "begrip", "leerdoel"];
  return { ...d, vraagstuk: vs, deelvraag: dv };
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

/** Eén vraagstuk (gerichte herstel- of vervangaanroep). */
export function vraagstukSchema(): Record<string, unknown> {
  return { type: "object", additionalProperties: false, required: ["vraagstuk"], properties: { vraagstuk: { $ref: "#/$defs/vraagstuk" } }, $defs: defs() };
}

// ── prompt ───────────────────────────────────────────────────────────────────────────────────────
export const SPEC_SYSTEM = `Je bent een ervaren toetsconstructeur natuur- en scheikunde (NaSk1) voor het vmbo. Je schrijft een nieuwe toets in de stijl van het centraal examen (CSE) en levert die ALLEEN als JSON volgens het opgegeven schema. Opmaak, figuren tekenen, nummering, rekencontrole en cijferberekening doet de software; jij levert de inhoud.

OPBOUW (CSE-stijl)
- De toets bestaat uit vraagstukken (soort "vraagstuk"). Elk vraagstuk = één situatie met een korte titel (2–4 woorden) en een korte inleiding (context, 2–4 zinnen), gevolgd door 3 of 4 samenhangende deelvragen over díe situatie.
- Elk vraagstuk gaat over een ANDERE situatie, met een ander voorwerp en een andere persoon. Geen twee vraagstukken over hetzelfde apparaat of dezelfde handeling.
- SAMENHANG: alle deelvragen van een vraagstuk gaan over díe ene situatie uit de inleiding (zelfde persoon, voorwerp en plek). Geen deelvraag over een andere situatie (dus geen vraag over een auto in een vraagstuk over een echo); begint een nieuwe situatie, maak dan een nieuw vraagstuk. Een figuur in een vraagstuk hoort bij die situatie.
- Een deelvraag mag eigen extra informatie hebben in "context" (die komt vóór de opdracht). De "stam" is de opdracht zelf ("Bereken …", "Leg uit …", "Welke … ?"). Herhaal de inleiding niet in de stam.
- Mix van vraagvormen zoals in het CSE: meerkeuze (4 opties, precies één juist), berekeningen (formule zelf kiezen, punten per stap), uitlegvragen ("Leg uit …", "Leg uit waarom …"), en inzichtvragen (I): nieuwe situatie, voorspellen, verband leggen of redeneren in meerdere stappen. Gebruik in elke toets meerdere uitlegvragen en minstens twee I-vragen.
- Geen weggevers: een deelvraag mag nooit het antwoord van een andere deelvraag (in hetzelfde of een ander vraagstuk) verklappen, ook niet in de context, de opties of een tabel. Noem een uitkomst die eerder berekend moet worden niet (met eenheid) in een volgende deelvraag; wil je verder rekenen, schrijf dan "Ga uit van …" met een ANDERE waarde. Let vooral op meerkeuzeopties: een (juiste of foute) optie mag geen uitspraak bevatten die een andere vraag beantwoordt.
- Elk begrip en elke redenering maar één keer: "begrip" (2–6 woorden) noemt wat de deelvraag toetst, bijv. "frequentie uit trillingstijd", "amplitude en luidheid", "geluid heeft tussenstof nodig". Geen twee deelvragen in de toets met hetzelfde begrip of dezelfde redenering (ook niet in andere woorden).
- Meerkeuze: ALTIJD "opties" (2–4 stuks) én "juist". Opties zonder letters (de software zet A–D ervoor). Bij een keuze tussen figuren A–D zijn de opties "beeld A", "beeld B", … (of "diagram A", …). Juist/onjuist-vraag: opties ["juist", "onjuist"]. Afleiders plausibel (typische denkfouten), niet overlappend, ongeveer even lang. Wissel de plaats van het juiste antwoord af. Scorestap: 1 punt voor de juiste letter.
- Weinig losse weetvragen: hoogstens het percentage uit de WEETVRAGEN-regel van de opdracht van de punten mag uit 1-punts reproductievragen (rtti R) komen; maak de rest toepassen (T1/T2), inzicht (I) of vragen van 2–3 punten.
- Alleen stof uit de LESSTOF hieronder, met de woorden van de lesstof (bijv. "resulterende kracht" als de lesstof dat zegt, niet "nettokracht"; geen versnelling, stabiliteit of andere stof die er niet in staat).
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
- AFRONDEN: rond de einduitkomst af op hetzelfde aantal significante cijfers als het gegeven met de minste significante cijfers (minimaal 2), tenzij de vraag zelf zegt hoe je afrondt. Doe dat in de hele toets op dezelfde manier. Zet in het antwoordmodel de onafgeronde waarde erbij: "Fz = 4,0 × 9,8 = 39,2 N ≈ 39 N".

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
- Verwijs in de tekst nooit naar een figuur of tabel die er niet is ("Je ziet …", "in de figuur", "beeld A–D", "de tabel"): wie verwijst, levert de figuur (met panelen A–D als je naar A–D verwijst) of de tabel ook echt mee. Een tabel: "tabel" als lijst rijen, de eerste rij zijn de kopjes.
- TEKENVRAAG (de leerling tekent een pijl, lijn, punten of een tak): zet "tekenvraag": true. De LEERLINGFIGUUR toont alleen wat er al staat (bij krachten: het voorwerp, het aangrijpingspunt en eventueel gegeven pijlen; bij een grafiek: alleen het lege assenstelsel, "reeksen": []) en heeft alleen controles op wat er staat (of geen). De ANTWOORDFIGUUR ("antwoordmodel.figuur") is dezelfde figuur mét in rood ("rood": true) wat de leerling tekent, en heeft de controle daarop. Nooit een controle in de leerlingfiguur op iets dat de leerling nog moet tekenen, en nooit een los punt in een leeg assenstelsel. Voorbeeld (krachten, 1 cm ≙ 10 N, leerling tekent Fz = 40 N):
  "tekenvraag": true,
  "figuur": {"type":"krachten","breedteCm":6,"hoogteCm":7,"schaalN":10,"voorwerp":"krat","punt":[3,5],"puntLabel":"Z","pijlen":[],"controle":[{"meting":"pijlen","verwacht":0}]},
  "antwoordmodel": {"regels":["pijl van 4,0 cm recht omlaag vanuit Z"],"figuur":{"type":"krachten","breedteCm":6,"hoogteCm":7,"schaalN":10,"voorwerp":"krat","punt":[3,5],"puntLabel":"Z","pijlen":[{"naam":"Fz","grootteN":40,"hoek":270,"rood":true}],"controle":[{"meting":"Fz.N","verwacht":40},{"meting":"Fz.hoek","verwacht":270}]}}
- "controle" met "parameter": die parameter MOET in "parameters" staan (meestal bron "figuur") en in een berekening gebruikt worden; anders "verwacht" met het getal.

FIGUUR-VOORBEELDEN (neem de vorm exact over; getallen en situatie zijn natuurlijk je eigen)
- Oscilloscoop, één beeld, aflezen + rekenen (tijdbasis in het onderschrift, parameter bestaat):
  "figuur": {"type":"oscilloscoop","hokjesX":10,"hokjesY":8,"panelen":[{"amplitude":2,"trillingstijd":4}],"onderschrift":"tijdbasis: 1 hokje = 0,5 ms","breedteCm":9,"controle":[{"meting":"T","parameter":"T_hok"},{"meting":"A","verwacht":2},{"meting":"tijdbasis","verwacht":0.5}]},
  "parameters": [{"naam":"T_hok","waarde":4,"eenheid":"hokjes","bron":"figuur"},{"naam":"tb","waarde":0.5,"eenheid":"ms","bron":"figuur"}],
  "berekeningen": [{"naam":"T","formule":"T_hok * tb","waarde":2,"eenheid":"ms","afgerond":"2,0"},{"naam":"f","formule":"1000 / T","waarde":500,"eenheid":"Hz","afgerond":"500"}]
- Keuze uit vier beelden A–D (panelen MET labels; opties "beeld A" …; "juist" = de letter):
  "figuur": {"type":"oscilloscoop","hokjesX":8,"hokjesY":6,"panelen":[{"label":"A","amplitude":2,"trillingstijd":4},{"label":"B","amplitude":1,"trillingstijd":4},{"label":"C","amplitude":2,"trillingstijd":2},{"label":"D","amplitude":1,"trillingstijd":8}],"onderschrift":"1 hokje = 1 ms","breedteCm":10,"controle":[{"meting":"A.T","verwacht":4},{"meting":"C.T","verwacht":2},{"meting":"tijdbasis","verwacht":1}]},
  "stam": "Welk beeld hoort bij de hoogste toon?", "opties": ["beeld A","beeld B","beeld C","beeld D"], "antwoordmodel": {"regels":["C: kortste trillingstijd, dus de hoogste frequentie"],"juist":"C"}
  (diagrammen A–D bij beweging: {"type":"grafiek","x":{"label":"t","min":0,"max":4,"stap":1},"y":{"label":"v","min":0,"max":4,"stap":1},"reeksen":[],"panelen":[{"label":"A","punten":[[0,0],[4,4]]},{"label":"B","punten":[[0,2],[4,2]]},{"label":"C","punten":[[0,4],[4,0]]},{"label":"D","punten":[[0,0],[2,4],[4,4]]}],"breedteCm":10,"controle":[{"meting":"A.trend","verwacht":1},{"meting":"B.trend","verwacht":0},{"meting":"C.trend","verwacht":-1}]})
- Tekenvraag in een grafiek (leerling zet punten uit de tekst en tekent de lijn): leerling krijgt het LEGE assenstelsel, de antwoordfiguur de rode lijn:
  "tekenvraag": true, "stam": "Bij 1 min is het 70 dB en bij 3 min 90 dB. Zet de punten in het diagram en verbind ze met een rechte lijn.",
  "figuur": {"type":"grafiek","x":{"label":"t (min)","min":0,"max":4,"stap":1},"y":{"label":"L (dB)","min":0,"max":100,"stap":20},"reeksen":[],"breedteCm":9},
  "antwoordmodel": {"regels":["punten (1; 70) en (3; 90), verbonden met een rechte lijn"],"figuur":{"type":"grafiek","x":{"label":"t (min)","min":0,"max":4,"stap":1},"y":{"label":"L (dB)","min":0,"max":100,"stap":20},"reeksen":[{"punten":[[1,70],[3,90]],"vorm":"lijn","rood":true}],"breedteCm":9,"controle":[{"meting":"y@1","verwacht":70},{"meting":"y@3","verwacht":90}]}}

IDS: kleine letters, cijfers en streepjes; elke deelvraag-id uniek (bijv. "fietsbel-a").
SE-code ("se"): SE4.1 krachten/druk/werktuigen, SE4.2 energie/geluid/materie (dichtheid, fasen, stoffen), SE4.3 elektriciteit, SE4.4 arbeid/vermogen/beweging, ALG algemene vaardigheden.`;

/**
 * De eerste generatie mikt op ~115 % van de punten (minimaal 110, maximaal 120): een afgekeurd vraagstuk wordt dan eerst
 * geschrapt in plaats van hersteld, en inkorten tot 90–110 % is gratis.
 */
export const LENGTE_DOEL = 1.15;
export const LENGTE_MIN = 1.1;
export const LENGTE_MAX = 1.2;

export function specPrompt(inv: SpecInvoer, kal: Pick<Kalibratie, "items" | "punten"> & Partial<Pick<Kalibratie, "vorm" | "pct1p">>): string {
  const pars = extractParagrafen(inv.bronmateriaal, inv.antwoordenmateriaal);
  const typen = relevanteVraagtypen(inv.bronmateriaal, inv.leerjaar, inv.leerweg)
    .map((t, i) => `${i + 1}=${t.id} (${t.naam.split(/[(:;]/)[0]!.trim().slice(0, 50)})`)
    .join("; ");
  const r = inv.rttiDoel;
  const nVs = [Math.max(2, Math.round((kal.items * LENGTE_DOEL) / 4)), Math.max(2, Math.round((kal.items * LENGTE_DOEL) / 3))];
  return [
    `TOETS: "${inv.titel}" · NaSk · ${inv.leerweg} klas ${inv.leerjaar} · ${inv.duurMinuten} minuten.`,
    // Ruim 115 %: afgekeurde vraagstukken worden eerst geschrapt (geen herstelaanroep); te lang wordt deterministisch
    // ingekort tot 90–110 % (geen extra aanroep).
    `LENGTE: totaal ${Math.round(kal.punten * LENGTE_DOEL)} punten (minimaal ${Math.ceil(kal.punten * LENGTE_MIN)}, maximaal ${Math.floor(kal.punten * LENGTE_MAX)}) verdeeld over ongeveer ${Math.ceil(kal.items * LENGTE_DOEL)} deelvragen (minimaal ${Math.ceil(kal.items * LENGTE_MIN)}), dus ${nVs[0]}–${nVs[1]} vraagstukken van 3 of 4 deelvragen. Dit is bewust meer dan de toetstijd: de software kiest daarna zelf. Tel de punten na voordat je antwoordt.`,
    `RTTI-doel (percentage van de punten): R ${r.R}%, T1 ${r.T1}%, T2 ${r.T2}%, I ${r.I}%.`,
    kal.vorm ? `VRAAGVORMEN (aantal deelvragen, ongeveer, zoals echte toetsen van deze klas): ${vormRegel(kal.vorm, kal.items)}${kal.pct1p ? `; ongeveer ${kal.pct1p}% van de deelvragen is 1 punt` : ""}.` : "",
    `FIGUREN: gebruik in deze toets 2–4 figuren uit de toegestane typen waar de lesstof dat vraagt (bijv. een oscilloscoopbeeld bij geluid, een grafiek bij beweging of metingen, een schakelschema bij elektriciteit, een krachtenfiguur bij krachten), elk met "controle".`,
    pars.length ? `PARAGRAFEN: elke paragraaf komt terug in minstens TWEE verschillende vraagstukken (waar de lesstof dat toelaat; zo blijft de dekking heel als er een vraagstuk afvalt), verder verdeeld naar de hoeveelheid stof. Zet de paragraafcode vooraan in elk leerdoel. Paragrafen: ${pars.map((p) => `${p.code} ${p.titel}`).join("; ")}.` : "",
    inv.leerjaar <= 2 ? `NIVEAU: onderbouw klas ${inv.leerjaar}: korte inleidingen, eenvoudige taal, rekenwerk in 1–2 stappen; wel CSE-opbouw met vraagstukken.` : "",
    `WEETVRAGEN: hoogstens ${Math.round((MAX_1P_R[inv.leerweg] ?? 0.35) * 100)}% van de punten (${Math.floor((MAX_1P_R[inv.leerweg] ?? 0.35) * kal.punten)} punten) uit 1-punts R-vragen.`,
    bloklijstRegel(inv.bronmateriaal),
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
    (v.deelvragen ?? []).forEach((d, i) => {
      const teken = d.tekenvraag ?? /\b(teken|schets)\b/i.test(kaal(d.stam ?? ""));
      if (d.figuur) d.figuur = normaliseerTekenfiguur(d.figuur, teken);
      else if (i === 0 && v.figuur) v.figuur = normaliseerTekenfiguur(v.figuur, teken);
    });
    for (const d of v.deelvragen ?? []) {
      if (!d.antwoordmodel?.juist || d.opties?.length) continue;
      const f = d.figuur ?? v.figuur;
      const labels = f && (f.type === "oscilloscoop" || f.type === "grafiek") ? (f.panelen ?? []).map((p) => p.label).filter((x): x is string => Boolean(x)) : [];
      if (labels.length >= 2) d.opties = labels.map((l) => `${f!.type === "oscilloscoop" ? "beeld" : "diagram"} ${l}`);
    }
  }
  return g;
}

/** Paragrafen uit de lesstof die (nog) geen deelvraag hebben. */
export function ontbrekendeParagrafen(vs: VraagstukSpec[], inv: Pick<SpecInvoer, "bronmateriaal" | "antwoordenmateriaal">): { code: string; titel: string }[] {
  const pars = extractParagrafen(inv.bronmateriaal, inv.antwoordenmateriaal);
  if (pars.length < 2) return [];
  let n = 0;
  // Een paragraafcode in het leerdoel telt alleen als de deelvraag ook inhoudelijk over die paragraaf gaat
  // (een kernwoord raakt); anders valt de code weg en telt alleen de inhoud (geen dekking via een fout label).
  const kern = paragraafKern(inv.bronmateriaal, inv.antwoordenmateriaal);
  // Valt een code weg, dan telt de deelvraag voor de paragrafen waarvan hij wél een kernwoord raakt (of voor geen
  // enkele: "0.0" blokkeert de zwakke titelwoord-terugval, die anders op een hoofdstukwoord als "krachten" matcht).
  // Zonder code in het leerdoel: ook op kernwoorden (niet op losse titelwoorden).
  const metKern = pars.filter((p) => kern.get(p.code)?.length);
  const opKern = (d: VraagstukSpec["deelvragen"][number], behalve?: string) => {
    const c = metKern.filter((p) => p.code !== behalve && raaktKern(d, kern.get(p.code))).map((p) => p.code);
    return c.length ? c.join(" ") : "0.0";
  };
  const leerdoelVan = (d: VraagstukSpec["deelvragen"][number]) => {
    const l = d.leerdoel ?? "";
    if (!/\b\d{1,2}\.\d{1,2}\b/.test(l)) return metKern.length ? `${l} ${opKern(d)}` : l;
    return l.replace(/\b(\d{1,2}\.\d{1,2})\b/g, (code) => (raaktKern(d, kern.get(code)) ? code : opKern(d, code)));
  };
  const pseudo = vs.flatMap((v) => v.deelvragen.map((d) => ({ nummer: ++n, domein: v.hoofdstuk.replace(/\d{1,2}\.\d{1,2}/g, ""), leerdoel: leerdoelVan(d), stam: kaal(d.stam), context: kaal([...v.context, ...(d.context ?? [])].join(" ")) }) as unknown as Vraag));
  return paragraafDekking(pseudo, pars).filter((d) => !d.vragen.length).map((d) => d.paragraaf);
}

const normBegrip = (b: string) => kaal(b).toLowerCase().replace(/[^a-zà-ÿ0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["van", "het", "een", "met", "uit", "bij", "and", "voor"].includes(w)).sort().join(" ");

/**
 * Paragrafen die maar door één vraagstuk gedekt worden (valt dat vraagstuk af, dan ontbreekt de paragraaf); per
 * paragraaf het vraagstuk. Informatief: de prompt vraagt om minstens twee vraagstukken per paragraaf.
 */
export function enkelGedekteParagrafen(vs: VraagstukSpec[], inv: Pick<SpecInvoer, "bronmateriaal" | "antwoordenmateriaal">): { paragraaf: string; vraagstuk: string }[] {
  const basis = new Set(ontbrekendeParagrafen(vs, inv).map((p) => p.code));
  return vs.flatMap((v) =>
    ontbrekendeParagrafen(
      vs.filter((x) => x !== v),
      inv,
    )
      .filter((p) => !basis.has(p.code))
      .map((p) => ({ paragraaf: `${p.code} ${p.titel}`, vraagstuk: v.id })),
  );
}

/** Dubbel getoetst begrip: zelfde begrip-label, of (in verschillende vraagstukken) bijna hetzelfde modelantwoord. */
export function zoekDubbeleBegrippen(vs: VraagstukSpec[]): { id: string; vraagstuk: string; tekst: string }[] {
  const items = vs.flatMap((v) => v.deelvragen.map((d) => ({ v, d, b: normBegrip(d.begrip ?? ""), aw: woorden(antwoordVan(d)) })));
  const uit: { id: string; vraagstuk: string; tekst: string }[] = [];
  for (let j = 0; j < items.length; j++) {
    for (let i = 0; i < j; i++) {
      const a = items[i]!;
      const b = items[j]!;
      const zelfdeLabel = a.b && a.b === b.b;
      const zelfdeAntwoord = a.v !== b.v && a.aw.length >= 3 && b.aw.length >= 3 && Math.min(overlap(a.aw, b.aw), overlap(b.aw, a.aw)) >= 0.6;
      if (zelfdeLabel || zelfdeAntwoord) uit.push({ id: b.d.id, vraagstuk: b.v.id, tekst: `${b.d.id} toetst hetzelfde als ${a.d.id} (${zelfdeLabel ? `begrip "${b.d.begrip}"` : "bijna hetzelfde antwoord"}); kies een ander begrip` });
    }
  }
  return uit;
}

function antwoordVan(d: VraagstukSpec["deelvragen"][number]): string {
  if (d.opties?.length && d.antwoordmodel.juist) return kaal(d.opties[d.antwoordmodel.juist.charCodeAt(0) - 65] ?? "");
  return kaal(d.antwoordmodel.regels[0] ?? "");
}

/**
 * Weggevers tussen vragen (zelfde maat als de eval-rubriek, maar ook binnen een vraagstuk): het antwoord van vraag B
 * staat grotendeels (≥ 60 % van de inhoudswoorden) in de eigen tekst of de opties van vraag A.
 */
export function zoekKruisWeggevers(vs: VraagstukSpec[]): { gever: string; vraagstuk: string; tekst: string }[] {
  const items = vs.flatMap((v) => v.deelvragen.map((d) => ({ v, d, eigen: woorden(tekstVan(d)), aw: woorden(antwoordVan(d)) })));
  const uit: { gever: string; vraagstuk: string; tekst: string }[] = [];
  for (const b of items) {
    if (b.aw.length < 3) continue;
    for (const a of items) {
      if (a === b) continue;
      if (overlap(b.aw, a.eigen) >= 0.6) uit.push({ gever: a.d.id, vraagstuk: a.v.id, tekst: `${a.d.id} verklapt het antwoord van ${b.d.id} ("${antwoordVan(b.d).slice(0, 50)}")${a.d.opties?.length ? " in de opties" : ""}` });
    }
  }
  return uit;
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
    dubbeleBegrippen: string[];
    begripHerhaling: string[];
    ontbrekendeParagrafen: string[];
    figuurVerwijzingen: string[];
    samenhang: string[];
    /** Aandeel punten uit 1-punts R-vragen en de grens voor deze leerweg. */
    eenPuntsR: { pct: number; max: number };
    buitenLesstof: string[];
    afronding: string[];
    afgekeurd: string[];
  };
}

const kaal = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function tekstVan(d: { context?: string[]; stam: string; opties?: string[]; tabel?: string[][] }): string {
  return kaal([...(d.context ?? []), d.stam, ...(d.opties ?? []), ...(d.tabel ?? []).flat()].join(" \n "));
}

/**
 * Weggevers die code kan zien:
 * - getal: de afgeronde uitkomst van A staat MET eenheid in een andere deelvraag van hetzelfde vraagstuk (zie
 *   zoekGetalWeggevers; een los getal of hetzelfde getal in een ander vraagstuk telt niet);
 * - uitspraak: het juiste MC-antwoord van A (≥ 14 tekens) staat letterlijk in de tekst van een andere deelvraag.
 */
export function zoekWeggevers(vs: VraagstukSpec[]): string[] {
  const uit: string[] = zoekGetalWeggevers(vs);
  const items = vs.flatMap((v) => v.deelvragen.map((d, i) => ({ v, d, eigen: tekstVan(d) + (i === 0 ? " " + kaal(v.context.join(" ")) : "") })));
  for (const a of items) {
    const juist = a.d.opties && a.d.antwoordmodel.juist ? kaal(a.d.opties[a.d.antwoordmodel.juist.charCodeAt(0) - 65] ?? "") : "";
    if (juist.length < 14 || /^(ja|nee|juist|onjuist|groter|kleiner|gelijk)/i.test(juist)) continue;
    for (const b of items) {
      if (a === b) continue;
      if (b.eigen.toLowerCase().includes(juist.toLowerCase()) && !(b.d.opties ?? []).some((o) => kaal(o).toLowerCase() === juist.toLowerCase())) uit.push(`${b.d.id} verklapt ${a.d.id} ("${juist.slice(0, 40)}")`);
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
    klas: { leerjaar: inv.leerjaar, leerweg: inv.leerweg },
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

/**
 * Leesbare hoofdstuk-/onderwerpnaam voor de opmaak ("Onderwerp: H3 Krachten" i.p.v. "Onderwerp: 3"): een kaal nummer
 * wordt aangevuld met de hoofdstuktitel uit de lesstof ("Hoofdstuk 3 Krachten (…)").
 */
export function hoofdstukNaam(h: string, bron: string): string {
  const m = /^\s*(?:H|hoofdstuk\s*)?(\d{1,2})(?:\.\d{1,2})?\s*$/i.exec(h ?? "");
  if (!m) return h;
  const kop = new RegExp(`^\\s*(?:Hoofdstuk|H)\\s*${m[1]}\\b[\\s:.–-]*([^\\n(]+)`, "im").exec(bron);
  const titel = kop?.[1]?.trim().replace(/[\s:.–-]+$/, "");
  return titel ? `H${m[1]} ${titel}` : `H${m[1]}`;
}

/**
 * Toets + opmaak voor de export. Standaard één leerlingdeel (één voorblad); `splitsen` maakt op verzoek deel A en B
 * (hele vraagstukken, verdeeld op punten).
 */
export function opmaakVoor(gen: Generatie, inv: SpecInvoer, opts: { splitsen?: boolean } = {}): { toets: ToetsSpec; res: Pijplijnresultaat } {
  const toets = alsToetsSpec(gen, inv);
  if (opts.splitsen && gen.vraagstukken.length >= 2) {
    const tot = gen.vraagstukken.reduce((s, v) => s + puntenVan(v), 0);
    let som = 0;
    const a: string[] = [];
    const b: string[] = [];
    for (const v of gen.vraagstukken) {
      const p = puntenVan(v);
      if (!b.length && (!a.length || som + p / 2 <= tot / 2)) {
        a.push(v.id);
        som += p;
      } else b.push(v.id);
    }
    if (!b.length) b.push(a.pop()!);
    toets.delen = [{ naam: "Deel A", vragen: a }, { naam: "Deel B", vragen: b }];
  }
  const fixtures: Fixture[] = gen.vraagstukken.map((v) => ({ ...v, soort: "vraagstuk", hoofdstuk: hoofdstukNaam(v.hoofdstuk, inv.bronmateriaal) }) as Fixture);
  return { toets, res: verwerkToets(toets, fixtures) };
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
  const fixtures: Fixture[] = gen.vraagstukken.map((v) => ({ ...v, soort: "vraagstuk", hoofdstuk: hoofdstukNaam(v.hoofdstuk, inv.bronmateriaal) }) as Fixture);
  const res = verwerkToets(toets, fixtures);
  for (const k of res.keuringen) for (const f of k.fouten) voeg(k.id, f);
  for (const f of res.toetsFouten) voeg("", f);
  const weggevers = zoekWeggevers(gen.vraagstukken);
  for (const w of weggevers) {
    const id = gen.vraagstukken.find((v) => v.deelvragen.some((d) => w.startsWith(d.id)))?.id ?? "";
    voeg(id, `weggever: ${w}`);
  }
  const kruis = zoekKruisWeggevers(gen.vraagstukken);
  for (const k of kruis) {
    voeg(k.vraagstuk, `weggever: ${k.tekst}`);
    weggevers.push(k.tekst);
  }
  const dubbel = zoekDubbeleBegrippen(gen.vraagstukken);
  for (const d of dubbel) voeg(d.vraagstuk, `dubbel begrip: ${d.tekst}`);
  const herhaling = zoekBegripHerhaling(gen.vraagstukken);
  for (const b of herhaling) voeg(b.vraagstuk, `begrip: ${b.tekst}`);
  const figVerwijzingen = zoekFiguurVerwijzingen(gen.vraagstukken);
  for (const b of figVerwijzingen) voeg(b.vraagstuk, `figuur: ${b.tekst}`);
  const incoherent = zoekIncoherentie(gen.vraagstukken, inv.bronmateriaal);
  for (const b of incoherent) voeg(b.vraagstuk, `samenhang: ${b.tekst}`);
  const r1 = eenPuntsReproductie(gen.vraagstukken, inv.leerweg);
  for (const b of r1.bevindingen) voeg(b.vraagstuk, `1p-R: ${b.tekst}`);
  const buiten = buitenLesstof(gen.vraagstukken, inv.bronmateriaal, inv.antwoordenmateriaal);
  for (const b of buiten) voeg(b.vraagstuk, `lesstof: ${b.tekst}`);
  const afronding = afrondFouten(gen.vraagstukken);
  for (const b of afronding) voeg(b.vraagstuk, `afronding: ${b.tekst}`);
  const ontbreekt = ontbrekendeParagrafen(gen.vraagstukken, inv);
  if (ontbreekt.length) voeg("", `dekking: geen deelvraag over ${ontbreekt.map((p) => `${p.code} ${p.titel}`).join("; ")}`);
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
      dubbeleBegrippen: dubbel.map((d) => d.tekst),
      begripHerhaling: herhaling.map((b) => b.tekst),
      ontbrekendeParagrafen: ontbreekt.map((p) => `${p.code} ${p.titel}`),
      figuurVerwijzingen: figVerwijzingen.map((b) => b.tekst),
      samenhang: incoherent.map((b) => b.tekst),
      eenPuntsR: { pct: Math.round(r1.pct * 100) / 100, max: r1.max },
      buitenLesstof: buiten.map((b) => b.tekst),
      afronding: afronding.map((b) => b.tekst),
      afgekeurd: res.afgekeurd,
    },
  };
}

/** xAI-serverfout (HTTP 5xx / "internal"): de aanroep kostte niets en mag één keer opnieuw. */
export function isServerfout(e: unknown): boolean {
  const m = String((e as Error)?.message ?? e);
  return /\b(HTTP|error|status)\s*5\d\d\b|\b5\d\d\b.*\binternal\b|"code":"internal"/i.test(m);
}

export type ChatFn = (messages: { role: "system" | "user" | "assistant"; content: string }[], schema: { naam: string; schema: Record<string, unknown> }, maxTokens: number) => Promise<string>;

/** Kort overzicht van de andere vraagstukken (voor gerichte aanroepen: geen dubbele begrippen, personen of weggevers). */
export function overzicht(gen: Generatie, behalve?: string): string {
  return gen.vraagstukken
    .filter((v) => v.id !== behalve)
    .map((v) => `- ${v.id} "${v.titel}" (${kaal(v.context.join(" ")).slice(0, 110)}…): ${v.deelvragen.map((d) => `[${d.begrip ?? "?"}] ${kaal(d.stam).slice(0, 70)} → ${antwoordVan(d).slice(0, 50)}`).join(" | ")}`)
    .join("\n");
}

export function gerichtPrompt(o: { soort: "herstel"; vraagstuk: VraagstukSpec; fouten: string[]; gen: Generatie } | { soort: "nieuw"; punten: number; paragrafen: string[]; gen: Generatie; fouten?: string[]; vorige?: VraagstukSpec; id: string; inv?: SpecInvoer }): string {
  const ander = overzicht(o.gen, o.soort === "herstel" ? o.vraagstuk.id : o.id);
  const kop = `Schrijf nu ALLEEN één vraagstuk (JSON: {"vraagstuk": …}). De rest van de toets staat al vast:\n${ander}\n\nGebruik een andere situatie, persoon en andere begrippen dan hierboven, en verklap geen antwoorden van die vragen.`;
  if (o.soort === "herstel") {
    const p = o.vraagstuk.deelvragen.reduce((s, d) => s + d.punten, 0);
    return `${kop}\n\nDit vraagstuk is door de software AFGEKEURD:\n${JSON.stringify(o.vraagstuk)}\n\nFouten:\n- ${o.fouten.join("\n- ")}\n\nSchrijf het vraagstuk opnieuw zodat al deze fouten weg zijn: zelfde id ("${o.vraagstuk.id}"), zelfde onderwerp en paragrafen, samen precies ${p} punten (nu per deelvraag ${o.vraagstuk.deelvragen.map((d) => d.punten).join(" + ")}), 3–4 deelvragen. Reken alles opnieuw na en controleer elke figuur-controle.`;
  }
  if (o.inv) return aanvulPrompt({ ...o, inv: o.inv });
  const extra = o.vorige && o.fouten?.length ? `\n\nJe vorige poging werd afgekeurd:\n${JSON.stringify(o.vorige)}\nFouten:\n- ${o.fouten.join("\n- ")}` : "";
  return `${kop}\n\nNIEUW vraagstuk met id "${o.id}", samen precies ${o.punten} punten in 3–4 deelvragen${o.paragrafen.length ? `, over: ${o.paragrafen.join("; ")} (begin elk leerdoel met de paragraafcode)` : ""}. Houd je aan alle regels van de opdracht.${extra}`;
}

// ── aanvullen: volledige vraagstukken met exacte punten, uit de minst getoetste paragrafen ─────────────────────────

/** Puntverdeling over 3–4 deelvragen voor precies `p` punten (3–5 p: 3 deelvragen, 6–9 p: 4; hoogstens 3 p per deelvraag). */
export function puntenVerdeling(p: number): number[] {
  const t = Math.max(3, Math.min(12, Math.round(p)));
  const n = t <= 5 ? 3 : 4;
  const base = Math.floor(t / n);
  const rest = t % n;
  return Array.from({ length: n }, (_, i) => base + (i >= n - rest ? 1 : 0));
}

/** Per paragraaf uit de lesstof: in hoeveel vraagstukken hij getoetst wordt (minst getoetst eerst; volgorde lesstof bij gelijk). */
export function paragraafTelling(vs: VraagstukSpec[], inv: Pick<SpecInvoer, "bronmateriaal" | "antwoordenmateriaal">): { code: string; titel: string; n: number }[] {
  const pars = extractParagrafen(inv.bronmateriaal, inv.antwoordenmateriaal);
  if (pars.length < 2) return [];
  const gedekt = vs.map((v) => {
    const mist = new Set(ontbrekendeParagrafen([v], inv).map((p) => p.code));
    return new Set(pars.filter((p) => !mist.has(p.code)).map((p) => p.code));
  });
  return pars.map((p, i) => ({ code: p.code, titel: p.titel, n: gedekt.filter((g) => g.has(p.code)).length, i })).sort((a, b) => a.n - b.n || a.i - b.i).map(({ code, titel, n }) => ({ code, titel, n }));
}

/** Paragrafen (code + titel) die een vraagstuk raakt. */
export function paragrafenVan(v: VraagstukSpec, inv: Pick<SpecInvoer, "bronmateriaal" | "antwoordenmateriaal">): string[] {
  const pars = extractParagrafen(inv.bronmateriaal, inv.antwoordenmateriaal);
  if (pars.length < 2) return [];
  const mist = new Set(ontbrekendeParagrafen([v], inv).map((p) => p.code));
  return pars.filter((p) => !mist.has(p.code)).map((p) => `${p.code} ${p.titel}`);
}

/** Soort van een keurbevinding (voor "waarom afgekeurd" en om gelijke mislukkingen te herkennen). */
export function foutSoort(f: string): string {
  const t = f.replace(/^\[[^\]]*\]\s*/, "");
  if (/toetst opnieuw|^begrip:/.test(t)) return "begrip-herhaling";
  if (/^dubbel begrip/.test(t)) return "dubbel-begrip";
  if (/^weggever/.test(t)) return "weggever";
  if (/^1p-R/.test(t)) return "weetvragen";
  if (/^lesstof/.test(t)) return "buiten-lesstof";
  if (/^figuur|figuur|tekenvraag|oscilloscoop|grafiek|krachten/.test(t)) return "figuur";
  if (/^afronding|staat niet in|geeft .*spec zegt|parameter|variabele/.test(t)) return "rekenwerk";
  if (/letterlijk/.test(t)) return "letterlijk";
  if (/^samenhang/.test(t)) return "samenhang";
  if (/schema|meerkeuze|scorestappen|deelvragen|punten/.test(t)) return "vorm";
  return "overig";
}

const UITLEG: Record<string, string> = {
  "begrip-herhaling": "een begrip dat al OP is (staat al in een ander vraagstuk); kies uitsluitend begrippen die nog vrij zijn",
  "dubbel-begrip": "een deelvraag vraagt bijna hetzelfde als een bestaand vraagstuk; kies een ander begrip en een andere redenering",
  weggever: "een antwoord of getal verklapt (of wordt verklapt door) een ander vraagstuk; gebruik andere getallen, woorden en antwoorden",
  weetvragen: "te veel 1-punts weetvragen (R) in de toets; maak 1-punts deelvragen toepassingsvragen (T1) of geef ze 2 punten",
  "buiten-lesstof": "stof of vaktaal die niet in de lesstof staat; blijf binnen de genoemde paragrafen",
  figuur: "de figuur klopt niet met de vraag (of ontbreekt); laat de figuur weg of maak hem met een geldige controle",
  rekenwerk: "een berekening of afronding klopt niet met het antwoordmodel; reken elke stap na",
  letterlijk: "een zin komt letterlijk uit de lesstof; formuleer alles zelf",
  samenhang: "de deelvragen passen niet bij de situatie; houd één samenhangende situatie aan",
  vorm: "de vorm klopt niet (3–4 deelvragen, punten, scorestappen, meerkeuze met juiste letter)",
  overig: "zie de letterlijke bevindingen",
};

/** Korte uitleg per soort bevinding (voor de prompt en het log). */
export function waaromAfgekeurd(fouten: string[]): string[] {
  return [...new Set(fouten.map(foutSoort))].map((k) => `${k}: ${UITLEG[k] ?? UITLEG.overig}`);
}

/** Vaste handtekening van een mislukte poging (gelijke soorten bevindingen = gelijke mislukking). */
export const foutHandtekening = (fouten: string[]) => [...new Set(fouten.map(foutSoort))].sort().join("+") || "geen";

function contextRegels(gen: Generatie, inv: SpecInvoer, behalve: string, extraPunten: number): string[] {
  const telling = begripTelling(gen.vraagstukken.filter((v) => v.id !== behalve), inv.bronmateriaal);
  const op = telling.filter((b) => b.in.length >= b.max);
  const vrij = telling.filter((b) => b.in.length < b.max);
  const labels = [...new Set(gen.vraagstukken.filter((v) => v.id !== behalve).flatMap((v) => v.deelvragen.map((d) => d.begrip).filter((b): b is string => Boolean(b))))];
  const r1 = eenPuntsReproductie(gen.vraagstukken.filter((v) => v.id !== behalve), inv.leerweg);
  const totaal = gen.vraagstukken.filter((v) => v.id !== behalve).reduce((s, v) => s + puntenVan(v), 0) + extraPunten;
  const nu1R = gen.vraagstukken.filter((v) => v.id !== behalve).flatMap((v) => v.deelvragen).filter((d) => d.punten === 1 && d.rtti === "R").length;
  const ruimte1R = Math.max(0, Math.floor(r1.max * totaal) - nu1R);
  const situaties = gen.vraagstukken.filter((v) => v.id !== behalve).map((v) => v.titel).filter(Boolean);
  return [
    op.length ? `BEGRIPPEN DIE OP ZIJN (niet gebruiken, ook niet in andere woorden of als afleider): ${op.map((b) => `${b.naam} (al in ${b.in.join(", ")})`).join("; ")}.` : "",
    vrij.length ? `Bloklijst-begrippen die nog vrij zijn: ${vrij.map((b) => `${b.naam} (nog ${b.max - b.in.length}×)`).join("; ")}.` : "",
    labels.length ? `Al getoetste begrippen (niet nog eens toetsen): ${labels.join("; ")}.` : "",
    `1-punts weetvragen (R): nog hoogstens ${ruimte1R} in de hele toets${ruimte1R === 0 ? "; maak elke 1-punts deelvraag een toepassingsvraag (T1)" : ""}.`,
    situaties.length ? `Al gebruikte situaties (kies een andere situatie en persoon): ${situaties.join("; ")}.` : "",
    `Gebruik geen getallen of antwoorden die in de andere vraagstukken voorkomen.`,
  ].filter(Boolean);
}

/**
 * Prompt voor een NIEUW, volledig vraagstuk: exacte punten per deelvraag, uit de minst getoetste paragrafen van
 * dezelfde lesstof, met de begrippen die op zijn, en (bij een herkansing) waarom de vorige poging is afgekeurd.
 */
export function aanvulPrompt(o: { id: string; punten: number; paragrafen: string[]; gen: Generatie; inv: SpecInvoer; fouten?: string[]; vorige?: VraagstukSpec }): string {
  const verdeling = puntenVerdeling(o.punten);
  const p = verdeling.reduce((a, b) => a + b, 0);
  const kop = `Schrijf nu ALLEEN één vraagstuk (JSON: {"vraagstuk": …}). De rest van de toets staat al vast:\n${overzicht(o.gen, o.id)}`;
  const opdracht = `NIEUW VRAAGSTUK met id "${o.id}": precies ${p} punten in ${verdeling.length} deelvragen, met in deze volgorde ${verdeling.map((x) => `${x} p`).join(", ")} (scorestappen per deelvraag = zijn punten; tel na).${o.paragrafen.length ? ` Paragrafen (uit dezelfde lesstof; nu het minst getoetst): ${o.paragrafen.join("; ")}. Begin elk leerdoel met de paragraafcode.` : ""}`;
  const terug = o.vorige && o.fouten?.length
    ? `\n\nJE VORIGE POGING ("${o.vorige.titel}") IS DOOR DE SOFTWARE AFGEKEURD. Waarom:\n- ${waaromAfgekeurd(o.fouten).join("\n- ")}\nLetterlijke bevindingen:\n- ${o.fouten.slice(0, 8).join("\n- ")}\nSchrijf een ANDER vraagstuk (andere situatie en andere begrippen) waarin deze punten niet terugkomen.`
    : "";
  return [kop, "", opdracht, ...contextRegels(o.gen, o.inv, o.id, p), "Houd je verder aan alle regels van de opdracht." + terug].join("\n");
}

/**
 * Prompt om een goedgekeurd vraagstuk uit te breiden (andere strategie als aanvullen twee keer op dezelfde manier
 * mislukt): bestaande deelvragen blijven staan, er komt één deelvraag bij (of, bij 4 deelvragen, extra punten).
 */
export function uitbreidPrompt(o: { vraagstuk: VraagstukSpec; extra: number; gen: Generatie; inv: SpecInvoer; fouten?: string[] }): string {
  const v = o.vraagstuk;
  const nu = puntenVan(v);
  const doel = nu + o.extra;
  const hoe = v.deelvragen.length < 4
    ? `Laat de bestaande ${v.deelvragen.length} deelvragen ongewijzigd (zelfde tekst, punten en antwoorden) en voeg aan het eind één nieuwe deelvraag van ${o.extra} punt(en) toe die op dezelfde situatie voortbouwt (een ander begrip dan de bestaande deelvragen).`
    : `Het vraagstuk heeft al 4 deelvragen: houd ze, maar maak één of twee deelvragen zwaarder (een extra rekenstap of uitlegstap) zodat het totaal ${doel} punten wordt; pas scorestappen en antwoordmodel daarop aan.`;
  const terug = o.fouten?.length ? `\n\nEen vorige uitbreiding is afgekeurd. Waarom:\n- ${waaromAfgekeurd(o.fouten).join("\n- ")}\nLetterlijk:\n- ${o.fouten.slice(0, 6).join("\n- ")}` : "";
  return [
    `Schrijf nu ALLEEN één vraagstuk (JSON: {"vraagstuk": …}). De rest van de toets staat al vast:\n${overzicht(o.gen, v.id)}`,
    "",
    `BREID dit goedgekeurde vraagstuk uit van ${nu} naar precies ${doel} punten, zelfde id ("${v.id}"):\n${JSON.stringify(v)}`,
    hoe,
    ...contextRegels(o.gen, o.inv, v.id, o.extra),
    "Reken alles opnieuw na en controleer elke figuur-controle." + terug,
  ].join("\n");
}

export interface Stap {
  wat: string;
  id: string;
  ok: boolean;
  fouten?: string[];
}

/**
 * Genereer + keur + gericht herstel:
 *  1. één aanroep voor de hele toets (~115 % lengte), dan deterministische auto-fixes;
 *  1b. afgekeurde vraagstukken eerst schrappen zolang lengte (≥ 90 %) en dekking dat toelaten (`schrapAfgekeurd`);
 *  2. elk overgebleven afgekeurd vraagstuk wordt OPNIEUW gegenereerd (gerichte aanroep met de keurfouten, max 2 pogingen);
 *  3. pas als het dan nog niet goed is, wordt het geschrapt;
 *  4. lengte (90–110 %) en paragraafdekking worden aangevuld met nieuwe vraagstukken (parallel, elk max 2 pogingen);
 *  5. een te lange toets wordt deterministisch ingekort (vraagstuk met de laagste waarde schrappen, zie `inkorten`).
 * Een mislukte of door het budget geweigerde gerichte aanroep breekt de generatie niet af (staat in `stappen`).
 */
/** Maximaal zoveel gerichte aanroepen tegelijk. */
const PARALLEL = 4;

export async function pool<T, R>(xs: T[], n: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const uit: R[] = new Array(xs.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, xs.length) }, async () => {
      while (i < xs.length) {
        const j = i++;
        uit[j] = await f(xs[j]!);
      }
    }),
  );
  return uit;
}

/** Aantal fouten op vraagstukniveau (zonder de toetsniveau-fouten lengte/dekking). */
export const vraagstukFouten = (r: Keuringsrapport) => Object.entries(r.perId).reduce((s, [id, l]) => s + (id ? l.length : 0), 0);
export const puntenVan = (v: VraagstukSpec) => v.deelvragen.reduce((s, d) => s + (d.punten ?? 0), 0);
/** "Waarde" van een vraagstuk voor het inkorten: punten op T2/I-niveau (inzicht) tellen het zwaarst. */
export const waardeVan = (v: VraagstukSpec) => v.deelvragen.reduce((s, d) => s + (d.punten ?? 0) * (d.rtti === "T2" || d.rtti === "I" ? 2 : 1), 0);

/** Vraagstuk zonder zijn laatste deelvraag (alleen bij 4 deelvragen: een vraagstuk heeft er minstens 3). */
export function zonderStaart(v: VraagstukSpec): VraagstukSpec | null {
  return v.deelvragen.length >= 4 ? { ...v, deelvragen: v.deelvragen.slice(0, -1) } : null;
}

/**
 * Eerst schrappen, dan pas herstellen: zolang de toets daarna nog ≥ 90 % lengte en genoeg deelvragen heeft en er
 * geen paragraaf extra gaat ontbreken. Liever één deelvraag dan een heel vraagstuk: zit de fout alleen in de laatste
 * deelvraag (vraagstuk wordt zonder die deelvraag goed), dan valt alleen die weg. Anders het vraagstuk met de meeste
 * fouten (bij gelijk: de laagste waarde). Wat niet weg kan zonder lengte of dekking te breken, gaat naar gericht herstel.
 */
export function schrapAfgekeurd(gen0: Generatie, inv: SpecInvoer, kal: Pick<Kalibratie, "items" | "punten">): { gen: Generatie; stappen: Stap[] } {
  let gen = gen0;
  const stappen: Stap[] = [];
  const minV = Math.ceil(kal.items * 0.85);
  for (let n = 0; n < 20; n++) {
    const r = keurGeneratie(gen, inv, kal);
    const ontbr = new Set(r.feiten.ontbrekendeParagrafen);
    const fout = gen.vraagstukken.filter((v) => r.perId[v.id]?.length);
    if (!fout.length) break;
    const heel = (f: Keuringsrapport["feiten"]) => f.lengtePct >= 90 && f.vragen >= minV && f.ontbrekendeParagrafen.every((p) => ontbr.has(p));
    // 1. alleen de laatste deelvraag weg, als het vraagstuk daarmee goed wordt
    const staart = fout
      .map((v) => {
        const v2 = zonderStaart(v);
        if (!v2) return null;
        const g: Generatie = { ...gen, vraagstukken: gen.vraagstukken.map((x) => (x === v ? v2 : x)) };
        const r2 = keurGeneratie(g, inv, kal);
        return !r2.perId[v.id]?.length && heel(r2.feiten) && vraagstukFouten(r2) < vraagstukFouten(r) ? { v, g, d: v.deelvragen.at(-1)! } : null;
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    if (staart[0]) {
      const k = staart[0];
      stappen.push({ wat: `deelvraag ${k.d.id} geschrapt vóór herstel (${k.d.punten} p; rest van het vraagstuk is goed)`, id: k.v.id, ok: true, fouten: r.perId[k.v.id] });
      gen = k.g;
      continue;
    }
    // 2. een heel vraagstuk
    const kand = fout
      .map((v) => {
        const g: Generatie = { ...gen, vraagstukken: gen.vraagstukken.filter((x) => x !== v) };
        return { v, g, ok: heel(keurGeneratie(g, inv, kal).feiten), nFout: r.perId[v.id]!.length, waarde: waardeVan(v) };
      })
      .filter((k) => k.ok)
      .sort((a, b) => b.nFout - a.nFout || a.waarde - b.waarde);
    const k = kand[0];
    if (!k) break;
    stappen.push({ wat: `geschrapt vóór herstel (${puntenVan(k.v)} p, ${k.nFout} fout(en); lengte en dekking blijven heel)`, id: k.v.id, ok: true, fouten: r.perId[k.v.id] });
    gen = k.g;
  }
  return { gen, stappen };
}

/**
 * Lengtebewust inkorten tot net onder 110 %, nooit onder 90 %: liever losse deelvragen (de laatste van een vraagstuk
 * met 4 deelvragen) dan hele vraagstukken, de laagste waarde eerst. Per stap:
 *  1. haalt het weghalen van één deelvraag de toets tot ≤ 110 %: die deelvraag (hoogste lengte die nog ≤ 110 % is);
 *  2. anders een heel vraagstuk dat de toets in 90–110 % brengt (hoogste lengte, dan laagste waarde);
 *  3. anders het onderdeel met de laagste waarde per punt dat de toets ≥ 90 % houdt (deelvraag vóór vraagstuk zolang
 *     de rest boven 110 % nog klein is) en verder.
 * Een kandidaat mag geen paragraaf laten wegvallen, niet onder het minimum aantal deelvragen komen en geen nieuwe
 * fouten geven.
 */
export function inkorten(gen0: Generatie, inv: SpecInvoer, kal: Pick<Kalibratie, "items" | "punten">): { gen: Generatie; stappen: Stap[] } {
  let gen = gen0;
  const stappen: Stap[] = [];
  const minV = Math.ceil(kal.items * 0.85);
  for (let n = 0; n < 40; n++) {
    const r = keurGeneratie(gen, inv, kal);
    if (r.feiten.lengtePct <= 110) break;
    const ontbr = r.feiten.ontbrekendeParagrafen.length;
    const fout0 = vraagstukFouten(r);
    type Kand = { gen: Generatie; pct: number; waarde: number; punten: number; pos: number; wat: string; id: string; deel: boolean };
    const kand: Kand[] = [];
    const beoordeel = (g: Generatie, k: Omit<Kand, "gen" | "pct">) => {
      const r2 = keurGeneratie(g, inv, kal);
      const f2 = r2.feiten;
      if (f2.lengtePct < 90 || f2.ontbrekendeParagrafen.length > ontbr || f2.vragen < minV || vraagstukFouten(r2) > fout0) return;
      kand.push({ gen: g, pct: f2.lengtePct, ...k });
    };
    gen.vraagstukken.forEach((v, pos) => {
      const v2 = zonderStaart(v);
      if (v2) {
        const d = v.deelvragen.at(-1)!;
        beoordeel({ ...gen, vraagstukken: gen.vraagstukken.map((x) => (x === v ? v2 : x)) }, { wat: `deelvraag ${d.id} geschrapt (te lang, ${d.punten} p)`, id: v.id, waarde: waardeVan({ ...v, deelvragen: [d] }), punten: d.punten, pos, deel: true });
      }
      beoordeel({ ...gen, vraagstukken: gen.vraagstukken.filter((x) => x !== v) }, { wat: `geschrapt (te lang, ${puntenVan(v)} p)`, id: v.id, waarde: waardeVan(v), punten: puntenVan(v), pos, deel: false });
    });
    if (!kand.length) break;
    const laag = (a: Kand, b: Kand) => a.waarde / a.punten - b.waarde / b.punten || a.waarde - b.waarde || b.pos - a.pos;
    const hoogsteOnder = (l: Kand[]) => l.filter((k) => k.pct <= 110).sort((a, b) => b.pct - a.pct || laag(a, b))[0];
    const restOver = r.feiten.lengtePct - 110;
    const grootsteDeel = Math.max(0, ...kand.filter((k) => k.deel).map((k) => r.feiten.lengtePct - k.pct));
    const keuze =
      hoogsteOnder(kand.filter((k) => k.deel)) ??
      hoogsteOnder(kand.filter((k) => !k.deel)) ??
      // nog ver boven 110 %: een heel vraagstuk met de laagste waarde; vlak boven 110 %: een losse deelvraag
      [...kand].filter((k) => (restOver > 2 * grootsteDeel ? !k.deel : k.deel)).sort(laag)[0] ??
      [...kand].sort(laag)[0]!;
    gen = keuze.gen;
    stappen.push({ wat: keuze.wat, id: keuze.id, ok: true });
  }
  return { gen, stappen };
}

/** Vraagstuk onder een vaste id, met deelvraag-ids <id>-a, <id>-b … (geen botsing met de rest van de toets). */
export function metId(v: VraagstukSpec, id: string): VraagstukSpec {
  return { ...v, id, deelvragen: v.deelvragen.map((d, i) => ({ ...d, id: `${id}-${String.fromCharCode(97 + i)}` })) };
}

export async function genereerSpec(inv: SpecInvoer, kal: Pick<Kalibratie, "items" | "punten"> & Partial<Pick<Kalibratie, "vorm" | "pct1p">>, chat: ChatFn, opts: { maxTokens?: number; maxTokensGericht?: number; maxGericht?: number } = {}) {
  const basis = [
    { role: "system" as const, content: SPEC_SYSTEM },
    { role: "user" as const, content: specPrompt(inv, kal) },
  ];
  const stappen: Stap[] = [];
  // Eén xAI-5xx (serverfout, kost niets) wordt één keer opnieuw geprobeerd; telt niet als gerichte aanroep.
  const metHerkansing = async (f: () => Promise<string>, wat: string): Promise<string> => {
    try {
      return await f();
    } catch (e) {
      if (!isServerfout(e)) throw e;
      stappen.push({ wat: `xAI-serverfout, opnieuw (${wat})`, id: "", ok: false, fouten: [String((e as Error)?.message ?? e).slice(0, 120)] });
      return await f();
    }
  };
  const auto = <G extends Generatie>(g: G): G => {
    const r = autoHerstel(g);
    for (const a of r.stappen) stappen.push({ wat: `auto: ${a.wat}`, id: a.id, ok: true });
    return r.gen;
  };
  const tEerste = Date.now();
  const raw = await metHerkansing(() => chat(basis, { naam: "toets_spec", schema: generatieSchema() }, opts.maxTokens ?? 16000), "toets");
  const eersteMs = Date.now() - tEerste;
  const ruw = normaliseer(JSON.parse(raw) as Generatie);
  const eersteRuw = keurGeneratie(ruw, inv, kal);
  let gen = auto(ruw);
  const eerste = keurGeneratie(gen, inv, kal);
  // 1b. eerst schrappen: afgekeurde vraagstukken vallen weg als lengte en dekking dat toelaten (geen aanroep)
  const vooraf = schrapAfgekeurd(gen, inv, kal);
  gen = vooraf.gen;
  stappen.push(...vooraf.stappen);
  let gericht = 0;
  const maxGericht = opts.maxGericht ?? 8;
  let gestopt = false;
  const vraag = async (prompt: string): Promise<VraagstukSpec | null> => {
    if (gestopt || gericht >= maxGericht) return null;
    gericht++;
    try {
      const r = await metHerkansing(() => chat([...basis, { role: "user", content: prompt }], { naam: "vraagstuk", schema: vraagstukSchema() }, opts.maxTokensGericht ?? 6000), "vraagstuk");
      const v = (JSON.parse(r) as { vraagstuk: VraagstukSpec }).vraagstuk;
      return auto(normaliseer({ titel: "", vraagstukken: [v] })).vraagstukken[0] ?? null;
    } catch (e) {
      if (/budget/.test(String((e as Error)?.message))) gestopt = true;
      stappen.push({ wat: "aanroep mislukt", id: "", ok: false, fouten: [String((e as Error)?.message ?? e).slice(0, 160)] });
      return null;
    }
  };
  const vervang = (id: string, v: VraagstukSpec) => ({ ...gen, vraagstukken: gen.vraagstukken.map((x) => (x.id === id ? metId(v, id) : x)) });

  // 2. gericht opnieuw genereren (parallel per vraagstuk, max 2 pogingen)
  for (let poging = 1; poging <= 2; poging++) {
    const rap = keurGeneratie(gen, inv, kal);
    const fout = gen.vraagstukken.filter((v) => rap.perId[v.id]?.length);
    if (!fout.length) break;
    const nieuw = await pool(fout, PARALLEL, (v) => vraag(gerichtPrompt({ soort: "herstel", vraagstuk: v, fouten: rap.perId[v.id]!, gen })));
    fout.forEach((v, i) => {
      const n = nieuw[i];
      if (!n) return;
      gen = vervang(v.id, n);
      const na = keurGeneratie(gen, inv, kal).perId[v.id] ?? [];
      stappen.push({ wat: `opnieuw (poging ${poging})`, id: v.id, ok: na.length === 0, fouten: na });
    });
  }
  // 3. nog steeds fout → schrappen
  const rap3 = keurGeneratie(gen, inv, kal);
  const weg = gen.vraagstukken.filter((v) => rap3.perId[v.id]?.length).map((v) => v.id);
  for (const id of weg) stappen.push({ wat: "geschrapt", id, ok: false, fouten: rap3.perId[id] });
  gen = { ...gen, vraagstukken: gen.vraagstukken.filter((v) => !weg.includes(v.id)) };

  // 4. lengte en dekking aanvullen: nieuwe vraagstukken parallel (elk max 2 pogingen, met de keurfouten als feedback)
  let nAanvulling = 0;
  for (let ronde = 1; ronde <= 3 && !gestopt; ronde++) {
    const r = keurGeneratie(gen, inv, kal);
    const f = r.feiten;
    const pars = f.ontbrekendeParagrafen;
    const tekortP = Math.max(0, kal.punten - f.punten);
    const tekortV = Math.max(0, Math.ceil(kal.items * 0.85) - f.vragen);
    if (f.lengtePct >= 90 && !tekortV && !pars.length) break;
    const k = Math.min(6, maxGericht - gericht, Math.max(1, Math.ceil(pars.length / 2), Math.ceil(tekortP / 7), Math.ceil(tekortV / 3.5)));
    if (k <= 0) break;
    const per = Math.max(3, Math.min(9, Math.round((tekortP || 3 * k) / k)));
    const taken = Array.from({ length: k }, (_, i) => ({ id: `aanvulling-${++nAanvulling}`, paragrafen: pars.filter((_, j) => j % k === i), vorige: undefined as VraagstukSpec | undefined, fouten: undefined as string[] | undefined, klaar: false }));
    for (let poging = 1; poging <= 2; poging++) {
      const open = taken.filter((t) => !t.klaar && (poging === 1 || t.vorige));
      if (!open.length) break;
      const nieuw = await pool(open, PARALLEL, (t) => vraag(gerichtPrompt({ soort: "nieuw", id: t.id, punten: per, paragrafen: t.paragrafen, gen, vorige: t.vorige, fouten: t.fouten, inv })));
      open.forEach((t, i) => {
        const v = nieuw[i];
        if (!v) return;
        const voor = vraagstukFouten(keurGeneratie(gen, inv, kal));
        const kandidaat: Generatie = { ...gen, vraagstukken: [...gen.vraagstukken, metId(v, t.id)] };
        const rk = keurGeneratie(kandidaat, inv, kal);
        const eigen = rk.perId[t.id] ?? [];
        const ok = eigen.length === 0 && vraagstukFouten(rk) <= voor;
        const fouten = eigen.length ? eigen : ok ? [] : Object.entries(rk.perId).filter(([id]) => id && id !== t.id).flatMap(([, l]) => l).slice(0, 8);
        stappen.push({ wat: `aanvulling ${per} p (ronde ${ronde}, poging ${poging})`, id: t.id, ok, fouten });
        t.vorige = v;
        t.fouten = fouten;
        if (ok) {
          gen = kandidaat;
          t.klaar = true;
        }
      });
    }
  }

  // 5. te lang → deterministisch inkorten tot 90–110 % met behoud van dekking (geen extra aanroep)
  const lengteVoorInkorten = keurGeneratie(gen, inv, kal).feiten.lengtePct;
  const kort = inkorten(gen, inv, kal);
  gen = kort.gen;
  stappen.push(...kort.stappen);
  const rapport = keurGeneratie(gen, inv, kal);
  return { gen, ruw, eerste, eersteRuw, eersteMs, lengteVoorInkorten, rapport, hersteld: stappen.length > 0, stappen, gerichteAanroepen: gericht };
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
    const fig = q.figuur ? figuurTekst(q.figuur).replace(/^\[(figuur|foto): /, `[$1 bij vraag ${q.nr}${q.figuur.type !== "ai-afbeelding" ? " (als afbeelding bijgevoegd)" : ""}: `) : "";
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
