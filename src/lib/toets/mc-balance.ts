import type { NakijkItem, Vraag, VraagOptie } from "./types";

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Bijna gelijke A/B/C/D-verdeling (of korter alfabet). */
export function balancedLetterTargets(n: number, alphabet: string[]): string[] {
  if (n <= 0 || alphabet.length === 0) return [];
  const out: string[] = [];
  while (out.length < n) out.push(...shuffle([...alphabet]));
  return out.slice(0, n);
}

function lettersForCount(count: number): string[] {
  return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
}

/** "B.", "b)", " A " → "B". Leeg als geen MC-letter. */
export function canonLetter(raw: string): string {
  const m = (raw || "").trim().toUpperCase().match(/([A-D])/);
  return m ? m[1] : "";
}

function normText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

/**
 * Zoek welk optie-index het modelantwoord bedoelt. -1 = onbekend.
 * Herkent o.a. "B", "B.", "B) tekst", "Antwoord: B", en de optietekst zelf.
 */
export function findCorrectOptionIndex(opties: VraagOptie[], modelantwoord: string): number {
  const m = (modelantwoord || "").trim();
  if (!m || !opties.length) return -1;

  const byLetter = (L: string) => opties.findIndex((o) => canonLetter(o.letter) === L);

  const start = m.match(/^\*{0,2}\s*([A-Da-d])(?:\s*[.):\-–—]|\s|$)/);
  if (start) {
    const idx = byLetter(start[1].toUpperCase());
    if (idx >= 0) return idx;
  }

  const labeled = m.match(
    /(?:juiste\s+)?(?:antwoord|sleutel|optie|keuze)\s*(?:is|=|:)?\s*\*{0,2}\s*([A-Da-d])\b/i,
  );
  if (labeled) {
    const idx = byLetter(labeled[1].toUpperCase());
    if (idx >= 0) return idx;
  }

  const stripped = m.replace(/^\*{0,2}\s*[A-Da-d]\s*[.):\-–—]?\s*/, "").trim();
  const nStrip = normText(stripped);
  if (nStrip.length >= 2) {
    const byText = opties.findIndex((o) => {
      const t = normText(o.tekst);
      if (!t) return false;
      return t === nStrip || nStrip.includes(t) || t.includes(nStrip);
    });
    if (byText >= 0) return byText;
  }

  return -1;
}

function rewriteModelantwoord(old: string, letter: string, correctTekst: string): string {
  const m = (old || "").trim();
  const rest = m
    .replace(/^\*{0,2}\s*[A-Da-d]\s*[.):\-–—]?\s*/, "")
    .replace(/^(?:juiste\s+)?(?:antwoord|sleutel|optie|keuze)\s*(?:is|=|:)?\s*\*{0,2}\s*[A-Da-d]\b\s*[.):\-–—]?\s*/i, "")
    .trim();
  if (!rest || normText(rest) === normText(correctTekst) || normText(rest).includes(normText(correctTekst))) {
    return `${letter}. ${correctTekst}`;
  }
  if (normText(correctTekst).includes(normText(rest))) {
    return `${letter}. ${correctTekst}`;
  }
  return `${letter}. ${correctTekst}`;
}

function nakijkVoor(
  nakijk: NakijkItem[],
  vraag: Vraag,
  index: number,
): NakijkItem | undefined {
  return nakijk.find((n) => n.nummer === vraag.nummer) ?? nakijk[index];
}

/**
 * Husselt MC-opties altijd na het opstellen en zet sleutelantwoorden ongeveer gelijk over A–D.
 * Nakijkmodel.modelantwoord wordt meegenomen (nieuwe letter + tekst).
 */
export function balanceMcAntwoorden(
  vragen: Vraag[],
  nakijkmodel: NakijkItem[],
): { vragen: Vraag[]; nakijkmodel: NakijkItem[] } {
  const nextVragen: Vraag[] = vragen.map((q) => ({
    ...q,
    opties: q.opties?.map((o) => ({ ...o })),
  }));
  const nextNakijk: NakijkItem[] = nakijkmodel.map((n) => ({
    ...n,
    puntenverdeling: n.puntenverdeling?.map((p) => ({ ...p })),
    nietToekennen: n.nietToekennen ? [...n.nietToekennen] : undefined,
  }));

  const mc = nextVragen.filter((q) => (q.opties?.length ?? 0) >= 2);
  const four = mc.filter((q) => (q.opties?.length ?? 0) >= 4);
  const targets4 = balancedLetterTargets(fourCount(four), ["A", "B", "C", "D"]);
  let t4 = 0;

  nextVragen.forEach((q, i) => {
    const opties = q.opties;
    if (!opties || opties.length < 2) return;

    const nakijk = nakijkVoor(nextNakijk, q, i);
    const correctIdx = findCorrectOptionIndex(opties, nakijk?.modelantwoord ?? "");
    if (correctIdx < 0) return;

    const letters = lettersForCount(opties.length);
    const targetLetter =
      opties.length >= 4
        ? targets4[t4++] ?? letters[Math.floor(Math.random() * letters.length)]
        : letters[Math.floor(Math.random() * letters.length)];
    const targetIdx = Math.max(0, letters.indexOf(targetLetter));

    const correctTekst = opties[correctIdx].tekst;
    const others = shuffle(opties.filter((_, oi) => oi !== correctIdx).map((o) => o.tekst));
    const texts: string[] = [];
    let oi = 0;
    for (let k = 0; k < opties.length; k++) {
      texts.push(k === targetIdx ? correctTekst : others[oi++]);
    }
    q.opties = texts.map((tekst, k) => ({ letter: letters[k], tekst }));
    if (nakijk) {
      nakijk.modelantwoord = rewriteModelantwoord(nakijk.modelantwoord, letters[targetIdx], correctTekst);
    }
  });

  return { vragen: nextVragen, nakijkmodel: nextNakijk };
}

function fourCount(items: { opties?: unknown[] | null }[]): number {
  return items.length;
}
