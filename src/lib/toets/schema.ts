import { z } from "zod";
import { normalizeLeerweg } from "./constants";

const rtti = z.enum(["R", "T1", "T2", "I"]);
const leerweg = z
  .string()
  .transform((s) => normalizeLeerweg(s))
  .pipe(z.enum(["BB", "KB", "GT"]));
const vraagType = z.enum([
  "meerkeuze",
  "juist-onjuist",
  "open",
  "invul",
  "berekening",
  "bronvraag",
]);

const cijferNormSchema = z.object({
  model: z.enum(["lineair", "gebroken", "exponentieel"]).default("lineair"),
  cesuurPct: z.coerce.number().min(20).max(90).default(55),
  exponent: z.coerce.number().min(0.3).max(3).default(1),
});

export const generateInputSchema = z.object({
  titel: z.string().max(160).optional().default(""),
  vak: z.string().max(80).optional().default(""),
  leerweg,
  leerjaar: z.coerce.number().int().min(1).max(4),
  duurMinuten: z.coerce.number().int().min(10).max(180),
  doelPunten: z.coerce.number().int().min(10).max(100),
  aantalVragen: z.coerce.number().int().min(4).max(80),
  mcVragen: z.coerce.number().int().min(0).max(60).optional(),
  openVragen: z.coerce.number().int().min(0).max(40).optional(),
  rttiDoel: z.object({
    R: z.coerce.number(),
    T1: z.coerce.number(),
    T2: z.coerce.number(),
    I: z.coerce.number(),
  }),
  bronmateriaal: z.string().max(100000).optional().default(""),
  extraEisen: z.string().max(4000).optional().default(""),
  bronUrl: z.string().max(500).optional(),
  antwoordenmateriaal: z.string().max(100000).optional().default(""),
  versie: z.enum(["A", "B"]).default("A"),
  moeilijkheid: z.enum(["makkelijk", "normaal", "moeilijk"]).default("normaal"),
  cijferNorm: cijferNormSchema.default({
    model: "lineair",
    cesuurPct: 55,
    exponent: 1,
  }),
  ronde: z.coerce.number().int().min(1).max(12).optional().default(1),
  parentId: z.string().max(80).optional(),
  feedback: z.string().max(8000).optional().default(""),
  vorigeSamenvatting: z.string().max(8000).optional().default(""),
  stuurdocument: z.string().max(20000).optional(),
});

const vraagSchema = z.object({
  nummer: z.coerce.number(),
  type: z
    .string()
    .transform((s) => {
      const x = s.toLowerCase();
      if (x.includes("meerkeuze") || x === "mc") return "meerkeuze";
      if (x.includes("juist")) return "juist-onjuist";
      if (x.includes("invul")) return "invul";
      if (x.includes("bereken")) return "berekening";
      if (x.includes("bron")) return "bronvraag";
      return "open";
    })
    .pipe(vraagType),
  rtti: z
    .string()
    .transform((s) =>
      s.toUpperCase().replace(/\s+/g, "").replace("TOEPASSING1", "T1").replace("TOEPASSING2", "T2"),
    )
    .pipe(rtti),
  domein: z.string().default("Algemeen"),
  leerdoel: z.string().default(""),
  punten: z.coerce.number().min(0).default(1),
  context: z.string().optional().default(""),
  stam: z.string().default(""),
  opties: z
    .array(z.object({ letter: z.string(), tekst: z.string() }))
    .nullish()
    .transform((v) => v ?? []),
});

const nakijkSchema = z.object({
  nummer: z.coerce.number(),
  modelantwoord: z.string(),
  puntenverdeling: z
    .array(z.object({ punt: z.coerce.number(), criterium: z.string() }))
    .default([]),
  nietToekennen: z.array(z.string()).optional().default([]),
});

const kwaliteitSchema = z.object({
  samenvatting: z.string(),
  punten: z.array(
    z.object({
      criterium: z.string(),
      oordeel: z
        .string()
        .transform((s) => s.toLowerCase())
        .pipe(z.enum(["voldoet", "aandacht", "ontbreekt"])),
      toelichting: z.string(),
    }),
  ),
});

export const generatedPayloadSchema = z.object({
  meta: z.object({
    titel: z.string(),
    vak: z.string().optional().default(""),
    leerweg: leerweg.optional(),
    leerjaar: z.coerce.number().int().min(1).max(4).optional(),
    duurMinuten: z.coerce.number().optional(),
    hulpmiddelen: z.array(z.string()).default([]),
    instructies: z.array(z.string()).default([]),
    onderwerp: z.string().default(""),
  }),
  vragen: z.array(vraagSchema).min(3),
  nakijkmodel: z.array(nakijkSchema).min(3),
  cesuur: z.object({
    nTerm: z.coerce.number().default(1),
    cesuurPunten: z.coerce.number(),
    toelichting: z.string(),
    formule: z.string().default("cijfer = 1 + 9 × (score / maximum)"),
  }),
  kwaliteit: kwaliteitSchema,
});

export const matrijsInputSchema = z.object({
  titel: z.string().max(160).optional().default(""),
  vak: z.string().max(80).optional().default(""),
  leerweg,
  leerjaar: z.coerce.number().int().min(1).max(4),
  rttiDoel: z.object({
    R: z.coerce.number(),
    T1: z.coerce.number(),
    T2: z.coerce.number(),
    I: z.coerce.number(),
  }),
  bronmateriaal: z.string().max(16000).optional().default(""),
  extraEisen: z.string().max(2000).optional().default(""),
  bronUrl: z.string().max(500).optional(),
  feedbackGewenst: z.boolean().optional().default(false),
});

export const matrijsPayloadSchema = z.object({
  meta: z.object({
    titel: z.string(),
    vak: z.string().optional().default(""),
    leerweg: leerweg.optional(),
    leerjaar: z.coerce.number().int().min(1).max(4).optional(),
    onderwerp: z.string().optional().default(""),
  }),
  vragen: z.array(vraagSchema).min(2),
  kwaliteit: kwaliteitSchema.optional(),
});
