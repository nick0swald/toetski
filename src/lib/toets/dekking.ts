import type { Vraag } from "./types";

export type DekkingHint = {
  samenvatting: string;
  gedekt: string[];
  dun: string[];
};

/** Normaliseer voor losse matching van onderwerpen. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return norm(s)
    .split(" ")
    .filter((w) => w.length >= 4);
}

/**
 * Lichtgewicht onderwerpen uit lesstof: kopjes, genummerde leerdoelen, "leerdoel:"-regels.
 * Geen zware analyse — alleen wat herkenbaar is.
 */
export function extractOnderwerpen(bron: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const t = raw.replace(/\s+/g, " ").trim().replace(/[.:;]+$/, "");
    if (t.length < 4 || t.length > 80) return;
    const key = norm(t);
    if (seen.has(key) || /^(bladzijde|pagina|opgave|opdracht|tabel|figuur)\b/i.test(t)) return;
    seen.add(key);
    out.push(t);
  };

  for (const line of bron.split(/\r?\n/)) {
    const L = line.trim();
    if (!L || L.length > 120) continue;
    const leerdoel = L.match(/^(?:leerdoel(?:en)?|doel)\s*[:\-–—]\s*(.+)$/i);
    if (leerdoel?.[1]) {
      push(leerdoel[1]);
      continue;
    }
    const genummerd = L.match(/^(?:\d+[\.\)]\s+|[\-\*•]\s+)(.{8,80})$/);
    if (genummerd?.[1] && !/\?$/.test(genummerd[1]) && /[a-zA-ZÀ-ÿ]{4,}/.test(genummerd[1])) {
      // Alleen als het op een leerdoel/onderwerp lijkt (werkwoord of begrip), geen hele alinea.
      if (!/^(bereken|leg uit|noem|geef|verklaar|lees)\b/i.test(genummerd[1])) {
        push(genummerd[1]);
      }
      continue;
    }
    const kop = L.match(/^(?:#{1,3}\s+|hoofdstuk\s+\d+[:.\s]+|paragraaf\s+\d+[:.\s]+|§\s*\d+[:.\s]*)(.{4,80})$/i);
    if (kop?.[1]) {
      push(kop[1]);
      continue;
    }
    if (/^[A-ZÀ-ÿ][^a-z]{0,2}.{2,50}$/.test(L) && L === L.toUpperCase() && L.length <= 60) {
      push(L);
    }
  }

  // Domein-achtige korte zinnen met ":" in de eerste regels van lange stof
  if (out.length < 3) {
    const head = bron.slice(0, 2500);
    for (const m of head.matchAll(/(?:begrip(?:pen)?|formule(?:s)?|onderwerp(?:en)?)\s*[:\-–—]\s*([^\n.]{4,60})/gi)) {
      if (m[1]) push(m[1]);
    }
  }

  return out.slice(0, 12);
}

function matchScore(onderwerp: string, vraagTekst: string): number {
  const ot = tokens(onderwerp);
  if (ot.length === 0) return 0;
  const vt = new Set(tokens(vraagTekst));
  let hit = 0;
  for (const t of ot) {
    if (vt.has(t)) hit += 1;
    else if ([...vt].some((v) => v.includes(t) || t.includes(v))) hit += 0.5;
  }
  return hit / ot.length;
}

/**
 * Vergelijkt herkenbare lesstof-onderwerpen met domein/leerdoel/stam van de vragen.
 * Geeft null als er te weinig signalen zijn (geen zware dashboard-claim).
 */
export function bouwDekkingHint(bron: string, vragen: Vraag[]): DekkingHint | null {
  if (!bron?.trim() || vragen.length === 0) return null;
  const onderwerpen = extractOnderwerpen(bron);
  // Fallback: unieke domeinen/leerdoelen uit vragen als bron geen kopjes heeft
  const uitVragen = [
    ...new Set(
      vragen
        .flatMap((q) => [q.domein, q.leerdoel].filter(Boolean))
        .map((s) => s.trim())
        .filter((s) => s.length >= 4 && s.length <= 80 && !/^algemeen$/i.test(s)),
    ),
  ].slice(0, 10);

  const topics = onderwerpen.length >= 2 ? onderwerpen : uitVragen;
  if (topics.length < 2) return null;

  const gedekt: string[] = [];
  const dun: string[] = [];

  for (const topic of topics) {
    let best = 0;
    for (const q of vragen) {
      const blob = `${q.domein} ${q.leerdoel} ${q.stam} ${q.context ?? ""}`;
      best = Math.max(best, matchScore(topic, blob));
    }
    if (best >= 0.35) gedekt.push(topic);
    else dun.push(topic);
  }

  // Als alles uit vragen komt en alles "gedekt" is, weinig nieuws — dan alleen tonen bij dunne plekken uit bron.
  if (onderwerpen.length < 2 && dun.length === 0) return null;

  const delen: string[] = [];
  if (gedekt.length) delen.push(`Redelijk gedekt: ${gedekt.slice(0, 5).join("; ")}.`);
  if (dun.length) delen.push(`Dun of niet zichtbaar in de vragen: ${dun.slice(0, 5).join("; ")}.`);
  else delen.push("Geen opvallend dunne plekken herkend in de lesstof-kopjes.");

  return {
    samenvatting: delen.join(" "),
    gedekt,
    dun,
  };
}
