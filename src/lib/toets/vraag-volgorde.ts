import type { NakijkItem, Vraag, VraagType } from "./types";

const MC_TYPES: VraagType[] = ["meerkeuze", "juist-onjuist"];

/** Docent vraagt expliciet géén MC-blok eerst. */
export function wilGemengdeOfOpenEerst(tekst: string): boolean {
  const t = tekst.toLowerCase();
  return /open\s*eerst|eerst\s*open|eerst\s*de\s*open|gemengde\s*volgorde|niet\s*groeper|door\s*elkaar|afwissel|mc\s*en\s*open\s*(mix|gemengd)|open\s*en\s*mc\s*(mix|gemengd)|geen\s*mc\s*eerst|volgorde\s*vrij/.test(
    t,
  );
}

function isMcLike(type: VraagType | string): boolean {
  return MC_TYPES.includes(type as VraagType);
}

/**
 * True als MC en open door elkaar staan (niet: alle MC eerst, daarna rest).
 * Gebruikt voor de knop «MC eerst» op de toetspagina.
 */
export function isVolgordeGemengd(vragen: Vraag[]): boolean {
  if (vragen.length < 2) return false;
  let seenOpen = false;
  for (const q of vragen) {
    if (isMcLike(q.type)) {
      if (seenOpen) return true;
    } else {
      seenOpen = true;
    }
  }
  return false;
}

/**
 * Standaard: meerkeuze/juist-onjuist eerst (relatieve volgorde behouden), daarna open/rest.
 * Herberekent nummers 1…n en houdt nakijkmodel in sync.
 */
export function ordenVragenMcEerst(
  vragen: Vraag[],
  nakijkmodel: NakijkItem[],
  opts?: { skip?: boolean },
): { vragen: Vraag[]; nakijkmodel: NakijkItem[] } {
  if (opts?.skip || vragen.length < 2) {
    return { vragen, nakijkmodel };
  }

  const mc = vragen.filter((q) => isMcLike(q.type));
  const rest = vragen.filter((q) => !isMcLike(q.type));
  if (mc.length === 0 || rest.length === 0) {
    return { vragen, nakijkmodel };
  }

  const ordered = [...mc, ...rest];
  const byOld = new Map(nakijkmodel.map((n) => [n.nummer, n]));
  const vragenOut = ordered.map((q, i) => ({ ...q, nummer: i + 1 }));
  const nakijkOut = ordered.map((q, i) => {
    const old = byOld.get(q.nummer);
    return old
      ? { ...old, nummer: i + 1 }
      : {
          nummer: i + 1,
          modelantwoord: "",
          puntenverdeling: [],
          nietToekennen: [],
        };
  });

  return { vragen: vragenOut, nakijkmodel: nakijkOut };
}
