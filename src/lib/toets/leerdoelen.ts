import type { Vraag } from "./types";

export type Leerdoel = {
  code: string;
  tekst: string;
  plus: boolean;
  paragraaf: string;
  paragraafTitel: string;
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** stoffeigenschap → stofeigenschap (ook meervoud). */
export function normaliseerSpelling(s: string): string {
  return s
    .replace(/Stoffeigenschap/g, "Stofeigenschap")
    .replace(/stoffeigenschap/g, "stofeigenschap");
}

function tokens(s: string): string[] {
  return norm(s)
    .split(" ")
    .filter((w) => w.length >= 4);
}

/**
 * Genummerde leerdoelen uit de lesstof, inclusief PLUS.
 * Herkent "2.1 Stoffen herkennen" en "2.1.1 Je kunt …" (PLUS op de regel ervoor).
 */
export function extractLeerdoelen(bron: string): Leerdoel[] {
  const out: Leerdoel[] = [];
  let plusNext = false;
  let parTitel = new Map<string, string>();
  const lines = bron.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.replace(/\s+/g, " ").trim();
    if (!line) continue;
    if (/^plus\b/i.test(line)) {
      plusNext = true;
      continue;
    }
    const par = line.match(/^(?:paragraaf\s+|§\s*)?(\d+\.\d+)\s+([A-Za-zÀ-ÿ].{2,80})$/i);
    if (par && !/^\d+\.\d+\.\d+/.test(line)) {
      const titel = `${par[1]} ${par[2]!.replace(/[.:;]+$/, "").trim()}`;
      parTitel.set(par[1]!, titel);
      plusNext = false;
      continue;
    }
    const alleen = line.match(/^(\d+\.\d+\.\d+)$/);
    const sub = line.match(/^(\d+\.\d+\.\d+)\s+(.{4,180})$/);
    const code = alleen?.[1] ?? sub?.[1];
    if (!code) {
      plusNext = false;
      continue;
    }
    let tekst = (sub?.[2] ?? "").trim();
    if (!tekst) {
      const next = lines[i + 1]?.replace(/\s+/g, " ").trim() ?? "";
      if (next && !/^\d+\.\d+/.test(next) && !/^plus\b/i.test(next)) tekst = next;
    }
    const paragraaf = code.split(".").slice(0, 2).join(".");
    const plus = plusNext || /\bPLUS\b/.test(line);
    plusNext = false;
    out.push({
      code,
      tekst: tekst.replace(/[.:;]+$/, ""),
      plus,
      paragraaf,
      paragraafTitel: parTitel.get(paragraaf) ?? paragraaf,
    });
  }
  // titels die pas ná de subdoelen staan, alsnog invullen
  parTitel = new Map(out.map((d) => [d.paragraaf, d.paragraafTitel]));
  for (const line of lines) {
    const par = line.trim().match(/^(?:paragraaf\s+|§\s*)?(\d+\.\d+)\s+([A-Za-zÀ-ÿ].{2,80})$/i);
    if (par && !/^\d+\.\d+\.\d+/.test(line.trim())) {
      parTitel.set(par[1]!, `${par[1]} ${par[2]!.replace(/[.:;]+$/, "").trim()}`);
    }
  }
  return out.map((d) => ({ ...d, paragraafTitel: parTitel.get(d.paragraaf) ?? d.paragraafTitel }));
}

function score(blob: string, doel: Leerdoel): number {
  if (doel.code && blob.includes(doel.code)) return 1;
  const dt = tokens(`${doel.tekst} ${doel.paragraafTitel}`);
  if (!dt.length) return 0;
  const set = new Set(tokens(blob));
  let hit = 0;
  for (const t of dt) {
    if (set.has(t)) hit += 1;
    else if ([...set].some((v) => v.includes(t) || t.includes(v))) hit += 0.5;
  }
  return hit / dt.length;
}

function besteDoel(q: Vraag, doelen: Leerdoel[]): Leerdoel | null {
  const blob = norm(`${q.domein} ${q.leerdoel} ${q.stam} ${q.context ?? ""}`);
  let best: Leerdoel | null = null;
  let bestScore = 0.34;
  for (const d of doelen) {
    const s = score(blob, d);
    if (s > bestScore) {
      best = d;
      bestScore = s;
    }
  }
  return best;
}

function rijLabel(d: Leerdoel): string {
  const basis = normaliseerSpelling(d.paragraafTitel || d.paragraaf);
  return d.plus ? `${basis} · PLUS` : basis;
}

const STOP = new Set(["berekenen", "bepalen", "uitleggen", "noemen", "meten", "van", "de", "het", "een", "en"]);

function kernTokens(domein: string): string[] {
  return norm(normaliseerSpelling(domein))
    .split(" ")
    .filter((w) => w.length >= 4 && !STOP.has(w));
}

/** Zonder genummerde leerdoelen: "Dichtheid berekenen" → "Dichtheid", "Volume berekenen" → "Massa en volume". */
function groepeerLosseDomeinen(vragen: Vraag[]): Vraag[] {
  const labels = [...new Set(vragen.map((q) => normaliseerSpelling(q.domein || "Algemeen")))];
  const kernen = labels.map((label) => ({ label, tokens: kernTokens(label) }));
  return vragen.map((q) => {
    const eigen = kernTokens(q.domein || "");
    let label = normaliseerSpelling(q.domein || "Algemeen");
    let best = -1;
    for (const k of kernen) {
      if (!eigen.length || !k.tokens.length) continue;
      if (!eigen.every((t) => k.tokens.includes(t))) continue;
      const broader = k.tokens.length > eigen.length;
      const sameCoreShorter = k.tokens.length === eigen.length && k.label.length < label.length;
      if (!broader && !sameCoreShorter) continue;
      const score = k.tokens.length * 1000 - k.label.length;
      if (score > best) {
        best = score;
        label = k.label;
      }
    }
    return { ...q, domein: label, leerdoel: normaliseerSpelling(q.leerdoel || "") };
  });
}

/**
 * Matrijsrijen per paragraaf uit de lesstof. PLUS-leerdoelen krijgen een eigen rij.
 */
export function groepeerDomeinen(vragen: Vraag[], bron: string): Vraag[] {
  const doelen = extractLeerdoelen(bron);
  const metTekst = doelen.filter((d) => d.tekst || d.paragraafTitel !== d.paragraaf);
  if (metTekst.length < 2) return groepeerLosseDomeinen(vragen);

  return vragen.map((q) => {
    const doel = besteDoel(q, metTekst);
    if (!doel) {
      return {
        ...q,
        domein: normaliseerSpelling(q.domein || "Algemeen"),
        leerdoel: normaliseerSpelling(q.leerdoel || ""),
      };
    }
    const leerdoel = doel.plus
      ? `PLUS · ${doel.code} ${doel.tekst}`.trim()
      : `${doel.code} ${doel.tekst}`.trim();
    return { ...q, domein: rijLabel(doel), leerdoel: normaliseerSpelling(leerdoel) };
  });
}

export function ongedekteLeerdoelen(bron: string, vragen: Vraag[]): Leerdoel[] {
  const doelen = extractLeerdoelen(bron).filter((d) => d.tekst.length >= 8);
  return doelen.filter((d) => !vragen.some((q) => score(norm(`${q.domein} ${q.leerdoel} ${q.stam} ${q.context ?? ""}`), d) >= 0.4));
}
