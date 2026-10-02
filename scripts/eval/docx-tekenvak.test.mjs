import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import JSZip from "jszip";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(ROOT, "src") } });
const { Packer } = await jiti.import("docx");
const { pakketDocument } = await jiti.import(join(ROOT, "src/lib/toets/docx-export.ts"));
const { eindControle } = await jiti.import(join(ROOT, "src/lib/toets/eind-controle.ts"));
const { herbouwMatrijs } = await jiti.import(join(ROOT, "src/lib/toets/rtti.ts"));
const v = (nummer, o = {}) => ({ nummer, type: "open", rtti: "T1", domein: "11.1", leerdoel: "", punten: 1, stam: `Vraag ${nummer}?`, ...o });
const nk = (nummer, modelantwoord, criterium = "juist") => ({ nummer, modelantwoord, puntenverdeling: [{ punt: 1, criterium }] });

describe("SE4.2 run 2: docx (Nick, iOS Word-viewer)", () => {
  const toets = () =>
    ({
      id: "t", createdAt: "", bronmateriaal: "", extraEisen: "", ronde: 1, cijferNorm: { model: "lineair", cesuurPct: 55, exponent: 1 },
      meta: { titel: "Proef", vak: "NaSk", leerweg: "GT", leerjaar: 4, duurMinuten: 90, hulpmiddelen: [], instructies: [], onderwerp: "", school: "", versie: "A", moeilijkheid: "normaal" },
      vragen: [
        v(1, { type: "meerkeuze", contextTitel: "Losse vraag", context: "Een losse situatie.", opties: [{ letter: "A", tekst: "a" }, { letter: "B", tekst: "b" }, { letter: "C", tekst: "c" }] }),
        v(2, { contextTitel: "Geluidsscherm", context: "Langs een snelweg komt een scherm.", stam: "Noem een maatregel." }),
        v(3, { contextTitel: "Geluidsscherm", stam: "Teken in het tekenvak een zijaanzicht van het scherm. Schaal 1 cm ≙ 2 m. Het scherm is 4 m hoog.", tekenvak: { soort: "raster", kolommen: 8, rijen: 6, schaal: "1 cm ≙ 2 m" } }),
        v(4, { contextTitel: "Koelcel", context: "Een koelcel.", stam: "Vraag 4?" }),
        v(5, { contextTitel: "Koelcel", stam: "Vraag 5?" }),
      ],
      nakijkmodel: [1, 2, 3, 4, 5].map((n) => nk(n, n === 1 ? "A. a" : "x")),
      cesuur: { nTerm: 1, cesuurPunten: 3, toelichting: "", formule: "" },
      matrijs: { cellen: {} },
      kwaliteit: { samenvatting: "", punten: [] },
    });
  it("tekenvak 16 × 1 cm vast (tblLayout fixed, gridCol 566, exacte rijen, cantSplit); één sectie; titels alleen op blokken met pagina-einde", async () => {
    const buf = await Packer.toBuffer(await pakketDocument(herbouwMatrijs(eindControle(toets()))));
    const xml = await (await JSZip.loadAsync(buf)).file("word/document.xml").async("string");
    assert.equal((xml.match(/<w:sectPr/g) ?? []).length, 1, "geen losse secties (vierkantje vóór Nakijkmodel)");
    const tbl = xml.slice(xml.indexOf("Schaal: 1 cm"));
    const t = tbl.slice(tbl.indexOf("<w:tbl>"), tbl.indexOf("</w:tbl>"));
    assert.match(t, /<w:tblLayout w:type="fixed"\/>/);
    assert.equal((t.match(/<w:gridCol w:w="566"\/>/g) ?? []).length, 16);
    assert.match(t, /<w:trHeight w:val="566" w:hRule="exact"\/>/);
    assert.match(t, /<w:cantSplit\/>/);
    assert.ok(!xml.includes(">Losse vraag<"), "losse vraag zonder titel");
    const geluid = xml.lastIndexOf("<w:p>", xml.indexOf(">Geluidsscherm<"));
    const koel = xml.lastIndexOf("<w:p>", xml.indexOf(">Koelcel<"));
    assert.ok(!xml.slice(geluid, xml.indexOf(">Geluidsscherm<")).includes("pageBreakBefore"), "eerste blok geen pagina-einde");
    assert.ok(xml.slice(koel, xml.indexOf(">Koelcel<")).includes("pageBreakBefore"), "volgend blok op nieuwe pagina");
  });
});
