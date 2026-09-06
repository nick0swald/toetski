import { RTTI_META, SCHOOL } from "./constants";
import { totaalPunten } from "./rtti";
import type { GegenereerdeToets } from "./types";

export function toetsAlsTekst(toets: GegenereerdeToets): string {
  const max = totaalPunten(toets.vragen);
  const m = toets.meta;
  const lines: string[] = [
    SCHOOL,
    `${m.vak} · ${m.leerweg} · klas ${m.leerjaar}`,
    m.titel,
    `Tijd: ${m.duurMinuten} minuten · Maximumscore: ${max} punten`,
    "",
    "Hulpmiddelen: " + (m.hulpmiddelen.join("; ") || "geen"),
    "",
    "Instructies",
    ...m.instructies.map((s) => `• ${s}`),
    "",
  ];

  for (const q of toets.vragen) {
    lines.push(`Vraag ${q.nummer}  (${q.punten}p)  [${q.rtti}]`);
    if (q.context) {
      lines.push(q.context);
      lines.push("");
    }
    lines.push(q.stam);
    if (q.opties?.length) {
      for (const o of q.opties) lines.push(`${o.letter}  ${o.tekst}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function nakijkAlsTekst(toets: GegenereerdeToets): string {
  const lines: string[] = [
    SCHOOL,
    `Correctievoorschrift · ${toets.meta.vak} · ${toets.meta.titel}`,
    toets.cesuur.formule,
    toets.cesuur.toelichting,
    "",
  ];
  for (const n of toets.nakijkmodel) {
    const q = toets.vragen.find((v) => v.nummer === n.nummer);
    lines.push(`Vraag ${n.nummer}  (${q?.punten ?? "?"}p)  ${q ? RTTI_META[q.rtti].kort : ""}`);
    lines.push("Modelantwoord: " + n.modelantwoord);
    for (const p of n.puntenverdeling) {
      lines.push(`  • ${p.punt}p — ${p.criterium}`);
    }
    if (n.nietToekennen?.length) {
      lines.push("Niet toekennen: " + n.nietToekennen.join("; "));
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadJson(toets: GegenereerdeToets) {
  const blob = new Blob([JSON.stringify(toets, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(toets.meta.titel)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "toets";
}

export function kwaliteitAlsTekst(toets: GegenereerdeToets): string {
  const k = toets.kwaliteit;
  if (!k?.punten?.length && !k?.samenvatting) return "";
  const oordeelLabel: Record<string, string> = {
    voldoet: "VOLDOET",
    aandacht: "AANDACHT",
    ontbreekt: "ONTBREEKT",
  };
  const regels = [
    `Kwaliteitscheck van Aeres Toetsmaker bij «${toets.meta.titel}»`,
    k.samenvatting ? `Samenvatting: ${k.samenvatting}` : "",
    "",
    "Pas de toets aan op punten met AANDACHT of ONTBREEKT. Wat VOLDOET, laat staan.",
    "",
  ];
  for (const p of k.punten) {
    regels.push(`- ${p.criterium} — ${oordeelLabel[p.oordeel] ?? p.oordeel}: ${p.toelichting}`);
  }
  return regels.filter((r, i, a) => r !== "" || a[i - 1] !== "").join("\n").trim();
}

export function samenstellenFeedback(opts: {
  siteTekst?: string;
  extra?: string;
  bestandTekst?: string;
}): string {
  const delen: string[] = [];
  if (opts.siteTekst?.trim()) {
    delen.push(opts.siteTekst.trim());
  }
  if (opts.extra?.trim()) {
    delen.push(`Eigen wijzigingen van de docent:\n${opts.extra.trim()}`);
  }
  if (opts.bestandTekst?.trim()) {
    delen.push(`Uit Word-bestand:\n${opts.bestandTekst.trim()}`);
  }
  return delen.join("\n\n").slice(0, 8000);
}
