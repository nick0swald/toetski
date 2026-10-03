/** Fixtures en voorbeeldtoets inlezen (Node; voor tests en het renderscript). */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Fixture, ToetsSpec } from "./spec.ts";

export const STAP0_DIR = dirname(fileURLToPath(import.meta.url));

export function laadFixtures(dir = join(STAP0_DIR, "fixtures")): Fixture[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Fixture);
}

export function laadVoorbeeldtoets(): ToetsSpec {
  return JSON.parse(readFileSync(join(STAP0_DIR, "voorbeeldtoets.json"), "utf8")) as ToetsSpec;
}
