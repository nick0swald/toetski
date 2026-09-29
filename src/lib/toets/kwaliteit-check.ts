import { heeftEchtFiguur } from "./blad-volgorde.ts";
import { detectVakProfiel } from "./bron-figuren.ts";
import { antwoordLettersInNakijk, findCorrectOptionIndex } from "./mc-balance.ts";
import { ongedekteLeerdoelen, extractLeerdoelen } from "./leerdoelen.ts";
import { rubricSomKlopt } from "./punten-rubric.ts";
import { bouwMatrijs } from "./rtti.ts";
import { RTTI_ORDER } from "./constants.ts";
import type { ItemIssue } from "./item-kwaliteit";
import type { Kwaliteitscheck, Kwaliteitspunt, NakijkItem, RttiVerdeling, Vraag } from "./types";

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
