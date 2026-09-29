import type { Vraag } from "./types";

/** Blokken op het leerlingblad, in afdrukvolgorde. */
export type Blok = "context" | "stimulus" | "stam" | "tabel" | "opties" | "antwoordlijnen";

/** Grafiek, schema, pictogram of maatcilinder. Een tabel telt niet. */
export function heeftEchtFiguur(q: Vraag): boolean {
  return Boolean(
    (q.grafiek && q.grafiek.punten.length >= 2) || q.schemaFiguur || q.pictogram || q.maatcilinder,
  );
}

export function heeftStimulus(q: Vraag): boolean {
  return heeftEchtFiguur(q);
}

/** Invultabel is het antwoordgebied: geen extra antwoordlijnen eronder. */
export function tabelIsAntwoordgebied(q: Vraag): boolean {
  const t = q.tabel;
  if (!t?.koppen?.length) return false;
  if (q.type === "invul") return true;
  const leeg = t.rijen.some((r) =>
    r.some((c) => {
      const cel = String(c ?? "").trim();
      return !cel || /^(\.{2,}|…+|_+|\?+|—|-)$/.test(cel);
    }),
  );
  if (leeg) return true;
  return /\b(vul in|noteer|schrijf in de tabel|geef bij|zet in de tabel)\b/i.test(q.stam);
}

/**
 * Leerlingblad: context → stimulusfiguur → punten/nummer/stam → tabel.
 * Een invultabel is het antwoordgebied; dan geen antwoordlijnen.
 */
export function blokkenVoorVraag(q: Vraag): Blok[] {
  const out: Blok[] = [];
  if (q.context?.trim()) out.push("context");
  if (heeftStimulus(q)) out.push("stimulus");
  out.push("stam");
  if (q.tabel?.koppen?.length) out.push("tabel");
  if (q.opties?.length) out.push("opties");
  else if (!tabelIsAntwoordgebied(q)) out.push("antwoordlijnen");
  return out;
}
