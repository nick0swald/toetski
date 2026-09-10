import type { Kwaliteitscheck, Vraag, VraagType } from "./types";

const MC_TYPES: VraagType[] = ["meerkeuze", "juist-onjuist"];

export function isMcLikeType(type: VraagType | string): boolean {
  return MC_TYPES.includes(type as VraagType);
}

export function mcAandeel(vragen: Vraag[]): number {
  if (vragen.length === 0) return 0;
  const mc = vragen.filter((q) => isMcLikeType(q.type)).length;
  return mc / vragen.length;
}

/** Dictee/schrijf/luister/spreek → geen hoge MC-eis. */
export function isTaalvaardigheidToets(tekst: string): boolean {
  const t = tekst.toLowerCase();
  return /\bdictee\b|\bschrijf(?:vaardigheid|opdracht)?\b|\bluister(?:vaardigheid)?\b|\bspreek(?:vaardigheid)?\b|\bschrijven\b|\bluisteren\b|\bspreken\b/.test(
    t,
  );
}

/**
 * Hoofdstuktoets / voldoende stof → streef ≥50% MC,
 * tenzij docent MC/open vastzet of het een taalvaardigheidstoets is.
 */
export function wilHogeMcShare(opts: {
  bron: string;
  extraEisen?: string;
  titel?: string;
  vak?: string;
  mcVragen?: number;
  openVragen?: number;
}): boolean {
  if (opts.mcVragen != null || opts.openVragen != null) return false;
  const ctx = `${opts.titel ?? ""} ${opts.vak ?? ""} ${opts.extraEisen ?? ""} ${opts.bron.slice(0, 2000)}`;
  if (isTaalvaardigheidToets(ctx)) return false;
  if (/\bweinig\s+mc\b|\bgeen\s+meerkeuze\b|\balleen\s+open\b|\bopen\s+vragen\s+alleen\b/i.test(ctx)) {
    return false;
  }
  const bronLen = opts.bron.trim().length;
  // Voldoende stof ≈ meer dan een kort plaksel; of expliciet hoofdstuk/paragraaf.
  const genoegStof = bronLen >= 600 || /\bhoofdstuk\b|\bparagraaf\b|\bleerdoel/i.test(opts.bron.slice(0, 3000));
  return genoegStof;
}

export function mcShareDoelTekst(): string {
  return "Hoofdstuktoets met voldoende stof: minimaal de helft (≥50%) meerkeuze/juist-onjuist, tenzij Extra eisen anders vragen.";
}

/**
 * Annotatie in kwaliteit als het model onder de 50% MC blijft waar we dat wel wilden.
 * Geen zware handhaving (geen nep-MC verzinnen) — wel zichtbaar voor de docent.
 */
export function annoteerMcAandeel(
  kwaliteit: Kwaliteitscheck,
  vragen: Vraag[],
  wilHoog: boolean,
): Kwaliteitscheck {
  if (!wilHoog || vragen.length < 4) return kwaliteit;
  const aandeel = mcAandeel(vragen);
  if (aandeel >= 0.5) return kwaliteit;
  const pct = Math.round(aandeel * 100);
  const criterium = "MC-aandeel";
  const punt = {
    criterium,
    oordeel: "aandacht" as const,
    toelichting: `Nu ongeveer ${pct}% meerkeuze/juist-onjuist; voor een hoofdstuktoets met voldoende stof streven we naar ≥50%. Gebruik Bijschaven of Extra vraag(en) (MC), of geef feedback.`,
  };
  const rest = (kwaliteit.punten ?? []).filter((p) => p.criterium !== criterium);
  return {
    samenvatting: kwaliteit.samenvatting,
    punten: [...rest, punt],
  };
}
