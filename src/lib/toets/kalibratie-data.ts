// GEGENEREERD door tools/bouw-kalibratie-data.py uit kalibratie.json v2 (Nick's 67 NaSk-toetsen + CSE 2013–2026),
// vraagtypen.json (alleen id/naam/domein/frequentie) en de Nova-structuur. Alleen statistiek en patronen,
// geen vraag- of examenteksten. Niet met de hand aanpassen.

export interface SchoolProfielData {
  bron: string; duur: number; vragen: number; items: number; punten: number;
  minPerItem: number; puntenPerItem: number; pct1p: number; vormPct: Record<string, number>;
  rekenMax: number; rekenTemplate: string; formuleGegeven: boolean | string; omrekenen: string;
  contextStijl: string; voornamen: number; examencontextPct: number; afbeeldingen: number;
  topTypen: string[]; examenvragenBlok: boolean;
}
export interface ExamenProfielData {
  duur: number; vragen: number; punten: number; puntenPerVraag: number; minPerItem: number; pct1p: number;
  vormPct: Record<string, number>; rekenMax: number; introWoorden: number[]; vragenPerContext: number[]; categorieen: string[];
}
export interface VraagtypeData {
  id: string;
  naam: string;
  domein: string;
  freq: number;
  niveaus: Record<string, number>;
  punten: number;
  onderbouw?: boolean;
  /** Schooltoetstype (klas 3–4) dat op het CSE binnen een breder type valt; alleen als de lesstof het noemt (re). */
  school?: boolean;
  re?: string;
}
export interface NovaHoofdstukData { n: number; titel: string; paragrafen: { n: number; titel: string }[] }

export const SCHOOL_PROFIELEN: Record<string, SchoolProfielData> = {
 "1BB": {
  "bron": "afgeleid (geen BB-onderbouwtoetsen in de map): 3BB-vorm, kleiner",
  "duur": 45,
  "vragen": 25,
  "items": 28,
  "punten": 30,
  "minPerItem": 1.6,
  "puntenPerItem": 1.07,
  "pct1p": 80,
  "vormPct": {
   "waar/niet waar": 35,
   "MC": 35,
   "kort antwoord": 20,
   "invullen/aankruisen": 5,
   "berekening": 5
  },
  "rekenMax": 1,
  "rekenTemplate": "1p: formule in woorden gegeven, alleen invullen",
  "formuleGegeven": true,
  "omrekenen": "alleen eenvoudig (g↔kg, m↔km, mA↔A, min↔s) als losse vraag, niet ín een rekenvraag",
  "contextStijl": "korte stellingen en losse vragen",
  "voornamen": 3,
  "examencontextPct": 0,
  "afbeeldingen": 3,
  "topTypen": [],
  "examenvragenBlok": false
 },
 "1KB": {
  "bron": "= klas1 GT (op school KGT-klas, zelfde toets); lagere normering",
  "duur": 45,
  "vragen": 18,
  "items": 23,
  "punten": 28,
  "minPerItem": 2.0,
  "puntenPerItem": 1.22,
  "pct1p": 80,
  "vormPct": {
   "MC": 30,
   "kort antwoord": 40,
   "invullen/aankruisen": 5,
   "uitleggen": 10,
   "berekening": 10,
   "tekenen": 5
  },
  "rekenMax": 2,
  "rekenTemplate": "2p = formule (gegeven of in woorden) + uitkomst met eenheid",
  "formuleGegeven": true,
  "omrekenen": "alleen eenvoudig (g↔kg, m↔km, mA↔A, min↔s) als losse vraag, niet ín een rekenvraag",
  "contextStijl": "losse vragen",
  "voornamen": 3,
  "examencontextPct": 0,
  "afbeeldingen": 3,
  "topTypen": [],
  "examenvragenBlok": false
 },
 "1GT": {
  "bron": "gemeten 1GT (Nova kgt lj1-2 eindtoets A, 4 toetsen); duur aangenomen",
  "duur": 45,
  "vragen": 18,
  "items": 23,
  "punten": 28,
  "minPerItem": 2.0,
  "puntenPerItem": 1.2,
  "pct1p": 85,
  "vormPct": {
   "MC": 30,
   "kort antwoord": 40,
   "invullen/aankruisen": 5,
   "uitleggen": 10,
   "berekening": 10,
   "tekenen": 5
  },
  "rekenMax": 2,
  "rekenTemplate": "2p = formule (gegeven of in woorden) + uitkomst met eenheid",
  "formuleGegeven": true,
  "omrekenen": "alleen eenvoudig (g↔kg, m↔km, mA↔A, min↔s) als losse vraag, niet ín een rekenvraag",
  "contextStijl": "losse vragen met 1-2 zinnen situatie; geen doorlopende contexten",
  "voornamen": 3,
  "examencontextPct": 0,
  "afbeeldingen": 3,
  "topTypen": [
   "W-FASE",
   "W-DICHT",
   "W-STOF",
   "W-TRANS",
   "W-VERBR",
   "W-DICHTB",
   "W-MAT",
   "E-SERPAR"
  ],
  "examenvragenBlok": false
 },
 "2BB": {
  "bron": "afgeleid: tussen klas1 BB en 3BB",
  "duur": 45,
  "vragen": 28,
  "items": 31,
  "punten": 34,
  "minPerItem": 1.5,
  "puntenPerItem": 1.1,
  "pct1p": 80,
  "vormPct": {
   "waar/niet waar": 40,
   "MC": 30,
   "kort antwoord": 20,
   "invullen/aankruisen": 5,
   "berekening": 5
  },
  "rekenMax": 2,
  "rekenTemplate": "2p = formule (gegeven of in woorden) + uitkomst met eenheid",
  "formuleGegeven": true,
  "omrekenen": "alleen eenvoudig (g↔kg, m↔km, mA↔A, min↔s) als losse vraag, niet ín een rekenvraag",
  "contextStijl": "korte stellingen en losse vragen",
  "voornamen": 3,
  "examencontextPct": 0,
  "afbeeldingen": 4,
  "topTypen": [],
  "examenvragenBlok": false
 },
 "2KB": {
  "bron": "= klas2 GT (KGT-klas); lagere normering",
  "duur": 45,
  "vragen": 20,
  "items": 26,
  "punten": 31,
  "minPerItem": 1.7,
  "puntenPerItem": 1.19,
  "pct1p": 80,
  "vormPct": {
   "MC": 27,
   "kort antwoord": 45,
   "uitleggen": 10,
   "berekening": 10,
   "tekenen": 6,
   "invullen/aankruisen": 2
  },
  "rekenMax": 3,
  "rekenTemplate": "2p = formule (gegeven of in woorden) + uitkomst met eenheid",
  "formuleGegeven": true,
  "omrekenen": "alleen eenvoudig (g↔kg, m↔km, mA↔A, min↔s) als losse vraag, niet ín een rekenvraag",
  "contextStijl": "losse vragen",
  "voornamen": 1,
  "examencontextPct": 0,
  "afbeeldingen": 7,
  "topTypen": [],
  "examenvragenBlok": false
 },
 "2GT": {
  "bron": "gemeten 2KGT (4 toetsen; 1 met duur 45 min)",
  "duur": 45,
  "vragen": 20,
  "items": 26,
  "punten": 31,
  "minPerItem": 1.7,
  "puntenPerItem": 1.2,
  "pct1p": 81,
  "vormPct": {
   "MC": 27,
   "kort antwoord": 45,
   "uitleggen": 10,
   "berekening": 10,
   "tekenen": 6,
   "invullen/aankruisen": 2
  },
  "rekenMax": 3,
  "rekenTemplate": "2p = formule + uitkomst; 3p alleen bij snelheid/stopafstand met gegeven formule",
  "formuleGegeven": true,
  "omrekenen": "alleen eenvoudig (g↔kg, m↔km, mA↔A, min↔s) als losse vraag, niet ín een rekenvraag",
  "contextStijl": "losse vragen, vaak met afbeelding",
  "voornamen": 1,
  "examencontextPct": 0,
  "afbeeldingen": 7,
  "topTypen": [
   "G-BRON",
   "G-OSC",
   "B-SNEL",
   "S-ONDZ",
   "S-CALC-OV",
   "B-VEIL",
   "S-AFLEZ",
   "B-DIAG"
  ],
  "examenvragenBlok": false
 },
 "3BB": {
  "bron": "gemeten 3BB (6 Nova-toetsen \"Toets A\"); duur niet vermeld → 50 min aangenomen",
  "duur": 50,
  "vragen": 34,
  "items": 37,
  "punten": 43,
  "minPerItem": 1.4,
  "puntenPerItem": 1.15,
  "pct1p": 90,
  "vormPct": {
   "waar/niet waar": 50,
   "MC": 27,
   "kort antwoord": 13,
   "berekening": 5,
   "uitleggen": 2,
   "invullen/aankruisen": 2,
   "tekenen": 1
  },
  "rekenMax": 4,
  "rekenTemplate": "2p formule+uitkomst; enkele 3-4p meerstaps (zeldzaam, ~2 per toets)",
  "formuleGegeven": "in woorden, bovenaan de toets",
  "omrekenen": "niet in rekenvraag",
  "contextStijl": "W/NW-blok (1p) + MC-blok (1p) + 3-6 open vragen met korte situatie",
  "voornamen": 4,
  "examencontextPct": 0,
  "afbeeldingen": 3,
  "topTypen": [
   "M-TRAFO",
   "EN-SOORT",
   "K-SOORT",
   "B-VEIL",
   "W-FASE",
   "W-VERBR",
   "E-SERPAR",
   "K-DRUKB"
  ],
  "examenvragenBlok": false
 },
 "3KB": {
  "bron": "gemeten 3KB (1 TW-toets + 1 oefentoets, KGT-stof H1-H2); duur aangenomen 45 min",
  "duur": 45,
  "vragen": 19,
  "items": 23,
  "punten": 34,
  "minPerItem": 2.0,
  "puntenPerItem": 1.5,
  "pct1p": 52.2,
  "vormPct": {
   "MC": 40,
   "berekening": 25,
   "uitleggen": 20,
   "kort antwoord": 10,
   "invullen/aankruisen": 5
  },
  "rekenMax": 3,
  "rekenTemplate": "2p formule+uitkomst; 3p met één omreken- of tussenstap",
  "formuleGegeven": false,
  "omrekenen": "mA↔A als aparte 3p invulvraag",
  "contextStijl": "Nova-stijl losse vragen, soms 2-3 deelvragen bij één figuur",
  "voornamen": 2,
  "examencontextPct": 0,
  "afbeeldingen": 6,
  "topTypen": [
   "S-CALC-OV",
   "E-VEIL",
   "G-BRON",
   "E-SERPAR",
   "S-AFLEZ",
   "W-FASE",
   "K-DRUKB",
   "W-VERBR"
  ],
  "examenvragenBlok": false
 },
 "3GT": {
  "bron": "gemeten 3GT (8 toetsen, alle 40 min, dSE-toetsen)",
  "duur": 40,
  "vragen": 17,
  "items": 21,
  "punten": 30,
  "minPerItem": 1.9,
  "puntenPerItem": 1.4,
  "pct1p": 72,
  "vormPct": {
   "MC": 45,
   "kort antwoord": 25,
   "berekening": 15,
   "uitleggen": 10,
   "tekenen": 3,
   "invullen/aankruisen": 2
  },
  "rekenMax": 3,
  "rekenTemplate": "2p formule+uitkomst; 3p omrekenen/aflezen+formule+uitkomst; 4p hoogstens 1× per toets",
  "formuleGegeven": false,
  "omrekenen": "max 1 per rekenvraag",
  "contextStijl": "Nova-stijl: losse vragen + 2-4 kleine situaties met 2-3 deelvragen; geen CSE-contexten",
  "voornamen": 2,
  "examencontextPct": 0,
  "afbeeldingen": 5,
  "topTypen": [
   "S-CALC-OV",
   "E-COMP",
   "S-AFLEZ",
   "EN-SOORT",
   "E-VEIL",
   "E-SERPAR",
   "W-VERBR",
   "K-VECT"
  ],
  "examenvragenBlok": false
 },
 "4BB": {
  "bron": "gemeten 4BB (5 toetsen); duur niet vermeld → 50 min aangenomen",
  "duur": 50,
  "vragen": 29,
  "items": 29,
  "punten": 35,
  "minPerItem": 1.7,
  "puntenPerItem": 1.21,
  "pct1p": 84.2,
  "vormPct": {
   "waar/niet waar": 55,
   "MC": 15,
   "berekening": 8,
   "invullen/aankruisen": 8,
   "kort antwoord": 8,
   "tekenen": 6
  },
  "rekenMax": 3,
  "rekenTemplate": "CSE-BB: 2p formule+rest, 3p omrekenen+formule+rest",
  "formuleGegeven": "in woorden",
  "omrekenen": "1 per rekenvraag",
  "contextStijl": "W/NW-blok + MC + blok \"Examenvragen\" met 1-2 bewerkte CSE-BB-contexten (≈20% van de punten)",
  "voornamen": 1,
  "examencontextPct": 20,
  "afbeeldingen": 8,
  "topTypen": [
   "W-VERBR",
   "E-COMP",
   "W-TRANS",
   "K-SOORT",
   "G-OSC",
   "B-VEIL",
   "W-FASE",
   "E-SERPAR"
  ],
  "examenvragenBlok": true
 },
 "4KB": {
  "bron": "gemeten 4KB (7 toetsen; 40 min vermeld bij 1; K03T02 90 min)",
  "duur": 45,
  "vragen": 18,
  "items": 18,
  "punten": 26,
  "minPerItem": 2.5,
  "puntenPerItem": 1.44,
  "pct1p": 71.5,
  "vormPct": {
   "MC": 50,
   "berekening": 28,
   "kort antwoord": 10,
   "uitleggen": 10,
   "tekenen": 2
  },
  "rekenMax": 3,
  "rekenTemplate": "CSE-KB",
  "formuleGegeven": false,
  "omrekenen": "ja",
  "contextStijl": "Nova-stijl nummering maar met contextkoppen; 6/7 toetsen bevatten (bewerkte) CSE-contexten",
  "voornamen": 4,
  "examencontextPct": 40,
  "afbeeldingen": 10,
  "topTypen": [
   "S-CALC-OV",
   "K-SOORT",
   "K-NET",
   "E-TRAFO",
   "M-TRAFO",
   "W-DICHTB",
   "E-SERPAR",
   "G-ECHO"
  ],
  "examenvragenBlok": false
 },
 "4GT": {
  "bron": "gemeten 4GT (13 PTA/SE-toetsen G03T0x/G04T0x, 40 of 90 min)",
  "duur": 40,
  "vragen": 14,
  "items": 15,
  "punten": 25,
  "minPerItem": 2.7,
  "puntenPerItem": 1.67,
  "pct1p": 55.3,
  "vormPct": {
   "berekening": 38,
   "MC": 28,
   "kort antwoord": 14,
   "tekenen": 10,
   "uitleggen": 5,
   "invullen/aankruisen": 5
  },
  "rekenMax": 3,
  "rekenTemplate": "CSE-GT stappen, 1p per stap; 4p niet gebruikt",
  "formuleGegeven": false,
  "omrekenen": "ja",
  "contextStijl": "volledig CSE-stijl: 4-8 genummerde contexten met titel, 2-4 deelvragen a/b/c per context; ~80% van de contexten is een (bewerkte) echte CSE-context",
  "voornamen": 1.3,
  "examencontextPct": 80,
  "afbeeldingen": 14,
  "topTypen": [
   "S-CALC-OV",
   "W-DICHT",
   "G-FREQ",
   "E-TRAFO",
   "G-GEHOOR",
   "G-OSC",
   "W-DICHTB",
   "B-SNEL"
  ],
  "examenvragenBlok": false
 }
};

export const EXAMEN_PROFIELEN: Record<"BB" | "KB" | "GT", ExamenProfielData> = {
 "BB": {
  "duur": 90,
  "vragen": 33,
  "punten": 49,
  "puntenPerVraag": 1.49,
  "minPerItem": 2.7,
  "pct1p": 60.2,
  "vormPct": {
   "MC": 42,
   "berekening": 21,
   "invullen/aankruisen": 21,
   "tekenen": 8,
   "kort antwoord": 7,
   "uitleggen": 1
  },
  "rekenMax": 3,
  "introWoorden": [
   20,
   30
  ],
  "vragenPerContext": [
   3,
   4
  ],
  "categorieen": [
   "overig",
   "verkeer & vervoer",
   "huis & keuken",
   "techniek & apparaat",
   "sport & vrije tijd",
   "natuur & milieu",
   "school & practicum",
   "werk & beroep"
  ]
 },
 "KB": {
  "duur": 120,
  "vragen": 39,
  "punten": 67,
  "puntenPerVraag": 1.73,
  "minPerItem": 3.1,
  "pct1p": 46.1,
  "vormPct": {
   "berekening": 29,
   "MC": 25,
   "kort antwoord": 18,
   "invullen/aankruisen": 16,
   "tekenen": 7,
   "uitleggen": 4
  },
  "rekenMax": 4,
  "introWoorden": [
   20,
   35
  ],
  "vragenPerContext": [
   4,
   4
  ],
  "categorieen": [
   "techniek & apparaat",
   "huis & keuken",
   "verkeer & vervoer",
   "werk & beroep",
   "sport & vrije tijd",
   "natuur & milieu",
   "overig",
   "school & practicum"
  ]
 },
 "GT": {
  "duur": 120,
  "vragen": 41,
  "punten": 75,
  "puntenPerVraag": 1.82,
  "minPerItem": 2.9,
  "pct1p": 43.2,
  "vormPct": {
   "berekening": 33,
   "MC": 24,
   "invullen/aankruisen": 16,
   "kort antwoord": 14,
   "tekenen": 7,
   "uitleggen": 4
  },
  "rekenMax": 4,
  "introWoorden": [
   30,
   50
  ],
  "vragenPerContext": [
   4,
   5
  ],
  "categorieen": [
   "huis & keuken",
   "verkeer & vervoer",
   "werk & beroep",
   "techniek & apparaat",
   "sport & vrije tijd",
   "overig",
   "school & practicum",
   "natuur & milieu"
  ]
 }
};

export const VRAAGTYPEN: VraagtypeData[] = [
 {
  "id": "E-COMP",
  "naam": "Elektronische componenten/sensoren herkennen (LDR, NTC, diode, led, reed, relais, transistor, condensator)",
  "domein": "elektriciteit",
  "freq": 86,
  "niveaus": {
   "BB": 9,
   "KB": 31,
   "GT": 46
  },
  "punten": 1
 },
 {
  "id": "K-SOORT",
  "naam": "Soorten krachten herkennen/benoemen",
  "domein": "krachten",
  "freq": 70,
  "niveaus": {
   "BB": 11,
   "KB": 14,
   "GT": 45
  },
  "punten": 1
 },
 {
  "id": "G-OSC",
  "naam": "Oscilloscoopbeeld: amplitude/toonhoogte/luidheid",
  "domein": "geluid",
  "freq": 67,
  "niveaus": {
   "BB": 9,
   "KB": 13,
   "GT": 45
  },
  "punten": 1
 },
 {
  "id": "G-GEHOOR",
  "naam": "Gehoorgevoeligheid/gehoorschade (Binas-zones, dB)",
  "domein": "geluid",
  "freq": 56,
  "niveaus": {
   "BB": 7,
   "KB": 9,
   "GT": 40
  },
  "punten": 1
 },
 {
  "id": "W-DICHT",
  "naam": "Dichtheid/massa/volume berekenen (ρ = m/V)",
  "domein": "stoffen",
  "freq": 53,
  "niveaus": {
   "BB": 9,
   "KB": 14,
   "GT": 30
  },
  "punten": 3
 },
 {
  "id": "W-FASE",
  "naam": "Faseovergangen benoemen/herkennen",
  "domein": "warmte",
  "freq": 51,
  "niveaus": {
   "BB": 5,
   "KB": 16,
   "GT": 30
  },
  "punten": 1
 },
 {
  "id": "M-TRAFO",
  "naam": "Transformator/elektromagneet/elektromotor/dynamo: werking",
  "domein": "magnetisme",
  "freq": 50,
  "niveaus": {
   "BB": 2,
   "KB": 16,
   "GT": 32
  },
  "punten": 1
 },
 {
  "id": "B-SNEL",
  "naam": "Snelheid/afstand/tijd berekenen (s = v·t)",
  "domein": "bewegen",
  "freq": 49,
  "niveaus": {
   "BB": 13,
   "KB": 11,
   "GT": 25
  },
  "punten": 3
 },
 {
  "id": "E-SERPAR",
  "naam": "Serie/parallel: spanning, stroom en weerstand redeneren",
  "domein": "elektriciteit",
  "freq": 47,
  "niveaus": {
   "BB": 3,
   "KB": 10,
   "GT": 34
  },
  "punten": 1
 },
 {
  "id": "EN-SOORT",
  "naam": "Energiesoorten/omzettingen en energiestroomdiagram",
  "domein": "energie",
  "freq": 45,
  "niveaus": {
   "BB": 1,
   "KB": 15,
   "GT": 29
  },
  "punten": 2
 },
 {
  "id": "W-MAT",
  "naam": "Materiaaleigenschappen en -keuze (incl. kunststoffen, geleiders)",
  "domein": "stoffen",
  "freq": 44,
  "niveaus": {
   "BB": 6,
   "KB": 14,
   "GT": 24
  },
  "punten": 1
 },
 {
  "id": "S-GRAF",
  "naam": "Grafiek tekenen uit meetgegevens",
  "domein": "vaardigheden",
  "freq": 43,
  "niveaus": {
   "BB": 6,
   "KB": 13,
   "GT": 24
  },
  "punten": 3
 },
 {
  "id": "B-EZEK",
  "naam": "Zwaarte-/bewegingsenergie berekenen",
  "domein": "energie",
  "freq": 43,
  "niveaus": {
   "BB": 0,
   "KB": 11,
   "GT": 32
  },
  "punten": 2
 },
 {
  "id": "E-SCHEMA",
  "naam": "Schakelschema tekenen/aanvullen",
  "domein": "elektriciteit",
  "freq": 41,
  "niveaus": {
   "BB": 6,
   "KB": 10,
   "GT": 25
  },
  "punten": 2
 },
 {
  "id": "B-VEIL",
  "naam": "Verkeersveiligheid: gordel, airbag, kreukelzone, helm, reactietijd",
  "domein": "bewegen",
  "freq": 39,
  "niveaus": {
   "BB": 9,
   "KB": 20,
   "GT": 10
  },
  "punten": 1
 },
 {
  "id": "E-PUI",
  "naam": "Vermogen/stroom berekenen met P = U·I",
  "domein": "elektriciteit",
  "freq": 39,
  "niveaus": {
   "BB": 6,
   "KB": 13,
   "GT": 20
  },
  "punten": 2
 },
 {
  "id": "E-R",
  "naam": "Weerstand/spanning/stroom berekenen met R = U/I",
  "domein": "elektriciteit",
  "freq": 38,
  "niveaus": {
   "BB": 6,
   "KB": 11,
   "GT": 21
  },
  "punten": 2
 },
 {
  "id": "K-NET",
  "naam": "Nettokracht en bewegingstoestand (constant, versnellen, vertragen)",
  "domein": "krachten",
  "freq": 37,
  "niveaus": {
   "BB": 8,
   "KB": 10,
   "GT": 19
  },
  "punten": 1
 },
 {
  "id": "E-CAP",
  "naam": "Capaciteit/gebruiksduur accu berekenen (C = I·t)",
  "domein": "elektriciteit",
  "freq": 36,
  "niveaus": {
   "BB": 5,
   "KB": 11,
   "GT": 20
  },
  "punten": 2
 },
 {
  "id": "W-DICHTB",
  "naam": "Dichtheid opzoeken/vergelijken (Binas) of meten",
  "domein": "stoffen",
  "freq": 36,
  "niveaus": {
   "BB": 2,
   "KB": 7,
   "GT": 27
  },
  "punten": 1
 },
 {
  "id": "K-DRUK",
  "naam": "Druk berekenen met p = F/A",
  "domein": "krachten",
  "freq": 33,
  "niveaus": {
   "BB": 6,
   "KB": 12,
   "GT": 15
  },
  "punten": 2
 },
 {
  "id": "K-VECT",
  "naam": "Kracht tekenen met krachtenschaal",
  "domein": "krachten",
  "freq": 33,
  "niveaus": {
   "BB": 7,
   "KB": 12,
   "GT": 14
  },
  "punten": 3
 },
 {
  "id": "W-TRANS",
  "naam": "Warmtetransport en isolatie (geleiding, stroming, straling)",
  "domein": "warmte",
  "freq": 30,
  "niveaus": {
   "BB": 1,
   "KB": 11,
   "GT": 18
  },
  "punten": 1
 },
 {
  "id": "K-DRUKB",
  "naam": "Druk: begrip (groter/kleiner oppervlak)",
  "domein": "krachten",
  "freq": 30,
  "niveaus": {
   "BB": 7,
   "KB": 10,
   "GT": 13
  },
  "punten": 1
 },
 {
  "id": "G-FREQ",
  "naam": "Frequentie/trillingstijd berekenen (f = 1/T)",
  "domein": "geluid",
  "freq": 30,
  "niveaus": {
   "BB": 0,
   "KB": 10,
   "GT": 20
  },
  "punten": 3
 },
 {
  "id": "E-REND",
  "naam": "Rendement berekenen",
  "domein": "energie",
  "freq": 29,
  "niveaus": {
   "BB": 1,
   "KB": 10,
   "GT": 18
  },
  "punten": 2
 },
 {
  "id": "G-ECHO",
  "naam": "Geluidssnelheid/echo berekenen (s = v·t, factor 2)",
  "domein": "geluid",
  "freq": 28,
  "niveaus": {
   "BB": 4,
   "KB": 7,
   "GT": 17
  },
  "punten": 3
 },
 {
  "id": "E-EPT",
  "naam": "Energie/vermogen/tijd berekenen met E = P·t",
  "domein": "energie",
  "freq": 28,
  "niveaus": {
   "BB": 3,
   "KB": 7,
   "GT": 18
  },
  "punten": 3
 },
 {
  "id": "E-TRAFO",
  "naam": "Transformator berekenen (Up/Us = np/ns)",
  "domein": "magnetisme",
  "freq": 28,
  "niveaus": {
   "BB": 2,
   "KB": 8,
   "GT": 18
  },
  "punten": 2
 },
 {
  "id": "W-VEIL",
  "naam": "Veiligheid met stoffen: pictogrammen, H/P-zinnen, voorzorg",
  "domein": "stoffen",
  "freq": 27,
  "niveaus": {
   "BB": 6,
   "KB": 6,
   "GT": 15
  },
  "punten": 1
 },
 {
  "id": "W-AFVAL",
  "naam": "Afval scheiden/recyclen (gft, kca, kunststof)",
  "domein": "stoffen",
  "freq": 27,
  "niveaus": {
   "BB": 4,
   "KB": 12,
   "GT": 11
  },
  "punten": 1
 },
 {
  "id": "S-CALC-OV",
  "naam": "Overige berekening (meerstaps/eigen redenering)",
  "domein": "vaardigheden",
  "freq": 26,
  "niveaus": {
   "BB": 8,
   "KB": 6,
   "GT": 12
  },
  "punten": 1
 },
 {
  "id": "G-BEREIK",
  "naam": "Gehoorbereik, ultrasoon/infrasoon, geluidsvoortplanting (tussenstof/vacuüm)",
  "domein": "geluid",
  "freq": 25,
  "niveaus": {
   "BB": 5,
   "KB": 8,
   "GT": 12
  },
  "punten": 1
 },
 {
  "id": "K-MOM",
  "naam": "Momentenwet/hefboom berekenen",
  "domein": "krachten",
  "freq": 24,
  "niveaus": {
   "BB": 0,
   "KB": 2,
   "GT": 22
  },
  "punten": 3
 },
 {
  "id": "K-FMA",
  "naam": "Kracht/versnelling berekenen met F = m·a",
  "domein": "krachten",
  "freq": 21,
  "niveaus": {
   "BB": 2,
   "KB": 1,
   "GT": 18
  },
  "punten": 2
 },
 {
  "id": "B-ACC",
  "naam": "Versnelling berekenen (a = Δv/Δt)",
  "domein": "bewegen",
  "freq": 21,
  "niveaus": {
   "BB": 2,
   "KB": 0,
   "GT": 19
  },
  "punten": 2
 },
 {
  "id": "S-ONDZ",
  "naam": "Onderzoeksvaardigheden: variabelen, meetplan, nauwkeurigheid, conclusie",
  "domein": "vaardigheden",
  "freq": 20,
  "niveaus": {
   "BB": 5,
   "KB": 4,
   "GT": 11
  },
  "punten": 1
 },
 {
  "id": "S-AFLEZ",
  "naam": "Waarde aflezen uit grafiek/tabel/meter",
  "domein": "vaardigheden",
  "freq": 18,
  "niveaus": {
   "BB": 3,
   "KB": 2,
   "GT": 13
  },
  "punten": 1
 },
 {
  "id": "E-VERM-BEGR",
  "naam": "Vermogen/energieverbruik vergelijken (begrip, kWh-meter, energielabel)",
  "domein": "elektriciteit",
  "freq": 17,
  "niveaus": {
   "BB": 6,
   "KB": 2,
   "GT": 9
  },
  "punten": 1
 },
 {
  "id": "EN-DUUR",
  "naam": "Duurzame energie/milieu: bronnen, CO2, besparen",
  "domein": "energie",
  "freq": 17,
  "niveaus": {
   "BB": 1,
   "KB": 6,
   "GT": 10
  },
  "punten": 1
 },
 {
  "id": "S-EENH",
  "naam": "Eenheden/voorvoegsels omrekenen (los)",
  "domein": "vaardigheden",
  "freq": 16,
  "niveaus": {
   "BB": 3,
   "KB": 10,
   "GT": 3
  },
  "punten": 1
 },
 {
  "id": "G-DB",
  "naam": "Geluidssterkte (dB) berekenen/beredeneren bij afstand",
  "domein": "geluid",
  "freq": 16,
  "niveaus": {
   "BB": 2,
   "KB": 3,
   "GT": 11
  },
  "punten": 2
 },
 {
  "id": "B-DIAG",
  "naam": "Bewegingsdiagram (v,t)/(s,t) lezen of interpreteren",
  "domein": "bewegen",
  "freq": 16,
  "niveaus": {
   "BB": 3,
   "KB": 3,
   "GT": 10
  },
  "punten": 1
 },
 {
  "id": "K-RES",
  "naam": "Resulterende kracht construeren/bepalen",
  "domein": "krachten",
  "freq": 16,
  "niveaus": {
   "BB": 0,
   "KB": 0,
   "GT": 16
  },
  "punten": 3
 },
 {
  "id": "E-VEIL",
  "naam": "Veilig elektrisch gebruik (zekering, aardlek, randaarde, overbelasting, kortsluiting)",
  "domein": "elektriciteit",
  "freq": 15,
  "niveaus": {
   "BB": 3,
   "KB": 1,
   "GT": 11
  },
  "punten": 1
 },
 {
  "id": "S-VERBAND",
  "naam": "Verband/evenredigheid herkennen in tabel of grafiek",
  "domein": "vaardigheden",
  "freq": 14,
  "niveaus": {
   "BB": 1,
   "KB": 3,
   "GT": 10
  },
  "punten": 1
 },
 {
  "id": "K-ARB",
  "naam": "Arbeid berekenen (W = F·s)",
  "domein": "energie",
  "freq": 14,
  "niveaus": {
   "BB": 0,
   "KB": 0,
   "GT": 14
  },
  "punten": 2
 },
 {
  "id": "W-VBW",
  "naam": "Verbrandingswarmte/energie uit brandstof berekenen",
  "domein": "verbranden",
  "freq": 14,
  "niveaus": {
   "BB": 0,
   "KB": 3,
   "GT": 11
  },
  "punten": 2
 },
 {
  "id": "K-HEF",
  "naam": "Hefboom/katrol/overbrenging: werking en voordeel",
  "domein": "krachten",
  "freq": 13,
  "niveaus": {
   "BB": 3,
   "KB": 3,
   "GT": 7
  },
  "punten": 1
 },
 {
  "id": "G-BRON",
  "naam": "Geluidsoverlast beperken: bron, tussenstof, ontvanger",
  "domein": "geluid",
  "freq": 12,
  "niveaus": {
   "BB": 4,
   "KB": 2,
   "GT": 6
  },
  "punten": 1
 },
 {
  "id": "W-VERBR",
  "naam": "Verbranding: voorwaarden, producten, blussen, onvolledige verbranding",
  "domein": "verbranden",
  "freq": 12,
  "niveaus": {
   "BB": 2,
   "KB": 3,
   "GT": 7
  },
  "punten": 1
 },
 {
  "id": "W-CORR",
  "naam": "Corrosie/roesten en bescherming",
  "domein": "stoffen",
  "freq": 12,
  "niveaus": {
   "BB": 2,
   "KB": 5,
   "GT": 5
  },
  "punten": 1
 },
 {
  "id": "W-TEMP-C",
  "naam": "Temperatuur K↔°C omrekenen",
  "domein": "warmte",
  "freq": 12,
  "niveaus": {
   "BB": 0,
   "KB": 2,
   "GT": 10
  },
  "punten": 2
 },
 {
  "id": "E-KOST",
  "naam": "Energiekosten berekenen (kWh × prijs)",
  "domein": "elektriciteit",
  "freq": 9,
  "niveaus": {
   "BB": 0,
   "KB": 1,
   "GT": 8
  },
  "punten": 3
 },
 {
  "id": "K-SCHAAL",
  "naam": "Krachtenschaal bepalen/aantonen",
  "domein": "krachten",
  "freq": 9,
  "niveaus": {
   "BB": 0,
   "KB": 0,
   "GT": 9
  },
  "punten": 1
 },
 {
  "id": "W-STOF",
  "naam": "Stofeigenschappen/mengsels/scheiden/oplossen",
  "domein": "stoffen",
  "freq": 8,
  "niveaus": {
   "BB": 0,
   "KB": 1,
   "GT": 7
  },
  "punten": 1
 },
 {
  "id": "E-METER",
  "naam": "Stroom-/spanningsmeter aansluiten/aflezen",
  "domein": "elektriciteit",
  "freq": 7,
  "niveaus": {
   "BB": 3,
   "KB": 1,
   "GT": 3
  },
  "punten": 1
 },
 {
  "id": "K-ARM",
  "naam": "Arm/draaipunt aangeven in tekening",
  "domein": "krachten",
  "freq": 7,
  "niveaus": {
   "BB": 2,
   "KB": 1,
   "GT": 4
  },
  "punten": 2
 },
 {
  "id": "B-STOP",
  "naam": "Stopafstand/reactie-afstand/remweg berekenen",
  "domein": "bewegen",
  "freq": 7,
  "niveaus": {
   "BB": 2,
   "KB": 2,
   "GT": 3
  },
  "punten": 1
 },
 {
  "id": "E-RV",
  "naam": "Vervangingsweerstand serie/parallel berekenen",
  "domein": "elektriciteit",
  "freq": 7,
  "niveaus": {
   "BB": 0,
   "KB": 2,
   "GT": 5
  },
  "punten": 2
 },
 {
  "id": "W-DRIJF",
  "naam": "Drijven, zweven, zinken (dichtheid vergelijken)",
  "domein": "stoffen",
  "freq": 6,
  "niveaus": {
   "BB": 0,
   "KB": 2,
   "GT": 4
  },
  "punten": 1
 },
 {
  "id": "K-ZWP",
  "naam": "Zwaartepunt en stabiliteit",
  "domein": "krachten",
  "freq": 6,
  "niveaus": {
   "BB": 0,
   "KB": 0,
   "GT": 6
  },
  "punten": 1
 },
 {
  "id": "OVERIG",
  "naam": "Overig/niet te clusteren",
  "domein": "overig",
  "freq": 39,
  "niveaus": {
   "BB": 5,
   "KB": 11,
   "GT": 23
  },
  "punten": 1
 },
 {
  "id": "O-LICHT",
  "naam": "Licht: schaduw, spiegeling, breking, lenzen en kleuren (onderbouw)",
  "domein": "licht",
  "freq": 0,
  "niveaus": {},
  "punten": 1,
  "onderbouw": true
 },
 {
  "id": "K-FZ",
  "naam": "Zwaartekracht berekenen met Fz = m × g (g volgens de lesstof)",
  "domein": "krachten",
  "freq": 0,
  "niveaus": {},
  "punten": 2,
  "school": true,
  "re": "zwaartekracht|fz\\s*=|m\\s*[×x·]\\s*g"
 },
 {
  "id": "K-VEER",
  "naam": "Veer: uitrekking en veerconstante (F = C × u), F-u-tabel of -diagram",
  "domein": "krachten",
  "freq": 0,
  "niveaus": {},
  "punten": 2,
  "school": true,
  "re": "veerconstante|uitrekking|\\bveer\\b|\\bveren\\b"
 },
 {
  "id": "O-HEELAL",
  "naam": "Heelal: zon, maan, planeten, maanfasen, dag en nacht, seizoenen (onderbouw)",
  "domein": "heelal",
  "freq": 0,
  "niveaus": {},
  "punten": 1,
  "onderbouw": true
 },
 {
  "id": "O-WEER",
  "naam": "Water en weer: neerslag, luchtdruk, wind, waterkringloop, weerbericht (onderbouw)",
  "domein": "weer",
  "freq": 0,
  "niveaus": {},
  "punten": 1,
  "onderbouw": true
 }
];

export const NOVA_HOOFDSTUKKEN: Record<"kgt12" | "gt3" | "gt4", NovaHoofdstukData[]> = {
 "kgt12": [
  {
   "n": 1,
   "titel": "Natuurkunde en scheikunde",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Een nieuw vak"
    },
    {
     "n": 2,
     "titel": "Onderzoeken"
    },
    {
     "n": 3,
     "titel": "Practicum"
    },
    {
     "n": 4,
     "titel": "Meten"
    }
   ]
  },
  {
   "n": 2,
   "titel": "Stoffen",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Stoffen in huis"
    },
    {
     "n": 2,
     "titel": "Zuivere stoffen en mengsels"
    },
    {
     "n": 3,
     "titel": "Massa en volume"
    },
    {
     "n": 4,
     "titel": "Dichtheid"
    }
   ]
  },
  {
   "n": 3,
   "titel": "Water",
   "paragrafen": [
    {
     "n": 1,
     "titel": "IJs – water – waterdamp"
    },
    {
     "n": 2,
     "titel": "Temperatuur meten"
    },
    {
     "n": 3,
     "titel": "Veranderen van fase"
    },
    {
     "n": 4,
     "titel": "Kookpunt en smeltpunt"
    }
   ]
  },
  {
   "n": 4,
   "titel": "Elektriciteit",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Een stroomkring maken"
    },
    {
     "n": 2,
     "titel": "Spanningsbronnen"
    },
    {
     "n": 3,
     "titel": "Schakelingen"
    },
    {
     "n": 4,
     "titel": "Vermogen en energie"
    }
   ]
  },
  {
   "n": 5,
   "titel": "Bewegen",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Bewegingen vastleggen"
    },
    {
     "n": 2,
     "titel": "Gemiddelde snelheid"
    },
    {
     "n": 3,
     "titel": "Soorten bewegingen"
    },
    {
     "n": 4,
     "titel": "Remmen en botsen"
    }
   ]
  },
  {
   "n": 6,
   "titel": "Licht",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Licht en schaduw"
    },
    {
     "n": 2,
     "titel": "Spiegelbeelden"
    },
    {
     "n": 3,
     "titel": "Licht en kleur"
    },
    {
     "n": 4,
     "titel": "Infrarode en ultraviolette straling"
    }
   ]
  },
  {
   "n": 7,
   "titel": "Het heelal",
   "paragrafen": [
    {
     "n": 1,
     "titel": "De zon, de aarde en de maan"
    },
    {
     "n": 2,
     "titel": "Het zonnestelsel"
    },
    {
     "n": 3,
     "titel": "De planeten"
    },
    {
     "n": 4,
     "titel": "De bouw van het heelal"
    }
   ]
  },
  {
   "n": 8,
   "titel": "Geluid",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Geluid maken en horen"
    },
    {
     "n": 2,
     "titel": "Toonhoogte en frequentie"
    },
    {
     "n": 3,
     "titel": "Geluidssterkte"
    },
    {
     "n": 4,
     "titel": "Geluidsoverlast verminderen"
    }
   ]
  }
 ],
 "gt3": [
  {
   "n": 1,
   "titel": "Elektriciteit",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Elektrische stroom"
    },
    {
     "n": 2,
     "titel": "Elektriciteit in huis"
    },
    {
     "n": 3,
     "titel": "Vermogen en energie"
    },
    {
     "n": 4,
     "titel": "Elektriciteit en veiligheid"
    }
   ]
  },
  {
   "n": 2,
   "titel": "Het weer",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Het deeltjesmodel"
    },
    {
     "n": 2,
     "titel": "Luchtdruk"
    },
    {
     "n": 3,
     "titel": "Temperatuur"
    },
    {
     "n": 4,
     "titel": "Wolken en onweer"
    }
   ]
  },
  {
   "n": 3,
   "titel": "Krachten",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Krachten herkennen"
    },
    {
     "n": 2,
     "titel": "Krachten meten"
    },
    {
     "n": 3,
     "titel": "Nettokracht"
    },
    {
     "n": 4,
     "titel": "Krachten in werktuigen"
    }
   ]
  },
  {
   "n": 4,
   "titel": "Stoffen",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Stofeigenschappen"
    },
    {
     "n": 2,
     "titel": "Smeltpunt en kookpunt"
    },
    {
     "n": 3,
     "titel": "Veilig werken met stoffen"
    },
    {
     "n": 4,
     "titel": "Chemische reacties"
    }
   ]
  },
  {
   "n": 5,
   "titel": "Licht",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Licht, schaduw en spiegels"
    },
    {
     "n": 2,
     "titel": "Van infrarood tot ultraviolet"
    },
    {
     "n": 3,
     "titel": "Beelden maken met een lens"
    },
    {
     "n": 4,
     "titel": "Oog en bril"
    }
   ]
  },
  {
   "n": 6,
   "titel": "Warmte",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Warmte en temperatuur"
    },
    {
     "n": 2,
     "titel": "Brandstoffen en verbranden"
    },
    {
     "n": 3,
     "titel": "Warmtetransport"
    },
    {
     "n": 4,
     "titel": "Isoleren"
    }
   ]
  },
  {
   "n": 7,
   "titel": "Materialen",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Materialen toepassen"
    },
    {
     "n": 2,
     "titel": "Van grondstof tot product"
    },
    {
     "n": 3,
     "titel": "Afvalverwerking"
    },
    {
     "n": 4,
     "titel": "Dichtheid"
    }
   ]
  },
  {
   "n": 8,
   "titel": "Atomen en straling",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Atomen als stralingsbron"
    },
    {
     "n": 2,
     "titel": "Radioactief verval"
    },
    {
     "n": 3,
     "titel": "Straling gebruiken"
    },
    {
     "n": 4,
     "titel": "Bescherming tegen straling"
    }
   ]
  }
 ],
 "gt4": [
  {
   "n": 9,
   "titel": "Schakelingen",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Weerstanden"
    },
    {
     "n": 2,
     "titel": "LDR en NTC"
    },
    {
     "n": 3,
     "titel": "Schakelen met een relais"
    },
    {
     "n": 4,
     "titel": "Elektronische schakelingen"
    }
   ]
  },
  {
   "n": 10,
   "titel": "Krachten",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Soorten krachten"
    },
    {
     "n": 2,
     "titel": "Krachten in constructies"
    },
    {
     "n": 3,
     "titel": "Krachten samenstellen"
    },
    {
     "n": 4,
     "titel": "Krachten ontbinden"
    }
   ]
  },
  {
   "n": 11,
   "titel": "Energie",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Fossiele brandstoffen"
    },
    {
     "n": 2,
     "titel": "Zonne-energie"
    },
    {
     "n": 3,
     "titel": "Windenergie"
    },
    {
     "n": 4,
     "titel": "Waterkracht"
    },
    {
     "n": 5,
     "titel": "Energie besparen"
    }
   ]
  },
  {
   "n": 12,
   "titel": "Elektriciteit",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Stroom en spanning"
    },
    {
     "n": 2,
     "titel": "Spanning transformeren"
    },
    {
     "n": 3,
     "titel": "Serie- en parallelschakeling"
    },
    {
     "n": 4,
     "titel": "Elektriciteit en veiligheid"
    }
   ]
  },
  {
   "n": 13,
   "titel": "Geluid",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Geluidsbronnen"
    },
    {
     "n": 2,
     "titel": "Toonhoogte"
    },
    {
     "n": 3,
     "titel": "Geluidssterkte"
    },
    {
     "n": 4,
     "titel": "Geluidshinder"
    }
   ]
  },
  {
   "n": 14,
   "titel": "Werktuigen",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Werken met hefbomen"
    },
    {
     "n": 2,
     "titel": "Hefbomen en zwaartekracht"
    },
    {
     "n": 3,
     "titel": "Katrollen en takels"
    },
    {
     "n": 4,
     "titel": "Druk"
    }
   ]
  },
  {
   "n": 15,
   "titel": "Bewegingen",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Bewegingen onderzoeken"
    },
    {
     "n": 2,
     "titel": "Snelheid en versnelling"
    },
    {
     "n": 3,
     "titel": "Eenparig versneld"
    },
    {
     "n": 4,
     "titel": "Eenparig vertraagd"
    }
   ]
  },
  {
   "n": 16,
   "titel": "Kracht en beweging",
   "paragrafen": [
    {
     "n": 1,
     "titel": "Voortstuwen en tegenwerken"
    },
    {
     "n": 2,
     "titel": "Optrekken en afremmen"
    },
    {
     "n": 3,
     "titel": "Veiligheid in het verkeer"
    },
    {
     "n": 4,
     "titel": "Kracht en arbeid"
    }
   ]
  }
 ]
};

export const NOVA_LEERDOELEN: Record<"kgt12" | "gt3" | "gt4", Record<string, string>> = {
 "kgt12": {
  "2.1.1": "Je kunt vier stofeigenschappen noemen.",
  "2.1.2": "Je kunt stoffen herkennen aan hun stofeigenschappen.",
  "2.1.3": "Je kunt uitleggen in welke gevallen een stof gevaarlijk kan zijn. PLUS",
  "2.1.4": "Je kunt de betekenis van enkele gevarensymbolen beschrijven.",
  "1.1.1": "Je kunt beschrijven waar de vakken nask en biologie over gaan.",
  "1.1.2": "Je kunt het verschil benoemen tussen een stof en een materiaal.",
  "1.1.3": "Je kunt met voorbeelden het verschil tussen natuurkunde en scheikunde uitleggen.",
  "1.2.1": "Je kunt benoemen wat je met je zintuigen kunt waarnemen.",
  "1.2.2": "Je kunt beschrijven hoe je voorzichtig aan onbekende stoffen moet ruiken.",
  "1.2.3": "Je kunt uitleggen waarom je bij natuurkunde en scheikunde nooit mag proeven van een stof.",
  "1.2.4": "Je kunt beschrijven wat de onderzoeksvraag en de conclusie van een onderzoek zijn.",
  "1.3.1": "Je kunt practicummateriaal herkennen.",
  "1.3.2": "Je kunt de toepassing van practicummateriaal benoemen.",
  "1.3.3": "Je kunt de veiligheidsregels en veiligheidsmiddelen bij practicum noemen.",
  "1.3.4": "Je kunt de werking van de brander uitleggen.",
  "1.4.1": "Je kunt van een aantal meetapparaten uitleggen waarvoor je ze gebruikt.",
  "1.4.2": "Je kunt het verschil uitleggen tussen analoge en digitale meetapparatuur.",
  "1.4.3": "Je kunt beschrijven wat een grootheid en wat een eenheid is.",
  "1.4.4": "Je kunt enkele meetapparaten aflezen.",
  "1.4.5": "Je kunt enkele eenheden naar elkaar omrekenen.",
  "2.2.1": "Je kunt het verschil aangeven tussen zuivere stoffen en mengsels.",
  "2.2.2": "Je kunt oplossingen en suspensies onderscheiden.",
  "2.2.3": "Je kunt beschrijven hoe je stoffen kunt scheiden door middel van extraheren of filtreren. PLUS",
  "2.2.4": "Je kunt de toepassing van alcohol als oplosmiddel uitleggen.",
  "2.3.1": "Je kunt de massa van een hoeveelheid stof bepalen.",
  "2.3.2": "Je kunt het volume van een hoeveelheid vloeistof bepalen.",
  "2.3.3": "Je kunt het volume van een rechthoekig voorwerp berekenen.",
  "2.3.4": "Je kunt het volume van een voorwerp met een onregelmatige vorm bepalen. PLUS",
  "2.3.5": "Je kunt rekenen met verschillende maten voor massa.",
  "2.4.1": "Je kunt uitleggen wat de dichtheid van een stof is.",
  "2.4.2": "Je kunt uitleggen dat dichtheid een stofeigenschap is.",
  "2.4.3": "Je kunt de dichtheid van een stof berekenen als de massa en het volume gegeven zijn.",
  "2.4.4": "Je kunt aan de hand van de dichtheid van stoffen uitleggen of een stof zinkt, zweeft of drijft. PLUS",
  "2.4.5": "Je kunt het verband uitleggen tussen dichtheid en temperatuur.",
  "3.1.1": "Je kunt de drie fasen benoemen.",
  "3.1.2": "Je kunt de drie fasen van water herkennen in de praktijk.",
  "3.1.3": "Je kunt beschrijven dat ijs en veel andere vaste stoffen een kenmerkende kristalstructuur hebben.",
  "3.1.4": "Je kunt verschillende soorten neerslag beschrijven. PLUS",
  "3.1.5": "Je kunt uitleggen waarom ijs blijft drijven op water.",
  "3.2.1": "Je kunt de onderdelen van een vloeistofthermometer benoemen.",
  "3.2.2": "Je kunt uitleggen hoe een vloeistofthermometer werkt.",
  "3.2.3": "Je kunt een schaalverdeling in graden Celsius maken met behulp van het smeltpunt van ijs en het kookpunt van water.",
  "3.2.4": "Je kunt verschillende soorten thermometers benoemen. PLUS",
  "3.2.5": "Je kunt uitleggen hoe een bimetaal-thermometer werkt.",
  "3.3.1": "Je kunt de zes fase-overgangen van stoffen beschrijven.",
  "3.3.2": "Je kunt beschrijven hoe de fase-overgangen van water een belangrijke rol spelen bij allerlei weersverschijnselen. PLUS",
  "3.3.3": "Je kunt uitleggen wat vriesdrogen is.",
  "3.4.1": "Je kunt beschrijven wat er gebeurt als water kookt.",
  "3.4.2": "Je kunt uitleggen wat het kookpunt en smeltpunt (vriespunt/stolpunt) van een stof zijn.",
  "3.4.3": "Je kunt uitleggen waarom het kookpunt en smeltpunt stofeigenschappen zijn.",
  "3.4.4": "Je kunt uitleggen hoe je het vriespunt of smeltpunt van water kunt verlagen. PLUS",
  "4.1.1": "Je kunt uitleggen hoe je een gesloten stroomkring maakt.",
  "4.1.2": "Je kunt het verschil tussen geleiders en isolatoren beschrijven.",
  "4.1.3": "Je kunt een aantal geleiders en isolatoren noemen.",
  "4.1.4": "Je kunt uitleggen op welke manier je de stroomsterkte meet.",
  "4.1.5": "Je kunt beschrijven wat een elektrische stroom is. PLUS",
  "4.1.6": "Je kunt uitleggen wat een led is en hoe een led werkt.",
  "4.2.1": "Je kunt beschrijven hoe je spanning meet.",
  "4.2.2": "Je kunt uitleggen wat het verschil is tussen spanning en stroomsterkte.",
  "4.2.3": "Je kunt een aantal spanningsbronnen noemen.",
  "4.2.4": "Je kunt de spanning berekenen als je batterijen in serie schakelt.",
  "4.2.5": "Je kunt uitleggen wat er gebeurt als je een elektrisch apparaat niet op de juiste spanning aansluit. PLUS",
  "4.2.6": "Je kunt de werking van een dynamo uitleggen.",
  "4.3.1": "Je kunt twaalf symbolen voor onderdelen in schakelschema’s herkennen en tekenen.",
  "4.3.2": "Je kunt het verschil uitleggen tussen een parallelschakeling en een serieschakeling.",
  "4.3.3": "Je kunt het schakelschema tekenen van eenvoudige serie- en parallelschakelingen.",
  "4.3.4": "Je kunt uitleggen waarom elektrische apparaten bijna altijd parallel geschakeld worden.",
  "4.3.5": "Je kunt de grootte van de stroomsterkte beredeneren in een schakeling. PLUS",
  "4.3.6": "Je kunt uitleggen hoe een wisselschakeling werkt.",
  "4.4.1": "Je kunt uitleggen wat het vermogen van een apparaat is.",
  "4.4.2": "Je kunt het vermogen van een apparaat berekenen.",
  "4.4.3": "Je kunt uitleggen waarom een apparaat met een groter vermogen meer elektrische energie verbruikt. PLUS",
  "4.4.4": "Je kunt het energieverbruik van een apparaat berekenen.",
  "5.1.1": "Je kunt uitleggen op welke manieren je een beweging vast kunt leggen.",
  "5.1.2": "Je kunt uitleggen hoe je een stroboscopische foto maakt.",
  "5.1.3": "Je kunt een afstand-tijdtabel maken van een beweging van een voorwerp.",
  "5.1.4": "Je kunt een afstand-tijddiagram tekenen van een afstand-tijdtabel.",
  "5.1.5": "Je kunt een afstand-tijddiagram aflezen. PLUS",
  "5.1.6": "Je kunt uitleggen hoe je een video-opname van een beweging kunt analyseren.",
  "5.2.1": "Je kunt de gemiddelde snelheid van een voorwerp berekenen.",
  "5.2.2": "Je kunt snelheid in m/s omrekenen naar km/h.",
  "5.2.3": "Je kunt de afstand berekenen die een voorwerp in een bepaalde tijd aflegt. PLUS",
  "5.2.4": "Je kunt de reistijd uitrekenen als de afstand en snelheid bekend zijn.",
  "5.3.1": "Je kunt uitleggen wat er gebeurt met de snelheid bij een beweging met constante snelheid, een versnelde beweging en een vertraagde beweging.",
  "5.3.2": "Je kunt de snelheid op elk moment van de beweging berekenen bij een beweging met constante snelheid.",
  "5.3.3": "Je kunt aan de vorm van de grafiek een beweging met constante snelheid, een versnelde beweging en een vertraagde beweging herkennen. PLUS",
  "5.3.4": "Je kunt verschillende eenheden van snelheid naar elkaar omrekenen.",
  "5.4.1": "Je kunt drie factoren noemen waarvan de lengte van de remweg afhangt.",
  "5.4.2": "Je kunt aan de hand van een grafiek uitleggen wat het verband is tussen de beginsnelheid en de remweg.",
  "5.4.3": "Je kunt uitleggen wat bedoeld wordt met de reactietijd en de reactie-afstand.",
  "5.4.4": "Je kunt de afstand berekenen die een auto nodig heeft om te stoppen. PLUS",
  "6.1.1": "Je kunt voorbeelden noemen van natuurlijke en kunstmatige lichtbronnen.",
  "6.1.2": "Je kunt schematisch lichtstralen tekenen.",
  "6.1.3": "Je kunt uitleggen hoe je voorwerpen om je heen kunt zien die zelf geen licht geven.",
  "6.1.4": "Je kunt de schaduw van een voorwerp tekenen.",
  "6.1.5": "Je kunt uitleggen welke schaduwbeelden ontstaan als een voorwerp verlicht wordt door één lamp of door twee lampen. PLUS",
  "6.1.6": "Je kunt het verschil uitleggen tussen direct en indirect zonlicht.",
  "6.2.1": "Je kunt uitleggen dat een spiegelbeeld op één belangrijk punt verschilt van de wereld voor de spiegel.",
  "6.2.2": "Je kunt de spiegelwet uitleggen met behulp van een tekening.",
  "6.2.3": "Je kunt tekenen hoe een lichtstraal door een spiegel teruggekaatst wordt.",
  "6.2.4": "Je kunt met de spiegelwet verklaren hoe spiegelbeelden ontstaan. PLUS",
  "6.2.5": "Je kunt uitleggen dat bij alle soorten oppervlakken de spiegelwet geldt.",
  "6.3.1": "Je kunt uitleggen wat een spectrum is en hoe je een spectrum zichtbaar maakt.",
  "6.3.2": "Je kunt uitleggen wat je met een zakspectroscoop kunt onderzoeken.",
  "6.3.3": "Je kunt uitleggen hoe je een voorwerp met een bepaalde kleur ziet bij verschillende kleuren licht. PLUS",
  "6.3.4": "Je kunt uitleggen hoe de kleuren op een tv-scherm gemaakt worden.",
  "6.4.1": "Je kunt benoemen waar infrarode en ultraviolette straling zich in het spectrum bevinden.",
  "6.4.2": "Je kunt kenmerken benoemen van infrarode en ultraviolette straling.",
  "6.4.3": "Je kunt toepassingen noemen van infrarode en ultraviolette straling.",
  "6.4.4": "Je kunt uitleggen wat de gevaren zijn van ultraviolette straling. PLUS",
  "6.4.5": "Je kunt uitleggen wat een thermogram is.",
  "7.1.1": "Je kunt een aantal kenmerken van de zon noemen.",
  "7.1.2": "Je kunt toelichten wat bedoeld wordt met de aardas.",
  "7.1.3": "Je kunt de begrippen baan en omlooptijd uitleggen.",
  "7.1.4": "Je kunt de bewegingen die de aarde maakt beschrijven.",
  "7.1.5": "Je kunt uitleggen waardoor de seizoenen en de verschillen in daglengte ontstaan.",
  "7.1.6": "Je kunt uitleggen hoe de schijngestalten van de maan eruitzien en hoe ze ontstaan. PLUS",
  "7.1.7": "Je kunt met tekeningen uitleggen hoe zons- en maansverduisteringen ontstaan.",
  "7.2.1": "Je kunt beschrijven hoe de sterren (vanaf de aarde) langs de hemel lijken te bewegen.",
  "7.2.2": "Je kunt uitleggen waardoor de schijnbare beweging van de sterren wordt veroorzaakt.",
  "7.2.3": "Je kunt uitleggen hoe een sterrenkundige planeten kan onderscheiden van sterren.",
  "7.2.4": "Je kunt beschrijven hoe de planeten in het zonnestelsel rond de zon bewegen.",
  "7.2.5": "Je kunt de namen van de planeten noemen, in volgorde van hun afstand tot de zon.",
  "7.2.6": "Je kunt beschrijven wat dwergplaneten en planetoïden zijn.",
  "7.2.7": "Je kunt beschrijven wat een maan is. PLUS",
  "7.2.8": "Je kunt beschrijven wat kometen, meteoroïden, meteoren en meteorieten zijn.",
  "7.3.1": "Je kunt uitleggen dat elke planeet zijn eigen omlooptijd en snelheid heeft.",
  "7.3.2": "Je kunt afstanden omrekenen van km naar AE en omgekeerd.",
  "7.3.3": "Je kunt de vier aardse planeten noemen met hun kenmerken.",
  "7.3.4": "Je kunt uitleggen wat bedoeld wordt met ‘een vacuüm’ en ‘de atmosfeer van een planeet’.",
  "7.3.5": "Je kunt de belangrijkste verschillen benoemen tussen de aardse planeten en de reuzenplaneten.",
  "7.3.6": "Je kunt een aantal manieren beschrijven waarop planeten onderzocht worden. PLUS",
  "7.4.1": "Je kunt uitleggen wat een ster is en dat de zon eigenlijk maar een heel gewone ster is.",
  "7.4.2": "Je kunt sterren, planeten en sterrenbeelden vinden met behulp van een sterrenkaart.",
  "7.4.3": "Je kunt uitleggen wat een sterrenstelsel is en wat je kunt zien van ‘ons eigen sterrenstelsel’.",
  "7.4.4": "Je kunt beschrijven wat de Melkweg is.",
  "7.4.5": "Je kunt beschrijven hoe het heelal is opgebouwd en dat de afstanden tussen de sterren en de aarde enorm verschillen. PLUS",
  "8.1.1": "Je kunt een aantal geluidsbronnen noemen.",
  "8.1.2": "Je kunt uitleggen hoe het geluid van een luidspreker zich verspreidt tot je oren het geluid opvangen.",
  "8.1.3": "Je kunt uitleggen wat een tussenstof is.",
  "8.1.4": "Je kunt de geluidssnelheid in lucht van 20 °C noemen.",
  "8.1.5": "Je kunt beschrijven hoe je geluid hoort. PLUS",
  "8.2.1": "Je kunt de drie factoren noemen die de hoogte van de toon van een snaar bepalen.",
  "8.2.2": "Je kunt uitleggen wat de frequentie is van een trilling.",
  "8.2.3": "Je kunt het verband beschrijven tussen de frequentie en de toonhoogte.",
  "8.2.4": "Je kunt in een oscilloscoopbeeld de trillingstijd van een toon bepalen.",
  "8.2.5": "Je kunt het frequentiebereik van het menselijk gehoor benoemen. PLUS",
  "8.2.6": "Je kunt de frequentie van een toon berekenen met de trillingstijd.",
  "8.3.1": "Je kunt uitleggen wat het verband is tussen de amplitude van een trilling en de geluidssterkte.",
  "8.3.2": "Je kunt beschrijven hoe je geluidssterkte meet.",
  "8.3.3": "Je kunt uitleggen wat de gehoordrempel en de pijngrens zijn. PLUS",
  "8.3.4": "Je kunt uitleggen dat je gehoor niet voor alle frequenties even gevoelig is.",
  "8.4.1": "Je kunt uitleggen vanaf welke geluidssterkte je gehoor beschadigd kan raken als je er regelmatig of langdurig aan blootstaat.",
  "8.4.2": "Je kunt drie manieren benoemen om geluidsoverlast te verminderen.",
  "8.4.3": "Je kunt voorbeelden geven van maatregelen tegen geluidshinder bij de geluidsbron, tussen de geluidsbron en de ontvanger en bij de ontvanger.",
  "8.4.4": "Je kunt het verschil uitleggen tussen geluid absorberen en weerkaatsen.",
  "8.4.5": "Je kunt enkele manieren van geluidsisolatie benoemen. PLUS",
  "8.4.6": "Je kunt uitleggen hoe een audiogram gemaakt wordt."
 },
 "gt3": {
  "1.1.1": "Je kunt met een model uitleggen hoe een elektrische stroom rond stroomt in een stroomkring.",
  "1.1.2": "Je kunt aangeven hoe je een stroommeter moet schakelen om een bepaalde stroom te meten.",
  "1.1.3": "Je kunt uitleggen dat de stroomsterkte in een serieschakeling op alle plaatsen even groot is.",
  "1.1.4": "Je kunt uitleggen wat wordt bedoeld met de totale stroomsterkte in een parallelschakeling.",
  "1.1.5": "Je kunt berekeningen uitvoeren met de verschillende stroomsterktes in een parallelschakeling.",
  "1.2.1": "Je kunt de onderdelen van een huisinstallati e benoemen vanaf de hoofdleiding in de meterkast.",
  "1.2.2": "Je kunt beschrijven waar de verschillend gekleurde draden in een huisinstallati e voor dienen.",
  "1.2.3": "Je kunt de oorzaak en de gevolgen beschrijven van kortsluiti ng en van overbelasti ng.",
  "1.3.1": "Je kunt uitleggen wat wordt bedoeld met het vermogen van een apparaat.",
  "1.3.2": "Je kunt berekeningen uitvoeren met spanning, stroomsterkte en vermogen.",
  "1.3.3": "Je kunt uitleggen hoe het verbruik van elektrische energie in huis wordt gemeten.",
  "1.3.4": "Je kunt het energieverbruik van elektrische apparaten berekenen in kWh.",
  "1.3.5": "Je kunt berekenen hoeveel je voor de verbruikte elektrische energie moet betalen.",
  "1.4.1": "Je kunt beschrijven welke twee gevaren het gebruik van elektriciteit met zich meebrengt.",
  "1.4.2": "Je kunt uitleggen waarom je in vochtige ruimtes extra voorzichtig moet zijn met elektriciteit.",
  "1.4.3": "Je kunt uitleggen wat wordt bedoeld met enkele isolatie en met dubbele isolatie.",
  "1.4.4": "Je kunt zekeringen, aardlekschakelaars en randaarde in afbeeldingen herkennen.",
  "1.4.5": "Je kunt de functie van zekeringen, aardlekschakelaars en randaarde beschrijven.",
  "2.1.1": "Je kunt uitleggen welke drie eigenschappen moleculen in het deeltjesmodel hebben.",
  "2.1.2": "Je kunt beschrijven hoe moleculen bewegen in een vaste stof, een vloeistof en een gas.",
  "2.1.3": "Je kunt uitleggen wat er met de moleculen gebeurt bij de verschillende faseovergangen.",
  "2.1.4": "Je kunt het ontstaan van mist, dauw en rijp toelichten met behulp van het deeltjesmodel.",
  "2.2.1": "Je kunt uitleggen hoe de luchtdruk op het aardoppervlak en op jezelf ontstaat.",
  "2.2.2": "Je kunt beschrijven op welke manier je de grootte van de luchtdruk kunt meten.",
  "2.2.3": "Je kunt de kenmerken van lagedrukgebieden en hogedrukgebieden benoemen.",
  "2.2.4": "Je kunt het verband beschrijven tussen de luchtdruk en de hoogte in de atmosfeer.",
  "2.2.5": "Je kunt uitleggen wat wordt bedoeld met de gasdruk in een afgesloten ruimte.",
  "2.2.6": "Je kunt beschrijven op welke manier je de grootte van de gasdruk kunt meten.",
  "2.2.7": "Je kunt de absolute druk berekenen als je de overdruk kent, en omgekeerd.",
  "2.3.1": "Je kunt de onderdelen van een vloeistofthermometer benoemen en hun functie beschrijven.",
  "2.3.2": "Je kunt uitleggen wat een bimetaal is en op welke manier een bimetaalthermometer werkt.",
  "2.3.3": "Je kunt met het deeltjesmodel het verband tussen gasdruk en temperatuur toelichten.",
  "2.3.4": "Je kunt met het deeltjesmodel uitleggen wat wordt bedoeld met het absolute nulpunt.",
  "2.3.5": "Je kunt de temperatuur omrekenen van graden Celsius naar kelvin en omgekeerd.",
  "2.4.1": "Je kunt met behulp van een grafiek bepalen hoe hoog het dauwpunt is.",
  "2.4.2": "Je kunt uitleggen van welke factor de hoogte van het dauwpunt afhangt.",
  "2.4.3": "Je kunt stap voor stap beschrijven op welke manier stapelwolken ontstaan.",
  "2.4.4": "Je kunt het verschil beschrijven tussen mooiweerwolken en buienwolken.",
  "2.4.5": "Je kunt beschrijven op welke manier de bliksem en de donder ontstaan.",
  "3.1.1": "Je kunt uitleggen waaraan je kunt zien dat ergens een kracht werkt of heeft gewerkt.",
  "3.1.2": "Je kunt de verschillende krachten benoemen die een rol spelen in een gegeven situatie.",
  "3.1.3": "Je kunt een kracht tekenen als een pijl, met het juiste aangrijpingspunt en de juiste richting.",
  "3.1.4": "Je kunt tekenen hoe de zwaartekracht aangrijpt in het zwaartepunt van een voorwerp.",
  "3.2.1": "Je kunt het verband beschrijven tussen de uitrekking en de kracht op een veer.",
  "3.2.2": "Je kunt uitleggen hoe je krachten kunt meten met een krachtmeter (veerunster).",
  "3.2.3": "Je kunt de zwaartekracht op een voorwerp berekenen als de massa is gegeven.",
  "3.2.4": "Je kunt een kracht tekenen op een gegeven of een zelfgekozen krachtenschaal.",
  "3.3.1": "Je kunt drie situaties beschrijven waarin de zwaartekracht en een andere kracht elkaar in evenwicht houden.",
  "3.3.2": "Je kunt uitleggen op welke manier de andere kracht in deze evenwichtssituaties ontstaat.",
  "3.3.3": "Je kunt de nettokracht berekenen die op een voorwerp werkt (in situaties waarbij alle krachten langs dezelfde lijn werken).",
  "3.4.1": "Je kunt uitleggen of een werktuig een enkele of een dubbele hefboom vormt.",
  "3.4.2": "Je kunt het draaipunt van een hefboom aanwijzen in een foto of een tekening.",
  "3.4.3": "Je kunt uitleggen wat bij een hefboom wordt bedoeld met de werkkracht en de last.",
  "3.4.4": "Je kunt uitleggen hoe je met een kleine werkkracht een grote last kunt uitoefenen.",
  "3.4.5": "Je kunt de grootte van een kracht of een arm met de hefboomregel berekenen.",
  "4.1.1": "Je kunt uitleggen wat het verschil is tussen een mengsel en een zuivere stof.",
  "4.1.2": "Je kunt met voorbeelden toelichten hoe je stoffen van elkaar kunt scheiden.",
  "4.1.3": "Je kunt beschrijven wat er met de moleculen gebeurt als je een stof zuivert.",
  "4.1.4": "Je kunt vijf stofeigenschappen noemen en stoffen daarmee van elkaar onderscheiden.",
  "4.2.1": "Je kunt stoffen van elkaar onderscheiden op basis van hun fase bij kamertemperatuur.",
  "4.2.2": "Je kunt toelichten dat het woord ‘damp’ dezelfde fase aanduidt als het woord ‘gas’.",
  "4.2.3": "Je kunt het kookpunt en smeltpunt van een stof aflezen uit een temperatuur- tijddiagram.",
  "4.2.4": "Je kunt beschrijven wat er in een vloeistof gebeurt als de stof aan het koken is.",
  "4.2.5": "Je kunt uitleggen waarom je bij het kookpunt ook de luchtdruk moet vermelden.",
  "4.3.1": "Je kunt zeven gevaren beschrijven die stoffen voor mensen kunnen opleveren.",
  "4.3.2": "Je kunt de informatie toelichten die je op etiketten en veiligheidskaarten tegenkomt.",
  "4.3.3": "Je kunt de betekenis uitleggen van de pictogrammen of symbolen op gevaarlijke stoffen.",
  "4.3.4": "Je kunt de regels noemen die op school gelden als je met gevaarlijke stoffen werkt.",
  "4.3.5": "Je kunt uitleggen hoe je voorkomt dat schadelijke stoffen in het milieu terechtkomen.",
  "4.4.1": "Je kunt een aantal chemische reacties herkennen die veel in het dagelijks leven voorkomen.",
  "4.4.2": "Je kunt toelichten dat bij een chemische reactie zowel stoffen verdwijnen als stoffen ontstaan.",
  "4.4.3": "Je kunt aan de hand van een reactieschema uitleggen wat er gebeurt bij een ontledingsreactie en bij een verbrandingsreactie.",
  "4.4.4": "Je kunt uitleggen wat er nodig is om een verbrandingsreactie op gang te brengen.",
  "4.4.5": "Je kunt beschrijven hoe corrosie verloopt bij ijzer en bij andere veelgebruikte metalen.",
  "5.1.1": "Je kunt beschrijven hoe licht en andere vormen van straling zich verspreiden.",
  "5.1.2": "Je kunt uitleggen wat er precies kan gebeuren als licht op een voorwerp valt.",
  "5.1.3": "Je kunt het verschil toelichten tussen spiegelende en diffuse terugkaatsing.",
  "5.1.4": "Je kunt de schaduw tekenen van een voorwerp dat door een lamp wordt verlicht.",
  "5.1.5": "Je kunt uitleggen hoe lichtstralen door een vlakke spiegel worden teruggekaatst.",
  "5.1.6": "Je kunt het spiegelbeeld tekenen van een voorwerp dat voor een spiegel staat.",
  "5.1.7": "Je kunt tekenen hoe een lichtbundel door een spiegel wordt teruggekaatst.",
  "5.2.1": "Je kunt uitleggen hoe je de verschillende kleuren in zonlicht zichtbaar kunt maken.",
  "5.2.2": "Je kunt de kleuren in het spectrum van zonlicht in de juiste volgorde benoemen.",
  "5.2.3": "Je kunt behalve licht twee soorten straling noemen die door de zon worden uitgezonden.",
  "5.2.4": "Je kunt uitleggen op welke manier de kleuren van de voorwerpen om je heen ontstaan.",
  "5.2.5": "Je kunt drie kenmerkende effecten (uitwerkingen) van uv-straling beschrijven.",
  "5.2.6": "Je kunt uitleggen hoe je je tegen de gevaren van uv-straling kunt beschermen.",
  "5.2.7": "Je kunt drie toepassingen van ir-straling in het dagelijks leven beschrijven.",
  "5.3.1": "Je kunt het verschil beschrijven tussen positieve lenzen en negatieve lenzen.",
  "5.3.2": "Je kunt uitleggen hoe een positieve lens een evenwijdige bundel zonlicht breekt.",
  "5.3.3": "Je kunt toelichten wat wordt bedoeld met brandpunt en brandpuntsafstand.",
  "5.3.4": "Je kunt uitleggen hoe een negatieve lens een evenwijdige bundel zonlicht breekt.",
  "5.3.5": "Je kunt het verschil uitleggen tussen een reëel beeld en een virtueel beeld.",
  "5.3.6": "Je kunt het beeld construeren dat een positieve lens van een voorwerp vormt.",
  "5.3.7": "Je kunt de voorwerpsafstand en de beeldafstand opmeten in een tekening.",
  "5.4.1": "Je kunt zeven onderdelen van een oog in een tekening aanwijzen en benoemen.",
  "5.4.2": "Je kunt de functie toelichten van het netvlies, de oogzenuw, de iris en de pupil.",
  "5.4.3": "Je kunt beschrijven hoe je ogen een beeld vormen van de wereld om je heen.",
  "5.4.4": "Je kunt beschrijven hoe je ogen scherpstellen op voorwerpen dichtbij en in de verte.",
  "5.4.5": "Je kunt uitleggen wat bijziendheid is en hoe je deze afwijking kunt corrigeren.",
  "5.4.6": "Je kunt uitleggen wat verziendheid is en hoe je deze afwijking kunt corrigeren.",
  "6.1.1": "Je kunt vier elektrische warmtebronnen noemen die je in huis of op school gebruikt.",
  "6.1.2": "Je kunt het energie-stroomdiagram van een elektrische warmtebron tekenen en toelichten.",
  "6.1.3": "Je kunt berekenen hoeveel warmte een elektrische warmtebron in een bepaalde tijd levert.",
  "6.1.4": "Je kunt het verband tussen temperatuur en tijd meten en weergeven in een diagram.",
  "6.1.5": "Je kunt het verband tussen temperatuur en warmte bepalen en weergeven in een diagram.",
  "6.2.1": "Je kunt drie voorbeelden geven van warmtebronnen die chemische energie verbruiken.",
  "6.2.2": "Je kunt berekeningen uitvoeren met de verbrandingswarmte van een brandstof.",
  "6.2.3": "Je kunt het reactieschema van de volledige verbranding van aardgas noteren.",
  "6.2.4": "Je kunt uitleggen waarom je bij gastoestellen voor voldoende luchttoevoer moet zorgen.",
  "6.2.5": "Je kunt beschrijven hoe je op een veilige manier met een gasbrander kunt werken.",
  "6.2.6": "Je kunt de temperatuur omrekenen van graden Celsius (°C) naar kelvin (K), en omgekeerd.",
  "6.3.1": "Je kunt drie vormen van warmtetransport noemen en de verschillen toelichten.",
  "6.3.2": "Je kunt met voorbeelden toelichten hoe warmte wordt vervoerd door geleiding.",
  "6.3.3": "Je kunt drie voorbeelden geven van goede en drie van slechte warmtegeleiders.",
  "6.3.4": "Je kunt met voorbeelden toelichten hoe warmte wordt vervoerd door stroming.",
  "6.3.5": "Je kunt met voorbeelden toelichten hoe warmte wordt vervoerd door straling.",
  "6.3.6": "Je kunt uitleggen welke voorwerpen straling goed absorberen en welke niet.",
  "6.4.1": "Je kunt drie manieren beschrijven waarop een huis warmte verliest aan de omgeving.",
  "6.4.2": "Je kunt uitleggen hoe het komt dat een goed geïsoleerd huis minder energie verbruikt.",
  "6.4.3": "Je kunt vier manieren beschrijven om een woonhuis te isoleren tegen warmteverlies.",
  "6.4.4": "Je kunt van elke manier van isoleren uitleggen hoe die het warmteverlies tegengaat.",
  "6.4.5": "Je kunt uitrekenen hoeveel bewoners door isolatie kunnen besparen in m3 aardgas en in euro’s.",
  "7.1.1": "Je kunt drie eigenschappen noemen die belangrijk zijn voor een constructiemateriaal.",
  "7.1.2": "Je kunt uitleggen wat wordt bedoeld met ‘verspanen’ en ‘verspanende bewerkingen’.",
  "7.1.3": "Je kunt toelichten waarom vloeistoffen vaak in glas of in polyetheen worden verpakt.",
  "7.1.4": "Je kunt uitleggen waarom carbonfiber veel wordt toegepast in (top)sportartikelen.",
  "7.2.1": "Je kunt vier belangrijke stappen beschrijven in het productieproces van een product.",
  "7.2.2": "Je kunt toelichten wat wordt bedoeld met grondstof, halffabricaat en eindproduct.",
  "7.2.3": "Je kunt grondstof, halffabricaat en eindproduct herkennen in een praktijkvoorbeeld.",
  "7.2.4": "Je kunt drie gevolgen noemen die het maken van producten heeft voor het milieu.",
  "7.3.1": "Je kunt uitleggen waarom het nuttig is om afval te scheiden in verschillende soorten.",
  "7.3.2": "Je kunt het verschil uitleggen tussen gft-afval, klein chemisch afval en restafval.",
  "7.3.3": "Je kunt van afvalstoffen en kapotte spullen aangeven bij welke soort afval ze horen.",
  "7.3.4": "Je kunt vier manieren noemen om afval te verwerken, met hun voor- en nadelen.",
  "7.3.5": "Je kunt drie manieren beschrijven om milieuproblemen met afval te verminderen.",
  "7.4.1": "Je kunt toepassingen van materialen beschrijven, waarbij dichtheid een grote rol speelt.",
  "7.4.2": "Je kunt met proeven de massa en het volume bepalen van vaste stoffen en vloeistoffen.",
  "7.4.3": "Je kunt berekeningen uitvoeren met dichtheid, massa en volume.",
  "7.4.4": "Je kunt uitleggen waarom sommige materialen geen vaste, kenmerkende dichtheid hebben.",
  "7.4.5": "Je kunt op basis van de dichtheid uitleggen wanneer een voorwerpt zinkt, zweeft of drijft.",
  "8.1.1": "Je kunt uitleggen wat wordt bedoeld met natuurlijk radioactief en kunstmatig radioactief.",
  "8.1.2": "Je kunt het verschil toelichten tussen de moleculen van een verbinding en van een element.",
  "8.1.3": "Je kunt beschrijven hoe atomen zijn opgebouwd uit drie verschillende kleinere deeltjes.",
  "8.1.4": "Je kunt de overeenkomsten en de verschillen tussen de isotopen van één element noemen.",
  "8.1.5": "Je kunt aangeven dat één element zowel gewone als radioactieve isotopen kan hebben.",
  "8.1.6": "Je kunt de bron noemen van de ioniserende straling die radioactieve isotopen uitzenden.",
  "8.2.1": "Je kunt toelichten wat er met de atoomkern gebeurt als een atoom radioactief vervalt.",
  "8.2.2": "Je kunt het verschil uitleggen tussen ioniserende straling en straling die niet ioniserend is.",
  "8.2.3": "Je kunt een meetinstrument beschrijven waarmee ioniserende straling wordt gemeten.",
  "8.2.4": "Je kunt uitleggen wat wordt bedoeld met de activiteit van een radioactief voorwerp.",
  "8.2.5": "Je kunt beschrijven hoe de activiteit van een radioactief voorwerp geleidelijk afneemt.",
  "8.2.6": "Je kunt uitleggen wat wordt bedoeld met de halfwaardetijd van een radioactieve isotoop.",
  "8.3.1": "Je kunt de drie soorten straling benoemen die door radioactieve stoffen worden uitgezonden.",
  "8.3.2": "Je kunt uitleggen hoe groot het doordringend vermogen is van elk van deze soorten straling.",
  "8.3.3": "Je kunt beschrijven op welke manier gammastraling wordt toegepast bij medisch onderzoek.",
  "8.3.4": "Je kunt beschrijven hoe kankergezwellen worden bestraald: van buitenaf én van binnenuit.",
  "8.3.5": "Je kunt uitleggen waarom gammastraling de beste keuze is voor bestraling van buitenaf.",
  "8.4.1": "Je kunt de gevaren beschrijven van de ioniserende straling die radioactieve stoffen afgeven.",
  "8.4.2": "Je kunt uitleggen waarom gammastraling het gevaarlijkst is bij bestraling van buitenaf.",
  "8.4.3": "Je kunt drie voorzorgsmaatregelen noemen voor het werken met radioactieve stoffen.",
  "8.4.4": "Je kunt uitleggen wat radioactieve besmetting is en hoe je besmetting kunt voorkomen.",
  "8.4.5": "Je kunt beschrijven welke maatregelen worden genomen als mensen per ongeluk wel radioactief besmet raken."
 },
 "gt4": {
  "9.1.1": "Je kunt toelichten wat wordt bedoeld met de weerstand van een schakelonderdeel.",
  "9.1.2": "Je kunt uitleggen hoe je de totale weerstand van een stroomkring groter kunt maken.",
  "9.1.3": "Je kunt beschrijven hoe je de weerstand van een schakelonderdeel kunt bepalen.",
  "9.1.4": "Je kunt berekeningen uitvoeren met de spanning, de stroomsterkte en de weerstand.",
  "9.1.5": "Je kunt beredeneren of de wet van Ohm van toepassing is op een schakelonderdeel.",
  "9.1.6": "Je kunt uit de kleurcode op een weerstandje afleiden hoe groot zijn weerstandswaarde is.",
  "9.2.1": "Je kunt de drie delen beschrijven waaruit een eenvoudige automatische schakeling bestaat.",
  "9.2.2": "Je kunt uitleggen wanneer de weerstand van een LDR toeneemt en wanneer hij afneemt.",
  "9.2.3": "Je kunt een schakeling tekenen waarin de hoeveelheid licht met een LDR wordt gemeten.",
  "9.2.4": "Je kunt uitleggen wanneer de weerstand van een NTC toeneemt en wanneer hij afneemt.",
  "9.2.5": "Je kunt een schakeling tekenen waarin een NTC als temperatuursensor wordt gebruikt.",
  "9.2.6": "Je kunt de vervangingsweerstand van een serieschakeling berekenen.",
  "9.2.7": "Je kunt beschrijven hoe je de weerstandswaarde van een schuifweerstand kunt instellen.",
  "9.3.1": "Je kunt de onderdelen beschrijven waaruit een elektromagneet is opgebouwd.",
  "9.3.2": "Je kunt uitleggen hoe een elektromagneet een stroomkring kan inschakelen.",
  "9.3.3": "Je kunt met symbolen tekenen hoe je een relais in een schakeling opneemt.",
  "9.3.4": "Je kunt toelichten hoe een relais wordt toegepast in een automatische schakeling.",
  "9.3.5": "Je kunt uitleggen hoe je een reedcontact in een schakeling als sensor gebruikt.",
  "9.4.1": "Je kunt overeenkomsten en verschillen tussen een transistor en een relais benoemen.",
  "9.4.2": "Je kunt uitleggen wanneer een transistor schakelt van UIT naar AAN (en andersom).",
  "9.4.3": "Je kunt schakelingen tekenen waarin een transistor als schakelaar wordt gebruikt.",
  "9.4.4": "Je kunt toelichten hoe een schakeling met een transistor als schakelaar werkt.",
  "9.4.5": "Je kunt beschrijven hoe je elektrische energie in een condensator kunt opslaan.",
  "9.4.6": "Je kunt toelichten hoe een condensator in een schakeling wordt toegepast.",
  "10.1.1": "Je kunt beschrijven welke effecten krachten op een voorwerp kunnen hebben.",
  "10.1.2": "Je kunt de grootte van een kracht met een geschikte krachtmeter meten.",
  "10.1.3": "Je kunt een kracht tekenen als een vector, volgens een gegeven krachtenschaal.",
  "10.1.4": "Je kunt de krachten benoemen die in een gegeven situatie op een voorwerp werken.",
  "10.1.5": "Je kunt de zwaartekracht berekenen die op een voorwerp werkt.",
  "10.1.6": "Je kunt beredeneren of twee magnetische voorwerpen elkaar aantrekken of afstoten.",
  "10.1.7": "Je kunt beredeneren of twee elektrisch geladen voorwerpen elkaar aantrekken of afstoten.",
  "10.2.1": "Je kunt aangeven of er trekkrachten of drukkrachten op een constructie werken.",
  "10.2.2": "Je kunt enkele belangrijke eigenschappen van staal, baksteen, beton en hout noemen.",
  "10.2.3": "Je kunt toelichten hoe staal, baksteen, beton en hout in constructies worden toegepast.",
  "10.2.4": "Je kunt uitleggen waar een ontwerper op let bij de keuze van een constructiemateriaal.",
  "10.2.5": "Je kunt uitleggen waarom in constructies driehoeken worden toegepast.",
  "10.3.1": "Je kunt situaties beschrijven waarin twee krachten elkaar opheffen.",
  "10.3.2": "Je kunt de resultante berekenen als twee (of meer) krachten in dezelfde richting werken.",
  "10.3.3": "Je kunt de resultante berekenen als twee krachten in tegenovergestelde richting werken.",
  "10.3.4": "Je kunt twee krachten samenstellen door een nauwkeurige tekening op schaal te maken.",
  "10.3.5": "Je kunt de grootte van getekende krachten bepalen met behulp van een krachtenschaal.",
  "10.4.1": "Je kunt beschrijven welke krachten werken op een voorwerp dat omhoog wordt gehesen.",
  "10.4.2": "Je kunt in twee gegeven richtingen een kracht op een voorwerp ontbinden.",
  "10.4.3": "Je kunt uitleggen welke rol krachten spelen bij het ontwerpen van een constructie.",
  "10.4.4": "Je kunt richting en grootte bepalen van de krachten die op een constructie werken.",
  "10.4.5": "Je kunt aangeven of een kracht op een constructie een druk- of een trekkracht is.",
  "11.1.1": "Je kunt de drie belangrijkste toepassingen van fossiele brandstoffen beschrijven.",
  "11.1.2": "Je kunt uitleggen hoe een ‘gewone’ energiecentrale elektrische energie produceert.",
  "11.1.3": "Je kunt berekeningen uitvoeren met (elektrische) energie, vermogen en tijd.",
  "11.1.4": "Je kunt uitleggen hoe een kerncentrale kernenergie omzet in elektrische energie.",
  "11.1.5": "Je kunt toelichten wat wordt bedoeld met de afvalwarmte van een energiecentrale.",
  "11.1.6": "Je kunt uitleggen wat thermische verontreiniging is en hoe je die kunt voorkomen.",
  "11.1.7": "Je kunt milieuproblemen beschrijven die horen bij het gebruik van fossiele brandstoffen.",
  "11.2.1": "Je kunt beschrijven hoe planten gebruikmaken van de stralingsenergie in zonlicht.",
  "11.2.2": "Je kunt benoemen welke energie-omzetting plaatsvindt in een zonnepaneel.",
  "11.2.3": "Je kunt uitleggen waardoor een zonnepaneel niet steeds hetzelfde vermogen afgeeft.",
  "11.2.4": "Je kunt uitleggen dat mensen met zonnepanelen energie én geld kunnen besparen.",
  "11.2.5": "Je kunt uitleggen wat wordt bedoeld met het rendement van een zonnepaneel.",
  "11.2.6": "Je kunt berekeningen uitvoeren met rendement en energie, en met rendement en vermogen.",
  "11.3.1": "Je kunt voorbeelden geven van hoe bewegingsenergie praktisch wordt gebruikt.",
  "11.3.2": "Je kunt berekeningen uitvoeren met bewegingsenergie, massa en snelheid.",
  "11.3.3": "Je kunt benoemen welke energie-omzetting plaatsvindt in een windturbine.",
  "11.3.4": "Je kunt een eenvoudige manier beschrijven om een wisselspanning op te wekken.",
  "11.3.5": "Je kunt uitleggen hoe de wisselspanning van een fietsdynamo ontstaat.",
  "11.3.6": "Je kunt uitleggen wat wordt bedoeld met het piekvermogen van een windturbine.",
  "11.4.1": "Je kunt uitleggen hoe een waterkrachtcentrale zwaarte-energie omzet in elektrische energie.",
  "11.4.2": "Je kunt berekeningen uitvoeren met zwaarte-energie, massa en hoogte.",
  "11.4.3": "Je kunt in berekeningen het verband tussen zwaarte-energie en bewegingsenergie toepassen.",
  "11.4.4": "Je kunt uitleggen op welke vier punten je energiebronnen met elkaar kunt vergelijken.",
  "11.4.5": "Je kunt voor- en nadelen noemen van de energiebronnen die in Nederland worden gebruikt.",
  "11.5.1": "Je kunt uitleggen wat de wet van behoud van energie inhoudt.",
  "11.5.2": "Je kunt toelichten wat precies wordt bedoeld met ‘zuinig zijn met energie’.",
  "11.5.3": "Je kunt twee manieren beschrijven waarop mensen energie kunnen besparen.",
  "11.5.4": "Je kunt de rendementen vergelijken van gloeilampen, spaarlampen en ledlampen.",
  "11.5.5": "Je kunt het energieverbruik van apparaten berekenen in joule en in kilowattuur.",
  "11.5.6": "Je kunt uitleggen hoe energielabels je kunnen helpen om een apparaat te kiezen.",
  "12.1.1": "Je kunt uitleggen hoe je de stroomkring door een apparaat opent en sluit.",
  "12.1.2": "Je kunt beredeneren in welke richting de stroom door een stroomkring beweegt.",
  "12.1.3": "Je kunt uitleggen of een diode de stroom doorlaat of tegenhoudt.",
  "12.1.4": "Je kunt uitleggen hoe je een led in een schakeling aansluit.",
  "12.1.5": "Je kunt berekeningen uitvoeren met de capaciteit, de stroomsterkte en de tijd.",
  "12.1.6": "Je kunt berekeningen uitvoeren met het vermogen, de spanning en de stroomsterkte.",
  "12.2.1": "Je kunt uitleggen wat het verschil is tussen hoogspanning, netspanning en veilige spanning.",
  "12.2.2": "Je kunt toelichten wat wordt bedoeld met: de netspanning in Nederland is 230 V / 50 Hz.",
  "12.2.3": "Je kunt uitleggen waarom veel apparaten een eigen adapter (netstekkervoeding) hebben.",
  "12.2.4": "Je kunt beschrijven hoe een transformator energie opneemt, omzet en weer afstaat.",
  "12.2.5": "Je kunt berekenen hoe een transformator de spanning transformeert.",
  "12.2.6": "Je kunt berekeningen uitvoeren met het opgenomen en afgegeven vermogen van een (ideale) transformator.",
  "12.3.1": "Je kunt herkennen of schakelonderdelen in serie of parallel zijn geschakeld.",
  "12.3.2": "Je kunt uitleggen waarom elektrische apparaten parallel worden geschakeld.",
  "12.3.3": "Je kunt de regels toepassen voor de spanning en stroomsterkte in een serieschakeling.",
  "12.3.4": "Je kunt de regels toepassen voor de spanning en stroomsterkte in een parallelschakeling.",
  "12.3.5": "Je kunt de vervangingsweerstand berekenen van een serie- en van een parallelschakeling.",
  "12.3.6": "Je kunt de formules voor vermogen en energie toepassen in serie- en parallelschakelingen.",
  "12.4.1": "Je kunt beschrijven hoe de elektrische installatie van een woonhuis in elkaar zit.",
  "12.4.2": "Je kunt uitleggen hoe geleiders en isolatoren in een huisinstallatie worden toegepast.",
  "12.4.3": "Je kunt beschrijven welke gevaren het gebruik van elektriciteit met zich meebrengt.",
  "12.4.4": "Je kunt uitleggen wat er precies aan de hand is bij kortsluiting en bij overbelasting.",
  "12.4.5": "Je kunt de functie beschrijven van zekeringen, aardlekschakelaars en aardleidingen.",
  "12.4.6": "Je kunt uitleggen hoe dubbele isolatie en transformatoren zorgen voor meer veiligheid.",
  "13.1.1": "Je kunt uitleggen hoe het geluid van een geluidsbron bij je oren komt.",
  "13.1.2": "Je kunt uitleggen hoe de conus van een luidspreker in trilling wordt gebracht.",
  "13.1.3": "Je kunt berekeningen uitvoeren met de geluidssnelheid, de ti jd en de afstand.",
  "13.1.4": "Je kunt uitleggen waarom je een echo iets later hoort dan het directe geluid.",
  "13.1.5": "Je kunt toelichten hoe je met een echolood de diepte van de zee kunt bepalen.",
  "13.2.1": "Je kunt de trillingsti jd van een toon bepalen aan de hand van een oscilloscoopbeeld.",
  "13.2.2": "Je kunt berekeningen uitvoeren met de trillingsti jd en de frequenti e van een geluidstrilling.",
  "13.2.3": "Je kunt een verband leggen tussen de frequenti e van een geluid en de toonhoogte.",
  "13.2.4": "Je kunt de bovengrens en ondergrens van het frequenti ebereik van de mens benoemen.",
  "13.2.5": "Je kunt uitleggen door welke drie factoren de toonhoogte van een snaar wordt bepaald.",
  "13.3.1": "Je kunt uitleggen wat wordt bedoeld met de amplitude van een (geluids)trilling.",
  "13.3.2": "Je kunt een verband leggen tussen de amplitude van een trilling en de geluidssterkte.",
  "13.3.3": "Je kunt de amplitude van een elektrisch signaal aflezen op een oscilloscoopscherm.",
  "13.3.4": "Je kunt uitleggen hoe je de geluidssterkte kunt meten in de eenheden dB en dB(A).",
  "13.3.5": "Je kunt toelichten waarom de dB(A)-schaal wordt gebruikt om geluidshinder te meten.",
  "13.3.6": "Je kunt uitleggen wat wordt bedoeld met de gehoordrempel en met de pijngrens.",
  "13.3.7": "Je kunt rekenen met het verband tussen het aantal geluidsbronnen en de geluidssterkte.",
  "13.4.1": "Je kunt drie soorten maatregelen noemen die de overheid neemt tegen geluidshinder.",
  "13.4.2": "Je kunt van elke soort maatregel tegen geluidshinder een praktisch voorbeeld geven.",
  "13.4.3": "Je kunt uitleggen welke soorten materiaal je nodig hebt om geluid te absorberen of te weerkaatsen.",
  "13.4.4": "Je kunt uitleggen van welke twee dingen het afhangt of er gehoorschade ontstaat.",
  "13.4.5": "Je kunt twee manieren noemen om je gehoor te beschermen in een lawaaiige omgeving.",
  "14.1.1": "Je kunt uitleggen wat wordt bedoeld met het moment van een kracht.",
  "14.1.2": "Je kunt berekeningen uitvoeren met het moment, de kracht en de arm.",
  "14.1.3": "Je kunt uitleggen waar het van afhangt of een hefboom in evenwicht is.",
  "14.1.4": "Je kunt krachten en armen berekenen met behulp van de momentenwet.",
  "14.1.5": "Je kunt herkennen of een werktuig een enkele of een dubbele hefboom is.",
  "14.2.1": "Je kunt uitleggen wat wordt bedoeld met het zwaartepunt van een voorwerp.",
  "14.2.2": "Je kunt het zwaartepunt aangeven van een homogene balk.",
  "14.2.3": "Je kunt beredeneren of je de zwaartekracht op een hefb oom wel of niet moet meerekenen, als je de momentenwet gebruikt.",
  "14.2.4": "Je kunt berekeningen uitvoeren met de momentenwet en daarbij ook de zwaartekracht op de hefb oom meerekenen.",
  "14.3.1": "Je kunt uitleggen wat wordt bedoeld met een vaste katrol en met een losse katrol.",
  "14.3.2": "Je kunt met een tekening uitleggen hoe een takel in elkaar zit.",
  "14.3.3": "Je kunt uit het aantal katrollen van een takel afleiden hoeveel keer de hijskracht wordt vergroot en hoeveel keer de hijsafstand wordt verkleind.",
  "14.3.4": "Je kunt berekeningen uitvoeren met de rekenregel voor takels.",
  "14.4.1": "Je kunt uitleggen welke twee dingen het vervormend effect van een kracht bepalen.",
  "14.4.2": "Je kunt benoemen wat druk is en in welke eenheden deze grootheid wordt gemeten.",
  "14.4.3": "Je kunt berekeningen uitvoeren met de druk, de kracht en de oppervlakte.",
  "14.4.4": "Je kunt een gegeven druk omrekenen van N/cm2 naar Pa en omgekeerd.",
  "14.4.5": "Je kunt voorbeelden geven van situaties waarin je de druk bewust klein houdt of vergroot.",
  "15.1.1": "Je kunt twee manieren beschrijven om bewegingen op beeld vast te leggen.",
  "15.1.2": "Je kunt uit foto’s of videobeelden gegevens halen over de tijd en de afstand.",
  "15.1.3": "Je kunt de gegevens van een afstand-tijdtabel verwerken tot een (s,t)-diagram.",
  "15.1.4": "Je kunt berekeningen maken met gemiddelde snelheid, afstand en tijd.",
  "15.1.5": "Je kunt snelheden omrekenen van m/s naar km/h, en van km/h naar m/s.",
  "15.2.1": "Je kunt een (v,t)-diagram van een beweging maken.",
  "15.2.2": "Je kunt het (v,t)-diagram en het (s,t)-diagram van een eenparige beweging schetsen.",
  "15.2.3": "Je kunt berekeningen uitvoeren met de snelheid van een eenparige beweging.",
  "15.2.4": "Je kunt uitleggen wat wordt bedoeld met een eenparig versnelde beweging.",
  "15.2.5": "Je kunt de versnelling van een eenparig versnelde beweging berekenen.",
  "15.3.1": "Je kunt berekeningen uitvoeren met de snelheid bij een eenparig versnelde beweging.",
  "15.3.2": "Je kunt het (v,t)-diagram en het (s,t)-diagram van een eenparig versnelde beweging schetsen.",
  "15.3.3": "Je kunt de afstand berekenen die tijdens een eenparig versnelde beweging is afgelegd.",
  "15.3.4": "Je kunt berekeningen uitvoeren over valbewegingen met verwaarloosbare luchtweerstand.",
  "15.4.1": "Je kunt uitleggen wat wordt bedoeld met een eenparig vertraagde beweging.",
  "15.4.2": "Je kunt de vertraging van een eenparig vertraagde beweging berekenen.",
  "15.4.3": "Je kunt berekeningen uitvoeren met de snelheid bij een eenparig vertraagde beweging.",
  "15.4.4": "Je kunt het (v,t)-diagram en het (s,t)-diagram van een eenparig vertraagde beweging schetsen.",
  "15.4.5": "Je kunt de afstand berekenen die tijdens een eenparig vertraagde beweging is afgelegd.",
  "15.4.6": "Je kunt uitleggen wat wordt bedoeld met de stopafstand, de reactie-afstand en de remweg.",
  "16.1.1": "Je kunt beschrijven hoe de luchtwrijving en de rolwrijving een beweging tegenwerken.",
  "16.1.2": "Je kunt drie manieren noemen om tegenwerkende krachten te verminderen.",
  "16.1.3": "Je kunt uitleggen wat wordt bedoeld met de nettokracht op een bewegend voorwerp.",
  "16.1.4": "Je kunt aangeven hoe een voorwerp beweegt, als je de nettokracht op dat voorwerp kent.",
  "16.1.5": "Je kunt beschrijven hoe de nettokracht een voorwerp van richting kan laten veranderen.",
  "16.2.1": "Je kunt uitleggen waaraan je kunt merken dat een voorwerp een grote traagheid heeft.",
  "16.2.2": "Je kunt het verband benoemen tussen de massa van een voorwerp en zijn traagheid.",
  "16.2.3": "Je kunt berekeningen uitvoeren met kracht, massa en versnelling.",
  "16.3.1": "Je kunt uitleggen hoe een automobilist een verantwoorde, veilige snelheid kan kiezen.",
  "16.3.2": "Je kunt toelichten hoe de tweesecondenregel helpt om voldoende afstand te bewaren.",
  "16.3.3": "Je kunt met voorbeelden uitleggen dat de apk zorgt voor meer veiligheid op de weg.",
  "16.3.4": "Je kunt de functie beschrijven van de kooiconstructie en de kreukelzone van een auto.",
  "16.3.5": "Je kunt uitleggen hoe veiligheidsgordels, airbags en veiligheidshelmen de krachten bij een botsing verkleinen.",
  "16.4.1": "Je kunt berekeningen uitvoeren met arbeid, kracht en afstand.",
  "16.4.2": "Je kunt uitleggen waarom 1 Nm arbeid op hetzelfde neerkomt als 1 J arbeid.",
  "16.4.3": "Je kunt berekeningen uitvoeren in situaties waarin de zwaarte-energie op het hoogste punt gelijk is aan de bewegingsenergie op het laagste punt."
 }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const KALIBRATIE_REGELS: any = {
 "correctie": {
  "rekenfout": -1,
  "eenheid_fout_of_ontbreekt": -1,
  "max_aftrek_reken_plus_eenheid": -1,
  "significantie_aftrek": 0,
  "tussentijds_afronden_aftrek": 0,
  "formulepunt_vereist": "grootheid benoemd (woord of symbool) + formule inhoudelijk juist ingevuld; alleen een rekenbewerking is niet genoeg",
  "mc_punten": 1,
  "omcirkel_2_keuzes_1p": "punt alleen als beide keuzes juist",
  "grafiek_3p": [
   "as juist ingedeeld (>=2/3 gebruikt)",
   "meetpunten juist uitgezet (1 fout punt niet aanrekenen)",
   "vloeiende/rechte lijn"
  ],
  "grafiek_4p_extra": "uitschieter negeren",
  "schakelschema": [
   "juiste symbolen",
   "juiste serie/parallel plaatsing",
   "(gesloten kring; extra niet-werkende componenten -1)"
  ],
  "krachtvector": [
   "aangrijpingspunt + richting",
   "lengte binnen ±0,2 cm",
   "(grootte noteren consequent met lengte)"
  ],
  "doorwerkfout": "alleen expliciet bij meerdelige vragen: tweede deel 'consequent met' eerste deel"
 },
 "templates": {
  "2p": [
   "gebruik van de formule <formule> (grootheid benoemd)",
   "rest van de berekening juist (uitkomst + eenheid)"
  ],
  "3p_omrekenen": [
   "juist omrekenen van <grootheid> (mA->A, min->s/h, km/h->m/s, kWh<->J, g->kg)",
   "gebruik van de formule",
   "rest van de berekening juist"
  ],
  "3p_aflezen": [
   "noteren/aflezen/opzoeken van de juiste waarde (grafiek, tabel, Binas, rendement uit diagram)",
   "gebruik van de formule",
   "rest van de berekening juist"
  ],
  "3p_conclusie": [
   "gebruik van de formule",
   "rest van de berekening juist",
   "conclusie/stof noteren consequent met uitkomst"
  ],
  "4p_GT": [
   "aflezen (bv. trillingstijd uit oscilloscoopbeeld)",
   "omrekenen",
   "gebruik van de formule",
   "rest van de berekening juist"
  ]
 },
 "context": {
  "titel_woorden": [
   2,
   4
  ],
  "namen": "precies één verzonnen voornaam per context, divers (NL + meercultureel), geen achternaam",
  "verboden": [
   "echte schoolnamen",
   "echte bedrijfs-/merknamen",
   "echte personen"
  ],
  "school_context_max_pct": 10,
  "categorieen": [
   "huis & keuken",
   "verkeer & vervoer",
   "techniek & apparaat",
   "werk & beroep",
   "sport & vrije tijd",
   "natuur & milieu",
   "school & practicum (spaarzaam)"
  ],
  "opbouw": "titel -> intro -> per vraag 1-2 zinnen nieuwe gegevens -> opdrachtregel met bolletje",
  "volgorde_in_context": "herkennen -> rekenen -> redeneren/tekenen"
 },
 "opdrachtwoorden": {
  "kern": [
   "Bereken",
   "Noteer",
   "Omcirkel in elke zin de juiste mogelijkheid",
   "Maak … compleet",
   "Zet … uit en teken de grafiek",
   "Teken",
   "Zet een kruisje / Kruis aan"
  ],
  "mc_vraagzin": [
   "Wat is juist over …?",
   "Welke afbeelding/schakeling …?",
   "Hoe heet …?",
   "In welke zone …?"
  ],
  "alleen_GT": [
   "Construeer",
   "Toon met een berekening aan",
   "Leg uit (spaarzaam)",
   "Bepaal"
  ],
  "havo_niet_voor_vmbo": [
   "Toon aan",
   "Beredeneer",
   "Schat",
   "Leg uit (als hoofdvorm)"
  ]
 }
};
