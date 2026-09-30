import { heeftEchtFiguur } from "./blad-volgorde.ts";
import { detectVakProfiel } from "./bron-figuren.ts";
import { antwoordLettersInNakijk, findCorrectOptionIndex } from "./mc-balance.ts";
import { ongedekteLeerdoelen, extractLeerdoelen } from "./leerdoelen.ts";
import { rubricSomKlopt } from "./punten-rubric.ts";
import { bouwMatrijs } from "./rtti.ts";
import { RTTI_ORDER } from "./constants.ts";
import type { ItemIssue } from "./item-kwaliteit";
import { figuurIsGeldig } from "./figuren/bevriezing.ts";
import type { FiguurRapport, Kwaliteitscheck, Kwaliteitspunt, NakijkItem, RttiVerdeling, Vraag } from "./types";

function kwalitatief(llm?: Kwaliteitscheck | null): string {
  if (!llm) return "";
  const tekst = [llm.samenvatting, ...(llm.punten ?? []).map((p) => p.toelichting)].filter(Boolean).join(" ");
  const zinnen = tekst.split(/(?<=[.!?])\s+/);
  const keep = zinnen
    .map((z) => z.trim())
    .filter((z) => z.length > 40)
    .filter((z) => !/\d/.test(z))
    .filter((z) => !/voldoet|totaal|rtti|figuur|leerdoel|procent|%/i.test(z));
  return keep.slice(0, 2).join(" ");
}

function figuurSoorten(vragen: Vraag[]): string[] {
  const set = new Set<string>();
  for (const q of vragen) {
    if (q.pictogram) set.add("pictogram");
    if (q.maatcilinder) set.add("maatcilinder");
    if (q.grafiek && q.grafiek.punten.length >= 2) set.add("grafiek");
    if (q.schemaFiguur) set.add("schema");
    if (figuurIsGeldig(q.figuur)) set.add(q.figuur.soort);
  }
  return [...set];
}

/**
 * Zelfcheck uit de echte toets. 'voldoet' alleen als de berekening klopt, anders 'let op'.
 * De LLM mag alleen een kwalitatieve opmerking toevoegen.
 */
export function bouwKwaliteit(input: {
  vragen: Vraag[];
  nakijkmodel: NakijkItem[];
  bron: string;
  vak: string;
  rttiDoel: RttiVerdeling;
  llm?: Kwaliteitscheck | null;
  issues?: ItemIssue[];
}): Kwaliteitscheck {
  const { vragen, nakijkmodel, bron, vak, rttiDoel } = input;
  const punten: Kwaliteitspunt[] = [];
  const max = vragen.reduce((s, q) => s + (q.punten || 0), 0);
  const rubriek = rubricSomKlopt(vragen, nakijkmodel);
  punten.push({
    criterium: "Punten",
    oordeel: rubriek.ok ? "voldoet" : "let op",
    toelichting: rubriek.ok
      ? `Totaal ${max} punten. Elke rubriek telt op tot de vraagsom, in hele punten.`
      : `Totaal ${max} punten. ${rubriek.problemen.slice(0, 4).join("; ")}.`,
  });

  const matrijs = bouwMatrijs(vragen, rttiDoel);
  const pct = matrijs.totalen;
  const rttiTekst = `R ${pct.R.percentage}% · T1 ${pct.T1.percentage}% · T2 ${pct.T2.percentage}% · I ${pct.I.percentage}%.`;
  const afwijking = Math.max(
    ...RTTI_ORDER.map((k) => Math.abs((pct[k]?.percentage ?? 0) - (matrijs.doelverdeling[k] ?? 0))),
  );
  punten.push({
    criterium: "RTTI-balans",
    oordeel: afwijking <= 15 ? "voldoet" : "let op",
    toelichting: `${rttiTekst} Doel R ${matrijs.doelverdeling.R}% · T1 ${matrijs.doelverdeling.T1}% · T2 ${matrijs.doelverdeling.T2}% · I ${matrijs.doelverdeling.I}%.`,
  });

  const nask = detectVakProfiel(vak, bron) === "nask";
  const echte = vragen.filter(heeftEchtFiguur);
  const tabellen = vragen.filter((q) => q.tabel?.koppen?.length).length;
  if (nask || echte.length || tabellen) {
    const soorten = figuurSoorten(vragen);
    if (echte.length > 0 && (!nask || echte.length >= 1)) {
      punten.push({
        criterium: "Figuren",
        oordeel: "voldoet",
        toelichting: `${echte.length} echte figuur${echte.length === 1 ? "" : "en"} (${soorten.join(", ") || "figuur"}). Een tabel telt niet mee${tabellen ? ` (${tabellen} tabel${tabellen === 1 ? "" : "len"} apart)` : ""}.`,
      });
    } else {
      punten.push({
        criterium: "Figuren",
        oordeel: "let op",
        toelichting: nask
          ? `Geen echte figuur (pictogram, maatcilinder, grafiek of schema). ${tabellen ? `Wel ${tabellen} tabel; een tabel telt niet.` : "Een tabel telt niet."}`
          : "Geen echte figuur gevonden.",
      });
    }
  }

  const doelen = extractLeerdoelen(bron).filter((d) => d.tekst.length >= 8);
  if (doelen.length < 2) {
    punten.push({
      criterium: "Leerdoeldekking",
      oordeel: "let op",
      toelichting: "Geen genummerde leerdoelen in de lesstof herkend; dekking is niet gecontroleerd.",
    });
  } else {
    const mis = ongedekteLeerdoelen(bron, vragen);
    punten.push({
      criterium: "Leerdoeldekking",
      oordeel: mis.length ? "let op" : "voldoet",
      toelichting: mis.length
        ? `Niet gedekt: ${mis.map((d) => `${d.code}${d.plus ? " (PLUS)" : ""}`).join(", ")}.`
        : `Alle ${doelen.length} genummerde leerdoelen komen in de vragen terug.`,
    });
  }

  const mcFout: string[] = [];
  for (const q of vragen) {
    if (!q.opties || q.opties.length < 2) continue;
    const n = nakijkmodel.find((item) => item.nummer === q.nummer);
    if (!n) continue;
    const idx = findCorrectOptionIndex(q.opties, n.modelantwoord);
    const key = idx >= 0 ? (q.opties[idx]?.letter ?? "").replace(/[^A-D]/gi, "").slice(0, 1).toUpperCase() : "";
    const letters = antwoordLettersInNakijk(n);
    if (!key || letters.some((L) => L !== key)) mcFout.push(String(q.nummer));
  }
  punten.push({
    criterium: "Nakijkmodel",
    oordeel: mcFout.length ? "let op" : "voldoet",
    toelichting: mcFout.length
      ? `MC-rubriek noemt een andere letter dan de sleutel bij vraag ${mcFout.join(", ")}.`
      : "Bij meerkeuze volgt de rubriek de sleutelletter.",
  });

  const issues = input.issues ?? [];
  if (issues.length) {
    const uniek = [...new Map(issues.map((x) => [`${x.nummer}:${x.code}`, x])).values()];
    punten.push({
      criterium: "Itemkwaliteit",
      oordeel: "let op",
      toelichting: uniek
        .slice(0, 6)
        .map((x) => `Vraag ${x.nummer}: ${x.uitleg}`)
        .join(" "),
    });
  }

  const opmerking = kwalitatief(input.llm);
  const samenvatting = [
    `Totaal ${max} punten.`,
    rttiTekst,
    nask ? `Echte figuren: ${echte.length}.` : "",
    doelen.length >= 2 ? `Leerdoelen gedekt: ${doelen.length - ongedekteLeerdoelen(bron, vragen).length} van ${doelen.length}.` : "",
    opmerking ? `Opmerking: ${opmerking}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { samenvatting, punten };
}

/**
 * Figuurkwaliteit, berekend uit de echte toets en het figuurrapport (niet uit een modelclaim).
 * Vervangt het punt "Figuren" en voegt "Figuurkeuring (go/no-go)" toe.
 */
export function figuurKeuringPunten(
  vragen: Vraag[],
  rapport: FiguurRapport | undefined,
  opts: { nask: boolean },
): { figuren: Kwaliteitspunt; keuring: Kwaliteitspunt; samenvatting: string } {
  const geplaatst = vragen.filter((q) => figuurIsGeldig(q.figuur));
  const beschadigd = vragen.filter((q) => q.figuur && !figuurIsGeldig(q.figuur)).length;
  const echte = vragen.filter(heeftEchtFiguur);
  const soorten = figuurSoorten(vragen);
  const items = rapport?.items ?? [];
  const aangevraagd = items.length;
  const go = items.filter((i) => i.status === "go").length;
  const gedropt = items.filter((i) => i.status === "gedropt");
  const pogingen = items.reduce((s, i) => s + (i.pogingen || 0), 0);
  const tabellen = vragen.filter((q) => q.tabel?.koppen?.length).length;

  const figuren: Kwaliteitspunt = echte.length
    ? {
        criterium: "Figuren",
        oordeel: "voldoet",
        toelichting: `${echte.length} echte figuur${echte.length === 1 ? "" : "en"} (${soorten.join(", ") || "figuur"}). Een tabel telt niet mee${tabellen ? ` (${tabellen} tabel${tabellen === 1 ? "" : "len"} apart)` : ""}.`,
      }
    : {
        criterium: "Figuren",
        oordeel: opts.nask ? "let op" : "voldoet",
        toelichting: opts.nask
          ? `Geen goedgekeurde figuur in de toets.${tabellen ? ` Wel ${tabellen} tabel; een tabel telt niet.` : ""}`
          : "Geen figuren nodig of geplaatst.",
      };

  const drop = gedropt
    .slice(0, 5)
    .map((i) => {
      const wat = i.fallback === "herschreven" || i.fallback === "vervangen"
        ? `vraag ${i.fallback} zonder figuur`
        : i.fallback === "tabel"
          ? "gegevens als tabel"
          : i.fallback === "tekst"
            ? "gegevens in de tekst"
            : i.fallback === "verwijderd"
              ? "figuur weggelaten — controleer de vraag"
              : "geen figuur";
      return `vraag ${i.nummer} (${i.soort}, ${i.pogingen} poging${i.pogingen === 1 ? "" : "en"}: ${(i.redenen[0] ?? "no-go").replace(/\.$/, "")}) → ${wat}`;
    })
    .join("; ");
  const probleem = beschadigd > 0 || gedropt.some((i) => i.fallback === "verwijderd") || geplaatst.length !== go;
  const keuring: Kwaliteitspunt = {
    criterium: "Figuurkeuring (go/no-go)",
    oordeel: probleem || gedropt.length ? "let op" : "voldoet",
    toelichting: aangevraagd
      ? `${aangevraagd} figu${aangevraagd === 1 ? "ur" : "ren"} gekeurd: ${go} go (geplaatst en bevroren), ${gedropt.length} gedropt, ${pogingen} keuringspoging${pogingen === 1 ? "" : "en"} totaal.${
          drop ? ` Gedropt: ${drop}.` : ""
        }${beschadigd ? ` ${beschadigd} figuur geweigerd: inhoud gewijzigd na goedkeuring.` : ""}${
          geplaatst.length !== go ? ` Nu geplaatst: ${geplaatst.length}.` : ""
        }`
      : "Geen figuren aangevraagd.",
  };
  const samenvatting = `Figuren: ${geplaatst.length} geplaatst (go), ${gedropt.length} gedropt, ${pogingen} keuringspogingen.`;
  return { figuren, keuring, samenvatting };
}

export function metFiguurKwaliteit(
  kwaliteit: Kwaliteitscheck,
  vragen: Vraag[],
  rapport: FiguurRapport | undefined,
  opts: { nask: boolean },
): Kwaliteitscheck {
  const { figuren, keuring, samenvatting } = figuurKeuringPunten(vragen, rapport, opts);
  const rest = (kwaliteit?.punten ?? []).filter((p) => p.criterium !== "Figuren" && p.criterium !== keuring.criterium);
  const idx = (kwaliteit?.punten ?? []).findIndex((p) => p.criterium === "Figuren");
  const punten = rest.slice();
  punten.splice(idx >= 0 ? Math.min(idx, punten.length) : Math.min(2, punten.length), 0, figuren, keuring);
  const basis = (kwaliteit?.samenvatting ?? "")
    .replace(/\s*Echte figuren: \d+\./, "")
    .replace(/\s*Figuren: \d+ geplaatst \(go\), \d+ gedropt, \d+ keuringspogingen\./, "")
    .trim();
  const zinnen = basis.split(/(?<=\.)\s+/);
  const plek = zinnen.findIndex((z) => /^R \d+%/.test(z));
  if (plek >= 0) zinnen.splice(plek + 1, 0, samenvatting);
  else zinnen.push(samenvatting);
  return { samenvatting: zinnen.filter(Boolean).join(" "), punten };
}
