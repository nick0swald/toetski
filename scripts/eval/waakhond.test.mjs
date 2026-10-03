import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { test } from "node:test";
import { bewaak, hoogsteUsd, kindEnv, leesArgs } from "./waakhond.mjs";

const stil = () => new Writable({ write: (_c, _e, cb) => cb() });
const log = () => join(mkdtempSync(join(tmpdir(), "wh-")), "kosten.jsonl");

test("argumenten en sleutelbeleid", () => {
  const { opt, cmd } = leesArgs(["--timeout", "5", "--stil", "2", "--", "node", "x.mjs"]);
  assert.equal(opt.timeout, 5);
  assert.equal(opt.stil, 2);
  assert.deepEqual(cmd, ["node", "x.mjs"]);
  assert.throws(() => leesArgs(["--timeout", "5"]));
  assert.equal(kindEnv({ XAI_API_KEY: "ander" }).XAI_API_KEY, undefined);
  assert.equal(kindEnv({ XAI_API_KEY: "ander", TOETSKI_XAI_API_KEY: "t" }).XAI_API_KEY, "t");
  assert.equal(hoogsteUsd("plan 3 s · $0.0123 … totaal $0.25"), 0.25);
});

test("hangend kind wordt na --stil afgebroken en gelogd", async () => {
  const l = log();
  const r = await bewaak({ opt: { timeout: 30, stil: 1, maxUsd: Infinity, log: l }, cmd: [process.execPath, "-e", "console.log('start $0.01'); setInterval(() => {}, 1000)"] }, { uit: stil(), fout: stil() });
  assert.equal(r.status, "afgebroken");
  assert.match(r.reden, /hangt/);
  assert.equal(JSON.parse(readFileSync(l, "utf8").trim()).usdGeschat, 0.01);
});

test("timeout ondanks uitvoer, en kostenplafond", async () => {
  const r = await bewaak({ opt: { timeout: 1.5, stil: 10, maxUsd: Infinity, log: log() }, cmd: [process.execPath, "-e", "setInterval(() => console.log('bezig'), 100)"] }, { uit: stil(), fout: stil() });
  assert.match(r.reden, /timeout/);
  const k = await bewaak({ opt: { timeout: 10, stil: 10, maxUsd: 0.5, log: log() }, cmd: [process.execPath, "-e", "console.log('$0.7'); setInterval(() => {}, 1000)"] }, { uit: stil(), fout: stil() });
  assert.match(k.reden, /kostenplafond/);
});

test("normaal einde: ok, en het kind ziet alleen de Toetski-sleutel", async () => {
  let uit = "";
  const w = new Writable({ write: (c, _e, cb) => ((uit += c), cb()) });
  const r = await bewaak({ opt: { timeout: 10, stil: 5, maxUsd: Infinity, log: log() }, cmd: [process.execPath, "-e", "console.log(String(process.env.XAI_API_KEY))"] }, { env: { ...process.env, XAI_API_KEY: "geheim-ander" , TOETSKI_XAI_API_KEY: "" }, uit: w, fout: stil() });
  assert.equal(r.status, "ok");
  assert.equal(uit.trim(), "undefined");
});
