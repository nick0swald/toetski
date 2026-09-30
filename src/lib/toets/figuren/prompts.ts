import { symboolLijstVoorKeuring } from "./schakelsymbolen.ts";
import { GHS_SYMBOLEN, PICTOGRAM_NAAM, type FiguurSpec, type GhsSymbool, type NakijkItem, type Vraag } from "../types.ts";
import { MAX_FIGUREN_PER_TOETS, MAX_SFEERPLATEN_PER_TOETS, specSamenvatting } from "./spec.ts";

/** Vaste stijl voor elke sfeerplaat (Nova natuurkunde-lesboek). */
export const NOVA_STIJL = [
  "Flat, clean educational illustration in the style of a Dutch secondary-school physics/chemistry textbook (Nova natuurkunde).",
  "Thin, clear dark contour lines. Soft, flat pastel colours. No photorealism, no 3D rendering, no shading gradients, no dramatic lighting.",
  "Plain white background, simple schematic figures and objects, generous white space, one clear subject.",
  "No text, no letters, no numbers, no labels, no captions, no watermarks, no logos anywhere in the image.",
  "Lab safety must be correct: people doing experiments wear safety goggles, long hair tied back, no unsafe handling.",
].join(" ");

export function beeldPrompt(spec: FiguurSpec, scene: string): string {
  const niet = spec.nietTonen.length ? ` Do NOT show: ${spec.nietTonen.join("; ")}.` : "";
  const moet = spec.verplichteElementen.length ? ` Must clearly show: ${spec.verplichteElementen.join("; ")}.` : "";
  return `${NOVA_STIJL}\n\nScene: ${scene}.${moet}${niet}`;
}

export function vraagTekst(v: Vraag): string {
  const opties = v.opties?.length ? `\nOpties: ${v.opties.map((o) => `${o.letter}. ${o.tekst}`).join(" | ")}` : "";
  return `Vraag ${v.nummer} [${v.type}, ${v.rtti}, ${v.punten}p]\n${v.context ? `Context: ${v.context}\n` : ""}Stam: ${v.stam}${opties}`;
}

export function sleutelTekst(n?: NakijkItem): string {
  if (!n) return "(geen nakijkregel)";
  return `Modelantwoord: ${n.modelantwoord ?? ""}\nRubriek: ${(n.puntenverdeling ?? []).map((p) => `${p.punt}p ${p.criterium}`).join("; ")}`;
}

const SPEC_UITLEG = `Een figuurspec is JSON:
{ "soort": "lijngrafiek"|"staafdiagram"|"spreidingsdiagram"|"stroomkring"|"katrol"|"hefboom"|"krachtenschema"|"blokschema"|"maatcilinder"|"pictogram"|"sfeerplaat",
  "titel": string (kort, mag leeg),
  "doel": string (wat de figuur laat zien en waarom de vraag hem nodig heeft),
  "verplichteElementen": string[], "labels": string[],
  "getallen": [{"label": string, "waarde": number, "eenheid": string}],
  "eenheden": string[],
  "nietTonen": string[] (wat NIET in beeld mag, zodat het antwoord niet wordt weggegeven — bijv. de gevraagde waarde of de naam van het gevraagde begrip),
  "data": object per soort:
    lijngrafiek: {"xLabel","yLabel","xEenheid","yEenheid","reeksen":[{"naam"?, "punten":[{"x":n,"y":n}]}],"toonPunten":bool}
    staafdiagram: {"yLabel","yEenheid","xLabel"?,"staven":[{"label","waarde":n}],"toonWaarden":bool}
    spreidingsdiagram: {"xLabel","yLabel","xEenheid","yEenheid","punten":[{"x","y"}]}
    stroomkring: {"schakeling":"serie"|"parallel","bron":{"soort":"batterij"|"spanningsbron","label":"6 V"},"componenten":[{"soort":"lampje"|"weerstand"|"variabele weerstand"|"LDR"|"NTC"|"schakelaar-open"|"schakelaar-dicht"|"ampèremeter"|"motor"|"led"|"diode"|"zoemer"|"zekering","label"?}],"takken":[[component,...]] (alleen parallel),"voltmeters":[{"over":index (onderdeel in componenten) | {"tak":t,"index":i} (onderdeel in een tak),"label"?}] (nooit over de bron)}. De bron staat ALLEEN in "bron", nooit ook nog als onderdeel in componenten of takken.
    katrol: {"type":"vast"|"los"|"takel","touwdelen":n,"last":string,"kracht":string}
    hefboom: {"lengte":n,"eenheid":"m","draaipunt":n (afstand vanaf linkeruiteinde),"krachten":[{"positie":n,"label":string,"richting":"omlaag"|"omhoog"}],"toonMaten":bool}
    krachtenschema: {"voorwerp":string,"krachten":[{"naam":"Fz","richting":"omhoog"|"omlaag"|"links"|"rechts","grootte":n,"eenheid":"N"}],"toonGrootte":bool,"schaal"?:n}
    blokschema: {"blokken":[string,...]}
    maatcilinder: {"maxMl":n,"standen":[{"label","ml":n}]}
    pictogram: {"symbool": ${GHS_SYMBOLEN.map((x) => `"${x}"`).join("|")}} (GHS-gevarensymbolen voor stoffen; gebod-/waarschuwing-/verbod- voor veiligheidsborden, bijv. gehoorbescherming bij lawaai = "gebod-gehoorbescherming")
    sfeerplaat: {"scene": string (Engelse beschrijving van een eenvoudige situatie/voorwerp, zonder tekst in beeld; de scene moet kloppen met ELK feit uit de vraag: afstanden, wie waar staat, wie wat vasthoudt)}
Grafieken en schema's tekent de app zelf exact uit "data". Een sfeerplaat is alleen sfeer/situatie en mag nooit gegevens bevatten die nodig zijn voor het antwoord.`;

export const PLANNER_SYSTEM = `Je bent beeldredacteur voor VMBO-toetsen (NaSk, methode Nova). Je bepaalt welke vragen een figuur NODIG hebben en schrijft per figuur eerst een precieze figuurspec. Je tekent niets.
Regels:
- Wees terughoudend. Alleen een figuur als die echt waarde toevoegt: de leerling moet iets aflezen of herkennen (grafiek, schakeling, krachten, maatcilinder), of de vraag is zonder figuur onduidelijk. Nooit "ter versiering". 0 figuren is een prima uitkomst: geef dan { "figuren": [] }. Meestal zijn 0–3 figuren genoeg; maximaal ${MAX_FIGUREN_PER_TOETS}, waarvan maximaal ${MAX_SFEERPLATEN_PER_TOETS} sfeerplaten. Sfeerplaat alleen als de situatie zonder beeld echt onduidelijk is (zelden); nooit bij een vraag met afstanden, posities of tijden die het beeld zou kunnen tegenspreken. Bij twijfel: geen sfeerplaat.
- Sluit aan bij wat leerlingen in Nova NaSk (VMBO) zien: Nova-achtige opstellingen en symbolen, eenvoudige schema's, SI-eenheden met decimale komma.
- Stroomkring (Nova): bron links; stroommeter (A) in serie; spanningsmeter (V) ALTIJD parallel over een lampje, weerstand of ander onderdeel — NOOIT over de spanningsbron of batterij (de bronspanning staat als label bij de bron). Bij parallelschakelingen mag een spanningsmeter over een onderdeel in een tak: "over": {"tak": t, "index": i}.
- Getallen in de figuur moeten exact kloppen met de vraag en het nakijkmodel. Bereken het antwoord zelf na.
- De figuur mag het antwoord NIET weggeven: zet het gevraagde in "nietTonen" en laat het uit data/labels weg.
- Geef "nieuweStam" alleen als de stam moet gaan verwijzen naar de figuur, anders weglaten. "nieuweStam" is dan de VOLLEDIGE nieuwe stam: de hele oude stam met alle gegevens en de vraagzin, plus een korte verwijzing (bijv. "In de grafiek zie je ... . Lees af ..."). Nooit alleen "Bekijk de grafiek.". Verander nooit wat er gevraagd wordt of het antwoord.
- "vraagVerwijstAlNaarFiguur": true als de huidige tekst al over een figuur/grafiek/afbeelding praat die er nog niet is.
${SPEC_UITLEG}
Antwoord ALLEEN met JSON: { "figuren": [ { "nummer": number, "vraagVerwijstAlNaarFiguur": boolean, "nieuweStam"?: string, "spec": figuurspec } ] }`;

export function plannerUser(input: { vak: string; vragen: Vraag[]; nakijk: NakijkItem[]; overslaan: number[]; minFiguren?: number; afgekeurd?: number[] }): string {
  const blok = input.vragen
    .filter((v) => !input.overslaan.includes(v.nummer))
    .map((v) => `${vraagTekst(v)}\n${sleutelTekst(input.nakijk.find((n) => n.nummer === v.nummer))}`)
    .join("\n\n");
  const min = input.minFiguren ?? 0;
  const verplicht = min > 0
    ? `\nVERPLICHT (de docent koos "Met plaatjes"): plan MINIMAAL ${min} figuren — dit gaat vóór de terughoudendheidsregel. Kies de vragen die er het best bij passen (aflezen, schakeling, krachten, hefboom, maatcilinder, pictogram, grafiek bij gegevens uit de stam). Kies bij voorkeur code-figuren met eenvoudige, overzichtelijke specs (die worden het vaakst goedgekeurd); alleen een sfeerplaat als er niets beters is.${input.afgekeurd?.length ? ` Bij vraag ${input.afgekeurd.join(", ")} werd een figuur afgekeurd: kies liever andere vragen, of maak daar een duidelijk eenvoudiger spec.` : ""}\n`
    : "";
  return `Vak: ${input.vak || "NaSk"}\nVragen die al een figuur hebben (niet opnieuw plannen): ${input.overslaan.join(", ") || "geen"}${verplicht}\n\n${blok}`;
}

export const KEURING_SYSTEM = `Je bent de strenge beeldkeurder (go/no-go) van een Nederlandse VMBO-toetsmaker. Je krijgt één figuur, de vraag, de figuurspec en het antwoordmodel.
Keur ALLEEN "go" als alles klopt. Controleer:
1. klopt_met_spec: alle verplichte elementen staan erin, soort klopt, niets wezenlijks ontbreekt.
2. labels_en_getallen_correct: elk label, getal en elke eenheid in beeld is correct gespeld, klopt met spec en vraag; geen verzonnen of onleesbare tekst.
3. past_bij_vraag_en_antwoord: de leerling kan met deze figuur de vraag beantwoorden en komt dan op het modelantwoord uit.
4. verklapt_antwoord_niet: de figuur toont het antwoord niet (ook niet via label, getal of duidelijke hint) en niets uit "NIET tonen".
5. leesbaar: scherp, niet overvol, tekst groot genoeg om geprint te lezen, geen overlap.
6. juiste_stijl: schone educatieve lesboekstijl (Nova): vlak, dunne donkere contouren, witte achtergrond; geen fotorealisme. Bij een sfeerplaat: géén tekst in beeld.
7. veilig_en_vakinhoudelijk_juist: geen onveilige situatie (bij proeven: veiligheidsbril), geen natuurkundige/scheikundige fouten, niets ongepasts voor 12–16-jarigen.
8. geen_tegenspraak_met_vraag: loop ELK feit uit de context en stam langs (afstanden, posities, wie wat vasthoudt of doet, aantallen, binnen/buiten, open/dicht, volgorde van gebeurtenissen) en vergelijk met het beeld. Eén tegenspraak = no_go. Voorbeeld: de vraag zegt dat je een knal op honderden meters afstand hoort, maar het beeld toont iemand die het apparaat zelf vasthoudt → no_go. Een sfeerplaat die niets toevoegt of twijfel zaait → no_go.
Extra bij een stroomkring (schakelschema) — tel en controleer ELK symbool tegen de lijst "Verwachte symbolen":
- Elk onderdeel moet met het Nederlandse standaardsymbool (VMBO/Nova) getekend zijn: lampje = cirkel met kruis; batterij = lange dunne plaat (+) en korte dikke plaat (−); weerstand = rechthoek; stroommeter = cirkel met A (in serie); spanningsmeter = cirkel met V (parallel over het onderdeel); motor = cirkel met M; led = driehoek met streep en twee pijltjes naar buiten; zoemer = halve cirkel.
- Open schakelaar = twee OPEN (holle) contactcirkeltjes met een hendeltje dat schuin omhoog staat vanaf het ene contactpunt richting het andere. Gesloten schakelaar = twee OPEN (holle) contactcirkeltjes met een rechte, iets dikkere hendel ertussen. Twee dichte stippen op een doorlopende draad lijken op knooppunten en zijn GEEN herkenbaar schakelaarsymbool → no_go. Alleen twee stippen of een onderbroken draad zonder hendel is ook GEEN schakelaar → no_go (zet klopt_met_spec en veilig_en_vakinhoudelijk_juist op false).
- Staat in de spec een schakelaar en kun je hem niet als schakelaar aanwijzen, dan is het altijd no_go.
- Stand van de schakelaar (open/dicht) moet overeenkomen met de spec en met de vraag.
- Nova-opstelling: stroommeter in serie; spanningsmeter parallel over een onderdeel. Een spanningsmeter over de bron/batterij hoort niet in deze toets → no_go.
- Ontbreekt een onderdeel, staat er een extra onderdeel, of is een symbool fout/onduidelijk → no_go.
- Draden vormen een gesloten kring (behalve bij een open schakelaar); geen losse draadeinden of kortsluiting die niet in de spec staat.
Antwoord ALLEEN met JSON:
{ "besluit": "go"|"no_go", "checks": { "klopt_met_spec": bool, "labels_en_getallen_correct": bool, "past_bij_vraag_en_antwoord": bool, "verklapt_antwoord_niet": bool, "leesbaar": bool, "juiste_stijl": bool, "veilig_en_vakinhoudelijk_juist": bool, "geen_tegenspraak_met_vraag": bool }, "redenen": [string], "feedback": string (concrete aanwijzing wat anders moet bij no_go) }`;

function pictogramVerwacht(spec: FiguurSpec): string {
  const d = spec.data as { symbool?: string } | undefined;
  const sym = d?.symbool as GhsSymbool | undefined;
  return sym && PICTOGRAM_NAAM[sym] ? PICTOGRAM_NAAM[sym] : String(sym ?? "?");
}

export function keuringUser(input: { vraag: Vraag; nakijk?: NakijkItem; spec: FiguurSpec; bron: "code" | "ai" }): string {
  return `${vraagTekst(input.vraag)}

${sleutelTekst(input.nakijk)}

Figuurspec:
${specSamenvatting(input.spec)}

Herkomst: ${input.bron === "code" ? "door code getekend uit de spec-data (getallen exact)" : "AI-illustratie (sfeerplaat)"}.
De figuur komt op het leerlingblad direct onder de vraagstam.${
    input.spec.soort === "pictogram" ? `\n\nVerwacht pictogram: ${pictogramVerwacht(input.spec)}. Beoordeel of het getekende symbool herkenbaar dit pictogram is (vereenvoudigde, zelf getekende versie is prima).` : ""
  }${
    input.spec.soort === "stroomkring" ? `\n\nVerwachte symbolen (precies deze, niet meer en niet minder):\n${symboolLijstVoorKeuring(input.spec)}` : ""
  }`;
}

export const REVISIE_SYSTEM = `Je verbetert een figuurspec op basis van feedback van de beeldkeurder. Antwoord ALLEEN met JSON: { "spec": figuurspec }.
Houd dezelfde "soort". Getallen in data blijven gelijk (die horen bij de vraag); pas presentatie aan: titel, labels, asopschriften, toonWaarden/toonMaten/toonGrootte/toonPunten, nietTonen, of bij een sfeerplaat de "scene".
${SPEC_UITLEG}`;

export function revisieUser(input: { vraag: Vraag; nakijk?: NakijkItem; spec: FiguurSpec; feedback: string[] }): string {
  return `${vraagTekst(input.vraag)}\n${sleutelTekst(input.nakijk)}\n\nHuidige spec:\n${JSON.stringify(input.spec)}\n\nFeedback van de keurder:\n- ${input.feedback.join("\n- ")}`;
}

export const HERSCHRIJF_SYSTEM = `De figuur bij deze VMBO-vraag is afgekeurd en wordt NIET geplaatst. Maak de vraag zo dat hij zonder figuur werkt: herschrijf hem (gegevens in tekst of een kleine tabel), of vervang hem door een gelijkwaardige vraag over hetzelfde leerdoel.
Regels: zelfde nummer, type, rtti, domein, leerdoel en puntental. Noem geen figuur, grafiek, afbeelding of plaatje. Verklap het antwoord niet. Precies één verdedigbaar antwoord. Meerkeuze: modelantwoord = letter + tekst.
Antwoord ALLEEN met JSON: { "actie": "herschreven"|"vervangen", "vraag": { "nummer", "type", "rtti", "domein", "leerdoel", "punten", "context", "stam", "opties": [{"letter","tekst"}], "tabel"?: {"koppen": string[], "rijen": string[][]} }, "nakijk": { "nummer", "modelantwoord", "puntenverdeling": [{"punt","criterium"}], "nietToekennen": string[] } }`;

export function herschrijfUser(input: { vraag: Vraag; nakijk?: NakijkItem; spec: FiguurSpec; redenen: string[] }): string {
  return `${vraagTekst(input.vraag)}\n${sleutelTekst(input.nakijk)}\n\nAfgekeurde figuur:\n${specSamenvatting(input.spec)}\n\nWaarom afgekeurd:\n- ${input.redenen.join("\n- ")}`;
}
