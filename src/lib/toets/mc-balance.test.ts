import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  antwoordLettersInNakijk,
  balancedLetterTargets,
  finalizeVragen,
  findCorrectOptionIndex,
  isAnchorOption,
  isNumericOptionSet,
  rewriteLetterRefs,
  shuffleMcAnswers,
} from "./mc-balance.ts";
import type { NakijkItem, Vraag, VraagOptie } from "./types.ts";

function maxRun(letters: string[]): number {
  if (letters.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < letters.length; i++) {
    run = letters[i] === letters[i - 1] ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

function mc(nummer: number): Vraag {
  return {
    nummer,
    type: "meerkeuze",
    rtti: "R",
    domein: "x",
    leerdoel: "y",
    punten: 1,
    stam: `Vraag ${nummer}`,
    opties: [
      { letter: "A", tekst: `foutA${nummer}` },
      { letter: "B", tekst: `goed${nummer}` },
      { letter: "C", tekst: `foutC${nummer}` },
      { letter: "D", tekst: `foutD${nummer}` },
    ],
  };
}

function nakijkB(nummer: number, extra?: Partial<NakijkItem>): NakijkItem {
  return {
    nummer,
    modelantwoord: "B",
    puntenverdeling: [{ punt: 1, criterium: "juist" }],
    ...extra,
  };
}

function sleutelVan(vraag: Vraag, item: NakijkItem): { letter: string; tekst: string } {
  const opties = vraag.opties ?? [];
  const idx = findCorrectOptionIndex(opties, item.modelantwoord);
  assert.ok(idx >= 0, `geen sleutel voor: ${item.modelantwoord}`);
  const opt = opties[idx]!;
  return { letter: opt.letter, tekst: opt.tekst };
}

describe("mc-balance", () => {
  it("maakt letterdoelen gelijk en zonder run > 2", () => {
    for (let n = 0; n < 20; n++) {
      const t = balancedLetterTargets(12, ["A", "B", "C", "D"]);
      assert.equal(t.length, 12);
      for (const L of ["A", "B", "C", "D"]) {
        assert.equal(t.filter((x) => x === L).length, 3);
      }
      assert.ok(maxRun(t) <= 2);
    }
  });

  it("vindt de juiste index op letter of tekst", () => {
    const opties: VraagOptie[] = [
      { letter: "A", tekst: "natrium" },
      { letter: "B", tekst: "kalium" },
      { letter: "C", tekst: "calcium" },
      { letter: "D", tekst: "ijzer" },
    ];
    assert.equal(findCorrectOptionIndex(opties, "B"), 1);
    assert.equal(findCorrectOptionIndex(opties, "B. kalium"), 1);
    assert.equal(findCorrectOptionIndex(opties, "Antwoord: B"), 1);
    assert.equal(findCorrectOptionIndex(opties, "Juiste antwoord is B"), 1);
    const dotted = opties.map((o) => ({ letter: `${o.letter}.`, tekst: o.tekst }));
    assert.equal(findCorrectOptionIndex(dotted, "B"), 1);
  });

  it("verdeelt 20 MC-vragen gelijk, run max 2, sleutel = tekst", () => {
    let sample = "";
    for (let trial = 0; trial < 25; trial++) {
      const vragen = Array.from({ length: 20 }, (_, i) => mc(i + 1));
      const nakijk = vragen.map((q) => nakijkB(q.nummer));
      const { vragen: out, nakijkmodel } = shuffleMcAnswers(vragen, nakijk);
      const letters: string[] = [];
      for (let i = 0; i < out.length; i++) {
        const sleutel = sleutelVan(out[i]!, nakijkmodel[i]!);
        assert.equal(sleutel.tekst, `goed${i + 1}`);
        const opt = out[i]!.opties!.find((o) => o.letter === sleutel.letter);
        assert.equal(opt?.tekst, `goed${i + 1}`);
        letters.push(sleutel.letter);
      }
      const counts = { A: 0, B: 0, C: 0, D: 0 };
      for (const L of letters) counts[L as keyof typeof counts]++;
      for (const L of ["A", "B", "C", "D"] as const) assert.equal(counts[L], 5, letters.join(""));
      assert.ok(maxRun(letters) <= 2, letters.join(""));
      if (trial === 0) {
        sample = `${letters.join("")} (A${counts.A} B${counts.B} C${counts.C} D${counts.D})`;
      }
    }
    console.log(`MC-verdeling sample (20 vragen): ${sample}`);
  });

  it("houdt ankeropties achteraan en numerieke reeksen op hun plek", () => {
    assert.equal(isAnchorOption("Alle bovenstaande"), true);
    assert.equal(isAnchorOption("Geen van bovenstaande"), true);
    assert.equal(isAnchorOption("A en B"), true);
    assert.equal(isAnchorOption("beide"), true);
    assert.equal(isNumericOptionSet([
      { letter: "A", tekst: "2 m" },
      { letter: "B", tekst: "5 m" },
      { letter: "C", tekst: "9 m" },
      { letter: "D", tekst: "12 m" },
    ]), true);

    const anchorVraag: Vraag = {
      ...mc(1),
      opties: [
        { letter: "A", tekst: "appel" },
        { letter: "B", tekst: "peer" },
        { letter: "C", tekst: "kers" },
        { letter: "D", tekst: "Alle bovenstaande" },
      ],
    };
    const anchorNakijk: NakijkItem = nakijkB(1);
    const anchored = shuffleMcAnswers([anchorVraag], [anchorNakijk]);
    const opts = anchored.vragen[0]!.opties!;
    assert.equal(opts[opts.length - 1]!.tekst, "Alle bovenstaande");
    assert.equal(opts[opts.length - 1]!.letter, "D");
    const peer = sleutelVan(anchored.vragen[0]!, anchored.nakijkmodel[0]!);
    assert.equal(peer.tekst, "peer");
    assert.notEqual(peer.letter, "D");

    const numVraag: Vraag = {
      ...mc(2),
      opties: [
        { letter: "A", tekst: "2 m" },
        { letter: "B", tekst: "5 m" },
        { letter: "C", tekst: "9 m" },
        { letter: "D", tekst: "12 m" },
      ],
    };
    const numbered = shuffleMcAnswers([numVraag], [nakijkB(2)]);
    assert.deepEqual(
      numbered.vragen[0]!.opties!.map((o) => o.tekst),
      ["2 m", "5 m", "9 m", "12 m"],
    );
    const vijf = sleutelVan(numbered.vragen[0]!, numbered.nakijkmodel[0]!);
    assert.equal(vijf.letter, "B");
    assert.equal(vijf.tekst, "5 m");
  });

  it("herschrijft letterverwijzingen en 'A en B' na het husselen", () => {
    const map = { A: "C", B: "A", C: "D", D: "B" };
    assert.equal(rewriteLetterRefs("vitamine A blijft", map), "vitamine A blijft");
    assert.equal(rewriteLetterRefs("B is juist", map), "A is juist");
    assert.equal(rewriteLetterRefs("niet A", map), "niet C");
    assert.equal(rewriteLetterRefs("B — kalium", map), "A — kalium");

    let changed = 0;
    for (let trial = 0; trial < 12; trial++) {
      const vraag: Vraag = {
        ...mc(1),
        opties: [
          { letter: "A", tekst: "natrium" },
          { letter: "B", tekst: "kalium" },
          { letter: "C", tekst: "calcium" },
          { letter: "D", tekst: "ijzer" },
        ],
      };
      const nakijk: NakijkItem = {
        nummer: 1,
        modelantwoord: "B is juist omdat kalium een alkalimetaal is",
        puntenverdeling: [{ punt: 1, criterium: "B — kalium" }],
        nietToekennen: ["niet A"],
      };
      const { vragen, nakijkmodel } = shuffleMcAnswers([vraag], [nakijk]);
      const opties = vragen[0]!.opties!;
      const L = opties.find((o) => o.tekst === "kalium")!.letter;
      const nat = opties.find((o) => o.tekst === "natrium")!.letter;
      const model = nakijkmodel[0]!.modelantwoord;
      const criterium = nakijkmodel[0]!.puntenverdeling[0]!.criterium;
      assert.equal(model, `${L}. kalium`);
      assert.equal(criterium, `Juiste keuze ${L}`);
      assert.deepEqual(nakijkmodel[0]!.nietToekennen, ["andere letters"]);
      for (const letter of antwoordLettersInNakijk(nakijkmodel[0]!)) {
        assert.equal(letter, L);
      }
      assert.notEqual(nat, "");
      if (L !== "B") changed++;
    }
    assert.ok(changed > 0, "sleutel bleef altijd B");

    const combo: Vraag = {
      ...mc(4),
      opties: [
        { letter: "A", tekst: "appel" },
        { letter: "B", tekst: "peer" },
        { letter: "C", tekst: "A en B" },
        { letter: "D", tekst: "geen van bovenstaande" },
      ],
    };
    const comboOut = shuffleMcAnswers([combo], [{ ...nakijkB(4), modelantwoord: "C" }]);
    const opties = comboOut.vragen[0]!.opties!;
    assert.equal(opties[3]!.tekst, "geen van bovenstaande");
    const appelL = opties.find((o) => o.tekst === "appel")!.letter;
    const peerL = opties.find((o) => o.tekst === "peer")!.letter;
    const comboOpt = opties[2]!;
    assert.match(comboOpt.tekst, new RegExp(`\\b${appelL}\\b`));
    assert.match(comboOpt.tekst, new RegExp(`\\b${peerL}\\b`));
    const sleutel = sleutelVan(comboOut.vragen[0]!, comboOut.nakijkmodel[0]!);
    assert.equal(sleutel.letter, comboOpt.letter);
    assert.equal(sleutel.tekst, comboOpt.tekst);
  });

  it("elke letter in een MC-nakijkregel is de sleutel, ook als de LLM een andere letter schreef", () => {
    let andereSleutel = 0;
    for (let trial = 0; trial < 20; trial++) {
      const vraag: Vraag = {
        ...mc(1),
        stam: "Welke grootheid is een stofeigenschap?",
        opties: [
          { letter: "A", tekst: "massa van dit voorwerp" },
          { letter: "B", tekst: "vorm" },
          { letter: "C", tekst: "dichtheid" },
          { letter: "D", tekst: "temperatuur in het lokaal" },
        ],
      };
      const nakijk: NakijkItem = {
        nummer: 1,
        modelantwoord: "C. dichtheid",
        puntenverdeling: [{ punt: 1, criterium: "Juiste keuze B" }],
        nietToekennen: ["niet A", "letter D is fout"],
      };
      const { vragen, nakijkmodel } = shuffleMcAnswers([vraag], [nakijk]);
      const item = nakijkmodel[0]!;
      const L = vragen[0]!.opties!.find((o) => o.tekst === "dichtheid")!.letter;
      assert.equal(item.modelantwoord, `${L}. dichtheid`);
      assert.equal(item.puntenverdeling[0]!.criterium, `Juiste keuze ${L}`);
      assert.deepEqual(item.nietToekennen, ["andere letters"]);
      const letters = antwoordLettersInNakijk(item);
      assert.ok(letters.length >= 1);
      for (const letter of letters) assert.equal(letter, L);
      if (L !== "C") andereSleutel++;
    }
    assert.ok(andereSleutel > 0, "de sleutel bleef altijd C");
  });

  it("finalizeVragen is de choke point: MC eerst, open nakijk onaangeroerd", () => {
    const open: Vraag = {
      nummer: 1,
      type: "open",
      rtti: "T1",
      domein: "x",
      leerdoel: "y",
      punten: 2,
      stam: "Leg uit.",
    };
    const vragen = [open, mc(2), mc(3)];
    const nakijk: NakijkItem[] = [
      {
        nummer: 1,
        modelantwoord: "omdat de zwaartekracht omlaag wijst",
        puntenverdeling: [{ punt: 2, criterium: "richting én grootte" }],
      },
      nakijkB(2),
      nakijkB(3),
    ];
    const out = finalizeVragen(vragen, nakijk);
    assert.equal(out.vragen[0]!.type, "meerkeuze");
    assert.equal(out.vragen[1]!.type, "meerkeuze");
    assert.equal(out.vragen[2]!.type, "open");
    assert.equal(out.vragen[2]!.stam, "Leg uit.");
    const openNakijk = out.nakijkmodel.find((n) => n.nummer === out.vragen[2]!.nummer);
    assert.equal(openNakijk?.modelantwoord, "omdat de zwaartekracht omlaag wijst");
    for (const q of out.vragen.filter((q) => q.type === "meerkeuze")) {
      const n = out.nakijkmodel.find((item) => item.nummer === q.nummer)!;
      const sleutel = sleutelVan(q, n);
      const nr = q.stam.endsWith("2") ? 2 : 3;
      assert.equal(sleutel.tekst, `goed${nr}`);
    }
  });
});
