/** JSON-schema (draft-07) van de vraag-spec; hoort bij de types in spec.ts. spec.schema.json is hiervan een kopie. */
const str = { type: "string", minLength: 1 } as const;
const num = { type: "number" } as const;
const controle = {
  type: "array",
  description: "Alleen metingen van wat IN déze figuur getekend staat. Wat de leerling zelf tekent (pijl, lijn, punten) controleer je in antwoordmodel.figuur.",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["meting"],
    properties: { meting: str, parameter: str, verwacht: num, tolerantie: { type: "number", minimum: 0 } },
    anyOf: [{ required: ["parameter"] }, { required: ["verwacht"] }],
  },
} as const;
const breedte = { type: "number", minimum: 2, maximum: 16 } as const;
const punt = { type: "array", items: num, minItems: 2, maxItems: 2 } as const;

const figuur = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "soort", "eenheid", "waarde", "breedteCm"],
      properties: {
        type: { const: "meter" },
        soort: { enum: ["wijzer", "kwh"] },
        eenheid: str,
        min: num,
        max: num,
        streep: { type: "number", exclusiveMinimum: 0 },
        getalElke: { type: "number", exclusiveMinimum: 0 },
        waarde: num,
        cijfers: { type: "integer", minimum: 4, maximum: 7 },
        decimalen: { type: "integer", minimum: 0, maximum: 2 },
        label: { type: "string" },
        breedteCm: breedte,
        controle,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "cilinders", "max", "streep", "getalElke", "breedteCm"],
      properties: {
        type: { const: "maatcilinder" },
        cilinders: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["niveau"],
            properties: { niveau: { type: "number", minimum: 0 }, label: { type: "string" }, voorwerp: { type: "boolean" } },
          },
        },
        max: { type: "number", exclusiveMinimum: 0 },
        streep: { type: "number", exclusiveMinimum: 0 },
        getalElke: { type: "number", exclusiveMinimum: 0 },
        breedteCm: breedte,
        controle,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "bron", "takken", "breedteCm"],
      properties: {
        type: { const: "schakelschema" },
        bron: {
          type: "object",
          additionalProperties: false,
          required: ["soort"],
          properties: { soort: { enum: ["cel", "wisselbron"] }, label: { type: "string" } },
        },
        takken: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["onderdelen"],
            properties: {
              rood: { type: "boolean" },
              onderdelen: {
                type: "array",
                minItems: 1,
                maxItems: 3,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["soort"],
                  properties: {
                    soort: {
                      enum: ["weerstand", "variabele-weerstand", "lamp", "spanningsmeter", "stroommeter", "motor", "cel", "wisselbron", "schakelaar", "diode", "led", "zekering"],
                    },
                    label: { type: "string" },
                    rood: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
        vrijeRuimte: { type: "boolean" },
        breedteCm: breedte,
        controle,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "x", "y", "reeksen", "breedteCm"],
      properties: {
        type: { const: "grafiek" },
        x: { $ref: "#/definitions/as" },
        y: { $ref: "#/definitions/as" },
        reeksen: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["punten", "vorm"],
            properties: { punten: { type: "array", items: punt, minItems: 1 }, vorm: { enum: ["lijn", "vloeiend", "punten"] }, rood: { type: "boolean" } },
          },
        },
        panelen: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "punten"],
            properties: { label: str, punten: { type: "array", items: punt, minItems: 2 } },
          },
        },
        breedteCm: breedte,
        controle,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "breedteCm", "hoogteCm", "schaalN", "voorwerp", "punt", "pijlen"],
      properties: {
        type: { const: "krachten" },
        breedteCm: breedte,
        hoogteCm: { type: "number", minimum: 2, maximum: 20 },
        schaalN: { type: "number", exclusiveMinimum: 0 },
        voorwerp: { enum: ["bloempot", "boomstam", "krat", "geen"] },
        punt,
        puntLabel: { type: "string" },
        pijlen: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["naam", "grootteN", "hoek"],
            properties: { naam: str, grootteN: { type: "number", exclusiveMinimum: 0 }, hoek: num, label: { type: "string" }, rood: { type: "boolean" } },
          },
        },
        resultante: { type: "object", additionalProperties: false, properties: { label: { type: "string" } } },
        controle,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "hokjesX", "hokjesY", "panelen", "breedteCm"],
      properties: {
        type: { const: "oscilloscoop" },
        hokjesX: { type: "integer", minimum: 4, maximum: 14 },
        hokjesY: { type: "integer", minimum: 4, maximum: 10 },
        panelen: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["amplitude", "trillingstijd"],
            properties: { label: { type: "string" }, amplitude: { type: "number", exclusiveMinimum: 0 }, trillingstijd: { type: "number", exclusiveMinimum: 0 } },
          },
        },
        onderschrift: { type: "string" },
        notitie: { type: "string" },
        breedteCm: breedte,
        controle,
      },
    },
    {
      // Foto/situatieplaatje via de beeldstroom; nooit een meet- of rekenfiguur, dus geen `controle`.
      type: "object",
      additionalProperties: false,
      required: ["type", "stijl", "beschrijving", "reden", "alt", "breedteCm", "hoogteCm"],
      properties: {
        type: { const: "ai-afbeelding" },
        stijl: { enum: ["foto", "illustratie"] },
        beschrijving: { type: "string", minLength: 10 },
        reden: { type: "string", minLength: 10 },
        alt: str,
        labels: { type: "array", items: str, maxItems: 6 },
        breedteCm: breedte,
        hoogteCm: { type: "number", minimum: 2, maximum: 12 },
      },
    },
  ],
} as const;

const parameters = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["naam", "waarde", "bron"],
    properties: { naam: { type: "string", pattern: "^[A-Za-z_][A-Za-z0-9_]*$" }, waarde: num, eenheid: { type: "string" }, bron: { enum: ["tekst", "figuur", "binas"] }, weergave: { type: "string" } },
  },
} as const;

const vraagVelden = {
  id: { type: "string", pattern: "^[a-z0-9-]+$" },
  vraagtype: {
    type: "object",
    additionalProperties: false,
    required: ["nr", "code", "naam"],
    properties: { nr: { type: "integer", minimum: 1, maximum: 63 }, code: str, naam: str, cse: { type: "array", items: { type: "integer", minimum: 0 }, minItems: 3, maxItems: 3 } },
  },
  ookIn: { type: "string" },
  titel: str,
  niveau: { enum: ["BB/KB/GT", "vooral KB/GT", "vooral GT"] },
  punten: { type: "integer", minimum: 1, maximum: 6 },
  context: { type: "array", items: str },
  tabel: { type: "array", items: { type: "array", items: { type: "string" }, minItems: 2 }, minItems: 2 },
  figuur: { $ref: "#/definitions/figuur" },
  stam: str,
  opties: { type: "array", items: str, minItems: 2, maxItems: 5 },
  antwoordregels: { type: "integer", minimum: 0, maximum: 12 },
  antwoordmodel: {
    type: "object",
    additionalProperties: false,
    required: ["regels"],
    properties: {
      juist: { enum: ["A", "B", "C", "D", "E"] },
      regels: { type: "array", items: str },
      figuur: { $ref: "#/definitions/figuur", description: "Antwoordfiguur: dezelfde figuur mét in rood wat de leerling tekent, met controle daarop. Verplicht bij een tekenvraag." },
      verbergLeerlingFiguur: { type: "boolean" },
      opmerking: { type: "string" },
    },
  },
  scorestappen: {
    type: "array",
    items: { type: "object", additionalProperties: false, required: ["omschrijving", "punten"], properties: { omschrijving: str, punten: { type: "integer", minimum: 1 } } },
  },
  rtti: { enum: ["R", "T1", "T2", "I"] },
  leerdoel: { type: "string" },
  examendoel: { type: "string" },
  begrip: { type: "string" },
  tekenvraag: { type: "boolean", description: "true als de leerling iets in de figuur tekent; dan is antwoordmodel.figuur verplicht en staan de controles daar." },
  parameters: { $ref: "#/definitions/parameters" },
  berekeningen: {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      required: ["naam", "formule", "waarde"],
      properties: { naam: { type: "string", pattern: "^[A-Za-z_][A-Za-z0-9_]*$" }, formule: str, waarde: num, eenheid: { type: "string" }, afgerond: { type: "string" }, tolerantie: { type: "number", minimum: 0 } },
    },
  },
} as const;
const se = { enum: ["SE4.1", "SE4.2", "SE4.3", "SE4.4", "ALG"] } as const;
/** Tekenvraag → antwoordfiguur verplicht (lokaal afgedwongen met ajv; voor xAI weggelaten, de keuring doet het ook). */
const tekenAntwoord = {
  if: { required: ["tekenvraag"], properties: { tekenvraag: { const: true } } },
  then: { properties: { antwoordmodel: { required: ["regels", "figuur"] } } },
} as const;
const basisVereist = ["id", "vraagtype", "niveau", "punten", "stam", "antwoordmodel", "scorestappen", "rtti"];

export const SPEC_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://toetski.nl/schema/vraag-spec-v1.json",
  title: "Toetski vraag-spec (stap 0)",
  definitions: {
    as: {
      type: "object",
      additionalProperties: false,
      required: ["label", "min", "max", "stap"],
      properties: { label: { type: "string" }, min: num, max: num, stap: { type: "number", exclusiveMinimum: 0 }, fijn: { type: "number", exclusiveMinimum: 0 }, zonderGetallen: { type: "boolean" } },
    },
    figuur,
    parameters,
    vraag: {
      type: "object",
      additionalProperties: false,
      required: ["soort", ...basisVereist, "se", "hoofdstuk", "context"],
      properties: { soort: { const: "vraag" }, se, hoofdstuk: str, ...vraagVelden },
      ...tekenAntwoord,
    },
    deelvraag: {
      type: "object",
      additionalProperties: false,
      required: basisVereist,
      properties: { ...vraagVelden },
      ...tekenAntwoord,
    },
    vraagstuk: {
      type: "object",
      additionalProperties: false,
      required: ["id", "soort", "titel", "se", "hoofdstuk", "context", "deelvragen"],
      properties: {
        id: { type: "string", pattern: "^[a-z0-9-]+$" },
        soort: { const: "vraagstuk" },
        titel: str,
        se,
        hoofdstuk: str,
        context: { type: "array", items: str },
        figuur: { $ref: "#/definitions/figuur" },
        parameters: { $ref: "#/definitions/parameters" },
        deelvragen: { type: "array", minItems: 2, maxItems: 5, items: { $ref: "#/definitions/deelvraag" } },
      },
    },
  },
  oneOf: [{ $ref: "#/definitions/vraag" }, { $ref: "#/definitions/vraagstuk" }],
} as const;

export const TOETS_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "Toetski toets-spec (stap 0)",
  type: "object",
  additionalProperties: false,
  required: ["titel", "vragen"],
  properties: {
    titel: str,
    ondertitel: { type: "string" },
    vragen: { type: "array", items: str, minItems: 1, uniqueItems: true },
    delen: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "object", additionalProperties: false, required: ["naam", "vragen"], properties: { naam: str, vragen: { type: "array", items: str, minItems: 1 } } },
    },
    nTerm: { type: "number", minimum: 0, maximum: 3 },
    minuten: { type: "integer", minimum: 10, maximum: 240 },
    klas: { type: "object", additionalProperties: false, required: ["leerjaar", "leerweg"], properties: { leerjaar: { type: "integer", minimum: 1, maximum: 6 }, leerweg: str } },
    voorblad: {
      type: "object",
      additionalProperties: false,
      properties: {
        kop: { type: "string" },
        leerweg: { type: "string" },
        schooljaar: { type: "string" },
        seCode: { type: "string" },
        toetscode: { type: "string" },
        vak: { type: "string" },
        hulpmiddelen: { type: "array", items: str },
        uitwerkbijlage: { type: "boolean" },
        voetcode: { type: "string" },
        schoolveld: { type: "string" },
        cesuur: { type: "boolean" },
      },
    },
  },
} as const;
