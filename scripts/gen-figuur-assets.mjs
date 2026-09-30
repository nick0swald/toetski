#!/usr/bin/env node
/**
 * Genereert src/lib/toets/figuren/assets.generated.ts: de resvg-wasm-binary en
 * Liberation Sans (SIL OFL 1.1) als base64. Zo werkt SVG → PNG op Vercel zonder
 * systeemfonts, native modules of bestandslezen tijdens runtime.
 *
 *   node scripts/gen-figuur-assets.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wasmPath = join(root, "node_modules/@resvg/resvg-wasm/index_bg.wasm");
const fontDir = join(root, "src/lib/toets/figuren/fonts");
const b64 = (p) => readFileSync(p).toString("base64");
const version = JSON.parse(readFileSync(join(dirname(wasmPath), "package.json"), "utf8")).version;

const out = `/* eslint-disable */
// GEGENEREERD door scripts/gen-figuur-assets.mjs — niet met de hand wijzigen.
// resvg-wasm ${version} (MPL-2.0) en Liberation Sans (SIL OFL 1.1, zie fonts/OFL.txt).
// Alleen server-side importeren (dynamisch), nooit in de client-bundle.
export const RESVG_WASM_B64 = "${b64(wasmPath)}";
export const FONT_REGULAR_B64 = "${b64(join(fontDir, "LiberationSans-Regular.ttf"))}";
export const FONT_BOLD_B64 = "${b64(join(fontDir, "LiberationSans-Bold.ttf"))}";
`;
writeFileSync(join(root, "src/lib/toets/figuren/assets.generated.ts"), out);
console.log(`assets.generated.ts geschreven (${Math.round(out.length / 1024)} kB)`);
