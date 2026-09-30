import { figuurIsGeldig } from "./figuren/bevriezing.ts";
import type { Vraag } from "./types";

/** Blokken op het leerlingblad, in afdrukvolgorde. */
export type Blok = "context" | "stimulus" | "stam" | "figuur" | "tabel" | "opties" | "antwoordlijnen" | "tekenvak";

/** Oude figuurvelden (grafiek, schema, pictogram, maatcilinder) — alleen nog voor toetsen van vóór de beeldpijplijn. */
export function heeftLegacyStimulus(q: Vraag): boolean {
  return Boolean(
    (q.grafiek && q.grafiek.punten.length >= 2) || q.schemaFiguur || q.pictogram || q.maatcilinder,
  );
}

/** Goedgekeurde (go) en onveranderde figuur uit de beeldpijplijn. */
export function heeftGoedgekeurdeFiguur(q: Vraag): boolean {
  return figuurIsGeldig(q.figuur);
}

/** Grafiek, schema, pictogram, maatcilinder of goedgekeurde figuur. Een tabel telt niet. */
export function heeftEchtFiguur(q: Vraag): boolean {
  return heeftLegacyStimulus(q) || heeftGoedgekeurdeFiguur(q);
}

export function heeftStimulus(q: Vraag): boolean {
  return heeftLegacyStimulus(q);
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
 * Leerlingblad: context → (oude) stimulusfiguur → punten/nummer/stam → goedgekeurde figuur → tabel.
 * Een invultabel is het antwoordgebied; dan geen antwoordlijnen.
 * `opts.pijplijn`: toets heeft de beeldpijplijn gehad → alleen goedgekeurde figuren, nooit oude velden.
 */
export function blokkenVoorVraag(q: Vraag, opts: { pijplijn?: boolean } = {}): Blok[] {
  const out: Blok[] = [];
  if (q.context?.trim()) out.push("context");
  if (!opts.pijplijn && heeftStimulus(q)) out.push("stimulus");
  out.push("stam");
  if (heeftGoedgekeurdeFiguur(q)) out.push("figuur");
  if (q.tabel?.koppen?.length) out.push("tabel");
  if (q.opties?.length) out.push("opties");
  // Tekenvraag: leeg (code-getekend) raster als antwoordkader in plaats van lijnen.
  else if (q.tekenvak) out.push("tekenvak");
  else if (!tabelIsAntwoordgebied(q)) out.push("antwoordlijnen");
  return out;
}

/** Afmetingen van het tekenvak (hokjes van 1 cm), begrensd tot de bladbreedte. */
export function tekenvakMaat(q: Vraag): { kolommen: number; rijen: number } {
  const t = q.tekenvak;
  return { kolommen: Math.min(16, Math.max(4, t?.kolommen ?? 14)), rijen: Math.min(12, Math.max(3, t?.rijen ?? 8)) };
}
