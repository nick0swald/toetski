import { SCHOOL } from "./constants";
import { bouwMatrijs } from "./rtti";
import type { GegenereerdeToets } from "./types";

export const VOORBEELD_LESSTOF = `Lesstof klas 2 KB Biologie — Fotosynthese en ademhaling
Ares058 VMBO Leeuwarden, praktijkkas.

Fotosynthese is het proces waarbij groene planten glucose en zuurstof maken. Daarvoor hebben ze water, koolstofdioxide (CO₂) en licht nodig. De woordvergelijking is:

water + koolstofdioxide + licht → glucose + zuurstof

Fotosynthese gebeurt in de bladgroenkorrels (chloroplasten) van vooral de bladeren. Licht levert de energie. Zonder licht geen (netto) fotosynthese.

Huidmondjes zijn kleine openingen in het blad. Via huidmondjes neemt de plant CO₂ op en staat ze waterdamp af (transpiratie).

Dissimilatie (celademhaling) is het omgekeerde: glucose + zuurstof → energie + CO₂ + water. Dat gaat dag en nacht door.

Leerdoelen
- De leerling kan fotosynthese in eigen woorden omschrijven.
- De leerling kent de woordvergelijking.
- De leerling koppelt chloroplasten en huidmondjes aan hun functie.
- De leerling verklaart een CO₂-verloop in de kas overdag en ’s nachts.
`;

export const VOORBEELD_TOETS_TEKST = `Toets Biologie klas 2 KB — Fotosynthese
Ares058 VMBO Leeuwarden · 50 minuten · 20 punten

1. Wat is fotosynthese? Geef een omschrijving in één of twee zinnen. (2p)

2. Vul de woordvergelijking van fotosynthese aan:
   water + …… + licht → glucose + …… (2p)

3. In welk deel van de plantencel vindt fotosynthese plaats? (1p)
   A celkern
   B bladgroenkorrel (chloroplast)
   C vacuole
   D celwand

4. Via welke openingen in het blad verliest de plant waterdamp? (1p)
   A houtvaten
   B huidmondjes
   C wortelharen
   D nerf

5. Plant A bij het raam, plant B in een donkere kast.
   a. Noem twee stoffen die plant A wél kan maken. (2p)
   b. Leg uit waarom licht hiervoor nodig is. (1p)

6. Tabel CO₂: 07:00 = 620 ppm, 12:00 = 410 ppm.
   a. Hoeveel ppm lager is het gehalte om 12:00? (1p)
   b. Geef een verklaring. (2p)

7. ’s Nachts stijgt het CO₂-gehalte in de kas. Verklaar dat. (4p)

8. In januari is er weinig daglicht. Leg uit waarom de planten dan toch weinig groeien. (2p)
`;

const vragen: GegenereerdeToets["vragen"] = [
  {
    nummer: 1,
    type: "open",
    rtti: "R",
    domein: "Fotosynthese",
    leerdoel: "De leerling kan fotosynthese in eigen woorden omschrijven.",
    punten: 2,
    stam: "Wat is fotosynthese? Geef een omschrijving in één of twee zinnen.",
  },
  {
    nummer: 2,
    type: "invul",
    rtti: "R",
    domein: "Fotosynthese",
    leerdoel: "De leerling kent de woordvergelijking van fotosynthese.",
    punten: 3,
    stam: "Vul de woordvergelijking van fotosynthese aan:\n\nwater + ……………… + ……………… → glucose + ………………",
  },
  {
    nummer: 3,
    type: "meerkeuze",
    rtti: "R",
    domein: "Fotosynthese",
    leerdoel: "De leerling koppelt chloroplasten aan fotosynthese.",
    punten: 1,
    stam: "In welk deel van de plantencel vindt fotosynthese plaats?",
    opties: [
      { letter: "A", tekst: "celkern" },
      { letter: "B", tekst: "bladgroenkorrel (chloroplast)" },
      { letter: "C", tekst: "vacuole" },
      { letter: "D", tekst: "celwand" },
    ],
  },
  {
    nummer: 4,
    type: "meerkeuze",
    rtti: "T1",
    domein: "Gaswisseling",
    leerdoel: "De leerling koppelt huidmondjes aan transpiratie.",
    punten: 1,
    stam: "Een tomaat in de kas van Ares058 heeft op een warme dag veel water nodig. Via welke openingen in het blad verliest de plant waterdamp?",
    opties: [
      { letter: "A", tekst: "houtvaten" },
      { letter: "B", tekst: "huidmondjes" },
      { letter: "C", tekst: "wortelharen" },
      { letter: "D", tekst: "nerf" },
    ],
  },
  {
    nummer: 5,
    type: "open",
    rtti: "T1",
    domein: "Fotosynthese",
    leerdoel: "De leerling past fotosynthese toe in een bekende context.",
    punten: 3,
    stam: "Twee basilicumplantjes. Plant A bij het raam, plant B in een donkere kast.\n\na. Noem twee stoffen die plant A wél kan maken en plant B bijna niet. (2p)\n\nb. Leg uit waarom licht hiervoor nodig is. (1p)",
  },
  {
    nummer: 6,
    type: "bronvraag",
    rtti: "T2",
    domein: "Gaswisseling",
    leerdoel: "De leerling verklaart een CO₂-verloop.",
    punten: 3,
    stam: "Tabel CO₂ in de oefenkas: 07:00 = 620 ppm, 12:00 = 410 ppm.\n\na. Hoeveel ppm lager is het gehalte om 12:00 dan om 07:00? (1p)\n\nb. Geef een verklaring voor deze daling. (2p)",
  },
  {
    nummer: 7,
    type: "open",
    rtti: "I",
    domein: "Ademhaling",
    leerdoel: "De leerling verklaart nachtelijke CO₂-stijging.",
    punten: 4,
    stam: "’s Nachts stijgt het CO₂-gehalte in de kas. Verklaar dat. Gebruik fotosynthese en dissimilatie.",
  },
  {
    nummer: 8,
    type: "open",
    rtti: "T2",
    domein: "Fotosynthese",
    leerdoel: "De leerling koppelt lichtgebrek aan groei.",
    punten: 2,
    stam: "In januari is de kas 20 °C, maar er is weinig daglicht. Leg uit waarom de planten dan toch weinig groeien.",
  },
];

const nakijkmodel: GegenereerdeToets["nakijkmodel"] = [
  {
    nummer: 1,
    modelantwoord:
      "Fotosynthese is het proces waarbij groene planten met water, CO₂ en licht glucose en zuurstof maken.",
    puntenverdeling: [
      { punt: 1, criterium: "noemt glucose / suiker" },
      { punt: 1, criterium: "noemt licht en/of CO₂ / water, of zuurstof als product" },
    ],
  },
  {
    nummer: 2,
    modelantwoord: "water + koolstofdioxide / CO₂ + licht → glucose + zuurstof",
    puntenverdeling: [
      { punt: 1, criterium: "koolstofdioxide / CO₂" },
      { punt: 1, criterium: "licht" },
      { punt: 1, criterium: "zuurstof" },
    ],
  },
  { nummer: 3, modelantwoord: "B", puntenverdeling: [{ punt: 1, criterium: "B — bladgroenkorrel" }] },
  { nummer: 4, modelantwoord: "B", puntenverdeling: [{ punt: 1, criterium: "B — huidmondjes" }] },
  {
    nummer: 5,
    modelantwoord: "a. glucose en zuurstof. b. Zonder licht geen fotosynthese.",
    puntenverdeling: [
      { punt: 1, criterium: "a. glucose" },
      { punt: 1, criterium: "a. zuurstof" },
      { punt: 1, criterium: "b. licht nodig voor fotosynthese" },
    ],
  },
  {
    nummer: 6,
    modelantwoord: "a. 210 ppm. b. Overdag fotosynthese: planten nemen CO₂ op.",
    puntenverdeling: [
      { punt: 1, criterium: "a. 210" },
      { punt: 1, criterium: "b. fotosynthese / opname CO₂" },
      { punt: 1, criterium: "b. koppelt aan overdag / licht" },
    ],
  },
  {
    nummer: 7,
    modelantwoord:
      "’s Nachts geen fotosynthese. Dissimilatie gaat door: daarbij komt CO₂ vrij.",
    puntenverdeling: [
      { punt: 1, criterium: "geen fotosynthese ’s nachts" },
      { punt: 1, criterium: "dissimilatie gaat door" },
      { punt: 1, criterium: "daarbij komt CO₂ vrij" },
      { punt: 1, criterium: "plant leeft van glucosevoorraad" },
    ],
  },
  {
    nummer: 8,
    modelantwoord: "Weinig licht → weinig fotosynthese → weinig groei, ook bij 20 °C.",
    puntenverdeling: [
      { punt: 1, criterium: "tekort aan licht" },
      { punt: 1, criterium: "koppelt licht aan fotosynthese / groei" },
    ],
  },
];

export function maakVoorbeeldToets(): GegenereerdeToets {
  const doelverdeling = { R: 35, T1: 40, T2: 20, I: 5 };
  return {
    id: "voorbeeld-fotosynthese",
    createdAt: new Date().toISOString(),
    bronmateriaal: "Lesstof klas 2 KB biologie: fotosynthese, dissimilatie, huidmondjes. Praktijkkas Ares058.",
    extraEisen: "Voorbeeldtoets — geen AI-aanroep.",
    ronde: 1,
    cijferNorm: { model: "lineair", cesuurPct: 55, exponent: 1 },
    meta: {
      titel: "Fotosynthese en ademhaling",
      vak: "Biologie",
      leerweg: "KB",
      leerjaar: 2,
      duurMinuten: 50,
      school: SCHOOL,
      hulpmiddelen: ["Geen biologieboek"],
      instructies: [
        "Deze toets bestaat uit 8 vragen. Het maximumscore is 19 punten.",
        "Lees elke vraag rustig door.",
        "Het cijfer wordt berekend met: cijfer = 1 + 9 × (score / 19).",
      ],
      onderwerp: "Fotosynthese, gaswisseling en dissimilatie",
      versie: "A",
      moeilijkheid: "normaal",
    },
    vragen,
    nakijkmodel,
    cesuur: {
      nTerm: 1,
      cesuurPunten: 10,
      toelichting: "Een 5,5 bij 10 van de 19 punten. Lineaire omzetting.",
      formule: "cijfer = 1 + 9 × (behaalde punten / 19)",
    },
    matrijs: bouwMatrijs(vragen, doelverdeling),
    kwaliteit: {
      samenvatting:
        "Evenwichtige onderbouwtoets met groene Ares058-context. Geschikt als sectievoorbeeld; altijd zelf vakinhoudelijk nalopen.",
      punten: [
        { criterium: "Validiteit", oordeel: "voldoet", toelichting: "Dekking van fotosynthese, gaswisseling en dissimilatie." },
        { criterium: "Betrouwbaarheid / nakijkmodel", oordeel: "voldoet", toelichting: "Puntenverdeelsleutel per vraag." },
        { criterium: "RTTI-spreiding", oordeel: "voldoet", toelichting: "Spreiding over R, T1, T2 en I." },
        { criterium: "Taal (VMBO KB)", oordeel: "voldoet", toelichting: "Korte zinnen, bekende woorden." },
        { criterium: "Transparantie", oordeel: "voldoet", toelichting: "Punten staan per vraag." },
        { criterium: "Cito-opmaak", oordeel: "voldoet", toelichting: "Nummering, punten, meerkeuze A–D." },
      ],
    },
  };
}
