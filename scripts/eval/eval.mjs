#!/usr/bin/env node
/**
 * Offline eval-harnas voor Toetski (zie scripts/eval/README.md).
 *
 *   node scripts/eval/eval.mjs genereer <case> [--naam N] [--base URL]     # 1 generatie (kost API-tokens)
 *   node scripts/eval/eval.mjs scoor <toets.json> --case <case> [--rechter] [--baseline scores.json]
 *   node scripts/eval/eval.mjs poort <scores-nieuw.json> <scores-baseline.json>
 *
 * "genereer" roept dezelfde server-functies aan als de app (stap 1 vragen → stap 2 afwerken; zonder
 * plaatjes), op productie of een preview (--base), en draait daarna lokaal de client-stap
 * (eindControle + zonderPlaatjes) en het Word-pakket. Uitvoer: eval-out/<naam>/<case>.{json,docx,meta.json}.
 * "scoor" is volledig offline (code-rubriek), behalve met --rechter (1 grok-4.5-aanroep, vaste prompt).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(ROOT, "src") } });
const args = process.argv.slice(2);
const opt = (naam, standaard) => {
  const i = args.indexOf(`--${naam}`);
  return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true) : standaard;
};
const leesJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const caseInput = (naam) => leesJson(join(ROOT, "scripts", "eval", "inputs", `${naam}.json`));

/** TanStack Start server-fn-id = sha256("<bestand>--<export>_createServerFn_handler"). */
const fnId = (bestand, naam) => createHash("sha256").update(`${bestand}--${naam}_createServerFn_handler`).digest("hex");

async function serverFn(base, id, data) {
  const { toJSONAsync, fromCrossJSON } = await import("seroval");
  const body = JSON.stringify(await toJSONAsync({ data }));
  const r = await fetch(`${base}/_serverFn/${id}`, {
    method: "POST",
    headers: { origin: base, referer: `${base}/`, "sec-fetch-site": "same-origin", "x-tsr-serverFn": "true", accept: "application/json", "content-type": "application/json" },
    body,
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${txt.slice(0, 300)}`);
  const out = fromCrossJSON(JSON.parse(txt), { refs: new Map() });
  if (out?.error) throw new Error(String(out.error?.message ?? out.error));
  return out.result;
}

async function genereer(caseNaam) {
  const base = opt("base", process.env.EVAL_BASE ?? "https://www.toetski.nl");
  const naam = opt("naam", new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-"));
  const uit = join(ROOT, "eval-out", naam);
  mkdirSync(uit, { recursive: true });
  const { rttiDoelVoor } = await jiti.import(join(ROOT, "src/lib/toets/config.ts"));
  const c = caseInput(caseNaam);
  // Zoals het formulier: RTTI-doel = standaarddoel voor de klas (geen handmatige override).
  const input = { ...c.input, rttiDoel: rttiDoelVoor(c.input.leerjaar, c.input.moeilijkheid) };
  const F = "src/lib/toets/generate.ts";
  const t0 = Date.now();
  const ruw = await serverFn(base, fnId(F, "generateVragenRuw"), input);
  const tVragen = Date.now();
  console.log(`vragen ${((tVragen - t0) / 1000).toFixed(1)} s`, ruw?.ok ? "ok" : ruw?.error);
  if (!ruw?.ok) process.exit(1);
  const afInput = { ...input, bronmateriaal: "", bronUrl: undefined, antwoordenmateriaal: (input.antwoordenmateriaal ?? "").slice(0, 30000), stuurdocument: undefined };
  const af = await serverFn(base, fnId(F, "afwerkToets"), { input: afInput, bron: ruw.bron, payload: ruw.payload, verstrekenMs: tVragen - t0 });
  const tAf = Date.now();
  console.log(`afwerken ${((tAf - tVragen) / 1000).toFixed(1)} s`, af?.ok ? "ok" : af?.error);
  if (!af?.ok) process.exit(1);
  const { eindControle } = await jiti.import(join(ROOT, "src/lib/toets/eind-controle.ts"));
  const { zonderPlaatjes } = await jiti.import(join(ROOT, "src/lib/toets/figuren/vroeg.ts"));
  const { telOp } = await jiti.import(join(ROOT, "src/lib/toets/llm.ts"));
  let toets = af.toets;
  if (ruw.kosten || toets.kosten) toets = { ...toets, kosten: { ...telOp(ruw.kosten, toets.kosten), duurVragenMs: ruw.duurMs, duurAfwerkenMs: toets.kosten?.duurAfwerkenMs } };
  toets = eindControle(zonderPlaatjes(toets));
  toets.figuurRapport = { ...(toets.figuurRapport ?? { versie: 1, items: [], meldingen: [] }), tijden: { vragenMs: tVragen - t0, afwerkenMs: tAf - tVragen, totaalMs: tAf - t0 } };
  writeFileSync(join(uit, `${caseNaam}.json`), JSON.stringify(toets, null, 1));
  const { Packer } = await jiti.import("docx");
  const { pakketDocument } = await jiti.import(join(ROOT, "src/lib/toets/docx-export.ts"));
  writeFileSync(join(uit, `${caseNaam}.docx`), await Packer.toBuffer(await pakketDocument(toets)));
  const meta = { case: caseNaam, base, naam, start: new Date(t0).toISOString(), tijden: toets.figuurRapport.tijden, kosten: toets.kosten ?? null, vragen: toets.vragen.length, punten: toets.vragen.reduce((s, q) => s + q.punten, 0) };
  writeFileSync(join(uit, `${caseNaam}.meta.json`), JSON.stringify(meta, null, 1));
  console.log(JSON.stringify(meta, null, 1));
  console.log(`→ ${join(uit, caseNaam)}.{json,docx,meta.json}`);
}

async function rechter(toets, input) {
  const R = await jiti.import(join(ROOT, "src/lib/toets/eval/rubric.ts"));
  const { MODELLEN } = await jiti.import(join(ROOT, "src/lib/toets/config.ts"));
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY ontbreekt (nodig voor --rechter)");
  const r = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(170_000),
    body: JSON.stringify({ model: MODELLEN.controle, reasoning_effort: "low", temperature: 0, max_tokens: 6000, response_format: { type: "json_object" }, messages: [{ role: "system", content: R.RECHTER_SYSTEM }, { role: "user", content: R.rechterPrompt(toets, input) }] }),
  });
  const j = await r.json();
  const oordeel = R.parseRechter(j.choices?.[0]?.message?.content ?? "");
  if (oordeel) oordeel.kostenUsd = (j.usage?.cost_in_usd_ticks ?? 0) / 1e10;
  return oordeel;
}

async function scoor(pad) {
  const R = await jiti.import(join(ROOT, "src/lib/toets/eval/rubric.ts"));
  const toets = leesJson(pad);
  const c = caseInput(opt("case"));
  const input = { ...c.input };
  const oordeel = opt("rechter", false) ? await rechter(toets, input) : undefined;
  const kaart = R.scoorToets(toets, input, oordeel);
  const uitPad = typeof opt("uit") === "string" ? opt("uit") : pad.replace(/\.json$/, ".scores.json");
  writeFileSync(uitPad, JSON.stringify({ ...kaart, rechter: oordeel ?? null, bestand: pad, case: c.case }, null, 1));
  console.log(`\n${c.case} · rubriek ${kaart.rubriekVersie}${oordeel ? ` · rechter ${oordeel.versie}` : ""}`);
  for (const x of kaart.criteria) console.log(`${String(x.punt).padStart(2)} ${x.score.toFixed(2)} ${x.naam.padEnd(46)} ${x.bron.padEnd(12)} ${x.detail}`);
  console.log("Harde criteria:");
  for (const h of kaart.hard) console.log(`  ${h.ok ? "OK  " : "FAIL"} ${h.naam} (${h.detail})`);
  console.log(`Cijfer (rubriek) ${kaart.cijfer}${oordeel?.cijfer != null ? ` · rechter ${oordeel.cijfer}` : ""} · hard ${kaart.hardOk ? "100 %" : "NIET ok"}`);
  if (oordeel?.topProblemen?.length) console.log(`Rechter top-problemen:\n- ${oordeel.topProblemen.join("\n- ")}`);
  const basisPad = opt("baseline");
  if (typeof basisPad === "string") {
    const basis = leesJson(basisPad);
    const p = R.poort(kaart, basis);
    console.log(`\nPOORT: ${p.ok ? "GROEN" : "ROOD"}${p.redenen.length ? ` (${p.redenen.join("; ")})` : ""}`);
    for (const x of kaart.criteria) {
      const b = basis.criteria.find((y) => y.id === x.id);
      if (b && Math.abs(b.score - x.score) >= 0.01) console.log(`  ${String(x.punt).padStart(2)} ${x.naam}: ${b.score.toFixed(2)} → ${x.score.toFixed(2)}`);
    }
  }
  console.log(`→ ${uitPad}`);
}

async function poortCmd(nieuwPad, basisPad) {
  const R = await jiti.import(join(ROOT, "src/lib/toets/eval/rubric.ts"));
  const p = R.poort(leesJson(nieuwPad), leesJson(basisPad));
  console.log(p.ok ? "POORT GROEN" : `POORT ROOD: ${p.redenen.join("; ")}`);
  process.exit(p.ok ? 0 : 1);
}

const [cmd, a1, a2] = args;
if (cmd === "genereer" && a1) await genereer(a1);
else if (cmd === "scoor" && a1) await scoor(a1);
else if (cmd === "poort" && a1 && a2) await poortCmd(a1, a2);
else {
  console.log("Gebruik: genereer <case> [--naam N] [--base URL] | scoor <toets.json> --case <case> [--rechter] [--baseline scores.json] | poort <nieuw> <baseline>");
  process.exit(2);
}
