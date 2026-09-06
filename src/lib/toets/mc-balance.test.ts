import { describe, expect, it } from "vitest";
import { balanceMcAntwoorden, balancedLetterTargets, findCorrectOptionIndex } from "./mc-balance";
import type { NakijkItem, Vraag } from "./types";

describe("mc-balance", () => {
  it("makes letter targets roughly even", () => {
    const t = balancedLetterTargets(12, ["A", "B", "C", "D"]);
    expect(t).toHaveLength(12);
    for (const L of ["A", "B", "C", "D"]) {
      expect(t.filter((x) => x === L).length).toBe(3);
    }
  });

  it("finds correct index from letter", () => {
    const opties = [
      { letter: "A", tekst: "natrium" },
      { letter: "B", tekst: "kalium" },
      { letter: "C", tekst: "calcium" },
      { letter: "D", tekst: "ijzer" },
    ];
    expect(findCorrectOptionIndex(opties, "B")).toBe(1);
    expect(findCorrectOptionIndex(opties, "B. kalium")).toBe(1);
  });

  it("reletters so keys are not all B", () => {
    const vragen: Vraag[] = Array.from({ length: 8 }, (_, i) => ({
      nummer: i + 1,
      type: "meerkeuze" as const,
      rtti: "R" as const,
      domein: "x",
      leerdoel: "y",
      punten: 1,
      stam: `Vraag ${i + 1}`,
      opties: [
        { letter: "A", tekst: `foutA${i}` },
        { letter: "B", tekst: `goed${i}` },
        { letter: "C", tekst: `foutC${i}` },
        { letter: "D", tekst: `foutD${i}` },
      ],
    }));
    const nakijk: NakijkItem[] = vragen.map((q) => ({
      nummer: q.nummer,
      modelantwoord: "B",
      puntenverdeling: [{ punt: 1, criterium: "juist" }],
    }));
    const { vragen: out, nakijkmodel } = balanceMcAntwoorden(vragen, nakijk);
    const keys = nakijkmodel.map((n) => n.modelantwoord.charAt(0));
    const unique = new Set(keys);
    expect(unique.size).toBeGreaterThan(1);
    for (let i = 0; i < out.length; i++) {
      const letter = keys[i];
      const opt = out[i].opties!.find((o) => o.letter === letter);
      expect(opt?.tekst).toBe(`goed${i}`);
    }
  });
});
