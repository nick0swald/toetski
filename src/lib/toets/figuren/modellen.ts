/** Modelnamen voor de beeldpijplijn (gecontroleerd tegen docs.x.ai en /v1/models, sept 2026). */

/** Tekstmodel: gelijk aan het bestaande callGrok-model in generate.ts. */
export const TEKST_MODEL = "grok-4.20-0309-non-reasoning";
/** Beeldmodel (Grok Imagine) voor sfeerplaten. */
export const BEELD_MODEL = "grok-imagine-image-2.0";
/** Vision-model voor de go/no-go-keuring (tekst + beeld als input). */
export const VISIE_MODEL = "grok-4.5";

export const XAI_BASE = "https://api.x.ai/v1";

/** Onafhankelijke inhoudscontrole (sleutel, oplosbaarheid, realisme): redenerend model, lage inspanning. */
export const CONTROLE_MODEL = "grok-4.5";
