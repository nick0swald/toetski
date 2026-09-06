import { RTTI_META, SCHOOL } from "./constants";
import { totaalPunten } from "./rtti";
import type { GegenereerdeToets } from "./types";

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "toets";
}

export function vorigeSamenvatting(toets: GegenereerdeToets): string {
  const regels = toets.vragen.map((q) => {
    const stam = q.stam.replace(/\s+/g, " ").slice(0, 140);
    return `v${q.nummer} [${q.rtti}] ${q.punten}p ${q.domein}: ${stam}`;
  });
  return [
    `Titel: ${toets.meta.titel}`,
    `Versie ${toets.meta.versie} · ronde ${toets.ronde ?? 1} · ${toets.meta.moeilijkheid} · ${toets.meta.leerweg} klas ${toets.meta.leerjaar}`,
    ...regels,
  ].join("\n");
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
    `Kwaliteitscheck van Ares058 Toetsmaker bij «${toets.meta.titel}»`,
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
  if (opts.siteTekst?.trim()) delen.push(opts.siteTekst.trim());
  if (opts.extra?.trim()) delen.push(`Eigen wijzigingen van de docent:\n${opts.extra.trim()}`);
  if (opts.bestandTekst?.trim()) delen.push(`Uit Word-bestand:\n${opts.bestandTekst.trim()}`);
  return delen.join("\n\n").slice(0, 8000);
}

export function toetsAlsTekst(toets: GegenereerdeToets): string {
  const max = totaalPunten(toets.vragen);
  const m = toets.meta;
  const lines: string[] = [
    SCHOOL,
    `${m.vak} · ${m.leerweg} · klas ${m.leerjaar}`,
    m.titel,
    `Tijd: ${m.duurMinuten} minuten · Maximumscore: ${max} punten`,
    "",
  ];
  for (const q of toets.vragen) {
    lines.push(`Vraag ${q.nummer}  (${q.punten}p)  [${q.rtti}]`);
    if (q.context) lines.push(q.context, "");
    lines.push(q.stam);
    if (q.opties?.length) {
      for (const o of q.opties) lines.push(`${o.letter}  ${o.tekst}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function nakijkAlsTekst(toets: GegenereerdeToets): string {
  const lines: string[] = [SCHOOL, `Correctievoorschrift · ${toets.meta.vak} · ${toets.meta.titel}`, ""];
  for (const n of toets.nakijkmodel) {
    const q = toets.vragen.find((v) => v.nummer === n.nummer);
    lines.push(`Vraag ${n.nummer}  (${q?.punten ?? "?"}p)  ${q ? RTTI_META[q.rtti].kort : ""}`);
    lines.push("Modelantwoord: " + n.modelantwoord);
    lines.push("");
  }
  return lines.join("\n");
}
