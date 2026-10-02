/**
 * Placeholder voor een AI-afbeelding (foto of gestileerde illustratie van de situatie).
 * Stap 0 roept GEEN beeld-API aan: de figuur wordt een gestippeld kader met de beschrijving. In de live stroom
 * vervangt de bestaande beeldstroom dit kader door het gegenereerde beeld — pas na een interne go/no-go, en
 * daarna zonder nabewerking.
 *
 * De keuring hier is een spec-keuring: een AI-afbeelding mag nooit een meet- of rekenfiguur zijn.
 */
import type { AiAfbeeldingFiguur, VraagSpec } from "../spec.ts";
import { PT_PER_CM, Svg } from "./svg.ts";

/** Woorden in de vraagtekst die op meten/aflezen uit de figuur wijzen — dan hoort er een meetfiguur bij. */
const MEETWOORDEN = /\b(lees|aflezen|afgelezen|meet|opmeten|bepaal met de (figuur|afbeelding|foto)|op schaal|krachtenschaal|hokjes?|diagram|grafiek)\b/i;
/** Getallen met eenheid in de beschrijving: een beeld met meetwaarden is geen situatieplaatje. */
const MEETWAARDE = /\d+([.,]\d+)?\s*(m|cm|mm|km|kg|g|N|V|A|Ω|W|J|s|ms|Hz|dB|°C|mL|L|km\/h|m\/s)\b/;

function regels(tekst: string, maxTekens: number): string[] {
  const uit: string[] = [];
  let r = "";
  for (const w of tekst.split(/\s+/)) {
    if ((r + " " + w).trim().length > maxTekens && r) {
      uit.push(r);
      r = w;
    } else r = (r + " " + w).trim();
  }
  if (r) uit.push(r);
  return uit;
}

export function aiAfbeeldingSvg(f: AiAfbeeldingFiguur): string {
  const W = f.breedteCm * PT_PER_CM;
  const H = f.hoogteCm * PT_PER_CM;
  const s = new Svg(W, H);
  s.rect(1, 1, W - 2, H - 2, { fill: "#f4f4f4", kleur: "#8a8a8a", lw: 1, rol: "ai-afbeelding", extra: 'stroke-dasharray="5 3"' });
  const kop = f.stijl === "foto" ? "FOTO (AI-afbeelding)" : "ILLUSTRATIE (AI-afbeelding)";
  s.text(W / 2, 16, kop, { size: 9, bold: true, anker: "middle", va: "top", kleur: "#555555" });
  const max = Math.max(20, Math.floor(W / 5.2));
  const r = regels(f.beschrijving, max).slice(0, Math.max(1, Math.floor((H - 60) / 12)));
  s.text(W / 2, H / 2 - ((r.length - 1) * 12) / 2, r.join("\n"), { size: 9.5, anker: "middle", va: "center", kleur: "#333333" });
  s.text(W / 2, H - 10, "wordt in de beeldstroom gegenereerd · go/no-go vóór plaatsing", { size: 7.5, anker: "middle", va: "bottom", kleur: "#777777" });
  if (f.labels?.length) s.text(W - 8, 30, f.labels.join("\n"), { size: 8, anker: "end", va: "top", kleur: "#555555", rol: "labels" });
  return s.toString(f.breedteCm, `data-ai-afbeelding="${f.stijl}" aria-label="${f.alt.replace(/"/g, "'")}"`);
}

/**
 * Spec-keuring (go/no-go) van een AI-afbeelding binnen een vraag: alleen als foto/situatieplaatje.
 * Fout als de vraag iets uit de figuur laat meten/aflezen, als er parameters uit de figuur komen, of als de
 * beschrijving meetwaarden bevat.
 */
export function keurAiAfbeelding(f: AiAfbeeldingFiguur, q?: Pick<VraagSpec, "stam" | "parameters">): string[] {
  const fouten: string[] = [];
  if (MEETWAARDE.test(f.beschrijving)) fouten.push("ai-afbeelding: beschrijving bevat een meetwaarde (gebruik een meetfiguur)");
  if (q && MEETWOORDEN.test(q.stam)) fouten.push("ai-afbeelding: de vraag laat meten/aflezen — daar hoort een deterministische meetfiguur bij");
  if (q?.parameters?.some((p) => p.bron === "figuur")) fouten.push("ai-afbeelding: parameters met bron 'figuur' kunnen niet uit een AI-afbeelding komen");
  return fouten;
}
