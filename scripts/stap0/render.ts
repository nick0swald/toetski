/**
 * Stap 0: rendert de voorbeeldtoets uit de vaste fixtures (geen Grok-aanroepen) naar leerling- en docentdeel.
 *
 *   node --experimental-strip-types --no-warnings scripts/stap0/render.ts [--uit eval-out/stap0]
 *
 * Uitvoer: voorbeeld-leerling.pdf, voorbeeld-leerling-<deel>.pdf, voorbeeld-docent.pdf, voorbeeld-leerling.docx,
 * voorbeeld-docent.docx, figuren/*.png en keuring.json (rekencontrole + figuur-go/no-go + rendertijd).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { laadFixtures, laadVoorbeeldtoets } from "../../src/lib/toets/stap0/laad.ts";
import { verwerkToets } from "../../src/lib/toets/stap0/pijplijn.ts";
import { maakPdfs } from "../../src/lib/toets/stap0/export-pdf.ts";
import { maakDocxs } from "../../src/lib/toets/stap0/export-docx.ts";
import { pngRender, stap0Fonts } from "../../src/lib/toets/stap0/node.server.ts";
import { controleerCijfers } from "../../src/lib/toets/stap0/cijfer-n.ts";

const args = process.argv.slice(2);
const i = args.indexOf("--uit");
const uit = resolve(i >= 0 ? args[i + 1] : "eval-out/stap0");
mkdirSync(join(uit, "figuren"), { recursive: true });

const t0 = performance.now();
const toets = laadVoorbeeldtoets();
const res = verwerkToets(toets, laadFixtures());
const tCheck = performance.now();
if (res.afgekeurd.length || res.toetsFouten.length) {
  console.error("Afgekeurd:", res.afgekeurd, res.toetsFouten, res.keuringen.filter((k) => !k.ok).map((k) => k.fouten));
  process.exit(1);
}
const max = res.vragen.reduce((s, q) => s + q.punten, 0);
const cijferFouten = controleerCijfers(max, toets.nTerm ?? 1);
if (cijferFouten.length) {
  console.error("Cijfercontrole:", cijferFouten);
  process.exit(1);
}
const pdf = await maakPdfs(toets, res, stap0Fonts(), pngRender);
const tPdf = performance.now();
const docx = await maakDocxs(toets, res, pngRender);
const tDocx = performance.now();
writeFileSync(join(uit, "voorbeeld-leerling.pdf"), pdf.leerling);
writeFileSync(join(uit, "voorbeeld-docent.pdf"), pdf.docent);
for (const d of pdf.leerlingDelen) writeFileSync(join(uit, `voorbeeld-leerling-${d.naam.toLowerCase().replace(/\s+/g, "-")}.pdf`), d.pdf);
writeFileSync(join(uit, "voorbeeld-leerling.docx"), docx.leerling);
writeFileSync(join(uit, "voorbeeld-docent.docx"), docx.docent);
for (const k of res.keuringen)
  for (const [j, f] of k.figuren.entries()) {
    const w = Number(/width="([\d.]+)cm"/.exec(f.svg)![1]);
    writeFileSync(join(uit, "figuren", `${k.id}-${j}-${f.rol}.png`), await pngRender(f.svg, Math.round((w / 2.54) * 200)));
    writeFileSync(join(uit, "figuren", `${k.id}-${j}-${f.rol}.svg`), f.svg);
  }
const tijden = { controlesMs: Math.round(tCheck - t0), pdfMs: Math.round(tPdf - tCheck), docxMs: Math.round(tDocx - tPdf), totaalMs: Math.round(tDocx - t0) };
writeFileSync(
  join(uit, "keuring.json"),
  JSON.stringify({ tijden, vragen: res.vragen.length, punten: max, delen: res.delen, keuringen: res.keuringen.map(({ figuren, ...k }) => ({ ...k, figuren: figuren.map(({ svg: _s, ...f }) => f) })) }, null, 1),
);
console.log(`${res.vragen.length} vragen / ${max} p · alle rekencontroles en figuren GO · cijfercontrole ok`);
console.log(`tijd: controles ${tijden.controlesMs} ms · PDF's ${tijden.pdfMs} ms · Word ${tijden.docxMs} ms · totaal ${tijden.totaalMs} ms`);
console.log(`→ ${uit}`);
