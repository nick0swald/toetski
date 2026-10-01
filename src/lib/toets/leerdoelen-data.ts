/**
 * Officiële leerdoelen NaSk, statisch en vooraf gekoppeld (geen API-aanroepen per toets).
 *
 * Klas 3–4: eindtermen uit de CvTE-syllabus Natuur- en scheikunde I vmbo, centraal examen 2028
 * (versie 2, april 2026; inhoudelijk gelijk aan de syllabus 2027, versie 2, juli 2025), per leerweg.
 * Nummering volgt de syllabus: NASK1/K/5 punt 6 → id "K/5.6". Let op: BB nummert K/4, K/5, K/8 en K/9
 * anders dan KB/GT (BB heeft geen "zinken/zweven/drijven", geen magnetisme-, oscilloscoop- en
 * luidsprekerpunten); een id is dus alleen uniek binnen één leerweg.
 * Exameneenheden die alleen in het schoolexamen zitten (BB: K/6, K/7, K/10; KB/GT: K/7, K/10, K/11, K/12)
 * staan er als één SE-leerdoel per eenheid in (de syllabus specificeert alleen de CE-stof).
 *
 * Klas 1–2: SLO definitieve conceptkerndoelen mens en natuur voor het vo (november 2025), losjes
 * gekoppeld (een paar doelen per hoofdstuk), met het huidige wettelijke kerndoel (2006) erbij.
 *
 * Omschrijvingen zijn korte eigen samenvattingen (bron: CvTE / SLO), geen letterlijke syllabustekst.
 */
import type { Leerweg } from "./types";

export type ExamenDeel = "CE" | "SE" | "KD";

export interface LeerdoelData {
  /** Id zoals op matrijs en nakijkmodel, bijv. "K/8.4", "V/2.3", "K/7" (SE) of "SLO-30C". */
  id: string;
  /** Korte Nederlandse omschrijving. */
  tekst: string;
  /** Leerwegen waarvoor dit doel (met deze nummering) geldt. */
  leerwegen: Leerweg[];
  /** CE = centraal examen, SE = alleen schoolexamen, KD = kerndoel onderbouw. */
  deel: ExamenDeel;
  /** Vraagtypen (NaSk-taxonomie, 62 CSE-typen + O-LICHT/O-HEELAL/O-WEER) die dit doel toetsen. */
  typen: string[];
  /** Kernwoorden voor het herkennen in lesstof en vraagtekst (regex-bron, hoofdletterongevoelig). */
  kw: string;
  /** Alleen kerndoelen: huidig wettelijk kerndoel (2006). */
  wettelijk?: string;
}

const ALLE: Leerweg[] = ["BB", "KB", "GT"];
const BB: Leerweg[] = ["BB"];
const KBGT: Leerweg[] = ["KB", "GT"];
const GT: Leerweg[] = ["GT"];

const d = (id: string, leerwegen: Leerweg[], deel: ExamenDeel, tekst: string, typen: string[], kw: string, wettelijk?: string): LeerdoelData => ({
  id,
  tekst,
  leerwegen,
  deel,
  typen,
  kw,
  ...(wettelijk ? { wettelijk } : {}),
});

export const EINDTERMEN: LeerdoelData[] = [
  // NASK1/K/3 Leervaardigheden in het vak natuurkunde (CE + SE, alle leerwegen)
  d("K/3.1", ALLE, "CE", "Informatie uit bronnen (tekst, tabel, grafiek) selecteren en verwerken", ["S-AFLEZ", "S-VERBAND"], "tabel|grafiek|diagram|bron|aflez"),
  d("K/3.2", ALLE, "CE", "Rekenvaardigheden toepassen (verhoudingen, omrekenen, afronden)", ["S-EENH", "S-CALC-OV"], "omreken|afrond|verhouding|procent|wetenschappelijke notatie"),
  d("K/3.3", ALLE, "CE", "Grootheden met symbool en eenheden met afkorting gebruiken", ["S-EENH", "W-TEMP-C"], "grootheid|eenheid|eenheden|voorvoegsel|symbool"),
  d("K/3.4", ALLE, "CE", "Natuurkundige meetapparatuur herkennen en gebruiken", ["E-METER", "S-AFLEZ"], "meetinstrument|maatcilinder|thermometer|multimeter|krachtmeter|stroommeter|spanningsmeter|balans|stopwatch|meten"),
  d("K/3.5", BB, "CE", "Resultaten van computermetingen interpreteren", ["S-AFLEZ", "S-GRAF"], "computer|sensor|meetprogramma"),
  d("K/3.5", KBGT, "CE", "De computer gebruiken bij metingen en verwerking (sensoren, grafieken)", ["S-AFLEZ", "S-GRAF"], "computer|sensor|meetprogramma"),
  d("K/3.6", BB, "CE", "Berekeningen uitvoeren met woordformules", ["S-CALC-OV"], "formule|bereken"),
  d("K/3.6", KBGT, "CE", "Berekeningen en redeneringen opzetten met formules", ["S-CALC-OV"], "formule|bereken"),
  d("K/3.7", ALLE, "CE", "Veilige en onveilige situaties herkennen bij onderzoek en ontwerp (KB/GT: ook verbeteren)", ["W-VEIL", "E-VEIL"], "veilig|practicum|veiligheidsbril|brander|labjas"),
  d("K/3.8", ALLE, "CE", "Deelstappen van een ontwerpproces uitvoeren", ["S-ONDZ"], "ontwerp|programma van eisen|prototype"),
  d("K/3.9", ALLE, "CE", "Deelstappen van een onderzoek uitvoeren (vraag, verwachting, meten, conclusie)", ["S-ONDZ", "S-GRAF", "S-VERBAND"], "onderzoek|hypothese|verwachting|conclusie|variabele|werkplan|onderzoeksvraag"),

  // NASK1/K/4 Stoffen en materialen — BB (CE)
  d("K/4.1", BB, "CE", "Materialen, hun eigenschappen en toepassingen met elkaar verbinden", ["W-MAT", "W-CORR"], "materia(al|len)|kunststof|metaal|metalen|hout|glas|keramiek|geleider"),
  d("K/4.2", BB, "CE", "Stoffen herkennen aan stofeigenschappen", ["W-STOF", "W-FASE", "W-DICHT", "W-DICHTB"], "stofeigenschap|smeltpunt|kookpunt|oplosbaar|dichtheid|kleur|geur"),
  d("K/4.3", BB, "CE", "Gevaren van stoffen noemen, gevarensymbolen en voorzorgsmaatregelen", ["W-VEIL"], "gevarensymbool|pictogram|giftig|brandbaar|ontvlambaar|bijtend|etiket"),
  d("K/4.4", BB, "CE", "Uitleggen hoe je bij de keuze van materialen rekening houdt met het milieu", ["W-AFVAL", "EN-DUUR", "W-MAT"], "milieu|duurzaam|biologisch afbreekbaar|hergebruik"),
  d("K/4.5", BB, "CE", "Milieugevolgen van grondstoffen en afvalstoffen herkennen", ["W-AFVAL", "EN-DUUR"], "grondstof|afvalstof|vervuiling|uitputting"),
  d("K/4.6", BB, "CE", "Manieren noemen om verantwoord met afval om te gaan", ["W-AFVAL"], "afval|recycl|gft|kca|scheiden|statiegeld|hergebruik"),
  d("K/4.7", BB, "CE", "Processen uit het dagelijks leven herkennen als chemische reactie (verbranden, roesten …)", ["W-VERBR", "W-CORR"], "chemische reactie|verbrand|roest|corrosie|ontleding|reactie"),

  // NASK1/K/4 Stoffen en materialen — KB/GT (CE)
  d("K/4.1", KBGT, "CE", "Materialen, hun eigenschappen en toepassingen met elkaar verbinden", ["W-MAT", "W-CORR"], "materia(al|len)|kunststof|metaal|metalen|hout|glas|keramiek|geleider"),
  d("K/4.2", KBGT, "CE", "Uitleggen wanneer een voorwerp zinkt, zweeft of drijft", ["W-DRIJF", "W-DICHT", "W-DICHTB"], "zink|zweef|zweven|drijf|drijven"),
  d("K/4.3", KBGT, "CE", "Stoffen herkennen en onderscheiden aan stofeigenschappen (o.a. dichtheid, smelt- en kookpunt)", ["W-STOF", "W-FASE", "W-DICHT", "W-DICHTB"], "stofeigenschap|smeltpunt|kookpunt|oplosbaar|dichtheid|mengsel|zuivere stof"),
  d("K/4.4", KBGT, "CE", "Gevaren van stoffen uitleggen, gevarensymbolen en voorzorgsmaatregelen", ["W-VEIL"], "gevarensymbool|pictogram|giftig|brandbaar|ontvlambaar|bijtend|etiket|h-zin|p-zin"),
  d("K/4.5", KBGT, "CE", "Uitleggen hoe je bij de keuze van materialen rekening houdt met het milieu", ["W-AFVAL", "EN-DUUR", "W-MAT"], "milieu|duurzaam|biologisch afbreekbaar|hergebruik"),
  d("K/4.6", KBGT, "CE", "Milieugevolgen van grondstoffen en afvalstoffen uitleggen", ["W-AFVAL", "EN-DUUR"], "grondstof|afvalstof|vervuiling|uitputting|product"),
  d("K/4.7", KBGT, "CE", "Manieren noemen om verantwoord met afval om te gaan", ["W-AFVAL"], "afval|recycl|gft|kca|scheiden|statiegeld|verbrandingsoven|stort"),
  d("K/4.8", KBGT, "CE", "Processen herkennen als natuurkundig proces of chemische reactie", ["W-VERBR", "W-CORR", "W-FASE"], "chemische reactie|natuurkundig proces|verbrand|roest|corrosie|ontleding|reactie"),

  // NASK1/K/5 Elektrische energie — BB (CE)
  d("K/5.1", BB, "CE", "Onderdelen van schakelingen naar functie onderscheiden en symbolen herkennen", ["E-COMP", "E-SCHEMA"], "symbool|schakelaar|lampje|batterij|spanningsbron|onderdel"),
  d("K/5.2", BB, "CE", "Gesloten stroomkring toepassen in serie- en parallelschakelingen", ["E-SERPAR", "E-SCHEMA"], "stroomkring|serie|parallel"),
  d("K/5.3", BB, "CE", "Uitleggen hoe een stroomkring beveiligd wordt (zekering, aardlekschakelaar, randaarde)", ["E-VEIL"], "zekering|aardlek|randaarde|kortsluiting|overbelast|beveilig"),
  d("K/5.4", BB, "CE", "Geleiders en isolatoren onderscheiden in toepassingen", ["W-MAT"], "geleider|isolator|isolatie"),
  d("K/5.5", BB, "CE", "Schema's van schakelingen gebruiken, interpreteren en aanpassen", ["E-SCHEMA", "E-COMP"], "schema|schakeling|ldr|ntc|led|diode"),
  d("K/5.6", BB, "CE", "Spanning en stroom in serie en parallel met elkaar verbinden en berekenen", ["E-SERPAR", "E-R", "E-METER"], "spanning|stroomsterkte|volt|ampère|weerstand"),
  d("K/5.7", BB, "CE", "Vermogen en energieverbruik van apparaten berekenen", ["E-PUI", "E-EPT"], "vermogen|watt|energieverbruik|kwh"),
  d("K/5.8", BB, "CE", "Energiegebruik meten met een kWh-meter en energiekosten berekenen", ["E-KOST", "E-VERM-BEGR"], "kwh|kilowattuur|energiekosten|energiemeter|kosten"),
  d("K/5.9", BB, "CE", "Beargumenteerd kiezen tussen apparaten (energiegebruik, rendement, capaciteit, veiligheid)", ["E-VERM-BEGR", "E-REND", "E-CAP"], "energielabel|rendement|capaciteit|levensduur|spaarlamp|ledlamp"),

  // NASK1/K/5 Elektrische energie — KB/GT (CE)
  d("K/5.1", KBGT, "CE", "Onderdelen van schakelingen naar functie onderscheiden en symbolen herkennen", ["E-COMP", "E-SCHEMA"], "symbool|schakelaar|lampje|batterij|spanningsbron|onderdel"),
  d("K/5.2", KBGT, "CE", "Gesloten stroomkring toepassen in serie- en parallelschakelingen", ["E-SERPAR", "E-SCHEMA"], "stroomkring|serie|parallel"),
  d("K/5.3", KBGT, "CE", "Beveiliging van een stroomkring en het principe ervan uitleggen", ["E-VEIL"], "zekering|aardlek|randaarde|kortsluiting|overbelast|beveilig|dubbel geïsoleerd"),
  d("K/5.4", KBGT, "CE", "Verschil tussen geleiders en isolatoren uitleggen in toepassingen", ["W-MAT"], "geleider|isolator|isolatie"),
  d("K/5.5", KBGT, "CE", "Schema's gebruiken en de werking van componenten verklaren (LDR, NTC, diode, relais, transistor …)", ["E-COMP", "E-SCHEMA"], "ldr|ntc|diode|led|relais|transistor|reedcontact|sensor|schema"),
  d("K/5.6", KBGT, "CE", "Spanning, stroom en weerstand in serie en parallel verbinden en berekenen", ["E-R", "E-RV", "E-SERPAR", "E-METER"], "spanning|stroomsterkte|weerstand|ohm|vervangingsweerstand"),
  d("K/5.7", KBGT, "CE", "Gebruikstijd van een batterij/accu bepalen uit de capaciteit", ["E-CAP"], "capaciteit|accu|mah|ah\\b|gebruikstijd|batterij"),
  d("K/5.8", KBGT, "CE", "Vermogen, totaal vermogen en energieverbruik berekenen", ["E-PUI", "E-EPT"], "vermogen|watt|energieverbruik|joule"),
  d("K/5.9", KBGT, "CE", "Energiegebruik meten met een kWh-meter en energiekosten berekenen", ["E-KOST", "E-VERM-BEGR"], "kwh|kilowattuur|energiekosten|energiemeter|kosten"),
  d("K/5.10", KBGT, "CE", "Beargumenteerd kiezen tussen apparaten (energiegebruik, rendement, capaciteit, veiligheid)", ["E-VERM-BEGR", "E-REND"], "energielabel|rendement|levensduur|spaarlamp|ledlamp|besparen"),
  d("K/5.11", KBGT, "CE", "Basisbegrippen magnetisme toepassen (dynamo, transformator, luidspreker, relais, reedcontact)", ["M-TRAFO"], "magneet|magnetisch|elektromagneet|spoel|veldlijn|noordpool|zuidpool"),
  d("K/5.12", KBGT, "CE", "Onderdelen van een dynamo benoemen en uitleggen hoe die spanning opwekt", ["M-TRAFO"], "dynamo|generator|opwekken|inductie"),
  d("K/5.13", KBGT, "CE", "Onderdelen en werking van een transformator uitleggen en ermee rekenen", ["E-TRAFO", "M-TRAFO"], "transformator|primaire|secundaire|windingen"),

  // NASK1/K/6 Verbranden en verwarmen — KB/GT (CE); BB alleen SE (hieronder)
  d("K/6.1", KBGT, "CE", "Warmtebronnen en meetinstrumenten voor temperatuur herkennen", ["W-TRANS", "S-AFLEZ"], "warmtebron|kachel|fornuis|gasbrander|dompelaar|thermometer|temperatuursensor"),
  d("K/6.2", KBGT, "CE", "Warmtetransport uitleggen: geleiding, stroming en straling", ["W-TRANS"], "geleiding|stroming|straling|warmtetransport"),
  d("K/6.3", KBGT, "CE", "Temperatuur, tijd en warmte gebruiken (verband, absolute nulpunt, kelvin ↔ °C)", ["W-TEMP-C", "W-FASE", "S-AFLEZ"], "kelvin|absolute nulpunt|temperatuur|opwarm|afkoel"),
  d("K/6.4", KBGT, "CE", "Werking van warmte-isolerende maatregelen uitleggen", ["W-TRANS"], "isoler|isolatie|spouwmuur|dubbel glas|dubbele beglazing|radiatorfolie|isoleerkan"),
  d("K/6.5", KBGT, "CE", "Milieu- en gezondheidseffecten van energiegebruik noemen (broeikaseffect, zure regen …)", ["EN-DUUR", "W-VERBR"], "broeikas|zure regen|luchtverontreiniging|co2|koolstofdioxide|fossiel|koolstofmono"),
  d("K/6.6", KBGT, "CE", "Energieomzettingen toelichten en berekenen (behoud van energie, rendement, verbrandingswarmte)", ["EN-SOORT", "E-REND", "W-VBW", "B-EZEK", "E-EPT"], "energieomzetting|omgezet|energiesoort|rendement|verbrandingswarmte|bewegingsenergie|zwaarte-energie|energiestroom"),

  // NASK1/K/8 Geluid — BB (CE)
  d("K/8.1", BB, "CE", "Begrippen hanteren die een geluid kenmerken (toonhoogte, frequentie, amplitude)", ["G-OSC", "G-BEREIK"], "toonhoogte|frequentie|hertz|amplitude|trilling"),
  d("K/8.2", BB, "CE", "Geluidsbron, tussenstof en ontvanger herkennen en rekenen met de geluidssnelheid", ["G-BEREIK", "G-ECHO", "G-BRON"], "geluidsbron|tussenstof|ontvanger|geluidssnelheid|echo|vacuüm"),
  d("K/8.3", BB, "CE", "Toonhoogte van een snaar in verband brengen met lengte en spankracht", ["G-OSC"], "snaar|gitaar|viool|spankracht|spannen"),
  d("K/8.4", BB, "CE", "Metingen van geluidssterkte interpreteren en bronnen van geluidshinder aangeven", ["G-DB", "G-BRON"], "decibel|db|geluidssterkte|geluidsmeter|geluidshinder|lawaai"),
  d("K/8.5", BB, "CE", "Gehoorschade in verband brengen met geluidssterkte en tijdsduur; maatregelen noemen", ["G-GEHOOR", "G-BRON"], "gehoorschade|oordop|gehoorbescherm|geluidswal|geluidsoverlast|tinnitus"),

  // NASK1/K/8 Geluid — KB/GT (CE)
  d("K/8.1", KBGT, "CE", "Begrippen toepassen die een geluid kenmerken (toonhoogte, frequentie, amplitude)", ["G-OSC", "G-BEREIK"], "toonhoogte|frequentie|hertz|amplitude|trilling|ultrasoon|infrasoon"),
  d("K/8.2", KBGT, "CE", "Uitleggen hoe geluid via een tussenstof een ontvanger bereikt en rekenen met de geluidssnelheid", ["G-BEREIK", "G-ECHO", "G-BRON"], "geluidsbron|tussenstof|ontvanger|geluidssnelheid|echo|vacuüm|sonar"),
  d("K/8.3", KBGT, "CE", "Toonhoogte van een snaar in verband brengen met lengte en spankracht", ["G-OSC"], "snaar|gitaar|viool|spankracht|spannen"),
  d("K/8.4", KBGT, "CE", "Trillingstijd bepalen uit een oscilloscoopbeeld en de frequentie berekenen", ["G-FREQ", "G-OSC"], "oscilloscoop|trillingstijd|periode|f = 1/t|frequentie"),
  d("K/8.5", KBGT, "CE", "Metingen van geluidssterkte interpreteren en bronnen van geluidshinder aangeven", ["G-DB", "G-BRON"], "decibel|db|geluidssterkte|geluidsmeter|geluidshinder|lawaai"),
  d("K/8.6", KBGT, "CE", "Gehoorschade in verband brengen met geluidssterkte en tijdsduur; maatregelen noemen", ["G-GEHOOR", "G-BRON"], "gehoorschade|oordop|gehoorbescherm|geluidswal|geluidsoverlast|tinnitus|gehoorgrens"),
  d("K/8.7", KBGT, "CE", "Onderdelen en werking van een luidspreker uitleggen", ["M-TRAFO"], "luidspreker|conus|speaker"),

  // NASK1/K/9 Kracht en veiligheid — BB (CE)
  d("K/9.1", BB, "CE", "Soorten krachten herkennen en hun werking en toepassing beschrijven", ["K-SOORT", "K-VECT"], "zwaartekracht|spierkracht|wrijving|veerkracht|normaalkracht|spankracht|kracht|newton"),
  d("K/9.2", BB, "CE", "Bij hefbomen herkennen hoe een kleine kracht een grote kracht geeft", ["K-HEF", "K-ARM"], "hefboom|draaipunt|arm|koevoet|tang|kruiwagen|wip"),
  d("K/9.3", BB, "CE", "Uitleggen hoe een katrol de richting of grootte van een kracht verandert", ["K-HEF"], "katrol|takel"),
  d("K/9.4", BB, "CE", "De gemiddelde snelheid van een bewegend voorwerp berekenen", ["B-SNEL"], "gemiddelde snelheid|km/h|m/s|snelheid"),
  d("K/9.5", BB, "CE", "(s,t)- en (v,t)-diagrammen aflezen en maken", ["B-DIAG", "S-GRAF"], "diagram|\\(s,t\\)|\\(v,t\\)|afstand-tijd|snelheid-tijd"),
  d("K/9.6", BB, "CE", "Krachten op een rijdend voertuig herkennen en samenstellen", ["K-NET"], "nettokracht|voortstuw|rolweerstand|luchtweerstand|tegenwerkende"),
  d("K/9.7", BB, "CE", "Constructies herkennen die de gevolgen van een botsing verminderen", ["B-VEIL"], "gordel|airbag|kreukelzone|helm|hoofdsteun|botsing"),
  d("K/9.8", BB, "CE", "Omstandigheden herkennen die de veiligheid tijdens het rijden beïnvloeden", ["B-STOP", "B-VEIL"], "reactietijd|remweg|stopafstand|reactieafstand|glad|alcohol"),
  d("K/9.9", BB, "CE", "Invloed van kracht en oppervlakte op de druk uitleggen", ["K-DRUKB", "K-DRUK"], "druk|oppervlakte|pascal|n/m2|sneeuwschoen|spijker"),

  // NASK1/K/9 Kracht en veiligheid — KB/GT (CE)
  d("K/9.1", KBGT, "CE", "Soorten krachten herkennen, werking beschrijven en als vector tekenen", ["K-SOORT", "K-VECT", "K-SCHAAL"], "zwaartekracht|spierkracht|wrijving|veerkracht|normaalkracht|spankracht|krachtenschaal|vector|newton"),
  d("K/9.2", KBGT, "CE", "Uitleggen hoe een hefboom in evenwicht met een kleine kracht een grote kracht geeft", ["K-HEF", "K-ARM", "K-MOM"], "hefboom|draaipunt|arm|moment|koevoet|tang|kruiwagen|wip"),
  d("K/9.3", KBGT, "CE", "Uitleggen hoe een katrol de richting of grootte van een kracht verandert", ["K-HEF"], "katrol|takel"),
  d("K/9.4", KBGT, "CE", "De gemiddelde snelheid van een bewegend voorwerp berekenen", ["B-SNEL"], "gemiddelde snelheid|km/h|m/s|snelheid"),
  d("K/9.5", KBGT, "CE", "(s,t)- en (v,t)-diagrammen maken en in samenhang interpreteren", ["B-DIAG", "S-GRAF"], "diagram|\\(s,t\\)|\\(v,t\\)|eenparig|afstand-tijd|snelheid-tijd"),
  d("K/9.6", KBGT, "CE", "Krachten bij een beweging langs een rechte weg herkennen en samenstellen", ["K-NET", "K-RES"], "nettokracht|resulterende|voortstuw|rolweerstand|luchtweerstand|tegenwerkende"),
  d("K/9.7", KBGT, "CE", "Verschijnselen van traagheid bij snelheidsverandering verklaren", ["B-VEIL", "K-NET"], "traagheid|traag"),
  d("K/9.8", KBGT, "CE", "Werking van constructies uitleggen die de gevolgen van een botsing verminderen", ["B-VEIL"], "gordel|airbag|kreukelzone|helm|hoofdsteun|botsing|kooiconstructie"),
  d("K/9.9", KBGT, "CE", "Omstandigheden herkennen die de veiligheid tijdens het rijden beïnvloeden", ["B-STOP", "B-VEIL"], "reactietijd|remweg|stopafstand|reactieafstand|glad|alcohol"),
  d("K/9.10", KBGT, "CE", "De druk van een voorwerp op de ondergrond berekenen", ["K-DRUK", "K-DRUKB"], "druk|oppervlakte|pascal|n/m2|n/cm2"),

  // NASK1/V/1 Veiligheid in het verkeer — GT (CE)
  d("V/1.1", GT, "CE", "Rekenen en redeneren in verkeerssituaties (versnelling, F = m·a, arbeid, bewegings- en zwaarte-energie)", ["B-ACC", "K-FMA", "B-EZEK", "K-ARB", "B-STOP"], "versnelling|vertraging|f = m|arbeid|bewegingsenergie|zwaarte-energie|m/s2|m/s²"),
  d("V/1.2", GT, "CE", "Gegevens uit bronnen over bewegingen of botsingen verzamelen en verwerken", ["B-DIAG", "S-AFLEZ"], "botsproef|crashtest|meetgegevens beweging"),
  // NASK1/V/2 Constructies — GT (CE)
  d("V/2.1", GT, "CE", "Krachten in constructies onderscheiden en de nettokracht bepalen", ["K-NET", "K-SOORT"], "constructie|brug|kraan|nettokracht"),
  d("V/2.2", GT, "CE", "Krachten als vector samenstellen en ontbinden in constructies", ["K-VECT", "K-RES", "K-SCHAAL"], "samenstellen|ontbinden|parallellogram|resultante|vector"),
  d("V/2.3", GT, "CE", "Het massamiddelpunt van een homogene balk of staaf bepalen", ["K-ZWP"], "zwaartepunt|massamiddelpunt|stabiel|kantelen"),
  d("V/2.4", GT, "CE", "Rekenen en redeneren in constructies (momenten, druk)", ["K-MOM", "K-DRUK", "K-FMA"], "moment|momentenwet|evenwicht|n·m|nm\\b"),
  d("V/2.5", GT, "CE", "Gegevens uit bronnen over constructies verzamelen en verwerken", ["S-AFLEZ"], "constructietekening|belasting"),
  // NASK1/V/4 Vaardigheden in samenhang — GT (CE + SE)
  d("V/4", GT, "CE", "Vaardigheden uit het kerndeel in samenhang toepassen", ["S-ONDZ", "S-GRAF", "S-AFLEZ"], "vaardigheden in samenhang|tw-toets"),

  // Alleen schoolexamen (per exameneenheid)
  d("K/6", BB, "SE", "Verbranden en verwarmen (schoolexamen): warmte, isolatie, verbranden, energieomzettingen", ["W-TRANS", "W-VERBR", "EN-SOORT", "EN-DUUR", "E-REND", "W-FASE"], "warmte|verbrand|isoler|energie|brandstof"),
  d("K/7", ALLE, "SE", "Licht en beeld (schoolexamen): lichtstralen, spiegels, lenzen, kleuren, oog", ["O-LICHT"], "licht|spiegel|lens|lenzen|schaduw|breking|kleur|oog|bril|infrarood|ultraviolet"),
  d("K/10", ALLE, "SE", "Bouw van de materie (schoolexamen): deeltjesmodel, atomen en moleculen", ["W-FASE", "W-STOF"], "deeltje|molecu|atoom|atomen|deeltjesmodel"),
  d("K/11", KBGT, "SE", "Straling en stralingsbescherming (schoolexamen): radioactiviteit, halveringstijd, bescherming", ["OVERIG"], "radioactie|straling|halveringstijd|isotoop|röntgen|alfa|bèta|gamma|dosimeter"),
  d("K/12", KBGT, "SE", "Het weer (schoolexamen): luchtdruk, temperatuur, wind, wolken en neerslag", ["O-WEER"], "\\bweer\\b|luchtdruk|wind|neerslag|wolk|onweer|barometer|hogedruk|lagedruk"),
];

/** SLO definitieve conceptkerndoelen mens en natuur vo (nov. 2025), deel relevant voor NaSk; losjes gekoppeld. */
export const KERNDOELEN: LeerdoelData[] = [
  d("SLO-29B", ALLE, "KD", "Natuurwetenschappelijk redeneren: patronen, oorzaak-gevolg, schaal en verhoudingen, modellen", ["S-VERBAND", "S-CALC-OV", "O-HEELAL"], "verband|oorzaak|gevolg|model|verhouding|schaal", "kerndoel 29/32"),
  d("SLO-29C", ALLE, "KD", "Onderzoeken en ontwerpen: stappen, veilig meten met instrumenten, metingen interpreteren", ["S-ONDZ", "S-AFLEZ", "S-EENH", "S-GRAF", "E-METER"], "onderzoek|meten|meetinstrument|grootheid|eenheid|conclusie|practicum", "kerndoel 28/33"),
  d("SLO-29D", ALLE, "KD", "De aard van natuurwetenschap en technologie verkennen", ["OVERIG"], "natuurkunde|scheikunde|wetenschap", "kerndoel 29"),
  d("SLO-29E", ALLE, "KD", "Gevaren van verschijnselen en stoffen (elektriciteit, geluid, straling, brand, chemicaliën) en voorzorg", ["W-VEIL", "E-VEIL", "G-GEHOOR"], "gevaar|veilig|gevarensymbool|kortsluiting|gehoorschade|brand|uv", "kerndoel 35"),
  d("SLO-30B", ALLE, "KD", "Krachten en beweging: krachten herkennen, rekenen aan eenparige beweging", ["B-SNEL", "B-DIAG", "B-VEIL", "B-STOP", "K-SOORT", "K-NET"], "snelheid|beweging|kracht|remmen|botsen|afstand", "kerndoel 32"),
  d("SLO-30C", ALLE, "KD", "Elektrische schakelingen en energie: energievormen, serie/parallel, U, I, P en t", ["E-SERPAR", "E-SCHEMA", "E-PUI", "E-EPT", "EN-SOORT", "E-METER", "E-R", "E-VEIL"], "stroomkring|spanning|stroom|schakeling|vermogen|energie", "kerndoel 32"),
  d("SLO-30D", ALLE, "KD", "Licht: schaduw, spiegelbeelden, kleuren, infrarood en ultraviolet", ["O-LICHT"], "licht|schaduw|spiegel|kleur|infrarood|ultraviolet", "kerndoel 32"),
  d("SLO-31A", ALLE, "KD", "Stoffen en deeltjes: zuivere stoffen en mengsels, faseovergangen, scheiden, dichtheid", ["W-STOF", "W-FASE", "W-DICHT", "W-DICHTB"], "stof|mengsel|fase|smelt|kook|dichtheid|massa|volume|deeltje", "kerndoel 32"),
  d("SLO-31B", ALLE, "KD", "Chemische processen en circulariteit: reacties, grondstof → product, recyclen", ["W-VERBR", "W-AFVAL", "W-CORR"], "reactie|verbrand|grondstof|recycl|afval", "kerndoel 30"),
  d("SLO-33A", ALLE, "KD", "Systeem aarde: aarde, zon en maan en veranderingen op verschillende tijdschalen", ["O-HEELAL"], "aarde|maan|zon|seizoen|planeet|heelal|zonnestelsel", "kerndoel 29"),
  d("SLO-33B", ALLE, "KD", "Weer, klimaat en water(kringloop)", ["O-WEER", "W-FASE"], "weer|klimaat|waterkringloop|neerslag|verdamp", "kerndoel 30"),
];

/** Paragraaf → leerdoel-ids (volgorde = gewicht). Sleutel "serie:hoofdstuk", waarde per paragraafnummer. */
export const NOVA_LEERDOEL_KOPPELING: Record<string, Record<number, string[]>> = {
  // klas 1–2 (KGT) → SLO-kerndoelen
  "kgt12:1": { 1: ["SLO-29D"], 2: ["SLO-29C"], 3: ["SLO-29C", "SLO-29E"], 4: ["SLO-29C"] },
  "kgt12:2": { 1: ["SLO-31A", "SLO-29E"], 2: ["SLO-31A"], 3: ["SLO-29C", "SLO-31A"], 4: ["SLO-31A", "SLO-29B"] },
  "kgt12:3": { 1: ["SLO-31A"], 2: ["SLO-29C"], 3: ["SLO-31A", "SLO-33B"], 4: ["SLO-31A"] },
  "kgt12:4": { 1: ["SLO-30C"], 2: ["SLO-30C"], 3: ["SLO-30C"], 4: ["SLO-30C", "SLO-29E"] },
  "kgt12:5": { 1: ["SLO-30B", "SLO-29C"], 2: ["SLO-30B"], 3: ["SLO-30B", "SLO-29B"], 4: ["SLO-30B", "SLO-29E"] },
  "kgt12:6": { 1: ["SLO-30D"], 2: ["SLO-30D"], 3: ["SLO-30D"], 4: ["SLO-30D", "SLO-29E"] },
  "kgt12:7": { 1: ["SLO-33A"], 2: ["SLO-33A", "SLO-29B"], 3: ["SLO-33A"], 4: ["SLO-29B"] },
  "kgt12:8": { 1: ["SLO-29B"], 2: ["SLO-29B", "SLO-29C"], 3: ["SLO-29C"], 4: ["SLO-29E"] },
  // klas 3 KB/GT → eindtermen
  "gt3:1": { 1: ["K/5.1", "K/5.2", "K/5.6"], 2: ["K/5.2", "K/5.4"], 3: ["K/5.8", "K/5.9"], 4: ["K/5.3", "K/5.4"] },
  "gt3:2": { 1: ["K/10"], 2: ["K/12"], 3: ["K/12", "K/6.3"], 4: ["K/12"] },
  "gt3:3": { 1: ["K/9.1"], 2: ["K/9.1", "K/3.4"], 3: ["K/9.6", "V/2.1"], 4: ["K/9.2", "K/9.3"] },
  "gt3:4": { 1: ["K/4.3"], 2: ["K/4.3"], 3: ["K/4.4", "K/3.7"], 4: ["K/4.8"] },
  "gt3:5": { 1: ["K/7"], 2: ["K/7"], 3: ["K/7"], 4: ["K/7"] },
  "gt3:6": { 1: ["K/6.1", "K/6.3"], 2: ["K/6.5", "K/6.6"], 3: ["K/6.2"], 4: ["K/6.4"] },
  "gt3:7": { 1: ["K/4.1"], 2: ["K/4.6", "K/4.5"], 3: ["K/4.7"], 4: ["K/4.3", "K/4.2"] },
  "gt3:8": { 1: ["K/10", "K/11"], 2: ["K/11"], 3: ["K/11"], 4: ["K/11"] },
  // klas 4 KB/GT → eindtermen
  "gt4:9": { 1: ["K/5.6"], 2: ["K/5.5"], 3: ["K/5.5", "K/5.11"], 4: ["K/5.5"] },
  "gt4:10": { 1: ["K/9.1"], 2: ["V/2.1", "K/9.1"], 3: ["V/2.2", "K/9.6"], 4: ["V/2.2"] },
  "gt4:11": { 1: ["K/6.5", "K/6.6"], 2: ["K/6.6", "K/6.5"], 3: ["K/6.6"], 4: ["K/6.6"], 5: ["K/6.4", "K/5.10"] },
  "gt4:12": { 1: ["K/5.6"], 2: ["K/5.13", "K/5.11", "K/5.12"], 3: ["K/5.2", "K/5.6"], 4: ["K/5.3"] },
  "gt4:13": { 1: ["K/8.2", "K/8.1"], 2: ["K/8.4", "K/8.3"], 3: ["K/8.5"], 4: ["K/8.6"] },
  "gt4:14": { 1: ["K/9.2", "V/2.4"], 2: ["K/9.2", "V/2.3"], 3: ["K/9.3"], 4: ["K/9.10"] },
  "gt4:15": { 1: ["K/9.5"], 2: ["K/9.4", "V/1.1"], 3: ["K/9.5", "V/1.1"], 4: ["K/9.5", "K/9.9"] },
  "gt4:16": { 1: ["K/9.6"], 2: ["K/9.6", "K/9.7", "V/1.1"], 3: ["K/9.8", "K/9.9"], 4: ["V/1.1"] },
};

/**
 * Onderwerpen (hoofdstuktitels) → leerdoelen, als er geen Nova-hoofdstuk herkend is (o.a. BB klas 3–4,
 * waarvoor geen Nova-paragraafdata in de app zit). Volgorde = gewicht. Eerste treffer op de titel wint.
 */
export const ONDERWERP_KOPPELING: { naam: string; re: string; doelen: Partial<Record<Leerweg, string[]>> }[] = [
  { naam: "Geluid", re: "geluid", doelen: { BB: ["K/8.1", "K/8.2", "K/8.3", "K/8.4", "K/8.5"], KB: ["K/8.1", "K/8.2", "K/8.4", "K/8.5", "K/8.6", "K/8.3", "K/8.7"], GT: ["K/8.1", "K/8.2", "K/8.4", "K/8.5", "K/8.6", "K/8.3", "K/8.7"] } },
  { naam: "Verkeer en bewegen", re: "verkeer|beweg|snelheid", doelen: { BB: ["K/9.4", "K/9.5", "K/9.6", "K/9.7", "K/9.8"], KB: ["K/9.4", "K/9.5", "K/9.6", "K/9.7", "K/9.8", "K/9.9"], GT: ["K/9.4", "K/9.5", "K/9.6", "V/1.1", "K/9.7", "K/9.8", "K/9.9", "V/1.2"] } },
  { naam: "Krachten en werktuigen", re: "kracht|werktuig|hefboom|constructie", doelen: { BB: ["K/9.1", "K/9.2", "K/9.3", "K/9.9"], KB: ["K/9.1", "K/9.2", "K/9.3", "K/9.10"], GT: ["K/9.1", "K/9.2", "V/2.2", "V/2.4", "K/9.3", "K/9.10", "V/2.3"] } },
  { naam: "Magnetisme", re: "magnet|transformator|dynamo", doelen: { BB: ["K/5.1", "K/5.5"], KB: ["K/5.11", "K/5.12", "K/5.13"], GT: ["K/5.11", "K/5.12", "K/5.13"] } },
  { naam: "Elektriciteit en schakelingen", re: "elektri|schakeling|stroom", doelen: { BB: ["K/5.1", "K/5.2", "K/5.6", "K/5.3", "K/5.5", "K/5.7", "K/5.8"], KB: ["K/5.2", "K/5.6", "K/5.5", "K/5.3", "K/5.8", "K/5.7", "K/5.9"], GT: ["K/5.2", "K/5.6", "K/5.5", "K/5.3", "K/5.8", "K/5.7", "K/5.9"] } },
  { naam: "Warmte en energie", re: "warmte|energie|verbrand|verwarm", doelen: { BB: ["K/6", "K/5.7", "K/5.9"], KB: ["K/6.2", "K/6.4", "K/6.6", "K/6.3", "K/6.5", "K/6.1"], GT: ["K/6.2", "K/6.4", "K/6.6", "K/6.3", "K/6.5", "K/6.1"] } },
  { naam: "Stoffen en materialen", re: "stof|materia", doelen: { BB: ["K/4.1", "K/4.2", "K/4.3", "K/4.7", "K/4.6", "K/4.4", "K/4.5"], KB: ["K/4.1", "K/4.3", "K/4.2", "K/4.4", "K/4.8", "K/4.7", "K/4.6", "K/4.5"], GT: ["K/4.1", "K/4.3", "K/4.2", "K/4.4", "K/4.8", "K/4.7", "K/4.6", "K/4.5"] } },
  { naam: "Licht", re: "licht|lens|spiegel", doelen: { BB: ["K/7"], KB: ["K/7"], GT: ["K/7"] } },
  { naam: "Weer", re: "\\bweer\\b", doelen: { KB: ["K/12"], GT: ["K/12"] } },
  { naam: "Straling", re: "straling|atoom|atomen", doelen: { KB: ["K/11", "K/10"], GT: ["K/11", "K/10"] } },
  { naam: "Materie", re: "materie|deeltje", doelen: { BB: ["K/10"], KB: ["K/10"], GT: ["K/10"] } },
  { naam: "Vaardigheden", re: "vaardigheden|onderzoek|tw-toets", doelen: { BB: ["K/3.9", "K/3.1", "K/3.6", "K/3.4", "K/3.3"], KB: ["K/3.9", "K/3.1", "K/3.6", "K/3.4", "K/3.3"], GT: ["K/3.9", "K/3.1", "K/3.6", "V/4", "K/3.4", "K/3.3"] } },
];

export const LEERDOELEN_BRON = {
  syllabus: {
    titel: "Syllabus centraal examen 2028 Natuur- en scheikunde I vmbo (versie 2, april 2026), CvTE",
    url: "https://www.examenblad.nl/2028/vmbo-bb/documenten/syllabus-natuur-scheikunde-i-vmbo-2028",
    noot: "Inhoudelijk gelijk aan de syllabus 2027 (versie 2, juli 2025).",
  },
  kerndoelen: {
    titel: "SLO definitieve conceptkerndoelen mens en natuur, voortgezet onderwijs (november 2025)",
    url: "https://www.slo.nl/thema/meer/actualisatie-kerndoelen-examenprogramma/actualisatie-kerndoelen/definitieve-conceptkerndoelen-mens-0/",
    noot: "Nog niet wettelijk; per doel staat het huidige wettelijke kerndoel (2006) erbij.",
  },
} as const;
