/**
 * Modelnamen voor de beeldpijplijn: doorgegeven uit config.ts (enige bron, bewaakt door config.test.ts).
 * Niet hier aanpassen: wijzig MODELLEN in src/lib/toets/config.ts.
 */
import { MODELLEN, XAI_BASE as BASE } from "../config.ts";

/** Figuurplanner / figuur-JSON: snel, niet-redenerend model. */
export const TEKST_MODEL = MODELLEN.snel;
/** Beeldmodel (Grok Imagine) voor sfeerplaten. */
export const BEELD_MODEL = MODELLEN.beeld;
/** Vision-model voor de go/no-go-keuring (tekst + beeld als input). */
export const VISIE_MODEL = MODELLEN.visie;
/** Onafhankelijke inhoudscontrole. */
export const CONTROLE_MODEL = MODELLEN.controle;

export const XAI_BASE = BASE;
