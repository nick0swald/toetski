//#region node_modules/.nitro/vite/services/ssr/assets/constants-C-iIXaRj.js
var SCHOOL = "Aeres VMBO Leeuwarden";
var LEERWEGEN = [
	{
		id: "BB",
		label: "BB",
		hint: "Basis"
	},
	{
		id: "KB",
		label: "KB",
		hint: "Kader"
	},
	{
		id: "GT",
		label: "GT",
		hint: "Gemengd/theoretisch — ook HGL"
	}
];
var VERSIES = [{
	id: "A",
	label: "A",
	hint: "Eerste afname"
}, {
	id: "B",
	label: "B",
	hint: "Parallel, andere getallen/context"
}];
var MOEILIJKHEDEN = [
	{
		id: "makkelijk",
		label: "Makkelijk",
		hint: "Meer R/T1, eenvoudiger taal"
	},
	{
		id: "normaal",
		label: "Normaal",
		hint: "Passend bij leerjaar en leerweg"
	},
	{
		id: "moeilijk",
		label: "Moeilijk",
		hint: "Meer T2/I, grotere stappen"
	}
];
var VAKPROFIELEN = [{
	id: "generiek",
	label: "Generiek",
	hint: "Alle vakken"
}, {
	id: "nask",
	label: "NaSk",
	hint: "Formules, eenheden, tabel/grafiek"
}];
function normalizeLeerweg(raw) {
	const u = (raw ?? "").trim().toUpperCase();
	if (u === "BB" || u.startsWith("BASIS")) return "BB";
	if (u === "KB" || u.startsWith("KADER")) return "KB";
	return "GT";
}
var RTTI_META = {
	R: {
		naam: "Reproductie",
		kort: "R",
		uitleg: "Kennis letterlijk weergeven: begrip, feit, formule, stappenplan."
	},
	T1: {
		naam: "Toepassing (bekend)",
		kort: "T1",
		uitleg: "Getrainde procedure in een bekende, geoefende context."
	},
	T2: {
		naam: "Toepassing (nieuw)",
		kort: "T2",
		uitleg: "Geleerde stof combineren in een nieuwe, niet-geoefende context."
	},
	I: {
		naam: "Inzicht",
		kort: "I",
		uitleg: "Analyseren, verklaren, verbanden leggen, een oplossing construeren."
	}
};
var RTTI_PRESETS = {
	onderbouw: {
		label: "Onderbouw",
		hint: "Klas 1–2 · meer reproductie en training",
		verdeling: {
			R: 35,
			T1: 40,
			T2: 20,
			I: 5
		}
	},
	bovenbouw: {
		label: "Bovenbouw",
		hint: "Klas 3–4 · meer transfer",
		verdeling: {
			R: 20,
			T1: 40,
			T2: 30,
			I: 10
		}
	},
	examen: {
		label: "Examengericht",
		hint: "Dichter bij CSE/CSPE",
		verdeling: {
			R: 15,
			T1: 35,
			T2: 35,
			I: 15
		}
	}
};
var RTTI_PRESET_KEUZES = [
	{
		id: "onderbouw",
		label: "Onderbouw",
		hint: "Klas 1–2"
	},
	{
		id: "bovenbouw",
		label: "Bovenbouw",
		hint: "Klas 3–4"
	},
	{
		id: "examen",
		label: "Examengericht",
		hint: "CSE/CSPE"
	}
];
var RTTI_ORDER = [
	"R",
	"T1",
	"T2",
	"I"
];
function presetVoorLeerjaar(jaar) {
	return jaar <= 2 ? "onderbouw" : jaar === 4 ? "examen" : "bovenbouw";
}
function rttiVoorMoeilijkheid(basis, m) {
	const raw = m === "normaal" ? basis : m === "makkelijk" ? {
		R: Math.min(50, basis.R + 10),
		T1: basis.T1 + 5,
		T2: Math.max(5, basis.T2 - 10),
		I: Math.max(0, basis.I - 5)
	} : {
		R: Math.max(10, basis.R - 10),
		T1: Math.max(20, basis.T1 - 5),
		T2: basis.T2 + 10,
		I: basis.I + 5
	};
	const som = raw.R + raw.T1 + raw.T2 + raw.I;
	if (som === 100) return raw;
	return {
		R: Math.round(raw.R / som * 100),
		T1: Math.round(raw.T1 / som * 100),
		T2: Math.round(raw.T2 / som * 100),
		I: Math.round(raw.I / som * 100)
	};
}
//#endregion
export { RTTI_PRESETS as a, VAKPROFIELEN as c, presetVoorLeerjaar as d, rttiVoorMoeilijkheid as f, RTTI_ORDER as i, VERSIES as l, MOEILIJKHEDEN as n, RTTI_PRESET_KEUZES as o, RTTI_META as r, SCHOOL as s, LEERWEGEN as t, normalizeLeerweg as u };
