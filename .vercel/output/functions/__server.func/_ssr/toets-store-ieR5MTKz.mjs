import { s as SCHOOL } from "./constants-C-iIXaRj.mjs";
import { n as bouwMatrijs, r as herbouwMatrijs } from "./rtti-B_X4rMyX.mjs";
import { t as withDefaults } from "./defaults-gTpbcpJZ.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/toets-store-ieR5MTKz.js
var VOORBEELD_LESSTOF = `Lesstof klas 2 KB Biologie — Fotosynthese en ademhaling
Aeres VMBO Leeuwarden, praktijkkas.

Fotosynthese is het proces waarbij groene planten glucose en zuurstof maken. Daarvoor hebben ze water, koolstofdioxide (CO₂) en licht nodig. De woordvergelijking is:

water + koolstofdioxide + licht → glucose + zuurstof

Fotosynthese gebeurt in de bladgroenkorrels (chloroplasten) van vooral de bladeren. Licht levert de energie. Zonder licht geen (netto) fotosynthese.

Huidmondjes zijn kleine openingen in het blad. Via huidmondjes neemt de plant CO₂ op en staat ze waterdamp af (transpiratie). Op een warme dag in de kas verliest een tomaat zo veel water.

Dissimilatie (celademhaling) is het omgekeerde: glucose + zuurstof → energie + CO₂ + water. Dat gaat dag en nacht door. ’s Nachts is er geen licht, dus geen fotosynthese, terwijl dissimilatie doorgaat. Daardoor stijgt het CO₂-gehalte in een kas ’s nachts.

Kringloop: planten maken glucose en zuurstof. Mensen en dieren gebruiken die bij ademhaling en leveren CO₂ terug. In de kas van Aeres sturen we licht, water en CO₂ om groei te sturen.

Leerdoelen
- De leerling kan fotosynthese in eigen woorden omschrijven.
- De leerling kent de woordvergelijking.
- De leerling koppelt chloroplasten en huidmondjes aan hun functie.
- De leerling verklaart een CO₂-verloop in de kas overdag en ’s nachts.
`;
var VOORBEELD_NASK_LESSTOF = `Lesstof klas 2 KB NaSk — Temperatuur, warmte en meten
Aeres VMBO Leeuwarden, praktijkkas.

Temperatuur meet je in °C. Warmte is energie in joule (J). Bij het verwarmen van water geldt:

Q = m × c × ΔT

m in kg, c van water ≈ 4,2 kJ/(kg·°C), ΔT in °C.

Significantie: een schoolthermometer geeft 1 decimaal. Reken daarna niet meer cijfers. Meetonzekerheid van deze thermometer: ±0,5 °C.

In de kas maten we de luchttemperatuur bij het raam. Tabel:

tijdstip t (min) | temperatuur T (°C)
0 | 18,0
10 | 21,5
20 | 24,0
30 | 25,5
40 | 26,0

De grafiek van T tegen t is in het begin steil en vlakt daarna af: de kas warmt op tot een evenwicht.

Leerdoelen
- De leerling leest een tabel en een grafiek van T tegen t af.
- De leerling berekent ΔT en gebruikt Q = m × c × ΔT met eenheden.
- De leerling noemt meetonzekerheid bij een thermometeraflezing.
`;
var VOORBEELD_TOETS_TEKST = `Toets Biologie klas 2 KB — Fotosynthese
Aeres VMBO Leeuwarden · 50 minuten · 20 punten

1. Wat is fotosynthese? Geef een omschrijving in één of twee zinnen. (2p)

2. Vul de woordvergelijking van fotosynthese aan:
   water + …… + licht → glucose + …… (2p)

3. In welk deel van de plantencel vindt fotosynthese plaats? (1p)
   A celkern
   B bladgroenkorrel (chloroplast)
   C vacuole
   D celwand

4. Een tomaat in de kas heeft op een warme dag veel water nodig. Via welke openingen in het blad verliest de plant waterdamp? (1p)
   A houtvaten
   B huidmondjes
   C wortelharen
   D nerf

5. Twee basilicumplantjes. Plant A bij het raam, plant B in een donkere kast. Beide evenveel water.
   a. Noem twee stoffen die plant A wél kan maken en plant B bijna niet. (2p)
   b. Leg uit waarom licht hiervoor nodig is. Gebruik het woord fotosynthese. (1p)

6. Tabel CO₂ in de oefenkas: 07:00 = 620 ppm, 12:00 = 410 ppm.
   a. Hoeveel ppm lager is het gehalte om 12:00 dan om 07:00? (1p)
   b. Geef een verklaring voor deze daling. (2p)

7. ’s Nachts stijgt het CO₂-gehalte in de kas. Verklaar dat. Gebruik fotosynthese en dissimilatie. (4p)

8. In januari is er weinig daglicht, de kas is 20 °C.
   a. Leg uit waarom de planten dan toch weinig groeien. (2p)
   b. Noem één voordeel en één nadeel van extra belichting. (2p)
`;
var vragen = [
	{
		nummer: 1,
		type: "open",
		rtti: "R",
		domein: "Fotosynthese",
		leerdoel: "De leerling kan fotosynthese in eigen woorden omschrijven.",
		punten: 2,
		stam: "Wat is fotosynthese? Geef een omschrijving in één of twee zinnen."
	},
	{
		nummer: 2,
		type: "invul",
		rtti: "R",
		domein: "Fotosynthese",
		leerdoel: "De leerling kent de woordvergelijking van fotosynthese.",
		punten: 3,
		stam: "Vul de woordvergelijking van fotosynthese aan:\n\nwater + ……………… + ……………… → glucose + ………………"
	},
	{
		nummer: 3,
		type: "meerkeuze",
		rtti: "R",
		domein: "Celorganellen",
		leerdoel: "De leerling koppelt chloroplasten aan fotosynthese.",
		punten: 1,
		stam: "In welk deel van de plantencel vindt fotosynthese plaats?",
		opties: [
			{
				letter: "A",
				tekst: "celkern"
			},
			{
				letter: "B",
				tekst: "bladgroenkorrel (chloroplast)"
			},
			{
				letter: "C",
				tekst: "vacuole"
			},
			{
				letter: "D",
				tekst: "celwand"
			}
		]
	},
	{
		nummer: 4,
		type: "meerkeuze",
		rtti: "T1",
		domein: "Gaswisseling",
		leerdoel: "De leerling herkent de rol van huidmondjes.",
		punten: 1,
		stam: "Een tomaat in de kas van Aeres heeft op een warme dag veel water nodig. Via welke openingen in het blad verliest de plant waterdamp?",
		opties: [
			{
				letter: "A",
				tekst: "houtvaten"
			},
			{
				letter: "B",
				tekst: "huidmondjes"
			},
			{
				letter: "C",
				tekst: "wortelharen"
			},
			{
				letter: "D",
				tekst: "nerf"
			}
		]
	},
	{
		nummer: 5,
		type: "open",
		rtti: "T1",
		domein: "Fotosynthese",
		leerdoel: "De leerling past de voorwaarden voor fotosynthese toe.",
		punten: 3,
		context: "Leerlingen van klas 2 KB zetten twee even grote basilicumplantjes in de praktijklokalen. Plant A krijgt een plek bij het raam. Plant B zetten ze in een donkere kast. Beide planten krijgen evenveel water.",
		stam: "Na tien dagen is plant A groener en groter dan plant B.\n\na. Noem twee stoffen die plant A wél kan maken en plant B bijna niet. (2p)\n\nb. Leg uit waarom licht hiervoor nodig is. Gebruik het woord fotosynthese. (1p)"
	},
	{
		nummer: 6,
		type: "berekening",
		rtti: "T1",
		domein: "Gaswisseling",
		leerdoel: "De leerling leest een eenvoudige tabel af.",
		punten: 3,
		context: "Tabel 1 – CO₂-gehalte in een oefenkas (gemiddelde van drie metingen)\n\nTijdstip | CO₂ (ppm)\n07:00 | 620\n12:00 | 410\n19:00 | 480\n23:00 | 590",
		stam: "a. Hoeveel ppm lager is het CO₂-gehalte om 12:00 dan om 07:00? (1p)\n\nb. Geef een verklaring voor deze daling. (2p)"
	},
	{
		nummer: 7,
		type: "bronvraag",
		rtti: "T2",
		domein: "Ademhaling",
		leerdoel: "De leerling verklaart een CO₂-verloop in de kas ’s nachts.",
		punten: 4,
		context: "Bron 1 – CO₂-verloop in de oefenkas van Aeres (één etmaal, geen extra belichting).",
		stam: "’s Nachts stijgt het CO₂-gehalte in de kas, terwijl overdag het gehalte daalt. Verklaar het nachtelijke verloop. Gebruik de woorden fotosynthese en dissimilatie."
	},
	{
		nummer: 8,
		type: "open",
		rtti: "T2",
		domein: "Fotosynthese",
		leerdoel: "De leerling past voorwaarden voor groei toe op een nieuwe seizoenscontext.",
		punten: 4,
		context: "In januari is de kas 20 °C, maar er is weinig daglicht. Een collega overweegt extra belichting.",
		stam: "a. Leg uit waarom de planten in januari weinig groeien, ondanks de temperatuur. (2p)\n\nb. Noem één voordeel en één nadeel van extra belichting. (2p)"
	},
	{
		nummer: 9,
		type: "juist-onjuist",
		rtti: "T1",
		domein: "Ademhaling",
		leerdoel: "De leerling onderscheidt fotosynthese en dissimilatie.",
		punten: 2,
		stam: "Zet bij elke uitspraak juist of onjuist.\n\n1. Dissimilatie vindt alleen overdag plaats.\n2. Alleen groene planten kunnen fotosynthese uitvoeren."
	},
	{
		nummer: 10,
		type: "open",
		rtti: "I",
		domein: "Kringloop",
		leerdoel: "De leerling legt de onderlinge afhankelijkheid van planten en mensen uit.",
		punten: 4,
		stam: "Iemand zegt: “Mensen hebben planten nodig voor zuurstof, verder niet.” Leg uit waarom die uitspraak te kort door de bocht is. Gebruik fotosynthese en ademhaling."
	}
];
var nakijkmodel = [
	{
		nummer: 1,
		modelantwoord: "Fotosynthese is het proces waarbij groene planten met water, CO₂ en licht glucose (suiker) en zuurstof maken.",
		puntenverdeling: [{
			punt: 1,
			criterium: "noemt glucose / suiker / voedsel maken"
		}, {
			punt: 1,
			criterium: "noemt licht en/of CO₂ / water als voorwaarde, of zuurstof als product"
		}]
	},
	{
		nummer: 2,
		modelantwoord: "water + koolstofdioxide / CO₂ + licht → glucose + zuurstof",
		puntenverdeling: [
			{
				punt: 1,
				criterium: "koolstofdioxide / CO₂"
			},
			{
				punt: 1,
				criterium: "licht (energie)"
			},
			{
				punt: 1,
				criterium: "zuurstof"
			}
		]
	},
	{
		nummer: 3,
		modelantwoord: "B",
		puntenverdeling: [{
			punt: 1,
			criterium: "B — bladgroenkorrel / chloroplast"
		}]
	},
	{
		nummer: 4,
		modelantwoord: "B",
		puntenverdeling: [{
			punt: 1,
			criterium: "B — huidmondjes"
		}]
	},
	{
		nummer: 5,
		modelantwoord: "a. glucose (suiker) en zuurstof.\nb. Zonder licht kan er geen fotosynthese plaatsvinden; licht levert de energie voor het proces.",
		puntenverdeling: [
			{
				punt: 1,
				criterium: "a. glucose / suiker / zetmeel"
			},
			{
				punt: 1,
				criterium: "a. zuurstof"
			},
			{
				punt: 1,
				criterium: "b. licht is nodig voor fotosynthese / als energiebron"
			}
		],
		nietToekennen: ["Alleen “hij krijgt geen zon” zonder koppeling aan fotosynthese."]
	},
	{
		nummer: 6,
		modelantwoord: "a. 620 − 410 = 210 ppm.\nb. Overdag fotosynthese: planten nemen CO₂ op (en maken glucose).",
		puntenverdeling: [
			{
				punt: 1,
				criterium: "a. 210 (ppm)"
			},
			{
				punt: 1,
				criterium: "b. noemt fotosynthese of opname van CO₂ door de plant"
			},
			{
				punt: 1,
				criterium: "b. koppelt dit aan overdag / licht / bladgroen"
			}
		]
	},
	{
		nummer: 7,
		modelantwoord: "’s Nachts is er geen licht, dus geen (netto) fotosynthese. De plant blijft wel dissimileren (celademhaling): glucose + zuurstof → energie + CO₂ + water. Daardoor stijgt het CO₂-gehalte. De plant leeft omdat hij van zijn glucosevoorraad teert.",
		puntenverdeling: [
			{
				punt: 1,
				criterium: "geen / weinig fotosynthese ’s nachts (geen licht)"
			},
			{
				punt: 1,
				criterium: "dissimilatie / celademhaling gaat door"
			},
			{
				punt: 1,
				criterium: "daarbij komt CO₂ vrij"
			},
			{
				punt: 1,
				criterium: "plant leeft van glucosevoorraad / gebruikt opgeslagen suiker"
			}
		]
	},
	{
		nummer: 8,
		modelantwoord: "a. In januari is er weinig licht; zonder licht weinig fotosynthese, dus weinig groei, ook bij 20 °C.\nb. Voordeel: meer fotosynthese / hogere opbrengst / kortere teeltduur. Nadeel: energiekosten / hogere CO₂-voetafdruk / ongelijke groei bij verkeerd spectrum.",
		puntenverdeling: [
			{
				punt: 1,
				criterium: "a. noemt tekort aan licht in januari"
			},
			{
				punt: 1,
				criterium: "a. koppelt licht aan fotosynthese / groei"
			},
			{
				punt: 1,
				criterium: "b. een juist voordeel"
			},
			{
				punt: 1,
				criterium: "b. een juist nadeel"
			}
		]
	},
	{
		nummer: 9,
		modelantwoord: "1 onjuist · 2 juist",
		puntenverdeling: [{
			punt: 1,
			criterium: "1 onjuist (dissimilatie gaat dag en nacht door)"
		}, {
			punt: 1,
			criterium: "2 juist (alleen groene planten / fotosynthese)"
		}]
	},
	{
		nummer: 10,
		modelantwoord: "Planten maken via fotosynthese glucose én zuurstof. Mensen (en dieren) gebruiken die glucose als voedsel en de zuurstof bij ademhaling. Bij ademhaling komt CO₂ vrij, die planten weer gebruiken. Zonder planten geen (duurzame) zuurstof en geen voedsel; zonder CO₂ van ademhaling/verbranding verloopt fotosynthese moeizamer. Het is een kringloop, geen eenrichtingsverkeer van alleen zuurstof.",
		puntenverdeling: [
			{
				punt: 1,
				criterium: "planten maken glucose (voedsel) én zuurstof"
			},
			{
				punt: 1,
				criterium: "mensen gebruiken zuurstof én (plantaardige) glucose"
			},
			{
				punt: 1,
				criterium: "mensen/dieren leveren CO₂ terug"
			},
			{
				punt: 1,
				criterium: "beschrijft onderlinge afhankelijkheid / kringloop"
			}
		]
	}
];
function maakVoorbeeldToets() {
	return {
		id: "voorbeeld-fotosynthese",
		createdAt: (/* @__PURE__ */ new Date()).toISOString(),
		bronmateriaal: "Lesstof klas 2 KB biologie: fotosynthese, dissimilatie, huidmondjes, chloroplasten. Praktijkkas Aeres.",
		extraEisen: "Voorbeeldtoets — geen AI-aanroep.",
		ronde: 1,
		cijferNorm: {
			model: "lineair",
			cesuurPct: 55,
			exponent: 1
		},
		meta: {
			titel: "Fotosynthese en ademhaling",
			vak: "Biologie",
			leerweg: "KB",
			leerjaar: 2,
			duurMinuten: 50,
			school: SCHOOL,
			hulpmiddelen: ["Rekenmachine toegestaan bij vraag 6", "Geen biologieboek"],
			instructies: [
				"Cesuur 5,5 bij 14/27 punten (lineair).",
				"Deze toets bestaat uit 10 vragen. Het maximumscore is 27 punten.",
				"Lees elke vraag rustig door. Heb je elk onderdeel beantwoord?",
				"Schrijf antwoorden in goed Nederlands. Leg woorden als hij/het/die uit.",
				"Bij meerkeuzevragen is één antwoord het beste. Omcirkel de letter."
			],
			onderwerp: "Fotosynthese, gaswisseling en dissimilatie",
			versie: "A",
			moeilijkheid: "normaal"
		},
		vragen,
		nakijkmodel,
		cesuur: {
			nTerm: 1,
			cesuurPunten: 14,
			toelichting: "Cesuur 5,5 bij 14/27 punten (lineair).",
			formule: "cijfer = 1 + 9 × (score / 27)"
		},
		matrijs: bouwMatrijs(vragen, {
			R: 35,
			T1: 40,
			T2: 20,
			I: 5
		}),
		kwaliteit: {
			samenvatting: "Evenwichtige onderbouwtoets met groene Aeres-context (kas, tomaat, basilicum). RTTI ligt dicht tegen de onderbouwnorm. Geschikt als sectievoorbeeld; altijd zelf vakinhoudelijk nalopen.",
			punten: [
				{
					criterium: "Validiteit",
					oordeel: "voldoet",
					toelichting: "Dekking van kerndoelen fotosynthese, gaswisseling en dissimilatie; contexten sluiten aan op de groene praktijk."
				},
				{
					criterium: "Betrouwbaarheid / nakijkmodel",
					oordeel: "voldoet",
					toelichting: "Puntenverdeelsleutel per vraag, inclusief wat níét scoort. Twee beoordelaars kunnen daarmee tot dezelfde score komen."
				},
				{
					criterium: "RTTI-spreiding",
					oordeel: "voldoet",
					toelichting: "R 22% · T1 33% · T2 30% · I 15% van de punten. Iets meer transfer/inzicht dan de onderbouwdoelstelling — acceptabel, eventueel vraag 10 inkorten."
				},
				{
					criterium: "Taal (VMBO KB)",
					oordeel: "voldoet",
					toelichting: "Korte zinnen, bekende woorden, contexten uit de eigen kas. Geen dubbele ontkenningen."
				},
				{
					criterium: "Transparantie",
					oordeel: "voldoet",
					toelichting: "Punten staan per vraag en in de instructie. Maximumscore 27 is op het voorblad vermeld."
				},
				{
					criterium: "Cito-opmaak",
					oordeel: "voldoet",
					toelichting: "Nummering, punten in de kantlijn, meerkeuze A–D, instructies op het voorblad."
				}
			]
		}
	};
}
var naskTabel = {
	koppen: ["t (min)", "T (°C)"],
	rijen: [
		["0", "18,0"],
		["10", "21,5"],
		["20", "24,0"],
		["30", "25,5"],
		["40", "26,0"]
	]
};
var naskGrafiek = {
	titel: "Luchttemperatuur in de kas",
	xLabel: "t (min)",
	yLabel: "T (°C)",
	punten: [
		{
			x: 0,
			y: 18
		},
		{
			x: 10,
			y: 21.5
		},
		{
			x: 20,
			y: 24
		},
		{
			x: 30,
			y: 25.5
		},
		{
			x: 40,
			y: 26
		}
	]
};
function maakVoorbeeldNaskToets() {
	const naskVragen = [
		{
			nummer: 1,
			type: "open",
			rtti: "R",
			domein: "Meten",
			leerdoel: "De leerling noemt de eenheid van temperatuur.",
			punten: 1,
			stam: "In welke eenheid staat T in de tabel?",
			tabel: naskTabel
		},
		{
			nummer: 2,
			type: "open",
			rtti: "T1",
			domein: "Tabel",
			leerdoel: "De leerling leest een waarde uit een tabel.",
			punten: 2,
			stam: "a. Wat is T bij t = 20 min? (1p)\n\nb. Hoeveel °C is T gestegen tussen t = 0 en t = 40 min? (1p)",
			tabel: naskTabel
		},
		{
			nummer: 3,
			type: "meerkeuze",
			rtti: "T1",
			domein: "Grafiek",
			leerdoel: "De leerling leest een grafiek van T tegen t af.",
			punten: 1,
			stam: "Bij welke tijd is T ongeveer 24 °C?",
			grafiek: naskGrafiek,
			opties: [
				{
					letter: "A",
					tekst: "10 min"
				},
				{
					letter: "B",
					tekst: "20 min"
				},
				{
					letter: "C",
					tekst: "30 min"
				},
				{
					letter: "D",
					tekst: "40 min"
				}
			]
		},
		{
			nummer: 4,
			type: "berekening",
			rtti: "T2",
			domein: "Warmte",
			leerdoel: "De leerling gebruikt Q = m × c × ΔT met eenheden.",
			punten: 4,
			context: "Een emmer met 2,0 kg water staat in dezelfde kas. c = 4,2 kJ/(kg·°C). ΔT is de stijging uit de tabel van t = 0 tot t = 40 min.",
			stam: "Bereken Q. Geef de eenheid. Rond af op 2 significante cijfers.",
			tabel: naskTabel
		},
		{
			nummer: 5,
			type: "open",
			rtti: "R",
			domein: "Meetonzekerheid",
			leerdoel: "De leerling noemt de meetonzekerheid van de thermometer.",
			punten: 1,
			stam: "De schoolthermometer heeft een meetonzekerheid van ±0,5 °C. Schrijf de temperatuur bij t = 0 min op met onzekerheid."
		},
		{
			nummer: 6,
			type: "open",
			rtti: "I",
			domein: "Evenwicht",
			leerdoel: "De leerling verklaart waarom de grafiek afvlakt.",
			punten: 3,
			stam: "De grafiek van T tegen t wordt na 30 min minder steil. Geef een verklaring. Gebruik het woord evenwicht.",
			grafiek: naskGrafiek
		}
	];
	return {
		id: "voorbeeld-nask-kas",
		createdAt: (/* @__PURE__ */ new Date()).toISOString(),
		bronmateriaal: VOORBEELD_NASK_LESSTOF,
		extraEisen: "Voorbeeld NaSk — geen AI-aanroep.",
		ronde: 1,
		cijferNorm: {
			model: "lineair",
			cesuurPct: 55,
			exponent: 1
		},
		vakProfiel: "nask",
		meta: {
			titel: "Temperatuur in de kas",
			vak: "NaSk",
			leerweg: "KB",
			leerjaar: 2,
			duurMinuten: 50,
			school: SCHOOL,
			hulpmiddelen: ["Rekenmachine alleen waar nodig", "Geen boek"],
			instructies: [
				"Cesuur 5,5 bij 6/12 punten (lineair).",
				"Deze toets bestaat uit 6 vragen. Het maximumscore is 12 punten.",
				"Schrijf eenheden bij berekeningen. Rond passend af."
			],
			onderwerp: "Temperatuur, warmte en meten",
			versie: "A",
			moeilijkheid: "normaal"
		},
		vragen: naskVragen,
		nakijkmodel: [
			{
				nummer: 1,
				modelantwoord: "°C / graden Celsius",
				puntenverdeling: [{
					punt: 1,
					criterium: "°C of graden Celsius"
				}]
			},
			{
				nummer: 2,
				modelantwoord: "a. 24,0 °C. b. 26,0 − 18,0 = 8,0 °C.",
				puntenverdeling: [{
					punt: 1,
					criterium: "a. 24,0 (of 24) °C"
				}, {
					punt: 1,
					criterium: "b. 8,0 (of 8) °C"
				}]
			},
			{
				nummer: 3,
				modelantwoord: "B",
				puntenverdeling: [{
					punt: 1,
					criterium: "B — 20 min"
				}]
			},
			{
				nummer: 4,
				modelantwoord: "ΔT = 8,0 °C. Q = 2,0 × 4,2 × 8,0 = 67 kJ (2 s.c.).",
				puntenverdeling: [
					{
						punt: 1,
						criterium: "ΔT = 8,0 °C"
					},
					{
						punt: 1,
						criterium: "invullen Q = m c ΔT"
					},
					{
						punt: 1,
						criterium: "67 (kJ) of 6,7·10^4 J"
					},
					{
						punt: 1,
						criterium: "eenheid kJ of J"
					}
				]
			},
			{
				nummer: 5,
				modelantwoord: "18,0 °C ± 0,5 °C",
				puntenverdeling: [{
					punt: 1,
					criterium: "18,0 met ±0,5 °C"
				}]
			},
			{
				nummer: 6,
				modelantwoord: "De kas nadert een evenwicht: evenveel warmte erbij als eraf (ventilatie, straling). Daardoor stijgt T steeds minder.",
				puntenverdeling: [
					{
						punt: 1,
						criterium: "noemt evenwicht of evenveel erbij als eraf"
					},
					{
						punt: 1,
						criterium: "koppelt aan afvlakken van de grafiek"
					},
					{
						punt: 1,
						criterium: "noemt een oorzaak (ventilatie/straling/verlies)"
					}
				]
			}
		],
		cesuur: {
			nTerm: 1,
			cesuurPunten: 6,
			toelichting: "Cesuur 5,5 bij 6/12 punten (lineair).",
			formule: "cijfer = 1 + 9 × (score / 12)"
		},
		matrijs: bouwMatrijs(naskVragen, {
			R: 35,
			T1: 40,
			T2: 20,
			I: 5
		}),
		kwaliteit: {
			samenvatting: "NaSk-voorbeeld met echte tabel en grafiek, formule Q = m c ΔT, eenheden en meetonzekerheid. Constructiehulp — altijd zelf nalopen.",
			punten: [{
				criterium: "Tabel/grafiek-bron",
				oordeel: "voldoet",
				toelichting: "Vraag 1–2 en 4 gebruiken de meetabel; vraag 3 en 6 de grafiek."
			}]
		}
	};
}
var useToetsStore = create()(persist((set, get) => ({
	toetsen: [],
	upsert: (toets) => set((s) => ({ toetsen: [withDefaults(toets), ...s.toetsen.filter((t) => t.id !== toets.id)] })),
	update: (id, patch) => set((s) => ({ toetsen: s.toetsen.map((t) => t.id === id ? herbouwMatrijs(withDefaults({
		...t,
		...patch
	})) : t) })),
	updateVraag: (id, nummer, patch) => set((s) => ({ toetsen: s.toetsen.map((t) => {
		if (t.id !== id) return t;
		const vragen = t.vragen.map((q) => q.nummer === nummer ? {
			...q,
			...patch
		} : q);
		return herbouwMatrijs(withDefaults({
			...t,
			vragen
		}));
	}) })),
	updateNakijk: (id, nummer, patch) => set((s) => ({ toetsen: s.toetsen.map((t) => {
		if (t.id !== id) return t;
		return withDefaults({
			...t,
			nakijkmodel: t.nakijkmodel.map((n) => n.nummer === nummer ? {
				...n,
				...patch
			} : n)
		});
	}) })),
	updateCijferNorm: (id, norm) => set((s) => ({ toetsen: s.toetsen.map((t) => {
		if (t.id !== id) return t;
		return withDefaults({
			...t,
			cijferNorm: norm
		});
	}) })),
	remove: (id) => set((s) => ({ toetsen: s.toetsen.filter((t) => t.id !== id) })),
	byId: (id) => {
		const t = get().toetsen.find((x) => x.id === id);
		return t ? withDefaults(t) : void 0;
	},
	ensureVoorbeeld: () => {
		const existing = get().toetsen.find((t) => t.id === "voorbeeld-fotosynthese");
		if (existing) return withDefaults(existing);
		const sample = maakVoorbeeldToets();
		set((s) => ({ toetsen: [sample, ...s.toetsen] }));
		return sample;
	},
	ensureVoorbeeldNask: () => {
		const existing = get().toetsen.find((t) => t.id === "voorbeeld-nask-kas");
		if (existing) return withDefaults(existing);
		const sample = maakVoorbeeldNaskToets();
		set((s) => ({ toetsen: [sample, ...s.toetsen] }));
		return sample;
	}
}), { name: "aeres-toetsmaker" }));
//#endregion
export { maakVoorbeeldToets as a, maakVoorbeeldNaskToets as i, VOORBEELD_NASK_LESSTOF as n, useToetsStore as o, VOORBEELD_TOETS_TEKST as r, VOORBEELD_LESSTOF as t };
