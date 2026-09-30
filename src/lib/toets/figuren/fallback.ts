import { PICTOGRAM_BESCHRIJVING, type FiguurRapportItem, type FiguurSpec, type GhsSymbool, type Vraag, type VraagTabel } from "../types.ts";
import { parseSpecData } from "./spec.ts";
import { nl } from "./svg.ts";
import { zonderLegacyFiguren } from "./bevriezing.ts";

const FIGUURWOORD = /\b(de |het |deze |onderstaande |bovenstaande )?(figuur|grafiek|diagram|afbeelding|plaatje|tekening)( hieronder| hierboven| hiernaast)?\b/gi;

/** Keuringsredenen die op tegenspraak met de vraag wijzen. */
export function wijstOpTegenspraak(redenen: string[] = []): boolean {
  return redenen.some((r) => /tegenspraak|spreekt? .{0,40}tegen|klopt? niet met|kloppen niet met|impliceert/i.test(r));
}

function vervangWoorden(s: string | undefined, door: string): string | undefined {
  if (!s) return s;
  return s.replace(FIGUURWOORD, door).replace(/\s{2,}/g, " ").trim();
}

function metEenheid(label: string, eenheid?: string): string {
  return eenheid && !label.includes(eenheid) ? `${label} (${eenheid})` : label;
}

function tabelUitSpec(spec: FiguurSpec): VraagTabel | null {
  try {
    if (spec.soort === "lijngrafiek") {
      const d = parseSpecData("lijngrafiek", spec.data);
      if (d.reeksen.length !== 1) return null;
      return {
        koppen: [metEenheid(d.xLabel, d.xEenheid), metEenheid(d.yLabel, d.yEenheid)],
        rijen: d.reeksen[0]!.punten.map((p) => [nl(p.x), nl(p.y)]),
      };
    }
    if (spec.soort === "spreidingsdiagram") {
      const d = parseSpecData("spreidingsdiagram", spec.data);
      return { koppen: [metEenheid(d.xLabel, d.xEenheid), metEenheid(d.yLabel, d.yEenheid)], rijen: d.punten.map((p) => [nl(p.x), nl(p.y)]) };
    }
    if (spec.soort === "staafdiagram") {
      const d = parseSpecData("staafdiagram", spec.data);
      return { koppen: [d.xLabel || "", metEenheid(d.yLabel, d.yEenheid)], rijen: d.staven.map((s) => [s.label, nl(s.waarde)]) };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Deterministische terugval als er geen figuur geplaatst wordt en herschrijven via het model
 * niet lukte (of de functie zelf faalde). Er komt NOOIT een ongekeurde figuur op het blad.
 */
export function vraagZonderFiguur(
  q: Vraag,
  spec: FiguurSpec,
  opts: { legacy: boolean; verwijst: boolean; tegenspraak?: boolean },
): { vraag: Vraag; fallback: NonNullable<FiguurRapportItem["fallback"]> } {
  // Tekst die voor de figuur was ingekort, komt ongewijzigd terug (zolang de stam sindsdien niet is herschreven).
  const hersteld = q.tekstZonderFiguur && q.tekstZonderFiguur.na === q.stam ? { ...q, stam: q.tekstZonderFiguur.stam, context: q.tekstZonderFiguur.context } : q;
  const { tekstZonderFiguur: _t, ...zonderTekst } = hersteld;
  const kaal = zonderLegacyFiguren(zonderTekst as Vraag);
  if (q.tekstZonderFiguur && q.tekstZonderFiguur.na === q.stam) return { vraag: kaal, fallback: "tekst" };
  // Nieuwe (geplande) figuur die de vraag niet nodig had: vraag blijft zoals hij was.
  if (!opts.legacy && !opts.verwijst) return { vraag: kaal, fallback: "geen-figuur" };
  // Figuurdata die de vraag tegenspreekt, wordt ook geen tabel.
  const tabel = !kaal.tabel && !opts.tegenspraak ? tabelUitSpec(spec) : null;
  if (tabel) {
    return {
      vraag: {
        ...kaal,
        tabel,
        context: vervangWoorden(kaal.context, "de tabel"),
        stam: vervangWoorden(kaal.stam, "de tabel") ?? kaal.stam,
      },
      fallback: "tabel",
    };
  }
  if (spec.soort === "maatcilinder") {
    try {
      const d = parseSpecData("maatcilinder", spec.data);
      const zin = d.standen.map((s) => `${s.label}: ${nl(s.ml)} mL`).join("; ");
      const stam = kaal.stam
        .replace(/Lees de beginstand en de stand na het onderdompelen af van de maatcilinder\.?\s*/i, "")
        .trim();
      return {
        vraag: { ...kaal, context: [kaal.context, `De maatcilinder geeft deze standen aan — ${zin}.`].filter(Boolean).join(" "), stam },
        fallback: "tekst",
      };
    } catch {
      /* val door */
    }
  }
  if (spec.soort === "pictogram") {
    // Geen plaatje: beschrijf wat je op het symbool ziet (niet wat het betekent).
    const symbool = (spec.data as { symbool?: GhsSymbool } | undefined)?.symbool;
    const beschrijving = symbool ? PICTOGRAM_BESCHRIJVING[symbool] : undefined;
    if (beschrijving) {
      const zet = (t?: string) => t?.replace(/\b(?:dit|het|deze|dat)\s+(gevarensymbool|pictogram|veiligheidsbord|bord|symbool)(?:\s+met\s+een)?\b(?!\s+met)/i, `het $1 met ${beschrijving}`);
      const stamB = zet(kaal.stam) ?? kaal.stam;
      const ctxB = stamB === kaal.stam ? zet(kaal.context) : kaal.context;
      if (stamB !== kaal.stam || ctxB !== kaal.context) return { vraag: { ...kaal, stam: stamB, context: ctxB }, fallback: "tekst" };
    }
  }
  let stam = vervangWoorden(kaal.stam, "de situatie") ?? kaal.stam;
  // Tekenopdracht zonder tekening: teken op het antwoordblad.
  if (/\bteken\b/i.test(stam)) stam = stam.replace(/\s+in de situatie\b/gi, " op je antwoordblad");
  return { vraag: { ...kaal, stam }, fallback: "verwijderd" };
}
