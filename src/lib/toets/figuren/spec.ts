import { z } from "zod";
import { GHS_SYMBOLEN, type FiguurSoort, type FiguurSpec, type GhsSymbool, type JsonWaarde, type Vraag } from "../types.ts";

export const FIGUUR_SOORTEN: FiguurSoort[] = [
  "lijngrafiek",
  "staafdiagram",
  "spreidingsdiagram",
  "stroomkring",
  "katrol",
  "hefboom",
  "krachtenschema",
  "blokschema",
  "pictogram",
  "maatcilinder",
  "sfeerplaat",
];

/** Alles behalve een sfeerplaat tekent de code deterministisch (exacte getallen). */
export function isCodeFiguur(soort: FiguurSoort): boolean {
  return soort !== "sfeerplaat";
}

/** Maximaal aantal figuren per toets / sfeerplaten per toets (Vercel-tijd en leesbaarheid). */
export const MAX_FIGUREN_PER_TOETS = 6;
export const MAX_SFEERPLATEN_PER_TOETS = 2;

const num = z.coerce.number().refine((n) => Number.isFinite(n), "geen getal");
const tekst = (max = 120) => z.string().trim().max(max);

const soortSchema = z
  .string()
  .transform((s) => s.toLowerCase().trim().replace(/\s+/g, ""))
  .transform((s) => {
    if (/lijn|grafiek/.test(s) && !/staaf|spreid/.test(s)) return "lijngrafiek";
    if (/staaf|bar/.test(s)) return "staafdiagram";
    if (/spreid|scatter|punten/.test(s)) return "spreidingsdiagram";
    if (/stroom|circuit|schakel/.test(s)) return "stroomkring";
    if (/katrol|takel/.test(s)) return "katrol";
    if (/hefboom/.test(s)) return "hefboom";
    if (/kracht/.test(s)) return "krachtenschema";
    if (/blok|proces|stroomschema/.test(s)) return "blokschema";
    if (/picto|ghs|gevaren/.test(s)) return "pictogram";
    if (/maatcilinder|cilinder/.test(s)) return "maatcilinder";
    if (/sfeer|scene|situatie|plaat|foto|tekening|illustratie/.test(s)) return "sfeerplaat";
    return s;
  })
  .pipe(z.enum(FIGUUR_SOORTEN as [FiguurSoort, ...FiguurSoort[]]));

/** Schema voor wat het model als spec teruggeeft. `data` wordt per soort apart gecontroleerd. */
export const figuurSpecSchema = z.object({
  soort: soortSchema,
  titel: tekst(90).optional().default(""),
  doel: tekst(400).default(""),
  verplichteElementen: z.array(tekst(160)).max(12).default([]),
  labels: z.array(tekst(60)).max(16).default([]),
  getallen: z
    .array(z.object({ label: tekst(60).default(""), waarde: num, eenheid: tekst(20).optional() }))
    .max(24)
    .default([]),
  eenheden: z.array(tekst(20)).max(8).default([]),
  nietTonen: z.array(tekst(160)).max(12).default([]),
  data: z.record(z.string(), z.unknown()).default({}),
});

const punt = z.object({ x: num, y: num });

const dataSchemas = {
  lijngrafiek: z.object({
    xLabel: tekst(60).default("x"),
    yLabel: tekst(60).default("y"),
    xEenheid: tekst(20).optional(),
    yEenheid: tekst(20).optional(),
    reeksen: z
      .array(z.object({ naam: tekst(40).optional(), punten: z.array(punt).min(2).max(40) }))
      .min(1)
      .max(3),
    xMin: num.optional(),
    xMax: num.optional(),
    yMin: num.optional(),
    yMax: num.optional(),
    toonPunten: z.boolean().optional().default(true),
    raster: z.boolean().optional().default(true),
  }),
  staafdiagram: z.object({
    xLabel: tekst(60).optional(),
    yLabel: tekst(60).default(""),
    yEenheid: tekst(20).optional(),
    staven: z.array(z.object({ label: tekst(30), waarde: num })).min(2).max(10),
    yMax: num.optional(),
    toonWaarden: z.boolean().optional().default(false),
  }),
  spreidingsdiagram: z.object({
    xLabel: tekst(60).default("x"),
    yLabel: tekst(60).default("y"),
    xEenheid: tekst(20).optional(),
    yEenheid: tekst(20).optional(),
    punten: z.array(punt).min(3).max(60),
    xMin: num.optional(),
    xMax: num.optional(),
    yMin: num.optional(),
    yMax: num.optional(),
  }),
  stroomkring: z.object({
    schakeling: z.enum(["serie", "parallel"]).default("serie"),
    bron: z
      .object({ soort: z.enum(["batterij", "spanningsbron"]).default("batterij"), label: tekst(20).optional() })
      .default({ soort: "batterij" }),
    /** Serie: onderdelen in de kring. Parallel: onderdelen in de hoofdstroom (bijv. schakelaar, A-meter). */
    componenten: z.array(z.object({ soort: tekst(30), label: tekst(20).optional() })).max(6).default([]),
    /** Alleen bij parallel: elke tak is een rijtje onderdelen. */
    takken: z
      .array(z.array(z.object({ soort: tekst(30), label: tekst(20).optional() })).min(1).max(3))
      .max(3)
      .default([]),
    /** Voltmeter over een onderdeel (index in componenten) of over de bron. */
    voltmeters: z
      .array(z.object({ over: z.union([z.literal("bron"), z.coerce.number().int().min(0)]), label: tekst(20).optional() }))
      .max(2)
      .default([]),
  }),
  katrol: z.object({
    type: z.enum(["vast", "los", "takel"]).default("vast"),
    touwdelen: z.coerce.number().int().min(1).max(6).optional(),
    last: tekst(30).default("last"),
    kracht: tekst(30).default("F"),
  }),
  hefboom: z.object({
    lengte: num.refine((n) => n > 0),
    eenheid: tekst(8).default("m"),
    draaipunt: num,
    krachten: z
      .array(z.object({ positie: num, label: tekst(30), richting: z.enum(["omlaag", "omhoog"]).default("omlaag") }))
      .min(1)
      .max(4),
    toonMaten: z.boolean().optional().default(true),
  }),
  krachtenschema: z.object({
    voorwerp: tekst(30).default(""),
    krachten: z
      .array(
        z.object({
          naam: tekst(20),
          richting: z.enum(["omhoog", "omlaag", "links", "rechts"]),
          grootte: num.refine((n) => n >= 0),
          eenheid: tekst(6).optional().default("N"),
        }),
      )
      .min(1)
      .max(4),
    toonGrootte: z.boolean().optional().default(false),
    /** Newton per cm op papier; alleen tonen als de vraag schaal gebruikt. */
    schaal: num.optional(),
  }),
  blokschema: z.object({ blokken: z.array(tekst(40)).min(2).max(5) }),
  pictogram: z.object({ symbool: z.enum(GHS_SYMBOLEN as [GhsSymbool, ...GhsSymbool[]]) }),
  maatcilinder: z.object({
    maxMl: num.refine((n) => n > 0),
    standen: z.array(z.object({ label: tekst(30), ml: num })).min(1).max(4),
  }),
  sfeerplaat: z.object({
    /** Scènebeschrijving voor het beeldmodel (liefst Engels). */
    scene: tekst(900).refine((s) => s.length >= 10, "scene te kort"),
  }),
} satisfies Record<FiguurSoort, z.ZodTypeAny>;

export type SpecData<S extends FiguurSoort> = z.infer<(typeof dataSchemas)[S]>;

/** Controleer en normaliseer de tekendata voor een soort. Gooit bij ongeldige data. */
export function parseSpecData<S extends FiguurSoort>(soort: S, data: unknown): SpecData<S> {
  return dataSchemas[soort].parse(data) as SpecData<S>;
}

/** Spec uit modeloutput → gevalideerde spec, of null als hij onbruikbaar is. */
export function parseFiguurSpec(raw: unknown): { spec: FiguurSpec | null; fout?: string } {
  const parsed = figuurSpecSchema.safeParse(raw);
  if (!parsed.success) return { spec: null, fout: parsed.error.issues[0]?.message ?? "spec ongeldig" };
  const s = parsed.data;
  const data = dataSchemas[s.soort].safeParse(s.data);
  if (!data.success) {
    return { spec: null, fout: `data voor ${s.soort} ongeldig: ${data.error.issues[0]?.path.join(".")} ${data.error.issues[0]?.message}` };
  }
  return {
    spec: {
      soort: s.soort,
      titel: s.titel || undefined,
      doel: s.doel,
      verplichteElementen: s.verplichteElementen,
      labels: s.labels,
      getallen: s.getallen,
      eenheden: s.eenheden,
      nietTonen: s.nietTonen,
      data: JSON.parse(JSON.stringify(data.data)) as { [k: string]: JsonWaarde },
    },
  };
}

function basis(soort: FiguurSoort, doel: string, data: Record<string, unknown>, extra?: Partial<FiguurSpec>): FiguurSpec {
  return {
    soort,
    doel,
    verplichteElementen: [],
    labels: [],
    getallen: [],
    eenheden: [],
    nietTonen: [],
    data: JSON.parse(JSON.stringify(data)) as { [k: string]: JsonWaarde },
    ...extra,
  };
}

function eenheidUitLabel(label: string): { label: string; eenheid?: string } {
  const m = label.match(/^(.*?)\s*[([]\s*([^)\]]+)\s*[)\]]\s*$/);
  if (m) return { label: m[1]!.trim() || label, eenheid: m[2]!.trim() };
  return { label };
}

function componentUitLabel(label: string): { soort: string; label?: string } {
  const t = label.toLowerCase();
  if (/lamp/.test(t)) return { soort: "lampje", label };
  if (/weerstand|\br\b/.test(t)) return { soort: "weerstand", label };
  if (/schakel/.test(t)) return { soort: "schakelaar-dicht", label };
  if (/amp|\ba\b|stroommeter/.test(t)) return { soort: "ampèremeter" };
  if (/motor/.test(t)) return { soort: "motor", label };
  if (/zoemer|bel/.test(t)) return { soort: "zoemer", label };
  return { soort: "lampje", label };
}

/**
 * Oude, direct door het model ingevulde figuurvelden → figuurspec.
 * Zo gaan ook pictogram, maatcilinder, grafiek en schema door dezelfde go/no-go-keuring.
 */
export function legacySpecs(q: Vraag): FiguurSpec[] {
  const out: FiguurSpec[] = [];
  if (q.pictogram) {
    out.push(
      basis("pictogram", "GHS-gevarensymbool dat de leerling moet herkennen.", { symbool: q.pictogram }, {
        verplichteElementen: ["rode ruit", `GHS-symbool ${q.pictogram}`],
        nietTonen: [q.pictogram, "naam van het symbool"],
      }),
    );
  }
  if (q.maatcilinder) {
    const m = q.maatcilinder;
    out.push(
      basis("maatcilinder", "Maatcilinder waarop de leerling vloeistofstanden afleest.", { maxMl: m.maxMl, standen: m.standen }, {
        titel: m.titel || undefined,
        verplichteElementen: ["maatcilinder met schaalverdeling in mL", ...m.standen.map((s) => `stand ${s.label}`)],
        labels: m.standen.map((s) => s.label),
        getallen: m.standen.map((s) => ({ label: s.label, waarde: s.ml, eenheid: "mL" })),
        eenheden: ["mL"],
      }),
    );
  }
  if (q.grafiek && q.grafiek.punten.length >= 2) {
    const g = q.grafiek;
    const x = eenheidUitLabel(g.xLabel);
    const y = eenheidUitLabel(g.yLabel);
    out.push(
      basis(
        "lijngrafiek",
        "Grafiek met de meetwaarden uit de vraag.",
        {
          xLabel: x.label,
          yLabel: y.label,
          xEenheid: x.eenheid,
          yEenheid: y.eenheid,
          reeksen: [{ punten: g.punten }],
          toonPunten: true,
          raster: true,
        },
        {
          titel: g.titel || undefined,
          verplichteElementen: ["x-as met label", "y-as met label", "alle meetpunten"],
          labels: [g.xLabel, g.yLabel],
          getallen: g.punten.flatMap((p, i) => [
            { label: `punt ${i + 1} x`, waarde: p.x },
            { label: `punt ${i + 1} y`, waarde: p.y },
          ]),
          eenheden: [x.eenheid, y.eenheid].filter((e): e is string => Boolean(e)),
        },
      ),
    );
  }
  if (q.schemaFiguur) {
    const sf = q.schemaFiguur;
    const labels = (sf.labels ?? []).filter(Boolean);
    if (sf.soort === "circuit") {
      const comps = (labels.length ? labels : ["lamp", "schakelaar"])
        .filter((l) => !/^(bron|batterij|spanningsbron|u)$/i.test(l.trim()))
        .slice(0, 4)
        .map(componentUitLabel);
      out.push(
        basis("stroomkring", "Schakelschema van een eenvoudige stroomkring.", {
          schakeling: "serie",
          bron: { soort: "batterij" },
          componenten: comps.length ? comps : [{ soort: "lampje" }],
          takken: [],
          voltmeters: [],
        }, { titel: sf.titel || undefined, labels }),
      );
    } else if (sf.soort === "krachten") {
      const namen = labels.length ? labels.slice(0, 4) : ["Fz", "Fn"];
      const richtingen = ["omlaag", "omhoog", "links", "rechts"] as const;
      out.push(
        basis("krachtenschema", "Krachten die op een voorwerp werken.", {
          voorwerp: "",
          krachten: namen.map((naam, i) => {
            const t = naam.toLowerCase();
            const richting = /z|zwaar/.test(t) ? "omlaag" : /n|normaal|op/.test(t) ? "omhoog" : /w|wrijv/.test(t) ? "links" : richtingen[i % 4]!;
            return { naam, richting, grootte: 1, eenheid: "N" };
          }),
          toonGrootte: false,
        }, { titel: sf.titel || undefined, labels: namen }),
      );
    } else {
      out.push(
        basis("blokschema", "Blokschema van een proces.", { blokken: labels.length >= 2 ? labels.slice(0, 5) : ["in", "proces", "uit"] }, {
          titel: sf.titel || undefined,
          labels,
        }),
      );
    }
  }
  return out;
}

export function heeftLegacyFiguur(q: Vraag): boolean {
  return Boolean((q.grafiek && q.grafiek.punten.length >= 2) || q.schemaFiguur || q.pictogram || q.maatcilinder);
}

/** Korte leesbare samenvatting van een spec (prompt, nakijkmodel, rapport). */
export function specSamenvatting(spec: FiguurSpec): string {
  const delen = [
    `soort: ${spec.soort}`,
    spec.titel ? `titel: ${spec.titel}` : "",
    spec.doel ? `doel: ${spec.doel}` : "",
    spec.verplichteElementen.length ? `verplicht: ${spec.verplichteElementen.join("; ")}` : "",
    spec.labels.length ? `labels: ${spec.labels.join(", ")}` : "",
    spec.getallen.length
      ? `getallen: ${spec.getallen.map((g) => `${g.label} = ${g.waarde}${g.eenheid ? ` ${g.eenheid}` : ""}`).join("; ")}`
      : "",
    spec.eenheden.length ? `eenheden: ${spec.eenheden.join(", ")}` : "",
    spec.nietTonen.length ? `NIET tonen: ${spec.nietTonen.join("; ")}` : "",
    `data: ${JSON.stringify(spec.data)}`,
  ];
  return delen.filter(Boolean).join("\n");
}

/** Alt-tekst voor de figuur (zonder het antwoord te verklappen). */
export function altTekst(spec: FiguurSpec): string {
  const naam: Record<FiguurSoort, string> = {
    lijngrafiek: "Lijngrafiek",
    staafdiagram: "Staafdiagram",
    spreidingsdiagram: "Spreidingsdiagram",
    stroomkring: "Schakelschema",
    katrol: "Katrol",
    hefboom: "Hefboom",
    krachtenschema: "Krachtenschema",
    blokschema: "Blokschema",
    pictogram: "Gevarensymbool",
    maatcilinder: "Maatcilinder",
    sfeerplaat: "Illustratie",
  };
  return spec.titel ? `${naam[spec.soort]}: ${spec.titel}` : naam[spec.soort];
}
