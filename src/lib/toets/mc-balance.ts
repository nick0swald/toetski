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

/** Zoek welk optie-index het modelantwoord bedoelt. -1 = onbekend. */
export function findCorrectOptionIndex(opties: VraagOptie[], modelantwoord: string): number {
  const m = (modelantwoord || "").trim();
  if (!m || !opties.length) return -1;
  const letterHit = m.match(/^([A-Za-z])\b/);
  if (letterHit) {
    const L = letterHit[1].toUpperCase();
    const idx = opties.findIndex((o) => o.letter.toUpperCase() === L);
    if (idx >= 0) return idx;
  }
  const stripped = m.replace(/^[A-Za-z]\s*[.):\-–—]?\s*/, "").trim();
  if (stripped) {
    const byText = opties.findIndex(
      (o) => o.tekst.trim() === stripped || stripped.includes(o.tekst.trim()) || o.tekst.trim().includes(stripped),
    );
    if (byText >= 0) return byText;
  }
  return -1;
}

/**
 * Husselt MC-opties en zet sleutelantwoorden ongeveer gelijk over A–D.
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

  const mcFour = nextVragen.filter((q) => (q.opties?.length ?? 0) >= 4);
  const targets4 = balancedLetterTargets(mcFour.length, ["A", "B", "C", "D"]);
  let t4 = 0;

  for (const q of nextVragen) {
    const opties = q.opties;
    if (!opties || opties.length < 2) continue;
    const nakijk = nextNakijk.find((n) => n.nummer === q.nummer);
    const correctIdx = findCorrectOptionIndex(opties, nakijk?.modelantwoord ?? "");
    if (correctIdx < 0) continue;

    const letters = lettersForCount(opties.length);
    const targetLetter =
      opties.length >= 4
        ? targets4[t4++] ?? letters[Math.floor(Math.random() * letters.length)]
        : letters[Math.floor(Math.random() * letters.length)];
    const targetIdx = Math.max(0, letters.indexOf(targetLetter));

    const correctTekst = opties[correctIdx].tekst;
    const others = shuffle(opties.filter((_, i) => i !== correctIdx).map((o) => o.tekst));
    const texts: string[] = [];
    let oi = 0;
    for (let i = 0; i < opties.length; i++) {
      texts.push(i === targetIdx ? correctTekst : others[oi++]);
    }
    q.opties = texts.map((tekst, i) => ({ letter: letters[i], tekst }));
    if (nakijk) {
      nakijk.modelantwoord = `${letters[targetIdx]}. ${correctTekst}`;
    }
  }

  return { vragen: nextVragen, nakijkmodel: nextNakijk };
}
