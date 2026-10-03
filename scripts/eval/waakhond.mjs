#!/usr/bin/env node
/**
 * Waakhond rond een eval-run (eval.mjs / met-plaatjes.mjs): voorkomt runs die blijven hangen of doorlopen.
 *
 *   node scripts/eval/waakhond.mjs [--timeout 900] [--stil 180] [--max-usd 2] [--log eval-out/kosten.jsonl] -- node scripts/eval/eval.mjs genereer ...
 *
 * - --timeout s : harde wandkloklimiet; daarna SIGTERM (na 5 s SIGKILL).
 * - --stil s    : geen uitvoer (stdout/stderr) en geen hartslag gedurende s seconden → als hangend afgebroken.
 *                 Het kind mag ook zelf een hartslag geven door het bestand in $WAAKHOND_HARTSLAG aan te raken.
 * - --max-usd   : afbreken zodra de hoogste "$x.xxx" in de uitvoer boven het plafond komt.
 * - per run één regel in het kostenlog (JSONL): start, commando, duur, status, reden, geschatte kosten.
 * - sleutel: het kind krijgt alleen XAI_API_KEY = TOETSKI_XAI_API_KEY; zonder die sleutel wordt XAI_API_KEY verwijderd.
 * Doet zelf geen API-aanroepen.
 */
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export function leesArgs(argv) {
  const i = argv.indexOf("--");
  if (i < 0 || i === argv.length - 1) throw new Error("gebruik: waakhond.mjs [opties] -- <commando ...>");
  const opt = { timeout: 900, stil: 180, maxUsd: Infinity, log: "eval-out/kosten.jsonl" };
  const eigen = argv.slice(0, i);
  for (let j = 0; j < eigen.length; j += 2) {
    const [k, v] = [eigen[j], eigen[j + 1]];
    if (k === "--timeout") opt.timeout = Number(v);
    else if (k === "--stil") opt.stil = Number(v);
    else if (k === "--max-usd") opt.maxUsd = Number(v);
    else if (k === "--log") opt.log = v;
    else throw new Error(`onbekende optie ${k}`);
  }
  return { opt, cmd: argv.slice(i + 1) };
}

/** Hoogste dollarbedrag in een stuk uitvoer (eval-scripts loggen "$0.1234"). */
export function hoogsteUsd(tekst, vorige = 0) {
  let m = vorige;
  for (const x of tekst.matchAll(/\$(\d+(?:\.\d+)?)/g)) m = Math.max(m, Number(x[1]));
  return m;
}

export function kindEnv(env) {
  const e = { ...env };
  if (e.TOETSKI_XAI_API_KEY) e.XAI_API_KEY = e.TOETSKI_XAI_API_KEY;
  else delete e.XAI_API_KEY;
  return e;
}

export function bewaak({ opt, cmd }, { env = process.env, uit = process.stdout, fout = process.stderr, nu = Date.now } = {}) {
  return new Promise((resolve) => {
    const start = nu();
    const hartslag = join(tmpdir(), `waakhond-${process.pid}-${start}.hb`);
    writeFileSync(hartslag, "");
    let laatste = start;
    let usd = 0;
    let reden = null;
    const kind = spawn(cmd[0], cmd.slice(1), { env: { ...kindEnv(env), WAAKHOND_HARTSLAG: hartslag }, stdio: ["ignore", "pipe", "pipe"] });
    const stop = (r) => {
      if (reden) return;
      reden = r;
      fout.write(`\n[waakhond] afgebroken: ${r}\n`);
      kind.kill("SIGTERM");
      setTimeout(() => kind.exitCode === null && kind.kill("SIGKILL"), 5000).unref();
    };
    const zie = (stroom) => (buf) => {
      laatste = nu();
      stroom.write(buf);
      usd = hoogsteUsd(buf.toString(), usd);
      if (usd > opt.maxUsd) stop(`kostenplafond $${opt.maxUsd} overschreden ($${usd})`);
    };
    kind.stdout.on("data", zie(uit));
    kind.stderr.on("data", zie(fout));
    const tik = setInterval(() => {
      try {
        laatste = Math.max(laatste, statSync(hartslag).mtimeMs);
      } catch {
        /* weg = geen hartslag */
      }
      const t = nu();
      if (t - start > opt.timeout * 1000) stop(`timeout na ${opt.timeout} s`);
      else if (t - laatste > opt.stil * 1000) stop(`${opt.stil} s geen uitvoer of hartslag (hangt)`);
    }, Math.min(1000, opt.stil * 250));
    kind.on("close", (code, signaal) => {
      clearInterval(tik);
      const regel = { start: new Date(start).toISOString(), cmd: cmd.join(" "), duurMs: nu() - start, status: reden ? "afgebroken" : code === 0 ? "ok" : "fout", code, signaal, reden, usdGeschat: usd };
      if (opt.log) {
        mkdirSync(dirname(opt.log), { recursive: true });
        appendFileSync(opt.log, JSON.stringify(regel) + "\n");
      }
      resolve(regel);
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await bewaak(leesArgs(process.argv.slice(2)));
  console.error(`[waakhond] ${r.status} · ${(r.duurMs / 1000).toFixed(1)} s · ~$${r.usdGeschat}`);
  process.exit(r.status === "ok" ? 0 : r.status === "afgebroken" ? 124 : r.code || 1);
}
