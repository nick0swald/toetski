import { u as normalizeLeerweg } from "./constants-C-iIXaRj.mjs";
import { c as string, i as boolean, n as _enum, r as array, s as object, t as number } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/schema-DSm8tvx7.js
var rtti = _enum([
	"R",
	"T1",
	"T2",
	"I"
]);
var leerweg = string().transform((s) => normalizeLeerweg(s)).pipe(_enum([
	"BB",
	"KB",
	"GT"
]));
var vraagType = _enum([
	"meerkeuze",
	"juist-onjuist",
	"open",
	"invul",
	"berekening",
	"bronvraag"
]);
var cijferNormSchema = object({
	model: _enum([
		"lineair",
		"gebroken",
		"exponentieel"
	]).default("lineair"),
	cesuurPct: number().min(20).max(90).default(55),
	exponent: number().min(.3).max(3).default(1)
});
var generateInputSchema = object({
	titel: string().max(160).optional().default(""),
	vak: string().max(80).optional().default(""),
	leerweg,
	leerjaar: number().int().min(1).max(4),
	duurMinuten: number().int().min(10).max(180),
	doelPunten: number().int().min(10).max(100),
	aantalVragen: number().int().min(4).max(16),
	rttiDoel: object({
		R: number(),
		T1: number(),
		T2: number(),
		I: number()
	}),
	bronmateriaal: string().max(16e3).optional().default(""),
	extraEisen: string().max(4e3).optional().default(""),
	bronUrl: string().max(500).optional(),
	versie: _enum(["A", "B"]).default("A"),
	moeilijkheid: _enum([
		"makkelijk",
		"normaal",
		"moeilijk"
	]).default("normaal"),
	cijferNorm: cijferNormSchema.default({
		model: "lineair",
		cesuurPct: 55,
		exponent: 1
	}),
	vakProfiel: _enum(["generiek", "nask"]).optional().default("generiek"),
	ronde: number().int().min(1).max(12).optional().default(1),
	parentId: string().max(80).optional(),
	feedback: string().max(8e3).optional().default(""),
	vorigeSamenvatting: string().max(8e3).optional().default("")
});
var vraagSchema = object({
	nummer: number(),
	type: string().transform((s) => {
		const x = s.toLowerCase();
		if (x.includes("meerkeuze") || x === "mc") return "meerkeuze";
		if (x.includes("juist")) return "juist-onjuist";
		if (x.includes("invul")) return "invul";
		if (x.includes("bereken")) return "berekening";
		if (x.includes("bron")) return "bronvraag";
		if (x.includes("open")) return "open";
		return "open";
	}).pipe(vraagType),
	rtti: string().transform((s) => s.toUpperCase().replace(/\s+/g, "").replace("TOEPASSING1", "T1").replace("TOEPASSING2", "T2")).pipe(rtti),
	domein: string().default("Algemeen"),
	leerdoel: string().default(""),
	punten: number().min(0).default(1),
	context: string().optional().default(""),
	stam: string().default(""),
	opties: array(object({
		letter: string(),
		tekst: string()
	})).nullish().transform((v) => v ?? []),
	tabel: object({
		koppen: array(string()).default([]),
		rijen: array(array(string())).default([])
	}).nullish().transform((v) => v && v.koppen.length ? v : void 0),
	grafiek: object({
		titel: string().optional().default(""),
		xLabel: string().optional().default(""),
		yLabel: string().optional().default(""),
		punten: array(object({
			x: number(),
			y: number(),
			label: string().optional()
		}))
	}).nullish().transform((v) => v && v.punten.length ? v : void 0)
});
var nakijkSchema = object({
	nummer: number(),
	modelantwoord: string(),
	puntenverdeling: array(object({
		punt: number(),
		criterium: string()
	})).default([]),
	nietToekennen: array(string()).optional().default([])
});
var generatedPayloadSchema = object({
	meta: object({
		titel: string(),
		vak: string().optional().default(""),
		leerweg: leerweg.optional(),
		leerjaar: number().int().min(1).max(4).optional(),
		duurMinuten: number().optional(),
		hulpmiddelen: array(string()).default([]),
		instructies: array(string()).default([]),
		onderwerp: string().default("")
	}),
	vragen: array(vraagSchema).min(3),
	nakijkmodel: array(nakijkSchema).min(3),
	cesuur: object({
		nTerm: number().default(1),
		cesuurPunten: number(),
		toelichting: string(),
		formule: string().default("cijfer = 1 + 9 × (score / maximum)")
	}),
	kwaliteit: object({
		samenvatting: string(),
		punten: array(object({
			criterium: string(),
			oordeel: string().transform((s) => s.toLowerCase()).pipe(_enum([
				"voldoet",
				"aandacht",
				"ontbreekt"
			])),
			toelichting: string()
		}))
	})
});
var kwaliteitSchema = object({
	samenvatting: string(),
	punten: array(object({
		criterium: string(),
		oordeel: string().transform((s) => s.toLowerCase()).pipe(_enum([
			"voldoet",
			"aandacht",
			"ontbreekt"
		])),
		toelichting: string()
	}))
});
var matrijsInputSchema = object({
	titel: string().max(160).optional().default(""),
	vak: string().max(80).optional().default(""),
	leerweg,
	leerjaar: number().int().min(1).max(4),
	rttiDoel: object({
		R: number(),
		T1: number(),
		T2: number(),
		I: number()
	}),
	bronmateriaal: string().max(16e3).optional().default(""),
	extraEisen: string().max(2e3).optional().default(""),
	bronUrl: string().max(500).optional(),
	feedbackGewenst: boolean().optional().default(false)
});
var matrijsPayloadSchema = object({
	meta: object({
		titel: string(),
		vak: string().optional().default(""),
		leerweg: leerweg.optional(),
		leerjaar: number().int().min(1).max(4).optional(),
		onderwerp: string().optional().default("")
	}),
	vragen: array(vraagSchema).min(2),
	kwaliteit: kwaliteitSchema.optional()
});
//#endregion
export { matrijsPayloadSchema as i, generatedPayloadSchema as n, matrijsInputSchema as r, generateInputSchema as t };
