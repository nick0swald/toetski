import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_BRON_BYTES, bestandTeGroot } from "./lees-bron.ts";

describe("bron-bestanden", () => {
  it("wijst bestanden boven 40 MB af", () => {
    const teGroot = { size: MAX_BRON_BYTES + 1 } as File;
    const ok = { size: 1024 } as File;
    assert.equal(bestandTeGroot(teGroot), true);
    assert.equal(bestandTeGroot(ok), false);
  });

  it("laat een lesboek van 16 MB door", () => {
    const boek = { size: 16 * 1024 * 1024 } as File;
    assert.equal(bestandTeGroot(boek), false);
  });
});
