import { z } from "zod";
import { symboolSoort } from "./schakelsymbolen.ts";
import { GHS_SYMBOLEN, PICTOGRAM_NAAM, isVeiligheidsbord, maatcilinderPastBijVraag, pictogramPastBijVraag, type FiguurSoort, type FiguurSpec, type GhsSymbool, type JsonWaarde, type Vraag } from "../types.ts";

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
export const MAX_SFEERPLATEN_PER_TOETS = 1;

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
    bron: z.preprocess(
      (v) => {
        // Robuust voor planner-varianten: "batterij", { soort: "accu" }, { soort: "voeding" } …
        const o = typeof v === "string" ? { soort: v } : v;
        if (!o || typeof o !== "object") return o;
        const r = o as { soort?: unknown };
        if (typeof r.soort === "string" && r.soort !== "batterij" && r.soort !== "spanningsbron") {
          return { ...r, soort: /spanningsbron|voeding|adapter|bron/i.test(r.soort) ? "spanningsbron" : "batterij" };
        }
        return o;
      },
      z
        .object({ soort: z.enum(["batterij", "spanningsbron"]).default("batterij"), label: tekst(20).optional() })
        .default({ soort: "batterij" }),
    ),
    /** Serie: onderdelen in de kring. Parallel: onderdelen in de hoofdstroom (bijv. schakelaar, A-meter). */
    componenten: z.array(z.object({ soort: tekst(30), label: tekst(20).optional() })).max(6).default([]),
    /** Alleen bij parallel: elke tak is een rijtje onderdelen. */
    takken: z
      .array(z.array(z.object({ soort: tekst(30), label: tekst(20).optional() })).min(1).max(3))
      .max(3)
      .default([]),
    /** Voltmeter over een onderdeel (index in componenten) of over de bron. */
    /**
     * Spanningsmeter parallel over een onderdeel: index in componenten (serie / hoofdstroom),
     * of { tak, index } voor een onderdeel in een parallelle tak. "bron" wordt door de
     * Nova-normalisatie verplaatst of geschrapt (Nova meet niet over de bron).
     */
    voltmeters: z
      .array(
        z.object({
          over: z.union([
            z.literal("bron"),
            z.coerce.number().int().min(0),
            z.object({ tak: z.coerce.number().int().min(0), index: z.coerce.number().int().min(0) }),
          ]),
          label: tekst(20).optional(),
        }),
      )
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
export function parseFiguurSpec(raw: unknown): { spec: FiguurSpec | null; fout?: string; aanpassingen?: string[] } {
  const parsed = figuurSpecSchema.safeParse(raw);
  if (!parsed.success) return { spec: null, fout: parsed.error.issues[0]?.message ?? "spec ongeldig" };
  const s = parsed.data;
  const data = dataSchemas[s.soort].safeParse(s.data);
  if (!data.success) {
    return { spec: null, fout: `data voor ${s.soort} ongeldig: ${data.error.issues[0]?.path.join(".")} ${data.error.issues[0]?.message}` };
  }
  const nova = s.soort === "stroomkring" ? novaStroomkring(data.data as SpecData<"stroomkring">) : { data: data.data, aanpassingen: [] as string[] };
  return {
    aanpassingen: nova.aanpassingen,
    spec: {
      soort: s.soort,
      titel: s.titel || undefined,
      doel: s.doel,
      verplichteElementen: s.verplichteElementen,
      labels: s.labels,
      getallen: s.getallen,
      eenheden: s.eenheden,
      nietTonen: s.nietTonen,
      data: JSON.parse(JSON.stringify(nova.data)) as { [k: string]: JsonWaarde },
    },
  };
}

const METEN_OVER = /lamp|weerstand|motor|led|zoemer|ldr|ntc/i;

/**
 * Curriculummatch (Nova NaSk, VMBO): een spanningsmeter staat parallel over een lampje/weerstand/…,
 * NOOIT over de spanningsbron of batterij. Zo'n meter wordt verplaatst naar het eerste lampje of de
 * eerste weerstand zonder meter, of geschrapt. Ongeldige indexen worden ook geschrapt.
 */
export function novaStroomkring(invoer: SpecData<"stroomkring">): { data: SpecData<"stroomkring">; aanpassingen: string[] } {
  const aanpassingen: string[] = [];
  const d = zonderBronComponenten(invoer, aanpassingen);
  const parallel = d.schakeling === "parallel" && d.takken.length > 0;
  const bezet = new Set<string>();
  const sleutel = (o: number | { tak: number; index: number }) => (typeof o === "number" ? `c${o}` : `t${o.tak}.${o.index}`);
  const geldig = (o: number | { tak: number; index: number }) =>
    typeof o === "number"
      ? o < (parallel ? Math.min(3, d.componenten.length) : d.componenten.length) && METEN_OVER.test(d.componenten[o]?.soort ?? "")
      : parallel && METEN_OVER.test(d.takken[o.tak]?.[o.index]?.soort ?? "");
  const vrij = (): number | { tak: number; index: number } | null => {
    const kandidaten: (number | { tak: number; index: number })[] = [];
    (parallel ? d.componenten.slice(0, 3) : d.componenten).forEach((_, i) => kandidaten.push(i));
    if (parallel) d.takken.forEach((tak, t) => tak.forEach((_, i) => kandidaten.push({ tak: t, index: i })));
    const voorkeur = (o: number | { tak: number; index: number }) => {
      const c = typeof o === "number" ? d.componenten[o] : d.takken[o.tak]?.[o.index];
      return /lamp/i.test(c?.soort ?? "") ? 0 : /weerstand/i.test(c?.soort ?? "") ? 1 : 2;
    };
    return kandidaten.filter((o) => geldig(o) && !bezet.has(sleutel(o))).sort((a, b) => voorkeur(a) - voorkeur(b))[0] ?? null;
  };
  const voltmeters: SpecData<"stroomkring">["voltmeters"] = [];
  for (const vm of d.voltmeters) {
    if (vm.over !== "bron" && geldig(vm.over) && !bezet.has(sleutel(vm.over))) {
      bezet.add(sleutel(vm.over));
      voltmeters.push(vm);
    }
  }
  for (const vm of d.voltmeters) {
    if (vm.over !== "bron" && voltmeters.includes(vm)) continue;
    const nieuw = vrij();
    if (vm.over === "bron") {
      if (nieuw != null) {
        bezet.add(sleutel(nieuw));
        voltmeters.push({ ...vm, over: nieuw });
        aanpassingen.push("spanningsmeter over de bron verplaatst naar een lampje/weerstand (Nova)");
      } else aanpassingen.push("spanningsmeter over de bron geschrapt (Nova meet niet over de bron)");
    } else aanpassingen.push("spanningsmeter over een onbekend of niet-meetbaar onderdeel geschrapt");
  }
  return { data: { ...d, voltmeters }, aanpassingen };
}

const IS_BRON = (soort: string) => {
  const k = symboolSoort(soort);
  return k === "batterij" || k === "spanningsbron";
};

/**
 * De bron wordt altijd apart getekend (veld bron). Een planner die de batterij óók als onderdeel in
 * componenten/takken zet, gaf een tweede, half getekende bron → code-check "batterij: geen lange + korte
 * plaat" → elke stroomkring gedropt. Zulke onderdelen gaan eruit; spanningsmeters worden meegeschoven.
 */
function zonderBronComponenten(d: SpecData<"stroomkring">, aanpassingen: string[]): SpecData<"stroomkring"> {
  const heeftBron = d.componenten.some((c) => IS_BRON(c.soort)) || d.takken.some((t) => t.some((c) => IS_BRON(c.soort)));
  if (!heeftBron) return d;
  const kaart = new Map<number, number>();
  const componenten: typeof d.componenten = [];
  let bronLabel: string | undefined;
  d.componenten.forEach((c, i) => {
    if (IS_BRON(c.soort)) {
      bronLabel ??= c.label;
      return;
    }
    kaart.set(i, componenten.length);
    componenten.push(c);
  });
  const takKaart = new Map<string, { tak: number; index: number }>();
  const takken: typeof d.takken = [];
  d.takken.forEach((tak, t) => {
    const nieuw: typeof tak = [];
    tak.forEach((c, i) => {
      if (IS_BRON(c.soort)) {
        bronLabel ??= c.label;
        return;
      }
      takKaart.set(`${t}.${i}`, { tak: takken.length, index: nieuw.length });
      nieuw.push(c);
    });
    if (nieuw.length) takken.push(nieuw);
  });
  const voltmeters: typeof d.voltmeters = d.voltmeters.map((vm) => {
    if (vm.over === "bron") return vm;
    if (typeof vm.over === "number") {
      const n = kaart.get(vm.over);
      return { ...vm, over: n ?? "bron" };
    }
    const n = takKaart.get(`${vm.over.tak}.${vm.over.index}`);
    return { ...vm, over: n ?? "bron" };
  });
  aanpassingen.push("batterij/spanningsbron uit de onderdelen gehaald (de bron wordt apart getekend)");
  const bron = !d.bron.label && bronLabel ? { ...d.bron, label: bronLabel } : d.bron;
  return { ...d, bron, componenten, takken, voltmeters };
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
  const soort = symboolSoort(label);
  if (soort === "onbekend") return { soort: "lampje", label };
  if (soort === "schakelaar-open" && !/open/i.test(label)) return { soort: "schakelaar-dicht", label };
  if (soort === "ampèremeter" || soort === "voltmeter") return { soort };
  return { soort, label };
}

/**
 * Oude, direct door het model ingevulde figuurvelden → figuurspec.
 * Zo gaan ook pictogram, maatcilinder, grafiek en schema door dezelfde go/no-go-keuring.
 */
export function legacySpecs(q: Vraag): FiguurSpec[] {
  const out: FiguurSpec[] = [];
  if (q.pictogram && pictogramPastBijVraag(q)) {
    out.push(
      isVeiligheidsbord(q.pictogram)
        ? basis("pictogram", "Veiligheidsbord dat de leerling moet herkennen.", { symbool: q.pictogram }, {
            verplichteElementen: [PICTOGRAM_NAAM[q.pictogram]],
            nietTonen: ["tekst of naam van het bord"],
          })
        : basis("pictogram", "GHS-gevarensymbool dat de leerling moet herkennen.", { symbool: q.pictogram }, {
            verplichteElementen: ["rode ruit", PICTOGRAM_NAAM[q.pictogram]],
            nietTonen: [q.pictogram, "naam van het symbool"],
          }),
    );
  }
  if (q.maatcilinder && maatcilinderPastBijVraag(q)) {
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

function woorden(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9,.]+/)
    .filter((w) => w.length > 2);
}

/**
 * Een door de planner voorgestelde nieuwe stam wordt alleen overgenomen als hij de VOLLEDIGE
 * vraag bevat: ongeveer even lang, en de vraagzin (laatste zin) en getallen van de oude stam staan erin.
 * Anders blijft de oude stam staan (bijv. planner gaf alleen "Bekijk de grafiek.").
 */
export function veiligeNieuweStam(oud: string, nieuw: string | undefined, context?: string): string | undefined {
  const n = zonderContext(nieuw?.trim(), context);
  if (!n || n === oud.trim()) return undefined;
  if (n.length < Math.min(oud.trim().length * 0.6, oud.trim().length - 10)) return undefined;
  const zinnen = oud.trim().split(/(?<=[.?!])\s+/).filter(Boolean);
  const vraagzin = [...zinnen].reverse().find((z) => /\?$/.test(z)) ?? zinnen[zinnen.length - 1] ?? "";
  const nw = new Set(woorden(n));
  const vz = woorden(vraagzin);
  if (vz.length && vz.filter((w) => nw.has(w)).length / vz.length < 0.7) return undefined;
  const getallen = oud.match(/\d+(?:[.,]\d+)?/g) ?? [];
  if (getallen.some((g) => !n.includes(g))) return undefined;
  return n;
}

/** De planner zet de context soms vóór de nieuwe stam; die staat al boven de vraag en mag niet dubbel. */
function zonderContext(stam: string | undefined, context: string | undefined): string | undefined {
  const c = context?.trim();
  if (!stam || !c) return stam;
  let s = stam;
  if (s.startsWith(c)) s = s.slice(c.length);
  else for (const zin of c.split(/(?<=[.?!])\s+/).filter((z) => z.length > 25)) s = s.replace(zin, "");
  return s.replace(/\s{2,}/g, " ").trim() || stam;
}
