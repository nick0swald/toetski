import type { GegenereerdeToets } from "./types";

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
