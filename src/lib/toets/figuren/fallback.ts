import type { FiguurRapportItem, FiguurSpec, Vraag, VraagTabel } from "../types.ts";
import { parseSpecData } from "./spec.ts";
import { nl } from "./svg.ts";
import { zonderLegacyFiguren } from "./bevriezing.ts";

const FIGUURWOORD = /\b(de |het |deze |onderstaande |bovenstaande )?(figuur|grafiek|diagram|afbeelding|plaatje|tekening)( hieronder| hierboven| hiernaast)?\b/gi;

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
  opts: { legacy: boolean; verwijst: boolean },
): { vraag: Vraag; fallback: NonNullable<FiguurRapportItem["fallback"]> } {
  const kaal = zonderLegacyFiguren(q);
  // Nieuwe (geplande) figuur die de vraag niet nodig had: vraag blijft zoals hij was.
  if (!opts.legacy && !opts.verwijst) return { vraag: kaal, fallback: "geen-figuur" };
  const tabel = !kaal.tabel ? tabelUitSpec(spec) : null;
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
  return { vraag: { ...kaal, stam: vervangWoorden(kaal.stam, "de situatie") ?? kaal.stam }, fallback: "verwijderd" };
}
